//backend/src/services/evaluator.service.ts

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger.js';
import type { AuditInput, TranscriptResult, ImageAnalysis, EvaluationResult } from '../types/index.js';
import type { EvaluationBlock } from '../config/evaluation-criteria.js';
import { getDatabaseService } from './database.service.js';
import { DEFAULT_IMAGE_DOMAIN } from './claude.service.js';
import {
  computeScoreTotals,
  hasScoreOptions,
  resolveMaxScore,
  snapToAllOrNothing,
  toWholeScore,
  snapToNearestOption,
  type DetailedScore,
  type ScoreOption,
} from '../utils/scoring.js';
import { normTopic } from '../utils/matching.js';
import { computeCallTiming, formatCallTimingForPrompt, type CallTimingMetrics } from '../utils/call-timing.js';
import { parseModelJson, ModelJsonError } from '../utils/model-json.js';
import * as fs from 'fs';

const CLAUDE_MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5';

// Techo de salida de la evaluación. Una rúbrica completa (≈20 criterios con
// justificación y recomendación) ronda los 7-8k tokens, así que 8192 dejaba
// margen cero y truncaba el JSON de forma intermitente.
const EVALUATION_MAX_TOKENS = Number(process.env.EVALUATION_MAX_TOKENS) || 16000;

class EvaluatorService {
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

 /**
  * Analiza las capturas y evalúa. Las capturas se leen aquí una sola vez: el
  * resultado vuelve en `imageAnalyses` para que quien llame lo guarde y lo
  * muestre, en vez de analizarlas otra vez por su cuenta.
  */
 async evaluate(
 auditInput: AuditInput,
 transcript: TranscriptResult,
 ): Promise<Omit<EvaluationResult, 'excelUrl'> & {
 usage?: { inputTokens: number; outputTokens: number; totalTokens: number };
 imageAnalyses: ImageAnalysis[];
 imageUsage: { inputTokens: number; outputTokens: number };
 }> {
 try {
 logger.info('Starting ENHANCED evaluation', {
 callType: auditInput.callType,
 executiveId: auditInput.executiveId
 });

 // NUEVO: Acumuladores de tokens
 let totalInputTokens = 0;
 let totalOutputTokens = 0;

 // PASO 0: Obtener criterios — necesarios para enriquecer el análisis de imágenes
 const criteriaEarly = await getDatabaseService().getCriteriaForCallType(auditInput.callType, auditInput.subCalificacion, auditInput.companyId ?? undefined) as EvaluationBlock[];

 // Construir hints de rubros que deben validarse en imágenes
 const imageRubroHints = criteriaEarly
  .flatMap((block: any) =>
   block.topics
    .filter((t: any) => t.applies && Array.isArray(t.validationSource) && t.validationSource.some((s: string) => s === 'imagenes' || s.startsWith('imagenes:')) && t.whatToLookFor)
    .map((t: any) => `- [${block.blockName}] ${t.topic}: ${t.whatToLookFor}`)
  ).join('\n');

 // PASO 1: Análisis estructurado de evidencia visual MEJORADO
 const { visualEvidence, analyses: imageAnalyses, tokensUsed: visualTokens } = await this.extractVisualEvidenceEnhanced(auditInput.imagePaths || [], imageRubroHints || undefined);

 // NUEVO: Acumular tokens de análisis visual
 totalInputTokens += visualTokens.input;
 totalOutputTokens += visualTokens.output;

 logger.info('Visual evidence extracted with enhanced detection', {
 systemsFound: Object.keys(visualEvidence).length,
 totalFindings: Object.values(visualEvidence).flat().length,
 tokensUsed: `${visualTokens.input} input + ${visualTokens.output} output`
 });

 // PASO 2: Análisis de transcripción
 const verbalEvidence = this.extractVerbalEvidence(transcript);

 logger.info('Verbal evidence extracted', {
 totalMentions: verbalEvidence.length
 });

 // PASO 3: Reusar criterios obtenidos en PASO 0
 const criteria = criteriaEarly;

 // PASO 3b: Normalizar claves de evidencia visual — si el análisis de imágenes
 // devolvió sistemas desconocidos (ej. "CICS"), redistribuir su evidencia entre
 // los sistemas conocidos para que no quede perdida.
 const knownSystems = new Set(criteria.map(b => this.getSystemFromBlock(b.blockName)));
 const normalizedVisualEvidence: Record<string, any[]> = {};
 const orphanImages: any[] = [];
 for (const [sys, imgs] of Object.entries(visualEvidence)) {
   if (knownSystems.has(sys)) {
     normalizedVisualEvidence[sys] = imgs;
   } else {
     logger.warn(`Visual evidence under unknown system "${sys}" will be added to all known systems`);
     orphanImages.push(...imgs);
   }
 }
 // Añadir imágenes huérfanas a todos los sistemas conocidos para que la IA las vea
 for (const sys of knownSystems) {
   if (orphanImages.length > 0) {
     normalizedVisualEvidence[sys] = [...(normalizedVisualEvidence[sys] || []), ...orphanImages];
   }
 }

 // PASO 4: Evaluación con MATCHING MEJORADO
 const { evaluation, tokensUsed: evalTokens, manualTopics } = await this.evaluateWithEnhancedMatching(
 criteria,
 normalizedVisualEvidence,
 verbalEvidence,
 transcript,
 auditInput
 );

 // NUEVO: Acumular tokens de evaluación
 totalInputTokens += evalTokens.input;
 totalOutputTokens += evalTokens.output;

 // Mapa de criticidad por nombre de tópico (para incluirlo en detailedScores)
 const topicCriticalityMap = new Map<string, string>(
 criteria.flatMap(block =>
 block.topics.map(t => [t.topic, t.criticality || '-'])
 )
 );

 // Transformar a formato de respuesta — en el orden original de criterios de la BD.
 // Matching TOLERANTE: el modelo puede devolver block/topic con diferencias de
 // mayúsculas, espacios o recortes; un criterio jamás se descarta por eso.
 const evaluationsArr: any[] = Array.isArray(evaluation.evaluations) ? evaluation.evaluations
   : Array.isArray((evaluation as any).evaluaciones) ? (evaluation as any).evaluaciones : [];
 const matcher = this.createAiResultMatcher(evaluationsArr);
 const manualMap = new Map<string, any>();
 for (const m of manualTopics) {
   manualMap.set(m.criterion, m);
 }

 const detailedScores = criteria.flatMap(block =>
   block.topics
     .filter((t: any) => t.applies || t.requiresManualReview)
     .map((t: any) => {
       const criterionKey = `[${block.blockName}] ${t.topic}`;
       if (t.requiresManualReview) {
         return manualMap.get(criterionKey) ?? null;
       }
       const scoreOptions = (t as any).scoreOptions ?? null;
       const maxScore = resolveMaxScore(t.points, scoreOptions);
       const ai = matcher.match(block.blockName, t.topic);
       if (ai) {
         // El denominador SIEMPRE lo manda la rubrica de la BD: si se tomara el
         // max_score del modelo, un valor inventado (p. ej. 2.5) mete decimales.
         const effectiveMax = maxScore;
         return {
           // Usar el nombre de la BD (no el del modelo): el visor reordena por esta clave
           criterion: criterionKey,
           // Con escala discreta el denominador lo manda la rúbrica, no el modelo
           score: this.applyScoreOptions(ai.score ?? 0, scoreOptions, effectiveMax),
           maxScore: effectiveMax,
           observations: ai.justification ?? '',
           recommendation: ai.recommendation ?? '',
           criticality: topicCriticalityMap.get(t.topic) || '-',
           scoreOptions,
         };
       }
       logger.warn('Criterio sin evaluación del modelo — se conserva en 0', { block: block.blockName, topic: t.topic });
       return {
         criterion: criterionKey,
         score: 0,
         maxScore,
         observations: 'No evaluado por el modelo — asigna el puntaje manualmente.',
         criticality: topicCriticalityMap.get(t.topic) || '-',
         scoreOptions,
       };
     })
     .filter(Boolean)
 ) as DetailedScore[];

 // Las evaluaciones que no corresponden a ningún criterio de la rúbrica se
 // descartan: la BD es la única fuente de verdad del puntaje. Antes se anexaban
 // con el max_score que inventara el modelo, inflando el máximo de la auditoría
 // (p. ej. 178 pts sobre una rúbrica de 121) y calificando rubros inexistentes.
 for (const ev of evaluationsArr) {
   if (!matcher.consumed.has(ev) && ev?.topic) {
     logger.warn('Evaluación del modelo sin criterio en la rúbrica — se descarta', {
       block: ev.block, topic: ev.topic, callType: auditInput.callType,
     });
   }
 }

 // PASO 4b: Totales y falla crítica con las reglas de escala (ver utils/scoring.ts).
 // Los criterios sin evaluación del modelo y los N/A nunca cuentan como fallo.
 const totals = computeScoreTotals(detailedScores);
 const { failedCriticalCriteria, criticalFailure } = totals;

 // Totales consistentes con los criterios guardados (no los que reporta el modelo)
 evaluation.total_score = totals.totalScore;
 evaluation.max_possible_score = totals.maxPossibleScore;
 evaluation.percentage = totals.percentage;
 if (criticalFailure) {
   logger.warn('Critical failure detected — result forced to 0', { failedCriticalCriteria });
 }

 logger.success('Evaluation completed with enhanced matching', {
 totalScore: evaluation.total_score,
 percentage: evaluation.percentage,
 criticalFailure,
 criteriaCount: detailedScores.length,
 tokensUsed: `${evalTokens.input} input + ${evalTokens.output} output`
 });

 const keyMoments: Array<{
 timestamp: string;
 type: string;
 description: string;
 }> = evaluation.key_moments?.map((moment: any) => ({
 timestamp: moment.timestamp,
 type: moment.event,
 description: moment.description
 })) || [];

 const result: Omit<EvaluationResult, 'excelUrl'> & {
 usage: { inputTokens: number; outputTokens: number; totalTokens: number };
 imageAnalyses: ImageAnalysis[];
 imageUsage: { inputTokens: number; outputTokens: number };
 } = {
 imageAnalyses,
 imageUsage: { inputTokens: visualTokens.input, outputTokens: visualTokens.output },
 totalScore: evaluation.total_score,
 maxPossibleScore: evaluation.max_possible_score,
 percentage: evaluation.percentage,
 detailedScores,
 observations: evaluation.observations,
 recommendations: evaluation.recommendations || [],
 keyMoments,
 criticalFailure,
 failedCriticalCriteria: criticalFailure ? failedCriticalCriteria : undefined,
 usage: {
 inputTokens: totalInputTokens,
 outputTokens: totalOutputTokens,
 totalTokens: totalInputTokens + totalOutputTokens
 }
 };

 logger.info(' Total evaluation tokens', {
 input: totalInputTokens.toLocaleString(),
 output: totalOutputTokens.toLocaleString(),
 total: (totalInputTokens + totalOutputTokens).toLocaleString()
 });

 return result;

 } catch (error) {
 logger.error('Error in evaluation', error);
 throw error;
 }
 }

 /**
  * Matching tolerante entre las evaluaciones devueltas por el modelo y los
  * criterios de la BD. Normaliza mayúsculas/espacios y tolera recortes de
  * nombres largos. Lleva registro de las evaluaciones ya consumidas para
  * poder conservar las que no hicieron match.
  */
 /**
  * Ordena y deduplica los pasos del guion antes de mandárselos al modelo.
  *
  * En la BD conviven filas repetidas del mismo `step_key` (FRAUDE/ROEXT tiene 21
  * filas activas para 11 pasos) y varias comparten `step_order`, así que el
  * `reduce` anterior descartaba ~la mitad y el ganador dependía del orden que
  * devolviera Postgres: el guion que veía la IA podía cambiar entre corridas del
  * mismo caso. Aquí el criterio es explícito y estable — gana la fila con más
  * frases; a igualdad, el mayor `step_order`; a igualdad, el `id` menor.
  */
 private buildScriptSteps(
   rows: any[],
   callType: string,
 ): Array<{ order: number; key: string; label: string; lines: string[] }> {
   const best = new Map<string, any>();
   for (const r of rows ?? []) {
     const key = String(r?.step_key ?? '').trim();
     if (!key) continue;
     const current = best.get(key);
     if (!current) { best.set(key, r); continue; }
     const lines = (r.lines || []).length;
     const currentLines = (current.lines || []).length;
     const wins =
       lines !== currentLines ? lines > currentLines
       : (r.step_order ?? 0) !== (current.step_order ?? 0) ? (r.step_order ?? 0) > (current.step_order ?? 0)
       : String(r.id ?? '') < String(current.id ?? '');
     if (wins) best.set(key, r);
   }

   const discarded = (rows?.length ?? 0) - best.size;
   if (discarded > 0) {
     logger.warn('Guion con pasos duplicados en la BD — se usa una sola versión por paso', {
       callType, filas: rows.length, pasos: best.size, descartadas: discarded,
     });
   }
   if (best.size === 0) {
     logger.warn('No hay guion configurado para este call_type — la IA evaluará sin guion de referencia', { callType });
   }

   return [...best.values()]
     .map((r: any) => ({
       order: r.step_order ?? 0,
       key: String(r.step_key),
       label: String(r.step_label ?? r.step_key),
       lines: Array.isArray(r.lines) ? r.lines : [],
     }))
     .sort((a, b) => (a.order - b.order) || a.key.localeCompare(b.key));
 }

 private createAiResultMatcher(evaluations: any[]) {
   // normTopic quita acentos, mayúsculas y el prefijo de enumeración que el
   // modelo copia del prompt ("5. Subir Excel" → "subir excel"). Sin eso, el
   // criterio real quedaba en 0 y la evaluación se colaba como rubro fantasma.
   const norm = normTopic;
   const byBlockTopic = new Map<string, any>();
   const byTopic = new Map<string, any>();
   for (const ev of evaluations) {
     const key = `${norm(ev.block)}|||${norm(ev.topic)}`;
     if (!byBlockTopic.has(key)) byBlockTopic.set(key, ev);
     const tkey = norm(ev.topic);
     if (tkey && !byTopic.has(tkey)) byTopic.set(tkey, ev);
   }
   const consumed = new Set<any>();
   const match = (blockName: string, topic: string): any | null => {
     const nb = norm(blockName);
     const nt = norm(topic);
     const exact = byBlockTopic.get(`${nb}|||${nt}`) ?? byTopic.get(nt);
     if (exact && !consumed.has(exact)) { consumed.add(exact); return exact; }
     if (!nt) return null;
     // Contención: nombres largos que el modelo recorta o amplía. Se prueba
     // primero dentro del mismo bloque para no robar el rubro de otro (p. ej.
     // "Bloquea tarjeta" está contenido en "Desbloquea tarjeta BLKI, BLKT...").
     const containment = (sameBlockOnly: boolean) => {
       for (const ev of evaluations) {
         if (consumed.has(ev)) continue;
         if (sameBlockOnly && norm(ev.block) !== nb) continue;
         const et = norm(ev.topic);
         if (et.length >= 8 && nt.length >= 8 && (et.includes(nt) || nt.includes(et))) {
           consumed.add(ev);
           return ev;
         }
       }
       return null;
     };
     return containment(true) ?? containment(false);
   };
   return { match, consumed };
 }

 /**
  * Evalúa usando imágenes ya analizadas (resultado del batch de OpenAI).
  * Usa exactamente la misma lógica que evaluate() pero sin re-descargar imágenes.
  */
 async evaluateWithPrecomputedImages(
   auditInput: AuditInput,
   batchImageResults: any[],
   transcriptText: string,
 ): Promise<Omit<EvaluationResult, 'excelUrl'> & { usage: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
   // Mapear resultados de imágenes del batch al formato visualEvidence
   const rawVisualEvidence: Record<string, any[]> = {};
   for (let i = 0; i < batchImageResults.length; i++) {
     const r = batchImageResults[i] || {};
     const system: string = r.system || r.sistema || 'Sistema';
     if (!rawVisualEvidence[system]) rawVisualEvidence[system] = [];
     rawVisualEvidence[system].push({
       imagePath: `batch-img-${i}.jpg`,
       data: r.data || r,
       findings: r.findings || [],
       confidence: r.confidence || 0.9,
       critical_fields: r.critical_fields || {},
     });
   }

   const criteria = await getDatabaseService().getCriteriaForCallType(auditInput.callType, auditInput.subCalificacion, auditInput.companyId ?? undefined) as EvaluationBlock[];

   // Normalizar evidencia visual contra sistemas conocidos (igual que evaluate())
   const knownSystems = new Set(criteria.map(b => this.getSystemFromBlock(b.blockName)));
   const visualEvidence: Record<string, any[]> = {};
   const orphanImages: any[] = [];
   for (const [sys, imgs] of Object.entries(rawVisualEvidence)) {
     if (knownSystems.has(sys)) {
       visualEvidence[sys] = imgs;
     } else {
       orphanImages.push(...imgs);
     }
   }
   for (const sys of knownSystems) {
     if (orphanImages.length > 0) {
       visualEvidence[sys] = [...(visualEvidence[sys] || []), ...orphanImages];
     }
   }

   const transcript: TranscriptResult = { text: transcriptText, utterances: [] };
   const verbalEvidence = this.extractVerbalEvidence(transcript);

   const { evaluation, tokensUsed, manualTopics } = await this.evaluateWithEnhancedMatching(
     criteria,
     visualEvidence,
     verbalEvidence,
     transcript,
     auditInput,
   );

   const topicCriticalityMap = new Map<string, string>(
     criteria.flatMap(block => block.topics.map(t => [t.topic, t.criticality || '-']))
   );
   const evaluationsArr: any[] = Array.isArray(evaluation.evaluations) ? evaluation.evaluations
     : Array.isArray((evaluation as any).evaluaciones) ? (evaluation as any).evaluaciones : [];
   const matcher = this.createAiResultMatcher(evaluationsArr);
   const manualMap = new Map<string, any>();
   for (const m of manualTopics) manualMap.set(m.criterion, m);

   const detailedScores = criteria.flatMap(block =>
     block.topics.filter((t: any) => t.applies || t.requiresManualReview).map((t: any) => {
       const criterionKey = `[${block.blockName}] ${t.topic}`;
       if (t.requiresManualReview) return manualMap.get(criterionKey) ?? null;
       const scoreOptions = (t as any).scoreOptions ?? null;
       const maxScore = resolveMaxScore(t.points, scoreOptions);
       const ai = matcher.match(block.blockName, t.topic);
       if (ai) {
         // El denominador SIEMPRE lo manda la rubrica de la BD: si se tomara el
         // max_score del modelo, un valor inventado (p. ej. 2.5) mete decimales.
         const effectiveMax = maxScore;
         return { criterion: criterionKey, score: this.applyScoreOptions(ai.score ?? 0, scoreOptions, effectiveMax), maxScore: effectiveMax, observations: ai.justification ?? '', recommendation: ai.recommendation ?? '', criticality: topicCriticalityMap.get(t.topic) || '-', scoreOptions };
       }
       return { criterion: criterionKey, score: 0, maxScore, observations: 'No evaluado por el modelo — asigna el puntaje manualmente.', criticality: topicCriticalityMap.get(t.topic) || '-', scoreOptions };
     }).filter(Boolean)
   ) as DetailedScore[];

   // Descartar evaluaciones del modelo sin criterio en la rúbrica (ver evaluate()).
   for (const ev of evaluationsArr) {
     if (!matcher.consumed.has(ev) && ev?.topic) {
       logger.warn('Evaluación del modelo sin criterio en la rúbrica — se descarta', {
         block: ev.block, topic: ev.topic, callType: auditInput.callType,
       });
     }
   }

   const totals = computeScoreTotals(detailedScores);
   const { failedCriticalCriteria, criticalFailure } = totals;

   evaluation.total_score = totals.totalScore;
   evaluation.max_possible_score = totals.maxPossibleScore;
   evaluation.percentage = totals.percentage;

   const keyMoments = (evaluation.key_moments || []).map((m: any) => ({ timestamp: m.timestamp, type: m.event, description: m.description }));

   logger.success('Batch evaluation completed via real-time evaluator', {
     callType: auditInput.callType,
     totalScore: evaluation.total_score,
     criteriaCount: detailedScores.length,
   });

   return {
     totalScore: evaluation.total_score,
     maxPossibleScore: evaluation.max_possible_score,
     percentage: evaluation.percentage,
     detailedScores,
     observations: evaluation.observations,
     recommendations: evaluation.recommendations || [],
     keyMoments,
     criticalFailure,
     failedCriticalCriteria: criticalFailure ? failedCriticalCriteria : undefined,
     usage: { inputTokens: tokensUsed.input, outputTokens: tokensUsed.output, totalTokens: tokensUsed.input + tokensUsed.output },
   };
 }

 /**
 * MEJORADO: Extrae evidencia visual con detección más precisa y captura tokens
 */
 private async extractVisualEvidenceEnhanced(imagePaths: string[], rubroHints?: string): Promise<{
 visualEvidence: Record<string, any[]>;
 analyses: ImageAnalysis[];
 tokensUsed: { input: number; output: number };
 }> {
 const evidence: Record<string, any[]> = {};
 // Lista plana en el formato que guarda y muestra la auditoría: el servidor ya
 // no vuelve a analizar las capturas por su cuenta, reusa esta.
 const analyses: ImageAnalysis[] = [];
 // NUEVO: Acumuladores de tokens
 let totalInputTokens = 0;
 let totalOutputTokens = 0;

 for (let i = 0; i < imagePaths.length; i++) {
 const imagePath = imagePaths[i];
 let attempts = 0;
 const maxAttempts = 3;
 let success = false;

 while (attempts < maxAttempts && !success) {
 try {
 attempts++;

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
 text: await this.getEnhancedAnalysisPrompt(rubroHints)
 }
 ]
 }
 ]
 });

 // NUEVO: Capturar tokens de uso
 if (response.usage) {
 totalInputTokens += response.usage.input_tokens;
 totalOutputTokens += response.usage.output_tokens;
 logger.info(` Image ${i + 1} analysis tokens: ${response.usage.input_tokens} input + ${response.usage.output_tokens} output`);
 }

 const content = this.extractText(response);
 if (!content) {
 throw new Error('Empty response from Claude');
 }

 // El modelo a veces añade una frase después del JSON o se queda sin tokens a
 // media respuesta. parseModelJson distingue ambos casos y rescata la parte
 // completa, en vez de perder la captura y pagar otro intento.
 const sanitized = content.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
 const { data: parsed, salvaged } = parseModelJson<any>(sanitized, {
 stopReason: response.stop_reason,
 salvageTruncated: true,
 label: `análisis de la captura ${i + 1}`,
 });
 if (salvaged) {
 logger.warn(`Análisis de la captura ${i + 1} recuperado de una respuesta truncada — puede faltar algún campo`);
 }

 if (!parsed.system || !parsed.data) {
 throw new Error('Invalid JSON structure');
 }

 const system = parsed.system;
 if (!evidence[system]) {
 evidence[system] = [];
 }

 // Guardar TODA la data estructurada con metadatos
 evidence[system].push({
 imagePath,
 data: parsed.data,
 findings: parsed.findings || [],
 confidence: parsed.confidence || 0.9,
 critical_fields: parsed.critical_fields || {}
 });

 analyses.push({
 imagePath,
 system,
 data: { ...parsed.data, critical_fields: parsed.critical_fields || {} },
 findings: parsed.findings || [],
 confidence: parsed.confidence || 0.9,
 } as ImageAnalysis);

 success = true;
 logger.info(`Image ${i + 1}/${imagePaths.length} analyzed successfully (attempt ${attempts})`, {
 system,
 fieldsFound: Object.keys(parsed.data).length,
 criticalFieldsFound: Object.keys(parsed.critical_fields || {}).length
 });

 } catch (error: any) {
 logger.warn(`Error analyzing image ${i + 1}, attempt ${attempts}/${maxAttempts}`, {
 error: error.message
 });

 if (attempts >= maxAttempts) {
 logger.error(`Failed to analyze image ${i + 1} after ${maxAttempts} attempts`);
 } else {
 await new Promise(resolve => setTimeout(resolve, 1000));
 }
 }
 }
 }

 // NUEVO: Retornar evidencia Y tokens
 logger.info(` Visual evidence extraction total tokens: ${totalInputTokens} input + ${totalOutputTokens} output`);

 return {
 visualEvidence: evidence,
 analyses,
 tokensUsed: {
 input: totalInputTokens,
 output: totalOutputTokens
 }
 };
 }

 /**
 * MEJORADO: Prompt con mejor detección de campos críticos
 */
 private async getEnhancedAnalysisPrompt(rubroHints?: string): Promise<string> {
  // Config de sistemas de imagen pertenece a PositivoS+ (origen GPF).
  const imgCompanyId = await getDatabaseService().getPositivosCompanyId();
  return this.buildAnalysisPromptForCompany(imgCompanyId ?? undefined, rubroHints);
 }

 /**
  * El mismo prompt que se envía a la IA en cada auditoría, para mostrarlo en
  * Administración → Pantallas de proceso. Lo que se ve es lo que corre.
  */
 async previewImageAnalysisPrompt(companyId?: string): Promise<string> {
  const resolved = companyId ?? (await getDatabaseService().getPositivosCompanyId()) ?? undefined;
  return this.buildAnalysisPromptForCompany(resolved);
 }

 private async buildAnalysisPromptForCompany(companyId?: string, rubroHints?: string): Promise<string> {
  const systems = await getDatabaseService().getImageSystems(companyId);
  const domain = await getDatabaseService().getImageDomainContext(companyId);
  const activeSystems = systems.filter((s: any) => s.is_active !== false);
  if (activeSystems.length === 0) {
   return this.buildGenericAnalysisPrompt(rubroHints, domain ?? undefined);
  }
  return this.buildPromptFromSystems(activeSystems, rubroHints, domain ?? undefined);
 }

 /**
  * Construye el prompt de análisis de imágenes dinámicamente desde los sistemas en BD
  */
 private buildPromptFromSystems(systems: any[], rubroHints?: string, domainContext?: string): string {
  const domain = (domainContext ?? '').trim() || DEFAULT_IMAGE_DOMAIN;
  const systemNames = systems.map((s: any) => s.system_name).join('|');

  // PASO 1: detección
  const paso1Lines = systems.map((s: any) => {
   const hints = s.detection_hints || s.description || '';
   return `- **${s.system_name}**: ${hints}`;
  }).join('\n');

  // PASO 2: campos por sistema
  const paso2Sections = systems.map((s: any) => {
   const fields: any[] = Array.isArray(s.fields_schema) ? s.fields_schema : [];
   if (fields.length === 0) return `# ${s.system_name}:\n- (sin campos definidos)`;
   const fieldLines = fields.map((f: any) => {
    const example = f.example ? ` (ej: "${f.example}")` : '';
    return `- ${f.field_name}: ${f.description}${example}`;
   }).join('\n');
   return `# ${s.system_name}:\n${fieldLines}`;
  }).join('\n\n');

  const systemNamesFormatted = systems.map((s: any) => `"${s.system_name}"`).join(', ');

  return `Analiza esta captura de ${domain} con MÁXIMA PRECISIÓN y EXTRAE TODOS LOS DATOS VISIBLES.

**PASO 1: IDENTIFICA LA PANTALLA**

Las pantallas posibles son: ${systemNamesFormatted}

Pistas de detección por pantalla:
${paso1Lines}

IMPORTANTE: Si la captura es una pantalla de acceso, de login o un paso intermedio (por ejemplo un "Signon" de terminal), busca en el identificador de la sesión o en el contenido la pista de la pantalla real. Si no puedes determinarla, elige la que más se acerque según los campos visibles. NUNCA devuelvas como "system" el nombre de la pantalla de login — siempre elige una de las listadas arriba.

**PASO 2: EXTRAE TODOS LOS CAMPOS VISIBLES**

Lee CADA LÍNEA de texto visible. Para cada pantalla, extrae:

${paso2Sections}

**PASO 3: IDENTIFICA CAMPOS CRÍTICOS**

Para cada hallazgo importante, márcalo en "critical_fields". Usa las banderas de abajo cuando apliquen y añade las que hagan falta para esta pantalla:

{
 "has_case_number": true/false,
 "has_blocked_status": true/false,
 "has_folio_number": true/false,
 "has_transactions": true/false,
 "has_fraud_checkboxes": true/false,
 "has_block_codes": true/false
}

**FORMATO DE RESPUESTA JSON:**

\`\`\`json
{
 "system": "<elige UNO de: ${systemNamesFormatted}>",
 "confidence": 0.95,
 "data": { "todos_los_campos": "valores_extraidos" },
 "critical_fields": { "has_case_number": true },
 "findings": ["campo1: valor exacto encontrado"]
}
\`\`\`

**REGLAS CRÍTICAS:**
1. Lee TODO el texto visible - no omitas nada
2. Si ves un número, fecha o monto: EXTRÁELO EXACTAMENTE
3. Si ves checkboxes marcados: LISTA TODOS
4. Si ves transacciones: CUENTA CUÁNTAS
5. NO inventes valores - usa null si no está visible
6. SÉ ULTRA específico con cada dato
7. El campo "system" DEBE ser exactamente uno de los valores listados — ni más ni menos${rubroHints ? `

**CRITERIOS ACTIVOS A DETECTAR EN ESTA AUDITORÍA:**

Los siguientes rubros requieren validación en imágenes. Presta especial atención a la evidencia relacionada con cada uno:

${rubroHints}` : ''}`;
 }

 private buildGenericAnalysisPrompt(rubroHints?: string, domainContext?: string): string {
  const domain = (domainContext ?? '').trim() || DEFAULT_IMAGE_DOMAIN;
  return `Analiza esta captura de ${domain} y extrae TODOS los datos visibles.

Devuelve SOLO un JSON con esta estructura exacta:

\`\`\`json
{
  "system": "OTRO",
  "confidence": 0.9,
  "data": { "campo_visible": "valor_exacto" },
  "critical_fields": {},
  "findings": ["dato importante: valor encontrado"]
}
\`\`\`
${rubroHints ? `\n**DATOS A DETECTAR (presta especial atención):**\n${rubroHints}\n` : ''}
REGLAS:
1. Extrae TODOS los datos visibles: números, fechas, nombres, estados, montos, códigos
2. No inventes valores — usa null si no está visible
3. El campo "system" debe ser siempre "OTRO"
4. Sé ultra específico con cada dato extraído`;
 }

 /**
 * Ajusta el puntaje que devolvió el modelo a la escala del rubro.
 * Con escala discreta → opción más cercana.
 * Sin escala discreta → todo o nada (0 o el máximo): no hay parciales.
 */
 private applyScoreOptions(score: number, scoreOptions: ScoreOption[] | null, maxScore: number): number {
   const snapped = hasScoreOptions(scoreOptions)
     ? snapToNearestOption(score, scoreOptions)
     : snapToAllOrNothing(score, maxScore);
   if (snapped !== score) {
     logger.warn('Puntaje del modelo ajustado a la escala del rubro', { original: score, ajustado: snapped });
   }
   return snapped;
 }

 /**
 * MEJORADO: Evaluación con matching más preciso y captura de tokens
 */
 private async evaluateWithEnhancedMatching(
 criteria: EvaluationBlock[],
 visualEvidence: Record<string, any[]>,
 verbalEvidence: string[],
 transcript: TranscriptResult,
 auditInput: AuditInput
 ): Promise<{
 evaluation: any;
 tokensUsed: { input: number; output: number };
 manualTopics: DetailedScore[];
 }> {
 // Separar tópicos manuales (la IA no los evalúa) de los que sí se evalúan
 const manualTopics = criteria.flatMap(block =>
 block.topics
 .filter((topic: any) => topic.requiresManualReview)
 .map((topic: any) => ({
 criterion: `[${block.blockName}] ${topic.topic}`,
 score: 0,
 maxScore: resolveMaxScore(topic.points, topic.scoreOptions),
 observations: 'Requiere validación manual — este criterio no puede evaluarse automáticamente a partir de las capturas de pantalla.',
 criticality: topic.criticality,
 requiresManualReview: true,
 scoreOptions: topic.scoreOptions ?? null,
 }))
 );

 const topicsToEvaluate = criteria.flatMap(block =>
 block.topics
 .filter((topic: any) => topic.applies && !topic.requiresManualReview)
 .map((topic: any) => ({
 block: block.blockName,
 topic: topic.topic,
 criticality: topic.criticality,
 maxScore: resolveMaxScore(topic.points, topic.scoreOptions),
 whatToLookFor: topic.whatToLookFor || '',
 validationSource: topic.validationSource || [],
 scoreOptions: topic.scoreOptions ?? null,
 system: this.getSystemFromBlock(block.blockName)
 }))
 );

 if (topicsToEvaluate.length === 0) {
 throw new Error(`Todos los criterios de "${auditInput.callType}" tienen applies=false o no hay criterios activos en la BD.`);
 }

 const maxPossibleScore = topicsToEvaluate.reduce((sum, t) => sum + t.maxScore, 0)
   + manualTopics.reduce((sum, t) => sum + t.maxScore, 0);

 // Cargar guion desde BD (filtrado por empresa: sin companyId se mezclarían los
 // guiones de todos los clientes en el mismo call_type).
 const dbScripts = await getDatabaseService().getScriptsForCallType(
   auditInput.callType,
   auditInput.subCalificacion,
   auditInput.companyId ?? undefined,
 );
 const scriptSteps = this.buildScriptSteps(dbScripts, auditInput.callType);

 // Construir prompt con MATCHING MEJORADO
 const prompt = this.buildEnhancedMatchingPrompt(
 auditInput,
 visualEvidence,
 verbalEvidence,
 topicsToEvaluate,
 maxPossibleScore,
 transcript.text,
 scriptSteps,
 auditInput.gpfData,
 computeCallTiming(transcript.utterances),
 );

 const evaluationSystemPromptBase = await getDatabaseService().getPromptByKey('evaluation_system') ?? '';
 // Claude no tiene response_format json_object: reforzar salida JSON pura.
 const evaluationSystemPrompt = `${evaluationSystemPromptBase}\n\nIMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin markdown, sin fences \`\`\`, sin texto antes ni después.`;

 // La evaluación de una rúbrica completa ronda los 7-8k tokens de salida: con
 // max_tokens=8192 el JSON se cortaba a media justificación de forma
 // intermitente (el mismo caso fallaba en un intento y pasaba en el siguiente).
 const maxAttempts = 3;
 let lastError: Error | null = null;
 // Los reintentos también se cobran: acumular para no subreportar el costo.
 const wastedTokens = { input: 0, output: 0 };

 for (let attempt = 1; attempt <= maxAttempts; attempt++) {
 const response = await this.client.messages.create({
 model: CLAUDE_MODEL,
 max_tokens: EVALUATION_MAX_TOKENS,
 thinking: { type: 'disabled' },
 system: evaluationSystemPrompt,
 messages: [
 {
 role: 'user',
 content: prompt
 }
 ]
 });

 // NUEVO: Capturar tokens de evaluación
 const tokensUsed = {
 input: response.usage?.input_tokens || 0,
 output: response.usage?.output_tokens || 0
 };

 logger.info(` Evaluation tokens: ${tokensUsed.input} input + ${tokensUsed.output} output`);

 const content = this.extractText(response);

 try {
 if (!content) {
 throw new Error('No response from Claude');
 }
 if (response.stop_reason === 'max_tokens') {
 throw new ModelJsonError(
 `La evaluación se cortó por límite de tokens (max_tokens=${EVALUATION_MAX_TOKENS})`,
 content,
 true,
 );
 }

 const { data } = parseModelJson(content, {
 stopReason: response.stop_reason,
 label: 'evaluación',
 });

 // NUEVO: Retornar evaluación, tokens Y tópicos manuales
 return {
 evaluation: data,
 tokensUsed: {
 input: tokensUsed.input + wastedTokens.input,
 output: tokensUsed.output + wastedTokens.output,
 },
 manualTopics
 };
 } catch (error: any) {
 lastError = error;
 wastedTokens.input += tokensUsed.input;
 wastedTokens.output += tokensUsed.output;
 logger.warn(`Evaluación no parseable (intento ${attempt}/${maxAttempts})`, {
 error: error.message,
 stopReason: response.stop_reason,
 outputTokens: tokensUsed.output
 });
 if (attempt < maxAttempts) {
 await new Promise(resolve => setTimeout(resolve, 1000));
 }
 }
 }

 throw lastError ?? new Error('No se pudo obtener una evaluación válida del modelo');
 }

 /**
 * MEJORADO: Prompt con evidencia estructurada más clara
 */
 private buildEnhancedMatchingPrompt(
 auditInput: AuditInput,
 visualEvidence: Record<string, any[]>,
 verbalEvidence: string[],
 topics: any[],
 maxScore: number,
 transcriptText: string,
 scriptSteps?: any,
 gpfData?: AuditInput['gpfData'],
 timing?: CallTimingMetrics | null,
 ): string {
 // Formatear evidencia estructurada de forma más clara
 const structuredEvidence = Object.entries(visualEvidence)
 .map(([system, images]) => {
 const fieldsSection = images.map((img, idx) => {
 const dataFields = Object.entries(img.data)
 .map(([key, value]) => {
 const valueStr = typeof value === 'object'
 ? JSON.stringify(value)
 : String(value);
 return ` ${key}: ${valueStr}`;
 })
 .join('\n');

 const criticalFields = img.critical_fields
 ? Object.entries(img.critical_fields)
 .map(([key, value]) => ` ${key}: ${value}`)
 .join('\n')
 : '';

 return ` Imagen ${idx + 1}: ${img.imagePath.split(/[/\\]/).pop()}

DATOS EXTRAÍDOS:
${dataFields}

CAMPOS CRÍTICOS DETECTADOS:
${criticalFields || ' (ninguno marcado)'}

HALLAZGOS ESPECÍFICOS:
${img.findings.map((f: string) => ` ${f}`).join('\n')}`;
 }).join('\n\n');

 return `╔═════════════════════════════════════╗
SISTEMA: ${system}
╚═════════════════════════════════════╝

${fieldsSection}`;
 })
 .join('\n\n');

 // Guion oficial: se rinde con el nombre del paso y sus frases en orden, no como
 // JSON crudo indexado por step_key (ahí se perdían la etiqueta y el orden, y un
 // guion vacío llegaba como "{}" sin que el modelo supiera que faltaba).
 const steps: Array<{ order: number; key: string; label: string; lines: string[] }> =
   Array.isArray(scriptSteps) ? scriptSteps : [];
 const scriptSection = steps.length === 0
   ? '(No hay guion configurado para este tipo de llamada. NO penalices los rubros de script por ausencia de guion: márcalos con el puntaje más bajo y explícalo en la justificación.)'
   : steps.map((s, i) => {
       const lines = s.lines.length > 0
         ? s.lines.map((l, j) => `   ${j + 1}. ${l}`).join('\n')
         : '   (paso sin frases configuradas)';
       return `PASO ${i + 1} — ${s.label}\n${lines}`;
     }).join('\n\n');

 // Construir sección GPF estructurada
 const gpfSection = gpfData ? (() => {
  const fields = gpfData.attentionFields || {};
  const fieldLines = Object.entries(fields)
   .filter(([, v]) => v !== undefined && v !== null && v !== '')
   .map(([k, v]) => `- ${k}: ${v}`)
   .join('\n');

  const txLines = gpfData.transactions.length > 0
   ? gpfData.transactions.map((t, i) =>
    `${i + 1}. Fecha: ${t.date || '-'} | Comercio: ${t.commerce_name || '-'} | Monto: ${t.amount || '-'}`
   ).join('\n')
   : '(sin transacciones)';

  const commentLines = gpfData.comments.length > 0
   ? gpfData.comments.map((c, i) =>
    `${i + 1}. [${c.date || '-'}] ${c.agent || 'Agente'}: ${c.comment}`
   ).join('\n')
   : '(sin comentarios)';

  const otpLines = gpfData.otpValidations.length > 0
   ? gpfData.otpValidations.map((o, i) =>
    `${i + 1}. [${o.date || '-'}] ${o.agent || 'Agente'}: ${o.resultado ? 'EXITOSO' : 'FALLIDO'}`
   ).join('\n')
   : '(sin validaciones OTP)';

  const rawLines = gpfData.rawComments.length > 0
   ? gpfData.rawComments.map((c, i) => `${i + 1}. ${c}`).join('\n')
   : '(sin notas)';

  return `╔═════════════════════════════════════╗
DATOS ESTRUCTURADOS GPF
╚═════════════════════════════════════╝

CAMPOS DE LA ATENCIÓN GPF:
${fieldLines || '(sin campos registrados)'}

TRANSACCIONES GPF (${gpfData.transactions.length}):
${txLines}

COMENTARIOS DEL AGENTE GPF (${gpfData.comments.length}):
${commentLines}

VALIDACIONES OTP GPF (${gpfData.otpValidations.length}):
${otpLines}

NOTAS DE ATENCIÓN GPF (${gpfData.rawComments.length}):
${rawLines}`;
 })() : '(Auditoría sin datos GPF — no aplica fuente GPF)';

 return `# AUDITORÍA CON EVIDENCIA ESTRUCTURADA MEJORADA

**Información de la Auditoría:**
- Tipo: ${auditInput.callType}
- Calificación: ${auditInput.calificacion || 'No especificada'}
- Sub-calificación: ${auditInput.subCalificacion || 'No especificada'}
- Ejecutivo: ${auditInput.executiveName} (ID: ${auditInput.executiveId})
- Cliente: ${auditInput.clientId}
- Fecha: ${auditInput.callDate}

╔═════════════════════════════════════╗
REGLA DE FUENTE — OBLIGATORIA
╚═════════════════════════════════════╝

Cada tópico indica "Validar en". DEBES respetar estrictamente esa fuente:
- "GPF" → usa SOLO la sección DATOS ESTRUCTURADOS GPF
- "Imágenes del sistema" → usa SOLO la sección EVIDENCIA VISUAL ESTRUCTURADA
- "Llamada/Transcripción" → usa SOLO la sección EVIDENCIA VERBAL (Transcripción)
- Múltiples fuentes → usa TODAS las fuentes indicadas
- Si la fuente requerida no tiene evidencia → 0 puntos (NO busques en otras fuentes)
- PERO si al revisar el resto del material ves que esa evidencia SÍ existe en otra fuente
  (por ejemplo el dato está en GPF y el criterio exige Imágenes), debes decirlo en
  "recommendation": nombra la fuente donde sí aparece y qué habría que revisar o ajustar.
  El puntaje sigue siendo 0, pero el auditor tiene que enterarse de que el dato existe.

${gpfSection}

╔═════════════════════════════════════╗
EVIDENCIA VISUAL ESTRUCTURADA
╚═════════════════════════════════════╝

${structuredEvidence}

╔═════════════════════════════════════╗
EVIDENCIA VERBAL (Transcripción)
╚═════════════════════════════════════╝

MENCIONES CLAVE:
${verbalEvidence.slice(0, 40).join('\n')}

TRANSCRIPCIÓN COMPLETA:
${transcriptText || 'Sin transcripción disponible'}

MÉTRICAS DE TIEMPO DE LA LLAMADA (AssemblyAI):
Estas métricas forman parte de la fuente "Llamada/Transcripción".
${formatCallTimingForPrompt(timing ?? null)}

╔═════════════════════════════════════╗
SCRIPT OFICIAL DE REFERENCIA (${auditInput.callType})
╚═════════════════════════════════════╝

PASOS OBLIGATORIOS DEL SCRIPT:
${scriptSection}

El agente debe seguir estos pasos en orden para cumplir el script.

╔═════════════════════════════════════╗
TÓPICOS A EVALUAR
╚═════════════════════════════════════╝

${topics.map((t, i) => {
  const sourceLabels: string = Array.isArray(t.validationSource) && t.validationSource.length > 0
   ? t.validationSource.map((s: string) => s === 'gpf' ? 'GPF' : s === 'llamada' ? 'Llamada/Transcripción' : s.startsWith('imagenes:') ? `Imágenes ${s.slice(9)}` : 'Imágenes del sistema').join(' + ')
   : 'Toda la evidencia disponible';
  const sourceRule: string = Array.isArray(t.validationSource) && t.validationSource.length > 0
   ? `OBLIGATORIO: evalúa ÚNICAMENTE usando la(s) fuente(s): ${sourceLabels}. Si esa fuente no tiene evidencia → 0 puntos.`
   : 'Puedes usar cualquier evidencia disponible.';
  // Escala discreta: el modelo solo puede elegir de la lista cerrada del rubro.
  const options: ScoreOption[] | null = t.scoreOptions ?? null;
  const usableOptions = hasScoreOptions(options)
    ? options.filter(o => o.value !== null)
    : null;
  const scoringRule: string = usableOptions && usableOptions.length > 0
    ? `ESCALA CERRADA — "score" debe ser EXACTAMENTE uno de estos valores: ${usableOptions.map(o => o.value).join(', ')}
- Evidencia completa en la fuente correcta → ${Math.max(...usableOptions.map(o => o.value as number))}
- Evidencia ausente o contradictoria → ${Math.min(...usableOptions.map(o => o.value as number))}
- NO inventes valores intermedios ni puntos parciales fuera de la escala.
- NO uses N/A: si el rubro no aplica, califícalo con el valor más bajo y explícalo en la justificación; el analista lo marcará como N/A.`
    : `TODO O NADA — "score" debe ser EXACTAMENTE ${t.maxScore} o 0. NO existen calificaciones parciales.
- El criterio se cumple por completo con evidencia en la fuente correcta → ${t.maxScore} puntos
- El criterio se cumple a medias, no hay evidencia en la fuente requerida o la evidencia lo contradice → 0 puntos
- PROHIBIDO devolver valores intermedios (ni decimales ni fracciones de ${t.maxScore}).`;
  return `
┌────────────────────────────────────┐
${i + 1}. ${t.topic}
└────────────────────────────────────┘

Bloque: ${t.block}
Sistema: ${t.system}
Puntos máximos: ${t.maxScore}
Criticidad: ${t.criticality}
Validar en: ${sourceLabels}
Regla de fuente: ${sourceRule}

QUÉ BUSCAR:
${t.whatToLookFor || 'Revisar evidencia relacionada con este criterio en la fuente indicada.'}

CRITERIO DE CALIFICACIÓN:
${scoringRule}
`; }).join('\n\n')}

╔═════════════════════════════════════╗
FORMATO DE RESPUESTA
╚═════════════════════════════════════╝

REGLA CRÍTICA: En el JSON, los campos "block" y "topic" deben ser EXACTAMENTE iguales a los nombres que aparecen en la sección TÓPICOS A EVALUAR (campo "Bloque:" y el título numerado del tópico). No abrevies, no traduzcas, no modifiques mayúsculas/minúsculas.

Responde con JSON válido siguiendo este formato:

\`\`\`json
{
 "evaluations": [
 {
 "block": "<nombre exacto del campo Bloque del tópico>",
 "topic": "<nombre exacto del tópico numerado>",
 "score": 0 o los puntos completos del tópico (nunca un valor intermedio),
 "max_score": puntos_maximos,
 "justification": "EVIDENCIA CONCRETA ENCONTRADA: [cita campos específicos]. Por lo tanto, [conclusión].",
 "recommendation": "Qué debe hacer el auditor o el agente para que este rubro quede correcto. Vacío si el rubro obtuvo el puntaje completo.",
 "evidence": [
 "data.campo1: valor - Fuente: Sistema X, Imagen Y",
 "data.campo2: valor - Fuente: Transcripción, minuto Z",
 "critical_fields.has_xxx: true - Confirmado en análisis visual"
 ],
 "completed": true
 }
 ],
 "total_score": suma_total,
 "max_possible_score": ${maxScore},
 "percentage": (total_score / max_possible_score) * 100,
 "observations": "Resumen detallado basado en evidencia encontrada",
 "recommendations": [
 "Recomendación específica 1",
 "Recomendación específica 2",
 "Recomendación específica 3"
 ],
 "key_moments": [
 {
 "timestamp": "MM:SS",
 "event": "Evento importante",
 "description": "Descripción del evento",
 "impact": "positive|negative|neutral"
 }
 ]
}
\`\`\`

**INSTRUCCIONES FINALES:**

1. Evalúa CADA tópico independientemente
2. USA la evidencia estructurada como fuente primaria
3. CITA los campos específicos en cada justificación
4. Si otorgas 0 puntos, explica QUÉ evidencia faltó
5. Si otorgas puntos completos, explica QUÉ evidencia lo sustenta
6. NO seas conservador si la evidencia existe
7. SÉ preciso y específico en cada evaluación
8. En "block" y "topic" usa el texto EXACTO como aparece en la sección TÓPICOS A EVALUAR. No cambies mayúsculas, tildes ni abrevies.
9. RECOMENDACIÓN por rubro: siempre que el puntaje NO sea el máximo, completa "recommendation" con una
   indicación accionable y concreta para el auditor. Reglas:
   - Di QUÉ falta y DÓNDE debería estar ("en la captura de VCAS debe verse el comentario …").
   - Si la evidencia existe pero en una fuente distinta a la exigida, dilo explícitamente:
     "el dato SÍ aparece en GPF (campo …), pero este rubro exige Imágenes VCAS: validar manualmente
     o revisar la fuente configurada para el criterio".
   - Si el rubro no se puede medir con el material disponible, dilo y pide validación manual.
   - Nada de frases genéricas tipo "mejorar el proceso": debe poder ejecutarse tal cual está escrita.
   - Si el rubro obtuvo el puntaje completo, deja "recommendation" como cadena vacía.`;
 }

 // Matching rules are now driven entirely by the 'whatToLookFor' field in evaluation_criteria (BD).

 private getSystemFromBlock(blockName: string): string {
 const mapping: Record<string, string> = {
 'Falcon': 'FALCON',
 'Front': 'FRONT',
 'Vcas': 'VCAS',
 'Vision': 'VISION',
 'VRM': 'VRM',
 'B.I': 'BI',
 'Manejo de llamada': 'TRANSCRIPCIÓN'
 };
 return mapping[blockName] || blockName;
 }

 private extractVerbalEvidence(transcript: TranscriptResult): string[] {
 const evidence: string[] = [];
 const keywords = [
 'bloque', 'bloqu', 'tarjeta',
 'folio', 'caso', 'número',
 'transacción', 'compra', 'cargo',
 'confirmo', 'confirmó', 'reconoce', 'reconozco',
 'fraude', 'fraudulent',
 'excel', 'archivo', 'documento',
 'autenticación', 'autentica', 'verifico', 'valido',
 'sistema', 'vcas', 'falcon', 'vision',
 'reposición', 'pasos a seguir', 'plástico',
 'sucursal', 'días', 'nueva',
 'callerid', 'caller id', 'identificador de llamada',
 'otp', 'código', 'clave', 'pin', 'token',
 'verificar', 'validar', 'corroborar',
 'identidad', 'identificación',
 'preguntas de seguridad',
 'último cargo', 'últimos movimientos', 'saldo',
 'código de seguridad'
 ];

 transcript.utterances.forEach(utt => {
 const lowerText = utt.text.toLowerCase();
 const hasKeyword = keywords.some(kw => lowerText.includes(kw));

 if (hasKeyword && utt.text.length > 15) {
 const timestamp = this.formatTime(utt.start);
 evidence.push(`[${timestamp}] ${utt.speaker}: "${utt.text}"`);
 }
 });

 return evidence;
 }

 private formatTranscript(transcript: TranscriptResult): string {
 if (transcript.utterances.length === 0) {
 return transcript.text;
 }

 return transcript.utterances
 .map((utt) => {
 const timestamp = this.formatTime(utt.start);
 return `[${timestamp}] ${utt.speaker}: ${utt.text}`;
 })
 .join('\n\n');
 }

 private formatTime(timeValue: number): string {
 const totalSeconds = timeValue >= 1000 ? Math.floor(timeValue / 1000) : timeValue;

 const mins = Math.floor(totalSeconds / 60);
 const secs = Math.floor(totalSeconds % 60);
 return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
 }
}

export { EvaluatorService };

let instance: EvaluatorService | null = null;
export const getEvaluatorService = () => {
 if (!instance) {
 instance = new EvaluatorService();
 }
 return instance;
};

export const evaluatorService = {
 evaluate: async (auditInput: any, transcript: any) => {
 return getEvaluatorService().evaluate(auditInput, transcript);
 },
 previewImageAnalysisPrompt: async (companyId?: string) => {
 return getEvaluatorService().previewImageAnalysisPrompt(companyId);
 }
};