// backend/src/services/whisper.service.ts
// Servicio de transcripción con OpenAI gpt-4o-transcribe.
// Se usa como fallback cuando AssemblyAI reporta confianza baja en el audio.

import OpenAI from 'openai';
import { createReadStream } from 'fs';
import { logger } from '../utils/logger.js';
import type { TranscriptResult } from '../types/index.js';
import { getDatabaseService } from './database.service.js';

class WhisperService {
  private client: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    this.client = new OpenAI({ apiKey });
  }

  async transcribe(audioPath: string): Promise<TranscriptResult> {
    logger.info('[WHISPER] Iniciando transcripción fallback con gpt-4o-transcribe', { audioPath });

    // Cargar vocabulario de la BD como pista de contexto para el modelo
    const dbTerms = await getDatabaseService().getWordBoostTerms();
    const vocabHint = dbTerms
      .filter((t: any) => t.is_active !== false)
      .slice(0, 60) // Límite aprox. 224 tokens del prompt de Whisper
      .map((t: any) => t.term)
      .join(', ');

    const contextPrompt = `Transcripción de llamada de call center bancario en español mexicano para Bradescard México. Términos frecuentes: ${vocabHint}`;

    const model = process.env.WHISPER_MODEL ?? 'gpt-4o-transcribe';

    const response = await this.client.audio.transcriptions.create({
      file: createReadStream(audioPath),
      model,
      language: 'es',
      response_format: 'verbose_json',
      prompt: contextPrompt,
      // @ts-ignore — temperature está soportado pero puede no aparecer en todos los tipos del SDK
      temperature: 0,
    });

    const duration: number | undefined = (response as any).duration;
    const segments: any[] = (response as any).segments ?? [];

    logger.info('[WHISPER] Transcripción completada', {
      modelo: model,
      duracion: duration ? duration + 's' : 'N/A',
      segmentos: segments.length,
    });

    // Whisper no hace diarización de hablantes.
    // Todos los utterances se asignan a speaker 'A'.
    // El evaluador downstream debe manejar el caso de speaker único.
    const utterances = segments.map((seg: any) => ({
      speaker: 'A',
      text: seg.text.trim(),
      start: Math.round(seg.start * 1000), // segundos → milisegundos
      end: Math.round(seg.end * 1000),
    }));

    if (utterances.length === 0 && response.text) {
      // Si no hay segmentos, crear un único utterance con todo el texto
      utterances.push({
        speaker: 'A',
        text: response.text.trim(),
        start: 0,
        end: duration ? Math.round(duration * 1000) : 0,
      });
    }

    logger.info('[WHISPER] Muestra de transcripción (primeros 3 segmentos)', {
      muestras: utterances.slice(0, 3).map(u => ({
        texto: u.text.substring(0, 100) + (u.text.length > 100 ? '...' : ''),
        timestamp: (u.start / 1000).toFixed(1) + 's',
      })),
    });

    return {
      text: response.text,
      utterances,
      duration,
      words: utterances,
      audio_duration: duration,
      confidence: undefined, // gpt-4o-transcribe no retorna score de confianza global
    };
  }
}

let instance: WhisperService | null = null;

export const getWhisperService = () => {
  if (!instance) {
    instance = new WhisperService();
  }
  return instance;
};
