//backend/src/services/claude.service.ts

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import type { ImageAnalysis, SentimentResult, TranscriptWord } from '../types/index.js';
import * as fs from 'fs';
import { getDatabaseService } from './database.service.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5';

class ClaudeService {
 private client: Anthropic;

 constructor() {
 const apiKey = process.env.ANTHROPIC_API_KEY;
 if (!apiKey) {
 throw new Error('ANTHROPIC_API_KEY is not configured');
 }
 this.client = new Anthropic({ apiKey });
 }

 /** Extrae el texto concatenado de los bloques de texto de una respuesta de Claude. */
 private extractText(message: Anthropic.Message): string {
 return message.content
 .filter((b): b is Anthropic.TextBlock => b.type === 'text')
 .map(b => b.text)
 .join('');
 }

 async analyzeImage(imagePath: string): Promise<ImageAnalysis & { usage?: { input_tokens: number; output_tokens: number } }> {
 try {
 logger.info('Analyzing image with ENHANCED detection', { imagePath });

 const imageBuffer = fs.readFileSync(imagePath);
 const imageBase64 = imageBuffer.toString('base64');
 const ext = imagePath.split('.').pop()?.toLowerCase();
 const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

 const response = await this.client.messages.create({
 model: CLAUDE_MODEL,
 max_tokens: 4096,
 thinking: { type: 'disabled' },
 messages: [
 {
 role: 'user',
 content: [
 {
 type: 'image',
 source: {
 type: 'base64',
 media_type: mimeType as 'image/png' | 'image/jpeg',
 data: imageBase64
 }
 },
 {
 type: 'text',
 text: await this.getEnhancedImageAnalysisPrompt()
 }
 ]
 }
 ]
 });

 const content = this.extractText(response);
 if (!content) {
 throw new Error('No response from Claude');
 }

 // Limpieza robusta del JSON
 let cleanedContent = content.trim();
 cleanedContent = cleanedContent.replace(/```json\n?/gi, '');
 cleanedContent = cleanedContent.replace(/```\n?/g, '');
 cleanedContent = cleanedContent.replace(/^﻿/, '');
 cleanedContent = cleanedContent.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

 const parsed = JSON.parse(cleanedContent);

 logger.success('Image analyzed with enhanced detection', {
 system: parsed.system,
 confidence: parsed.confidence,
 criticalFieldsFound: Object.keys(parsed.critical_fields || {}).length,
 totalFieldsFound: Object.keys(parsed.data || {}).length,
 inputTokens: response.usage?.input_tokens || 0,
 outputTokens: response.usage?.output_tokens || 0
 });

 return {
 imagePath,
 system: parsed.system,
 data: {
 ...parsed.data,
 critical_fields: parsed.critical_fields
 },
 confidence: parsed.confidence,
 usage: {
 input_tokens: response.usage?.input_tokens || 0,
 output_tokens: response.usage?.output_tokens || 0
 }
 };

 } catch (error) {
 logger.error('Error analyzing image', error);
 throw error;
 }
 }

 private async getEnhancedImageAnalysisPrompt(): Promise<string> {
   return await getDatabaseService().getPromptByKey('image_analysis') ?? '';
 }


 async analyzeMultipleImages(imagePaths: string[]): Promise<Array<ImageAnalysis & { usage?: { input_tokens: number; output_tokens: number } }>> {
 const analyses: Array<ImageAnalysis & { usage?: { input_tokens: number; output_tokens: number } }> = [];
 let lastError: any = null;

 for (const imagePath of imagePaths) {
 try {
 const analysis = await this.analyzeImage(imagePath);
 analyses.push(analysis);
 } catch (error: any) {
 lastError = error;
 logger.error(`[IMAGENES] Failed to analyze ${imagePath}`, {
 message: error.message,
 code: error.code,
 status: error.status,
 type: error.type,
 errorBody: error.error
 });
 }
 }

 if (analyses.length === 0 && imagePaths.length > 0 && lastError) {
 lastError.message = `[IMAGENES] Todas las imagenes fallaron. Ultimo error: ${lastError.message}`;
 throw lastError;
 }

 return analyses;
 }

 /**
 * Corrige errores obvios de reconocimiento de voz en transcripciones bancarias
 */
 async correctTranscription(text: string): Promise<string> {
 if (!text || text.length < 10) return text;

 try {
 logger.info('[CLAUDE] Iniciando post-corrección de transcripción', { longitud: text.length });

 const systemContent = await getDatabaseService().getPromptByKey('transcription_correction') ?? '';

 const response = await this.client.messages.create({
 model: CLAUDE_MODEL,
 max_tokens: 16000,
 thinking: { type: 'disabled' },
 system: systemContent,
 messages: [
 {
 role: 'user',
 content: text
 }
 ]
 });

 const corrected = this.extractText(response).trim();
 const tokens = (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0);

 logger.info('[CLAUDE] Post-corrección completada', { tokens, cambios: corrected !== text });

 return corrected || text;
 } catch (error: any) {
 logger.warn('[CLAUDE] Post-corrección falló, usando texto original', { error: error.message });
 return text;
 }
 }

 /**
 * Análisis de sentimientos por frase para idiomas no soportados por
 * AssemblyAI Sentiment Analysis (que solo cubre inglés). Devuelve el mismo
 * formato que sentiment_analysis_results de AssemblyAI.
 */
 async analyzeSentiment(utterances: TranscriptWord[]): Promise<{
 results: SentimentResult[];
 usage: { inputTokens: number; outputTokens: number };
 }> {
 const emptyUsage = { inputTokens: 0, outputTokens: 0 };
 if (!utterances || utterances.length === 0) {
 return { results: [], usage: emptyUsage };
 }

 // Limitar a 400 utterances para mantener el prompt acotado
 const items = utterances.slice(0, 400);

 try {
 logger.info('[CLAUDE] Iniciando análisis de sentimientos', { frases: items.length });

 const numberedList = items
 .map((u, i) => `${i}|${u.speaker}|${u.text}`)
 .join('\n');

 const response = await this.client.messages.create({
 model: CLAUDE_MODEL,
 max_tokens: 8192,
 thinking: { type: 'disabled' },
 system: `Eres un analista de sentimientos para llamadas de call center bancario en español/portugués.
Recibirás frases de una llamada en formato "indice|hablante|texto" (una por línea).
Clasifica el sentimiento de CADA frase desde la perspectiva emocional del hablante:
- POSITIVE: amabilidad, satisfacción, agradecimiento, acuerdo, alivio
- NEGATIVE: molestia, frustración, queja, preocupación, rechazo, urgencia ansiosa
- NEUTRAL: información factual, preguntas operativas, protocolo estándar

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{"sentiments": [{"i": 0, "s": "NEUTRAL", "c": 0.95}, ...]}
donde "i" es el índice, "s" el sentimiento y "c" la confianza (0-1).
Incluye TODOS los índices, en orden.`,
 messages: [
 { role: 'user', content: numberedList }
 ]
 });

 let raw = this.extractText(response).trim();
 // Limpieza defensiva de fences por si el modelo los añade
 raw = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
 const parsed = JSON.parse(raw || '{}');
 const sentiments: Array<{ i: number; s: string; c: number }> = parsed.sentiments || [];

 const validSentiments = new Set(['POSITIVE', 'NEUTRAL', 'NEGATIVE']);
 const byIndex = new Map<number, { s: string; c: number }>();
 for (const s of sentiments) {
 if (typeof s.i === 'number' && validSentiments.has(s.s)) {
 byIndex.set(s.i, { s: s.s, c: typeof s.c === 'number' ? s.c : 0.5 });
 }
 }

 const results: SentimentResult[] = items.map((u, i) => {
 const match = byIndex.get(i);
 return {
 text: u.text,
 sentiment: (match?.s ?? 'NEUTRAL') as SentimentResult['sentiment'],
 confidence: match?.c ?? 0.5,
 speaker: u.speaker ?? null,
 start: u.start,
 end: u.end
 };
 });

 const usage = {
 inputTokens: response.usage?.input_tokens ?? 0,
 outputTokens: response.usage?.output_tokens ?? 0
 };

 logger.success('[CLAUDE] Análisis de sentimientos completado', {
 frases: results.length,
 positivas: results.filter(r => r.sentiment === 'POSITIVE').length,
 negativas: results.filter(r => r.sentiment === 'NEGATIVE').length,
 tokens: (usage.inputTokens + usage.outputTokens)
 });

 return { results, usage };
 } catch (error: any) {
 logger.warn('[CLAUDE] Análisis de sentimientos falló, continuando sin sentimientos', {
 error: error.message
 });
 return { results: [], usage: emptyUsage };
 }
 }

 async generateCriteriaBlocks(description: string, callType: string, mode: string, availableSystems: string[]): Promise<{ blocks: Array<{ block_name: string; criteria: Array<{ topic: string; points: number | null; criticality: string; what_to_look_for: string; validation_source: string[]; applies: boolean }> }> }> {
 const systemsStr = availableSystems.length > 0 ? availableSystems.join(', ') : 'FALCON, VCAS, VISION, VRM, GPF';
 const systemPrompt = `Eres un experto en calidad de call centers bancarios en México, especializado en crear rúbricas de evaluación para auditorías de llamadas.

Genera criterios de evaluación para auditar llamadas de tipo "${callType}" en modo "${mode}".
El usuario describe lo que quiere evaluar: "${description}"

Sistemas de imagen disponibles: ${systemsStr}

Genera de 3 a 6 bloques lógicos de criterios. Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "blocks": [
    {
      "block_name": "Nombre del bloque",
      "criteria": [
        {
          "topic": "Nombre corto del criterio",
          "points": 5,
          "criticality": "Crítico",
          "what_to_look_for": "Instrucción clara y específica para la IA sobre qué buscar en la evidencia",
          "validation_source": ["gpf"],
          "applies": true
        }
      ]
    }
  ]
}

Reglas:
- Bloques típicos: Gestión del caso / Verificación en sistemas / Comunicación / Cierre / Script
- Cada bloque: 3 a 7 criterios
- Puntos: 5, 7, 10, 11, 17 (suma total ~100-130 pts)
- Máximo 3 criterios con criticality "Crítico" (los demás "-")
- validation_source opciones: "gpf", "imagenes", "llamada" (usa "imagenes:SISTEMA" para sistema específico, ej: "imagenes:FALCON")
- what_to_look_for: instrucción detallada de 2-5 oraciones para la IA evaluadora
- Si no aplica para este tipo de llamada, aplica:false`;

 try {
 logger.info('[CLAUDE] Generando bloques de criterios', { callType, mode });
 const response = await this.client.messages.create({
 model: CLAUDE_MODEL,
 max_tokens: 4096,
 thinking: { type: 'disabled' },
 messages: [{ role: 'user', content: systemPrompt }]
 });
 const content = this.extractText(response).trim();
 const cleaned = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
 const parsed = JSON.parse(cleaned || '{}');
 logger.info('[CLAUDE] Criterios generados', { blocks: parsed.blocks?.length, tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0) });
 return { blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [] };
 } catch (error: any) {
 logger.error('[CLAUDE] Error generando criterios', { error: error.message });
 throw error;
 }
 }

 async analyzeScreenshotForConfig(
 imageBase64: string,
 mimeType: string,
 systemName: string,
 userDescription: string
 ): Promise<{ detection_hints: string; fields: Array<{ field_name: string; description: string; example: string; how_to_evaluate: string }> }> {
 const systemPrompt = `Eres un experto en sistemas bancarios de call center en México.
Analiza esta captura de pantalla del sistema "${systemName}".
El usuario quiere que la IA extraiga: "${userDescription}"

Genera en JSON válido (sin markdown):
{
  "detection_hints": "Texto visual que identifica esta pantalla con certeza (3-4 oraciones: títulos, colores, secciones visibles, layout característico)",
  "fields": [
    {
      "field_name": "nombre_en_snake_case",
      "description": "Qué representa este campo (en español)",
      "example": "Valor exacto visible en la imagen o valor típico",
      "how_to_evaluate": "Qué debe verificar la IA sobre este campo para evaluar al agente (en español, 1-2 oraciones)"
    }
  ]
}

Incluye TODOS los campos relevantes visibles en la imagen que sean útiles para evaluar si el agente hizo su trabajo correctamente.
Prioriza los campos que el usuario mencionó.`;

 try {
 logger.info('[CLAUDE] Analizando captura para configuración de sistema', { systemName });
 const response = await this.client.messages.create({
 model: CLAUDE_MODEL,
 max_tokens: 4096,
 thinking: { type: 'disabled' },
 messages: [{
 role: 'user',
 content: [
 {
 type: 'image',
 source: {
 type: 'base64',
 media_type: (mimeType === 'image/png' ? 'image/png' : 'image/jpeg') as 'image/png' | 'image/jpeg',
 data: imageBase64
 }
 },
 { type: 'text', text: systemPrompt }
 ]
 }]
 });
 const content = this.extractText(response).trim();
 const cleaned = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
 const parsed = JSON.parse(cleaned || '{}');
 logger.info('[CLAUDE] Screenshot analizado', { fields: parsed.fields?.length, tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0) });
 return {
 detection_hints: parsed.detection_hints ?? '',
 fields: Array.isArray(parsed.fields) ? parsed.fields : [],
 };
 } catch (error: any) {
 logger.error('[CLAUDE] Error analizando screenshot', { error: error.message });
 throw error;
 }
 }

 async generateImageSystemHints(systemName: string, userDescription: string): Promise<{ detection_hints: string; suggested_fields: Array<{ field_name: string; description: string; example?: string }> }> {
 const systemPrompt = `Eres un experto en sistemas bancarios de call center de México.
Tu tarea es ayudar a configurar un sistema de IA que detecta y extrae información de capturas de pantalla de sistemas bancarios internos.

El sistema bancario se llama: "${systemName}"
El usuario describe el sistema así: "${userDescription}"

Genera:
1. "detection_hints": Texto que aparece VISUALMENTE en la pantalla de este sistema y permite identificarlo con certeza (nombres de campos, títulos, menús, colores). Máximo 3 oraciones cortas.
2. "suggested_fields": Lista de 3-6 campos clave que este sistema muestra y que son relevantes para evaluar llamadas de auditoría de fraude. Cada campo debe tener: field_name (en inglés, snake_case), description (en español), example (valor de ejemplo real).

Responde SOLO con JSON válido, sin markdown, sin explicaciones adicionales. Formato:
{"detection_hints": "...", "suggested_fields": [{"field_name": "...", "description": "...", "example": "..."}]}`;

 try {
 logger.info('[CLAUDE] Generando hints para sistema de imagen', { systemName });
 const response = await this.client.messages.create({
 model: CLAUDE_MODEL,
 max_tokens: 2048,
 thinking: { type: 'disabled' },
 messages: [{ role: 'user', content: systemPrompt }]
 });
 const content = this.extractText(response).trim();
 const cleaned = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
 const parsed = JSON.parse(cleaned || '{}');
 logger.info('[CLAUDE] Hints generados', { tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0) });
 return {
 detection_hints: parsed.detection_hints ?? '',
 suggested_fields: Array.isArray(parsed.suggested_fields) ? parsed.suggested_fields : [],
 };
 } catch (error: any) {
 logger.error('[CLAUDE] Error generando hints de sistema', { error: error.message });
 throw error;
 }
 }

 async generateCriterionPrompt(description: string, topic: string, callType: string): Promise<string> {
 const systemPrompt = `Eres un experto en calidad y auditoría de call centers bancarios.
Tu tarea es generar instrucciones técnicas precisas para un sistema de IA que evalúa automáticamente si los agentes de call center cumplen con criterios de calidad.

CONTEXTO DEL SISTEMA:
- El sistema analiza: transcripciones de llamadas, capturas de pantalla de sistemas internos (VCAS, Falcon, Vision, GPF, VRM) y registros GPF.
- El criterio de evaluación ya tiene un nombre/descripción: "${topic}"
- Tipo de llamada: ${callType}

INSTRUCCIONES PARA GENERAR EL PROMPT:
1. Sé específico sobre QUÉ buscar (campo exacto, valor esperado, ubicación en la pantalla).
2. Define claramente cuándo es CORRECTO vs INCORRECTO.
3. Menciona casos especiales o excepciones si los hay.
4. Usa el mismo lenguaje y formato que los demás criterios del sistema.
5. Máximo 400 palabras, sin formato markdown innecesario.

El usuario te describirá en lenguaje natural lo que debe verificarse. Genera la instrucción técnica lista para usar.`;

 try {
 logger.info('[CLAUDE] Generando instrucción de criterio', { topic, callType });

 const response = await this.client.messages.create({
 model: CLAUDE_MODEL,
 max_tokens: 2048,
 thinking: { type: 'disabled' },
 system: systemPrompt,
 messages: [
 { role: 'user', content: description }
 ]
 });

 const result = this.extractText(response).trim();
 logger.info('[CLAUDE] Instrucción generada', { tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0) });
 return result;
 } catch (error: any) {
 logger.error('[CLAUDE] Error generando instrucción de criterio', { error: error.message });
 throw error;
 }
 }
}

export { ClaudeService };

let instance: ClaudeService | null = null;
export const getClaudeService = () => {
 if (!instance) {
 instance = new ClaudeService();
 }
 return instance;
};

export const claudeService = {
 analyzeImage: async (imagePath: string) => {
 return getClaudeService().analyzeImage(imagePath);
 },
 analyzeMultipleImages: async (imagePaths: string[]) => {
 return getClaudeService().analyzeMultipleImages(imagePaths);
 },
 correctTranscription: async (text: string) => {
 return getClaudeService().correctTranscription(text);
 },
 analyzeSentiment: async (utterances: TranscriptWord[]) => {
 return getClaudeService().analyzeSentiment(utterances);
 },
 generateCriterionPrompt: async (description: string, topic: string, callType: string) => {
 return getClaudeService().generateCriterionPrompt(description, topic, callType);
 },
 generateImageSystemHints: async (systemName: string, userDescription: string) => {
 return getClaudeService().generateImageSystemHints(systemName, userDescription);
 },
 analyzeScreenshotForConfig: async (imageBase64: string, mimeType: string, systemName: string, userDescription: string) => {
 return getClaudeService().analyzeScreenshotForConfig(imageBase64, mimeType, systemName, userDescription);
 },
 generateCriteriaBlocks: async (description: string, callType: string, mode: string, availableSystems: string[]) => {
 return getClaudeService().generateCriteriaBlocks(description, callType, mode, availableSystems);
 }
};

// Alias de compatibilidad: los llamadores existentes siguen usando `openAIService`.
export const openAIService = claudeService;
