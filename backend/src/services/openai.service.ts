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
 }
};