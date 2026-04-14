//backend/src/services/assemblyai.service.ts

import { AssemblyAI } from 'assemblyai';
import { logger } from '../utils/logger.js';
import type { TranscriptResult } from '../types/index.js';
import * as fs from 'fs';
import https from 'https';
import { getDatabaseService } from './database.service.js';
import { preprocessAudio } from './audio-preprocessor.service.js';


class AssemblyAIService {
 private client: AssemblyAI;

 constructor() {
 const apiKey = process.env.ASSEMBLYAI_API_KEY;
 if (!apiKey) {
 throw new Error('ASSEMBLYAI_API_KEY is not configured');
 }
 
 this.client = new AssemblyAI({ 
 apiKey
 });
 }

 async transcribe(audioPath: string): Promise<TranscriptResult> {
 try {
 logger.info('[ASSEMBLYAI] Iniciando transcripcion de audio', { audioPath });

 // Verificar que el archivo existe
 if (!fs.existsSync(audioPath)) {
 throw new Error(`Audio file not found: ${audioPath}`);
 }

 // Preprocesar audio si está habilitado (normalización, filtros de ruido)
 const effectiveAudioPath = await preprocessAudio(audioPath);
 const didPreprocess = effectiveAudioPath !== audioPath;

 const stats = fs.statSync(effectiveAudioPath);
 const fileSizeMB = (stats.size / 1024 / 1024).toFixed(2);
 logger.info('[ASSEMBLYAI] Archivo de audio en disco', {
 tamano: fileSizeMB + ' MB',
 ruta: effectiveAudioPath,
 preprocesado: didPreprocess,
 });

 // Leer archivo de audio
 const audioData = fs.readFileSync(effectiveAudioPath);

 logger.info('[ASSEMBLYAI] Subiendo audio a AssemblyAI...');

 // Subir archivo con reintentos
 let uploadUrl: string;
 let retries = 3;
 
 while (retries > 0) {
 try {
 uploadUrl = await this.uploadWithTimeout(audioData);
 break;
 } catch (error: any) {
 retries--;
 if (retries === 0) throw error;
 
 logger.warn(` Upload failed, retrying... (${retries} attempts left)`, {
 error: error.message
 });
 
 // Esperar antes de reintentar (backoff exponencial)
 await new Promise(resolve => setTimeout(resolve, 5000 * (4 - retries)));
 }
 }
 
 logger.info('[ASSEMBLYAI] Audio subido exitosamente, iniciando transcripcion...');

 // ============ CARGAR VOCABULARIO DESDE BD ============
 const dbTerms = await getDatabaseService().getWordBoostTerms();
 const wordBoostList = dbTerms.filter((t: any) => t.is_active !== false).map((t: any) => t.term);
 logger.info(`[ASSEMBLYAI] Vocabulario cargado desde BD: ${wordBoostList.length} términos`);

 // ===============================================
 // CONFIGURACIÓN MEJORADA DE TRANSCRIPCIÓN
 // ===============================================
 const transcript = await this.client.transcripts.transcribe({
 audio: uploadUrl!,

 // ============ IDIOMA Y PRECISIÓN ============
 language_code: 'es', // Español

 // ============ MEJORAS DE CALIDAD ============
 speaker_labels: true, // Identificar speakers (A, B, C...)
 speakers_expected: 2, // Llamada típica: agente + cliente
 punctuate: true, // Agregar puntuación automática
 format_text: false, // NO formatear - mantener texto RAW completo

 // ============ CAPTURAR TODO EL CONTENIDO ============
 disfluencies: false, // NO capturar "eh", "um" para texto más limpio

 // ============ MODELO Y PRECISIÓN ============
 speech_model: 'best', // Usar el mejor modelo disponible (más preciso)

 // ============ VOCABULARIO PERSONALIZADO (cargado desde BD) ============
 word_boost: wordBoostList,
 boost_param: 'high', // Alta prioridad para las palabras del vocabulario

 // ============ CORRECCIÓN ORTOGRÁFICA DETERMINISTA (es_MX) ============
 // Corrige errores fonéticos frecuentes en español mexicano a nivel ASR,
 // antes de que el texto llegue a la post-corrección de OpenAI.
 custom_spelling: [
 { from: ['bradescar', 'brascar', 'prascar', 'bascar', 'bradiscard', 'la card'], to: 'Bradescard' },
 { from: ['folió', 'follo', 'foulio', 'fólio'], to: 'folio' },
 { from: ['contracaro', 'contra cargo'], to: 'contracargo' },
 { from: ['aclarasión', 'aclarasion'], to: 'aclaración' },
 { from: ['o te pe', 'ó te pe'], to: 'OTP' },
 { from: ['nip'], to: 'NIP' },
 { from: ['tarjeta de creto', 'tarjeta creto'], to: 'tarjeta de crédito' },
 ]
 });

 logger.info('[ASSEMBLYAI] Job de transcripcion creado, esperando resultado...', {
 transcriptId: transcript.id,
 tiempoEstimado: '30-120 segundos segun duracion del audio'
 });

 // ===============================================
 // POLLING CON MEJOR LOGGING
 // ===============================================
 let result = transcript;
 let pollCount = 0;
 const maxPolls = 240; // ~12 minutos máximo
 const startTime = Date.now();
 
 while (result.status !== 'completed' && result.status !== 'error') {
 if (pollCount >= maxPolls) {
 throw new Error('Transcription timeout: exceeded maximum wait time');
 }
 
 await new Promise(resolve => setTimeout(resolve, 3000));
 result = await this.client.transcripts.get(result.id);
 pollCount++;
 
 // Logging mejorado cada 9 segundos
 if (pollCount % 3 === 0) {
 const elapsed = pollCount * 3;
 const progress = Math.min(elapsed / 120 * 100, 95).toFixed(0);
 logger.info(`[ASSEMBLYAI] Transcripcion en proceso... ${elapsed}s transcurridos`, {
 status: result.status,
 progreso: progress + '%',
 tamanoAudio: fileSizeMB + ' MB'
 });
 }
 }

 // Verificar errores
 if (result.status === 'error') {
 logger.error('[ASSEMBLYAI] Transcripcion fallida', { error: result.error });
 throw new Error(`Transcription failed: ${result.error}`);
 }

 const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);

 // ===============================================
 // VERIFICACIÓN DE CALIDAD
 // ===============================================
 const textLength = result.text?.length || 0;
 const wordCount = result.words?.length || 0;
 const utteranceCount = result.utterances?.length || 0;
 
 // ===============================================
 // FALLBACK A WHISPER SI CONFIANZA ES BAJA
 // ===============================================
 const confidenceThreshold = parseFloat(process.env.ASR_CONFIDENCE_THRESHOLD ?? '0.75');
 const enableWhisperFallback = process.env.ENABLE_WHISPER_FALLBACK !== 'false';

 if (
 enableWhisperFallback &&
 result.confidence !== null &&
 result.confidence !== undefined &&
 result.confidence < confidenceThreshold
 ) {
 logger.warn('[ASSEMBLYAI] Confianza baja — activando fallback con Whisper (gpt-4o-transcribe)', {
 confianza: (result.confidence * 100).toFixed(1) + '%',
 umbral: (confidenceThreshold * 100).toFixed(0) + '%',
 });
 const { getWhisperService } = await import('./whisper.service.js');
 return getWhisperService().transcribe(audioPath);
 }

 // Advertencia si el texto es muy corto
 if (textLength < 100) {
 logger.warn('[ASSEMBLYAI] Transcripcion completada pero el texto es muy corto', {
 longitudTexto: textLength,
 palabras: wordCount,
 utterances: utteranceCount,
 posibleCausa: 'El audio puede estar en silencio, dañado o sin voz'
 });
 }

 logger.success('[ASSEMBLYAI] Transcripcion completada exitosamente', {
 duracionAudio: result.audio_duration + 's',
 tiempoProcesamiento: totalTime + 's',
 palabras: wordCount,
 utterances: utteranceCount,
 longitudTexto: textLength,
 confianza: result.confidence ? (result.confidence * 100).toFixed(1) + '%' : 'N/A'
 });

 // Formatear resultado
 const utterances = result.utterances?.map(u => ({
 speaker: u.speaker,
 text: u.text,
 start: u.start, // En milisegundos
 end: u.end // En milisegundos
 })) || [];

 // Log de muestra del contenido
 if (utterances.length > 0) {
 logger.info('[ASSEMBLYAI] Muestra de transcripcion (primeros 3 utterances)', {
 muestras: utterances.slice(0, 3).map(u => ({
 speaker: u.speaker,
 texto: u.text.substring(0, 100) + (u.text.length > 100 ? '...' : ''),
 timestamp: (u.start / 1000).toFixed(1) + 's'
 }))
 });
 } else {
 logger.warn('[ASSEMBLYAI] No se encontraron utterances en la transcripcion');
 }

 // Advertencia si no hay suficientes utterances
 if (utteranceCount < 5 && result.audio_duration && result.audio_duration > 60) {
 logger.warn('[ASSEMBLYAI] Pocos utterances para la duracion del audio', {
 utterances: utteranceCount,
 duracionAudio: result.audio_duration + 's',
 sugerencia: 'El audio puede tener muchos silencios o poca actividad de voz'
 });
 }

 // Limpiar archivo preprocesado temporal si fue generado
 if (didPreprocess && fs.existsSync(effectiveAudioPath)) {
 fs.unlinkSync(effectiveAudioPath);
 }

 return {
 text: result.text || '',
 utterances,
 duration: result.audio_duration ?? undefined,
 words: utterances, // Mismo contenido que utterances
 audio_duration: result.audio_duration ?? undefined,
 confidence: result.confidence ?? undefined
 };

 } catch (error: any) {
 logger.error('[ASSEMBLYAI] Error en transcripcion', {
 error: error.message,
 stack: error.stack
 });
 throw error;
 }
 }

 /**
 * Método auxiliar para subir audio con timeout personalizado
 */
 private async uploadWithTimeout(audioData: Buffer): Promise<string> {
 const apiKey = process.env.ASSEMBLYAI_API_KEY!;
 
 return new Promise((resolve, reject) => {
 const options = {
 hostname: 'api.assemblyai.com',
 path: '/v2/upload',
 method: 'POST',
 headers: {
 'Authorization': apiKey,
 'Content-Type': 'application/octet-stream',
 'Content-Length': audioData.length
 },
 timeout: 300000 // 5 minutos
 };

 const req = https.request(options, (res) => {
 let data = '';

 res.on('data', (chunk) => {
 data += chunk;
 });

 res.on('end', () => {
 if (res.statusCode === 200) {
 try {
 const json = JSON.parse(data);
 resolve(json.upload_url);
 } catch (e) {
 reject(new Error('Failed to parse upload response'));
 }
 } else {
 reject(new Error(`Upload failed with status ${res.statusCode}: ${data}`));
 }
 });
 });

 req.on('error', (error) => {
 reject(error);
 });

 req.on('timeout', () => {
 req.destroy();
 reject(new Error('Upload request timeout'));
 });

 // Enviar datos
 req.write(audioData);
 req.end();
 });
 }
}

// Exportaciones
let instance: AssemblyAIService | null = null;

export const getAssemblyAIService = () => {
 if (!instance) {
 instance = new AssemblyAIService();
 }
 return instance;
};

export const assemblyAIService = {
 transcribe: async (audioPath: string) => {
 return getAssemblyAIService().transcribe(audioPath);
 }
};

export { AssemblyAIService };