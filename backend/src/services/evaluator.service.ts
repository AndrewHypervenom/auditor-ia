//backend/src/services/evaluator.service.ts

import OpenAI from 'openai';
import { logger } from '../utils/logger.js';
import type { AuditInput, TranscriptResult, ImageAnalysis, EvaluationResult } from '../types/index.js';
import type { EvaluationBlock } from '../config/evaluation-criteria.js';
import { getDatabaseService } from './database.service.js';
import * as fs from 'fs';

class EvaluatorService {
 private client: OpenAI;

 constructor() {
 const apiKey = process.env.OPENAI_API_KEY;
 if (!apiKey) {
 throw new Error('OPENAI_API_KEY is not configured');
 }
 this.client = new OpenAI({ apiKey });
 }

 async evaluate(
 auditInput: AuditInput,
 transcript: TranscriptResult,
 imageAnalyses: ImageAnalysis[]
 ): Promise<Omit<EvaluationResult, 'excelUrl'> & { usage?: { inputTokens: number; outputTokens: number; totalTokens: number } }> {
 try {
 logger.info('Starting ENHANCED evaluation', {
 callType: auditInput.callType,
 executiveId: auditInput.executiveId
 });

 // NUEVO: Acumuladores de tokens
 let totalInputTokens = 0;
 let totalOutputTokens = 0;

 // PASO 0: Obtener criterios — necesarios para enriquecer el análisis de imágenes
 const criteriaEarly = await getDatabaseService().getCriteriaForCallType(auditInput.callType) as EvaluationBlock[];

 // Construir hints de rubros que deben validarse en imágenes
 const imageRubroHints = criteriaEarly
  .flatMap((block: any) =>
   block.topics
    .filter((t: any) => t.applies && Array.isArray(t.validationSource) && t.validationSource.includes('imagenes') && t.whatToLookFor)
    .map((t: any) => `- [${block.blockName}] ${t.topic}: ${t.whatToLookFor}`)
  ).join('\n');

 // PASO 1: Análisis estructurado de evidencia visual MEJORADO
 const { visualEvidence, tokensUsed: visualTokens } = await this.extractVisualEvidenceEnhanced(auditInput.imagePaths || [], imageRubroHints || undefined);

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

 // PASO 4b: Verificar si algún criterio crítico obtuvo 0
 const criticalTopics = criteria.flatMap(block =>
 block.topics
 .filter(t => t.applies && t.criticality === 'Crítico' && typeof t.points === 'number')
 .map(t => t.topic)
 );

 const failedCriticalCriteria: string[] = (evaluation.evaluations as any[])
 .filter(ev => criticalTopics.includes(ev.topic) && ev.score === 0)
 .map(ev => ev.topic);

 const criticalFailure = failedCriticalCriteria.length > 0;
 if (criticalFailure) {
 evaluation.percentage = 0;
 evaluation.total_score = 0;
 logger.warn('Critical failure detected — result forced to 0', { failedCriticalCriteria });
 }

 logger.success('Evaluation completed with enhanced matching', {
 totalScore: evaluation.total_score,
 percentage: evaluation.percentage,
 criticalFailure,
 tokensUsed: `${evalTokens.input} input + ${evalTokens.output} output`
 });

 // Mapa de criticidad por nombre de tópico (para incluirlo en detailedScores)
 const topicCriticalityMap = new Map<string, string>(
 criteria.flatMap(block =>
 block.topics.map(t => [t.topic, t.criticality || '-'])
 )
 );

 // Transformar a formato de respuesta — en el orden original de criterios de la BD
 const aiResultMap = new Map<string, any>();
 for (const ev of evaluation.evaluations as any[]) {
   aiResultMap.set(`${ev.block}|||${ev.topic}`, ev);
 }
 const manualMap = new Map<string, any>();
 for (const m of manualTopics) {
   manualMap.set(m.criterion, m);
 }

 const detailedScores = criteria.flatMap(block =>
   block.topics
     .filter((t: any) => t.applies)
     .map((t: any) => {
       const manualKey = `[${block.blockName}] ${t.topic}`;
       if (t.requiresManualReview) {
         return manualMap.get(manualKey) ?? null;
       }
       const ai = aiResultMap.get(`${block.blockName}|||${t.topic}`);
       if (ai) {
         return {
           criterion: `[${ai.block}] ${ai.topic}`,
           score: ai.score,
           maxScore: ai.max_score,
           observations: ai.justification,
           criticality: topicCriticalityMap.get(ai.topic) || '-',
         };
       }
       return null;
     })
     .filter(Boolean)
 ) as Array<{ criterion: string; score: number; maxScore: number; observations: string; criticality: string }>;

 const keyMoments: Array<{
 timestamp: string;
 type: string;
 description: string;
 }> = evaluation.key_moments?.map((moment: any) => ({
 timestamp: moment.timestamp,
 type: moment.event,
 description: moment.description
 })) || [];

 const result: Omit<EvaluationResult, 'excelUrl'> & { usage: { inputTokens: number; outputTokens: number; totalTokens: number } } = {
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
 * MEJORADO: Extrae evidencia visual con detección más precisa y captura tokens
 */
 private async extractVisualEvidenceEnhanced(imagePaths: string[], rubroHints?: string): Promise<{
 visualEvidence: Record<string, any[]>;
 tokensUsed: { input: number; output: number };
 }> {
 const evidence: Record<string, any[]> = {};
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
 text: await this.getEnhancedAnalysisPrompt(rubroHints)
 }
 ]
 }
 ]
 });

 // NUEVO: Capturar tokens de uso
 if (response.usage) {
 totalInputTokens += response.usage.prompt_tokens;
 totalOutputTokens += response.usage.completion_tokens;
 logger.info(` Image ${i + 1} analysis tokens: ${response.usage.prompt_tokens} input + ${response.usage.completion_tokens} output`);
 }

 const content = response.choices[0]?.message?.content;
 if (!content) {
 throw new Error('Empty response from OpenAI');
 }

 // Limpieza robusta
 let cleanedContent = content.trim();
 cleanedContent = cleanedContent.replace(/```json\n?/gi, '');
 cleanedContent = cleanedContent.replace(/```\n?/g, '');
 cleanedContent = cleanedContent.replace(/^\uFEFF/, '');
 cleanedContent = cleanedContent.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

 const parsed = JSON.parse(cleanedContent);

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
  const systems = await getDatabaseService().getImageSystems();
  const activeSystems = systems.filter((s: any) => s.is_active !== false);
  if (activeSystems.length === 0) {
   return this.buildGenericAnalysisPrompt(rubroHints);
  }
  return this.buildPromptFromSystems(activeSystems, rubroHints);
 }

 /**
  * Construye el prompt de análisis de imágenes dinámicamente desde los sistemas en BD
  */
 private buildPromptFromSystems(systems: any[], rubroHints?: string): string {
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

  return `Analiza esta captura de pantalla de sistema bancario con MÁXIMA PRECISIÓN y EXTRAE TODOS LOS DATOS VISIBLES.

**PASO 1: IDENTIFICA EL SISTEMA**

Los sistemas posibles son: ${systemNamesFormatted}

Pistas de detección por sistema:
${paso1Lines}

IMPORTANTE: Si ves una pantalla de "Signon to CICS", "CICS login", o pantalla de inicio de sesión IBM, busca en el APPLID o en el contenido la pista del sistema real. Si no puedes determinar el sistema, elige el que más se acerque según los campos visibles. NUNCA devuelvas "CICS" como system — siempre elige uno de los sistemas listados arriba.

**PASO 2: EXTRAE TODOS LOS CAMPOS VISIBLES**

Lee CADA LÍNEA de texto visible. Para cada sistema, extrae:

${paso2Sections}

**PASO 3: IDENTIFICA CAMPOS CRÍTICOS**

Para cada hallazgo importante, márcalo en "critical_fields":

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

 private buildGenericAnalysisPrompt(rubroHints?: string): string {
  return `Analiza esta captura de pantalla de sistema bancario y extrae TODOS los datos visibles.

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
 manualTopics: Array<{ criterion: string; score: number; maxScore: number; observations: string; criticality: string; requiresManualReview: boolean }>;
 }> {
 // Separar tópicos manuales (la IA no los evalúa) de los que sí se evalúan
 const manualTopics = criteria.flatMap(block =>
 block.topics
 .filter((topic: any) => topic.applies && topic.requiresManualReview)
 .map((topic: any) => ({
 criterion: `[${block.blockName}] ${topic.topic}`,
 score: 0,
 maxScore: topic.points === 'n/a' ? 0 : (topic.points as number),
 observations: 'Requiere validación manual — este criterio no puede evaluarse automáticamente a partir de las capturas de pantalla.',
 criticality: topic.criticality,
 requiresManualReview: true,
 }))
 );

 const topicsToEvaluate = criteria.flatMap(block =>
 block.topics
 .filter((topic: any) => topic.applies && !topic.requiresManualReview)
 .map((topic: any) => ({
 block: block.blockName,
 topic: topic.topic,
 criticality: topic.criticality,
 maxScore: topic.points as number,
 whatToLookFor: topic.whatToLookFor || '',
 validationSource: topic.validationSource || [],
 system: this.getSystemFromBlock(block.blockName)
 }))
 );

 if (topicsToEvaluate.length === 0) {
 throw new Error(`Todos los criterios de "${auditInput.callType}" tienen applies=false o no hay criterios activos en la BD.`);
 }

 const maxPossibleScore = topicsToEvaluate.reduce((sum, t) => sum + t.maxScore, 0)
   + manualTopics.reduce((sum, t) => sum + t.maxScore, 0);

 // Cargar script desde BD
 const dbScripts = await getDatabaseService().getScriptsForCallType(auditInput.callType);
 const scriptSteps = dbScripts.reduce((acc: any, s: any) => {
   acc[s.step_key] = s.lines;
   return acc;
 }, {});

 // Construir prompt con MATCHING MEJORADO
 const prompt = this.buildEnhancedMatchingPrompt(
 auditInput,
 visualEvidence,
 verbalEvidence,
 topicsToEvaluate,
 maxPossibleScore,
 transcript.text,
 scriptSteps,
 auditInput.gpfData
 );

 const evaluationSystemPrompt = await getDatabaseService().getPromptByKey('evaluation_system') ?? '';

 const response = await this.client.chat.completions.create({
 model: 'gpt-5.4-mini',
 messages: [
 {
 role: 'system',
 content: evaluationSystemPrompt
 },
 {
 role: 'user',
 content: prompt
 }
 ],
 temperature: 0,
 seed: 12345,

 response_format: { type: 'json_object' }
 });

 // NUEVO: Capturar tokens de evaluación
 const tokensUsed = {
 input: response.usage?.prompt_tokens || 0,
 output: response.usage?.completion_tokens || 0
 };

 logger.info(` Evaluation tokens: ${tokensUsed.input} input + ${tokensUsed.output} output`);

 const content = response.choices[0]?.message?.content;
 if (!content) {
 throw new Error('No response from OpenAI');
 }

 // NUEVO: Retornar evaluación, tokens Y tópicos manuales
 return {
 evaluation: JSON.parse(content),
 tokensUsed,
 manualTopics
 };
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
 gpfData?: AuditInput['gpfData']
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

╔═════════════════════════════════════╗
SCRIPT OFICIAL DE REFERENCIA (${auditInput.callType})
╚═════════════════════════════════════╝

PASOS OBLIGATORIOS DEL SCRIPT:
${JSON.stringify(scriptSteps, null, 2)}

El agente debe seguir estos pasos en orden para cumplir el script.

╔═════════════════════════════════════╗
TÓPICOS A EVALUAR
╚═════════════════════════════════════╝

${topics.map((t, i) => {
  const sourceLabels: string = Array.isArray(t.validationSource) && t.validationSource.length > 0
   ? t.validationSource.map((s: string) => s === 'gpf' ? 'GPF' : s === 'imagenes' ? 'Imágenes del sistema' : 'Llamada/Transcripción').join(' + ')
   : 'Toda la evidencia disponible';
  const sourceRule: string = Array.isArray(t.validationSource) && t.validationSource.length > 0
   ? `OBLIGATORIO: evalúa ÚNICAMENTE usando la(s) fuente(s): ${sourceLabels}. Si esa fuente no tiene evidencia → 0 puntos.`
   : 'Puedes usar cualquier evidencia disponible.';
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
- Si encuentras la evidencia específica en la fuente correcta → ${t.maxScore} puntos
- Si la evidencia es parcial → Otorga puntos parciales proporcionalmente
- Si NO hay evidencia en la fuente requerida o contradice → 0 puntos
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
 "score": 0 o puntos_completos o puntos_parciales,
 "max_score": puntos_maximos,
 "justification": "EVIDENCIA CONCRETA ENCONTRADA: [cita campos específicos]. Por lo tanto, [conclusión].",
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
8. En "block" y "topic" usa el texto EXACTO como aparece en la sección TÓPICOS A EVALUAR. No cambies mayúsculas, tildes ni abrevies.`;
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
 evaluate: async (auditInput: any, transcript: any, imageAnalyses: any) => {
 return getEvaluatorService().evaluate(auditInput, transcript, imageAnalyses);
 }
};