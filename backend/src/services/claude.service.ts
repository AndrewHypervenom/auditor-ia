//backend/src/services/claude.service.ts

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import type { ImageAnalysis, SentimentResult, TranscriptWord } from '../types/index.js';
import * as fs from 'fs';
import { getDatabaseService } from './database.service.js';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5';

/**
 * Contexto por defecto de las capturas que audita la IA. Es deliberadamente
 * genérico: cada empresa lo ajusta a su realidad (banca, seguros, retail, CRM…)
 * desde Administración → Pantallas de proceso.
 */
export const DEFAULT_IMAGE_DOMAIN = 'una pantalla de un sistema o aplicativo interno';

export interface ScreenshotAnalysisField {
 field_name: string;
 description: string;
 example: string;
 how_to_evaluate: string;
 /** Si conviene extraerlo por defecto (la IA lo razona por campo). */
 recommended: boolean;
 /** Una frase que explica por qué conviene (o no) extraerlo. */
 reason: string;
 /** Dato personal del cliente: nunca se recomienda por defecto. */
 sensitive: boolean;
}

export interface ScreenshotAnalysis {
 /** Nombre propuesto para la pantalla (o el que indicó el usuario). */
 proposed_system_name: string;
 /** Pantalla ya configurada con la que coincide, o null si es nueva. */
 matched_system: string | null;
 match_confidence: number;
 screen_summary: string;
 detection_hints: string;
 fields: ScreenshotAnalysisField[];
}

export interface GenerateCriterionPromptInput {
 /** Lo que el auditor escribió en sus propias palabras. */
 description: string;
 topic: string;
 callType: string;
 subCalificacion?: string | null;
 validationSource?: string[];
}

const SOURCE_LABELS: Record<string, string> = {
 gpf: 'el registro/gestión GPF',
 llamada: 'la transcripción de la llamada',
 imagenes: 'las capturas de pantalla adjuntas',
};

function describeValidationSources(sources: string[]): string {
 const labels = sources.map((source) => {
   if (source.startsWith('imagenes:')) return `la captura de pantalla del sistema ${source.slice(9)}`;
   return SOURCE_LABELS[source] ?? source;
 });
 const unique = [...new Set(labels)];
 return unique.length > 0 ? unique.join(', ') : 'transcripción de la llamada';
}

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
 async correctTranscription(text: string): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
 const emptyUsage = { inputTokens: 0, outputTokens: 0 };
 if (!text || text.length < 10) return { text, usage: emptyUsage };

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
 const usage = {
 inputTokens: response.usage?.input_tokens ?? 0,
 outputTokens: response.usage?.output_tokens ?? 0,
 };

 logger.info('[CLAUDE] Post-corrección completada', {
 tokens: usage.inputTokens + usage.outputTokens,
 cambios: corrected !== text,
 });

 return { text: corrected || text, usage };
 } catch (error: any) {
 logger.warn('[CLAUDE] Post-corrección falló, usando texto original', { error: error.message });
 return { text, usage: emptyUsage };
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
 opts: {
  systemName?: string;
  userDescription?: string;
  domainContext?: string;
  existingSystems?: Array<{ system_name: string; description?: string; detection_hints?: string }>;
 } = {}
 ): Promise<ScreenshotAnalysis> {
 const systemName = (opts.systemName ?? '').trim();
 const userDescription = (opts.userDescription ?? '').trim();
 const domain = (opts.domainContext ?? '').trim() || DEFAULT_IMAGE_DOMAIN;
 const existing = opts.existingSystems ?? [];

 // Cuando el usuario sube la captura sin decir a qué pantalla pertenece, la IA
 // decide si coincide con alguna ya configurada o si hay que crear una nueva.
 const catalogo = existing.length > 0
  ? existing.map(s => `- ${s.system_name}: ${(s.detection_hints || s.description || '').slice(0, 300)}`).join('\n')
  : '(todavía no hay pantallas configuradas)';

 const systemPrompt = `Eres un experto en auditoría de calidad de atención al cliente.
Analiza esta captura de ${domain}.

${systemName
  ? `El usuario dice que esta captura pertenece a la pantalla "${systemName}".`
  : `El usuario NO indicó a qué pantalla pertenece. Decide si coincide con alguna de las pantallas ya configuradas o si es una pantalla nueva.

PANTALLAS YA CONFIGURADAS:
${catalogo}`}

${userDescription
  ? `El usuario quiere que la IA extraiga: "${userDescription}"`
  : 'El usuario no dio indicaciones: propón tú los campos que valgan la pena auditar.'}

Genera SOLO JSON válido (sin markdown):
{
  "proposed_system_name": "NOMBRE CORTO EN MAYÚSCULAS (2-3 palabras) que describa la pantalla; si coincide con una ya configurada, usa ese mismo nombre",
  "matched_system": "nombre exacto de la pantalla configurada con la que coincide, o null si es nueva",
  "match_confidence": 0.0,
  "screen_summary": "Una sola frase en español: qué muestra esta pantalla y para qué sirve",
  "detection_hints": "Texto visual que identifica esta pantalla con certeza (3-4 oraciones: títulos, secciones visibles, layout característico)",
  "fields": [
    {
      "field_name": "nombre_en_snake_case",
      "description": "Qué representa este campo (en español)",
      "example": "Valor exacto visible en la imagen",
      "how_to_evaluate": "Qué debe verificar la IA sobre este campo para evaluar al agente (en español, 1-2 oraciones)",
      "recommended": true,
      "reason": "Por qué conviene (o no) extraer este campo, en una sola frase corta y concreta",
      "sensitive": false
    }
  ]
}

REGLAS PARA LOS CAMPOS:
1. Extrae TODOS los campos visibles que aporten algo, entre 5 y 12.
2. "recommended": true solo para los que de verdad sirven para auditar al agente (identificadores del caso, estados/resultados de la gestión, fechas, texto libre que el agente escribió). Los campos de relleno, códigos internos o datos decorativos van con recommended: false.
3. "sensitive": true para datos personales del cliente (nombre completo, documento, teléfono, dirección, número de tarjeta). Esos SIEMPRE van con recommended: false.
4. "reason" debe ayudar a decidir, no repetir la descripción. Frases como "Es el identificador que amarra la llamada con el registro" o "Dato interno, rara vez se contrasta contra la llamada".
5. Prioriza y marca como recomendados los campos que el usuario mencionó.
6. "example" debe ser el valor EXACTO que ves en la imagen; si no se ve, cadena vacía.`;

 try {
 logger.info('[CLAUDE] Analizando captura para configuración de sistema', { systemName: systemName || '(sin nombre)', existing: existing.length });
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
 logger.info('[CLAUDE] Screenshot analizado', { fields: parsed.fields?.length, matched: parsed.matched_system, tokens: (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0) });

 // La coincidencia solo vale si apunta a una pantalla que existe de verdad.
 const matched = typeof parsed.matched_system === 'string'
  ? (existing.find(s => s.system_name.toUpperCase() === parsed.matched_system.trim().toUpperCase())?.system_name ?? null)
  : null;

 const rawFields = Array.isArray(parsed.fields) ? parsed.fields : [];
 return {
 proposed_system_name: (parsed.proposed_system_name ?? systemName ?? '').toString().trim().toUpperCase(),
 matched_system: matched,
 match_confidence: matched ? Number(parsed.match_confidence) || 0 : 0,
 screen_summary: (parsed.screen_summary ?? '').toString(),
 detection_hints: parsed.detection_hints ?? '',
 fields: rawFields.map((f: any) => ({
  field_name: (f.field_name ?? '').toString(),
  description: (f.description ?? '').toString(),
  example: (f.example ?? '').toString(),
  how_to_evaluate: (f.how_to_evaluate ?? '').toString(),
  // Un dato personal nunca se recomienda por defecto, aunque la IA insista.
  recommended: f.sensitive === true ? false : f.recommended !== false,
  reason: (f.reason ?? '').toString(),
  sensitive: f.sensitive === true,
 })),
 };
 } catch (error: any) {
 logger.error('[CLAUDE] Error analizando screenshot', { error: error.message });
 throw error;
 }
 }

 async generateImageSystemHints(systemName: string, userDescription: string, domainContext?: string): Promise<{ detection_hints: string; suggested_fields: Array<{ field_name: string; description: string; example?: string }> }> {
 const domain = (domainContext ?? '').trim() || DEFAULT_IMAGE_DOMAIN;
 const systemPrompt = `Eres un experto en auditoría de calidad de atención al cliente.
Tu tarea es ayudar a configurar un sistema de IA que detecta y extrae información de capturas de ${domain}.

La pantalla se llama: "${systemName}"
El usuario la describe así: "${userDescription}"

Genera:
1. "detection_hints": Texto que aparece VISUALMENTE en esta pantalla y permite identificarla con certeza (nombres de campos, títulos, menús, layout). Máximo 3 oraciones cortas.
2. "suggested_fields": Lista de 3-6 campos clave que esta pantalla muestra y que son relevantes para auditar la gestión del agente. Cada campo debe tener: field_name (snake_case), description (en español), example (valor de ejemplo real).

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

 async generateCriterionPrompt(input: GenerateCriterionPromptInput): Promise<string> {
 const { description, topic, callType, subCalificacion } = input;
 const sources = describeValidationSources(input.validationSource ?? []);

 const systemPrompt = `Eres un experto en calidad y auditoría de call centers bancarios.
Tu tarea es generar instrucciones técnicas precisas para un sistema de IA que evalúa automáticamente si los agentes de call center cumplen con criterios de calidad.

CONTEXTO DEL SISTEMA:
- El sistema analiza: transcripciones de llamadas, capturas de pantalla de sistemas internos (VCAS, Falcon, Vision, GPF, VRM) y registros GPF.
- El criterio de evaluación ya tiene un nombre/descripción: "${topic}"
- Tipo de llamada: ${callType}${subCalificacion ? `\n- Subcalificación (esta instrucción aplica solo a ella): ${subCalificacion}` : ''}
- Material que la IA tendrá disponible para este criterio: ${sources}

INSTRUCCIONES PARA GENERAR EL PROMPT:
1. Sé específico sobre QUÉ buscar (campo exacto, valor esperado, ubicación en la pantalla).
2. Define claramente cuándo es CORRECTO vs INCORRECTO.
3. Menciona casos especiales o excepciones si los hay.
4. No pidas revisar material que no está disponible para este criterio.
5. Usa el mismo lenguaje y formato que los demás criterios del sistema.
6. Máximo 400 palabras, sin formato markdown innecesario, sin encabezados ni preámbulos.

El usuario te describirá en sus propias palabras -a veces de forma informal o incompleta- lo que debe verificarse. Interpreta su intención y responde ÚNICAMENTE con la instrucción técnica lista para usar.`;

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
 generateCriterionPrompt: async (input: GenerateCriterionPromptInput) => {
 return getClaudeService().generateCriterionPrompt(input);
 },
 generateImageSystemHints: async (systemName: string, userDescription: string, domainContext?: string) => {
 return getClaudeService().generateImageSystemHints(systemName, userDescription, domainContext);
 },
 analyzeScreenshotForConfig: async (
 imageBase64: string,
 mimeType: string,
 opts: {
  systemName?: string;
  userDescription?: string;
  domainContext?: string;
  existingSystems?: Array<{ system_name: string; description?: string; detection_hints?: string }>;
 } = {}
 ) => {
 return getClaudeService().analyzeScreenshotForConfig(imageBase64, mimeType, opts);
 },
 generateCriteriaBlocks: async (description: string, callType: string, mode: string, availableSystems: string[]) => {
 return getClaudeService().generateCriteriaBlocks(description, callType, mode, availableSystems);
 }
};

// Alias de compatibilidad: los llamadores existentes siguen usando `openAIService`.
export const openAIService = claudeService;
