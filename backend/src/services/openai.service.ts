//backend/src/services/openai.service.ts

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import type { ImageAnalysis } from '../types/index.js';
import * as fs from 'fs';
import { getDatabaseService } from './database.service.js';

class OpenAIService {
 private client: OpenAI;

 constructor() {
 const apiKey = process.env.OPENAI_API_KEY;
 if (!apiKey) {
 throw new Error('OPENAI_API_KEY is not configured');
 }
 this.client = new OpenAI({ apiKey });
 }

 async analyzeImage(imagePath: string): Promise<ImageAnalysis & { usage?: { input_tokens: number; output_tokens: number } }> {
 try {
 logger.info('Analyzing image with ENHANCED detection', { imagePath });

 const imageBuffer = fs.readFileSync(imagePath);
 const imageBase64 = imageBuffer.toString('base64');
 const ext = imagePath.split('.').pop()?.toLowerCase();
 const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

 const response = await this.client.chat.completions.create({
 model: 'gpt-5.4-mini',

 temperature: 0,
 seed: 42,
 messages: [
 {
 role: 'user',
 content: [
 {
 type: 'image_url',
 image_url: {
 url: `data:${mimeType};base64,${imageBase64}`,
 detail: 'high'
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

 const content = response.choices[0]?.message?.content;
 if (!content) {
 throw new Error('No response from OpenAI');
 }

 // Limpieza robusta del JSON
 let cleanedContent = content.trim();
 cleanedContent = cleanedContent.replace(/```json\n?/gi, '');
 cleanedContent = cleanedContent.replace(/```\n?/g, '');
 cleanedContent = cleanedContent.replace(/^\uFEFF/, '');
 cleanedContent = cleanedContent.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

 const parsed = JSON.parse(cleanedContent);

 logger.success('Image analyzed with enhanced detection', {
 system: parsed.system,
 confidence: parsed.confidence,
 criticalFieldsFound: Object.keys(parsed.critical_fields || {}).length,
 totalFieldsFound: Object.keys(parsed.data || {}).length,
 inputTokens: response.usage?.prompt_tokens || 0,
 outputTokens: response.usage?.completion_tokens || 0
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
 input_tokens: response.usage?.prompt_tokens || 0,
 output_tokens: response.usage?.completion_tokens || 0
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
 logger.info('[OPENAI] Iniciando post-corrección de transcripción', { longitud: text.length });

 const systemContent = await getDatabaseService().getPromptByKey('transcription_correction') ?? '';

 const response = await this.client.chat.completions.create({
 model: 'gpt-5.4-mini',
 temperature: 0,
 messages: [
 {
 role: 'system',
 content: systemContent
 },
 {
 role: 'user',
 content: text
 }
 ]
 });

 const corrected = response.choices[0]?.message?.content?.trim();
 const tokens = response.usage?.total_tokens ?? 0;

 logger.info('[OPENAI] Post-corrección completada', { tokens, cambios: corrected !== text });

 return corrected || text;
 } catch (error: any) {
 logger.warn('[OPENAI] Post-corrección falló, usando texto original', { error: error.message });
 return text;
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
 logger.info('[OPENAI] Generando bloques de criterios', { callType, mode });
 const response = await this.client.chat.completions.create({
 model: 'gpt-5.4-mini',
 temperature: 0.4,
 messages: [{ role: 'user', content: systemPrompt }]
 });
 const content = response.choices[0]?.message?.content?.trim() ?? '{}';
 const cleaned = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
 const parsed = JSON.parse(cleaned);
 logger.info('[OPENAI] Criterios generados', { blocks: parsed.blocks?.length, tokens: response.usage?.total_tokens });
 return { blocks: Array.isArray(parsed.blocks) ? parsed.blocks : [] };
 } catch (error: any) {
 logger.error('[OPENAI] Error generando criterios', { error: error.message });
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
 logger.info('[OPENAI] Generando hints para sistema de imagen', { systemName });
 const response = await this.client.chat.completions.create({
 model: 'gpt-5.4-mini',
 temperature: 0.3,
 messages: [{ role: 'user', content: systemPrompt }]
 });
 const content = response.choices[0]?.message?.content?.trim() ?? '{}';
 const cleaned = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
 const parsed = JSON.parse(cleaned);
 logger.info('[OPENAI] Hints generados', { tokens: response.usage?.total_tokens });
 return {
 detection_hints: parsed.detection_hints ?? '',
 suggested_fields: Array.isArray(parsed.suggested_fields) ? parsed.suggested_fields : [],
 };
 } catch (error: any) {
 logger.error('[OPENAI] Error generando hints de sistema', { error: error.message });
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
 logger.info('[OPENAI] Generando instrucción de criterio', { topic, callType });

 const response = await this.client.chat.completions.create({
 model: 'gpt-5.4-mini',
 temperature: 0.3,
 messages: [
 { role: 'system', content: systemPrompt },
 { role: 'user', content: description }
 ]
 });

 const result = response.choices[0]?.message?.content?.trim() ?? '';
 logger.info('[OPENAI] Instrucción generada', { tokens: response.usage?.total_tokens });
 return result;
 } catch (error: any) {
 logger.error('[OPENAI] Error generando instrucción de criterio', { error: error.message });
 throw error;
 }
 }
}

export { OpenAIService };

let instance: OpenAIService | null = null;
export const getOpenAIService = () => {
 if (!instance) {
 instance = new OpenAIService();
 }
 return instance;
};

export const openAIService = {
 analyzeImage: async (imagePath: string) => {
 return getOpenAIService().analyzeImage(imagePath);
 },
 analyzeMultipleImages: async (imagePaths: string[]) => {
 return getOpenAIService().analyzeMultipleImages(imagePaths);
 },
 correctTranscription: async (text: string) => {
 return getOpenAIService().correctTranscription(text);
 },
 generateCriterionPrompt: async (description: string, topic: string, callType: string) => {
 return getOpenAIService().generateCriterionPrompt(description, topic, callType);
 },
 generateImageSystemHints: async (systemName: string, userDescription: string) => {
 return getOpenAIService().generateImageSystemHints(systemName, userDescription);
 },
 generateCriteriaBlocks: async (description: string, callType: string, mode: string, availableSystems: string[]) => {
 return getOpenAIService().generateCriteriaBlocks(description, callType, mode, availableSystems);
 }
};