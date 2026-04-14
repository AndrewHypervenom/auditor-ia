// backend/src/services/audio-preprocessor.service.ts
// Preprocesamiento de audio con ffmpeg para mejorar la calidad de transcripción ASR.
// Solo se ejecuta si ENABLE_AUDIO_PREPROCESSING=true en las variables de entorno.
// Requiere que ffmpeg esté instalado en el sistema (ver render.yaml).

import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { logger } from '../utils/logger.js';

/**
 * Preprocesa un archivo de audio para optimizarlo para ASR en llamadas de call center.
 * Retorna la ruta del archivo procesado (o la original si el preprocesamiento está desactivado).
 * El llamador es responsable de eliminar el archivo procesado si difiere del original.
 */
export async function preprocessAudio(inputPath: string): Promise<string> {
  if (process.env.ENABLE_AUDIO_PREPROCESSING !== 'true') {
    return inputPath;
  }

  const ext = path.extname(inputPath);
  const outputPath = inputPath.replace(ext, '_processed.wav');

  logger.info('[AUDIO-PREPROCESS] Normalizando audio para mejora ASR', { inputPath });

  try {
    await runFfmpeg([
      '-i', inputPath,
      '-ar', '16000',         // 16kHz — óptimo para modelos ASR (AssemblyAI, Whisper)
      '-ac', '1',              // Mono — mezcla canales estéreo
      '-af', [
        'highpass=f=100',      // Elimina zumbido eléctrico 50/60Hz y ruido de manejo
        'lowpass=f=8000',      // Elimina ruido >8kHz (telefonía solo llega a ~7kHz)
        'loudnorm=I=-16:TP=-1.5:LRA=11', // Normalización EBU R128: iguala volumen agente/cliente
        'agate=threshold=0.01:ratio=2'   // Noise gate suave para silencios con ruido de fondo
      ].join(','),
      '-c:a', 'pcm_s16le',    // PCM 16-bit sin compresión (mejor calidad para ASR)
      '-y',                    // Sobreescribir si existe
      outputPath,
    ]);

    const inputMB = (fs.statSync(inputPath).size / 1024 / 1024).toFixed(2);
    const outputMB = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);

    logger.info('[AUDIO-PREPROCESS] Preprocesamiento completado', {
      entradaMB: inputMB + ' MB',
      salidaMB: outputMB + ' MB',
      salidaRuta: outputPath,
    });

    return outputPath;
  } catch (error: any) {
    // Si ffmpeg falla (no instalado, archivo corrupto, etc.), continuar con el original
    logger.warn('[AUDIO-PREPROCESS] Error en preprocesamiento, usando audio original', {
      error: error.message,
    });
    return inputPath;
  }
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args);
    let stderr = '';

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code: number) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg terminó con código ${code}: ${stderr.slice(-500)}`));
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`No se pudo iniciar ffmpeg (¿está instalado?): ${err.message}`));
    });
  });
}
