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

 // PASO 1: Análisis estructurado de evidencia visual MEJORADO
 const { visualEvidence, tokensUsed: visualTokens } = await this.extractVisualEvidenceEnhanced(auditInput.imagePaths || []);

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

 // PASO 3: Obtener criterios desde BD
 const criteria = await getDatabaseService().getCriteriaForCallType(auditInput.callType) as EvaluationBlock[];

 // PASO 4: Evaluación con MATCHING MEJORADO
 const { evaluation, tokensUsed: evalTokens } = await this.evaluateWithEnhancedMatching(
 criteria,
 visualEvidence,
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

 // Transformar a formato de respuesta
 const detailedScores: Array<{
 criterion: string;
 score: number;
 maxScore: number;
 observations: string;
 criticality: string;
 }> = evaluation.evaluations.map((ev: any) => ({
 criterion: `[${ev.block}] ${ev.topic}`,
 score: ev.score,
 maxScore: ev.max_score,
 observations: ev.justification,
 criticality: topicCriticalityMap.get(ev.topic) || '-'
 }));

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
 private async extractVisualEvidenceEnhanced(imagePaths: string[]): Promise<{
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
 text: await this.getEnhancedAnalysisPrompt()
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
 private async getEnhancedAnalysisPrompt(): Promise<string> {
  const systems = await getDatabaseService().getImageSystems();
  const activeSystems = systems.filter((s: any) => s.is_active !== false);
  if (activeSystems.length === 0) {
   throw new Error('No hay sistemas de imagen configurados en la base de datos. Agrega sistemas en el panel Admin → Criterios → Sistemas de Imagen.');
  }
  return this.buildPromptFromSystems(activeSystems);
 }

 /**
  * Construye el prompt de análisis de imágenes dinámicamente desde los sistemas en BD
  */
 private buildPromptFromSystems(systems: any[]): string {
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

  return `Analiza esta captura de pantalla de sistema bancario con MÁXIMA PRECISIÓN y EXTRAE TODOS LOS DATOS VISIBLES.

**PASO 1: IDENTIFICA EL SISTEMA**

${paso1Lines}

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
 "system": "${systemNames}",
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
6. SÉ ULTRA específico con cada dato`;
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
 }> {
 const topicsToEvaluate = criteria.flatMap(block =>
 block.topics
 .filter(topic => topic.applies)
 .map(topic => ({
 block: block.blockName,
 topic: topic.topic,
 criticality: topic.criticality,
 maxScore: topic.points as number,
 whatToLookFor: topic.whatToLookFor || '',
 system: this.getSystemFromBlock(block.blockName)
 }))
 );

 const maxPossibleScore = topicsToEvaluate.reduce((sum, t) => sum + t.maxScore, 0);

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
 scriptSteps
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

 // NUEVO: Retornar evaluación Y tokens
 return {
 evaluation: JSON.parse(content),
 tokensUsed
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
 scriptSteps?: any
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

 return `# AUDITORÍA CON EVIDENCIA ESTRUCTURADA MEJORADA

**Información de la Auditoría:**
- Tipo: ${auditInput.callType}
- Calificación: ${auditInput.calificacion || 'No especificada'}
- Sub-calificación: ${auditInput.subCalificacion || 'No especificada'}
- Ejecutivo: ${auditInput.executiveName} (ID: ${auditInput.executiveId})
- Cliente: ${auditInput.clientId}
- Fecha: ${auditInput.callDate}

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

${topics.map((t, i) => `
┌────────────────────────────────────┐
${i + 1}. ${t.topic}
└────────────────────────────────────┘

Bloque: ${t.block}
Sistema: ${t.system}
Puntos máximos: ${t.maxScore}
Criticidad: ${t.criticality}

QUÉ BUSCAR:
${t.whatToLookFor}

INSTRUCCIONES DE MATCHING:

${this.getEnhancedMatchingRulesForTopic(t.topic, t.system)}

CRITERIO DE CALIFICACIÓN:
- Si encuentras la evidencia específica → ${t.maxScore} puntos
- Si la evidencia es parcial → Otorga puntos parciales proporcionalmente
- Si NO hay evidencia o contradice → 0 puntos

IMPORTANTE: Revisa TODA la evidencia (visual + verbal) antes de calificar.
`).join('\n\n')}

╔═════════════════════════════════════╗
FORMATO DE RESPUESTA
╚═════════════════════════════════════╝

Responde con JSON válido siguiendo este formato:

\`\`\`json
{
 "evaluations": [
 {
 "block": "Nombre del bloque",
 "topic": "Nombre del tópico",
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
7. SÉ preciso y específico en cada evaluación`;
 }

 /**
 * MEJORADO: Reglas de matching más específicas
 */
 private getEnhancedMatchingRulesForTopic(topic: string, system: string): string {
 const rules: Record<string, string> = {
 'Cierre correcto del caso': `
BUSCAR EN:
- Transcripción: palabras clave ["bloqueé", "bloqueada", "reposición", "nueva tarjeta", "5 días", "sucursal"]
- Frases que indiquen pasos a seguir al cliente

CRITERIO:
 Si el agente menciona bloqueo Y pasos siguientes (reposición/sucursal) → PUNTOS COMPLETOS
 Si solo menciona una parte → PUNTOS PARCIALES
 Si no menciona el cierre → 0 puntos`,

 'Creación y llenado correcto del caso: (creación correcto del caso, selección de casillas, calificación de transacciones, comentarios correctos)': `
BUSCAR EN:
- FALCON: data.case_number (debe existir y tener formato válido)
- FALCON: data.checkboxes_checked (debe tener 3+ items)
- FALCON: data.transactions_marked = true
- FALCON: data.comment_text (debe tener contenido sustancial >20 chars)

CRITERIO:
 Si case_number existe Y checkboxes_checked tiene 3+ items Y transactions_marked = true Y comment_text tiene contenido → PUNTOS COMPLETOS
 Si faltan 1-2 elementos → PUNTOS PARCIALES
 Si falta case_number o todos están vacíos → 0 puntos`,

 'Codificación correcta del caso': `
BUSCAR EN:
- FRONT: data.case_code (debe contener "Fraude" o "Cerrado - Fraude")
- FRONT: data.case_type

CRITERIO:
 Si case_code contiene "Fraude" → PUNTOS COMPLETOS
 Si no existe o tiene otro valor → 0 puntos`,

 'Llenado correcto del front (caso correcto, comentarios acorde a la gestión, tienen afectación/ sin afectación)': `
BUSCAR EN (PRIORIDAD):
1. FRONT: data.comments_section (debe tener texto)
2. FRONT: data.has_afectacion (debe ser true o false, NO null)
3. FRONT: data.case_complete = true

BÚSQUEDA ALTERNATIVA (si NO hay FRONT):
4. FALCON: data.comment_text (comentarios del cliente >20 caracteres)
5. FALCON: data.case_number existe (implica que hay caso registrado)

CRITERIO FLEXIBLE:
 Si FRONT existe con comments_section Y has_afectacion válido → PUNTOS COMPLETOS (5)
 Si NO hay FRONT pero SÍ hay comment_text en FALCON >20 chars → PUNTOS COMPLETOS (5)
 Si solo hay comentarios parciales → PUNTOS PARCIALES (3)
 Si NO hay ningún comentario → 0 puntos

JUSTIFICACIÓN:
"Comentarios encontrados en [FRONT/FALCON]: [extracto]. Llenado considerado correcto."`,

 'Colocar capturas completas y correctas': `
EVALUAR CALIDAD Y CORRECCIÓN (no solo contar sistemas):

Para FRAUDE - verificar estados correctos:
- VCAS presente: account_status debe ser BLOCKED (si está ACTIVE, la captura NO es válida para caso FRAUDE)
- VISION presente: block_types_marked debe contener BLKI
- FALCON presente: case_number debe existir
- VRM presente: search_attempted = true
- BI presente: folio_number debe existir

CRITERIO:
 4+ sistemas con estados correctos → PUNTOS COMPLETOS (5)
 4+ sistemas pero con 1-2 estados incorrectos → PUNTOS PARCIALES (3)
 3 sistemas con estados correctos → PUNTOS PARCIALES (2)
 Menos de 3 sistemas O mayoría con estados incorrectos → 0 puntos

DIFERENCIA CLAVE: Captura de VCAS con account_status=ACTIVE en caso FRAUDE NO es válida.`,

 'Subir Excel': `
 REGLA CRÍTICA - NO CONFUNDIR SISTEMA CON ARCHIVO:

BUSCAR EN:
- OTRO: data.excel_visible = true
- OTRO: data.content_type = "EXCEL_FILE"
- OTRO: data.is_bi_system debe ser FALSE

 NO ACEPTAR:
- Sistema BI con "Transacciones seleccionadas" (NO es Excel subido)
- Tablas dentro de interfaces del sistema
- Pantallas con logos Bradescard/VISA (es sistema)

 SÍ ACEPTAR:
- Captura de Microsoft Excel con columnas A, B, C
- Interfaz de Excel abierto
- Archivo Excel con datos de transacciones

CRITERIO ESTRICTO:
 Si excel_visible = true Y content_type = "EXCEL_FILE" Y is_bi_system = false → PUNTOS COMPLETOS (5)
 Si is_bi_system = true (aunque haya transacciones) → 0 puntos
 Si NO hay evidencia de archivo Excel real → 0 puntos

JUSTIFICACIÓN SI OTORGA PUNTOS:
"Excel subido visible: [nombre_archivo o descripción del archivo]"

JUSTIFICACIÓN SI NO OTORGA PUNTOS:
"Solo se observan pantallas del sistema BI. No hay evidencia de archivo Excel subido."`,

 'Bloquea tarjeta': `
BUSCAR EN:
- VCAS: data.account_status = "BLOCKED"
- VISION: data.block_types_marked contiene "BLKI"
- VISION: data.block_code existe
- Transcripción: menciones de "bloqueé", "bloqueada", "bloqueamos"

CRITERIO:
 Si account_status = BLOCKED O block_types_marked contiene BLKI O agente menciona bloqueo → PUNTOS COMPLETOS
 Si account_status = ACTIVE y no hay menciones → 0 puntos`,

 'Califica transacciones': `
BUSCAR EN:
- VCAS: data.transactions_marked = true
- FALCON: data.transactions_marked = true
- FALCON: data.transaction_count > 0

CRITERIO:
 Si transactions_marked = true en cualquier sistema → PUNTOS COMPLETOS
 Si no hay transacciones marcadas → 0 puntos`,

 'Comentarios correctos en ASHI': `
BUSCAR EN:
- VISION: data.ashi_comments (debe existir)
- VISION: data.ashi_detailed = true
- VISION: cualquier campo de comentarios con contenido

CRITERIO:
 Si ashi_comments existe con texto O ashi_detailed = true → PUNTOS COMPLETOS
 Si no hay comentarios → 0 puntos`,

 'Bloqueo correcto': `
BUSCAR EN:
- VISION: data.block_types_marked debe contener "BLKI"
- VISION: data.block_code = "F" (para fraude)
- VISION: data.block_date existe

CRITERIO:
 Si block_types_marked contiene "BLKI" → PUNTOS COMPLETOS
 Si no hay BLKI o está vacío → 0 puntos`,

 'Valida compras en ARTD y ARSD': `
BUSCAR EN:
- VRM: data.search_attempted = true
- VRM: data.account_searched existe
- VRM: cualquier indicador de validación

CRITERIO:
 Si search_attempted = true O account_searched tiene valor → PUNTOS COMPLETOS
 Si no hay evidencia de búsqueda en VRM → 0 puntos

NOTA: Si la imagen de VRM muestra "No se encontraron cuentas", esto CUENTA como validación intentada → PUNTOS COMPLETOS`,

 'Calificación de transacciones, comentarios y aplica mantenimiento': `
BUSCAR EN:
- VRM: data.maintenance_applied = true
- VRM: data.maintenance_code existe
- VRM: cualquier indicador de mantenimiento

CRITERIO:
 Si maintenance_applied = true O hay código de mantenimiento → PUNTOS COMPLETOS
 Si no hay evidencia de mantenimiento → 0 puntos`,

 'Crea el Folio Correctamente': `
BUSCAR EN:
- BI: data.folio_created = true
- BI: data.folio_number existe (formato: 10 dígitos)
- BI: data.bi_category → VERIFICAR que sea categoría de FRAUDE
- BI: critical_fields.has_folio_number = true
- BI: mensaje "Se ha creado el folio" visible

CRITERIO (aplicar EN ESTE ORDEN, son casos mutuamente excluyentes):
1. folio_number existe Y folio_created=true Y bi_category contiene "Fraude" → PUNTOS COMPLETOS (10)
2. folio_number existe Y folio_created=true Y bi_category es null, vacío o no visible en captura → PUNTOS PARCIALES (7). El folio existe pero la categoría no es legible en la imagen; no penalizar por dato no visible.
3. folio_number existe Y folio_created=true Y bi_category tiene valor explícito distinto a "Fraude" → 0 PUNTOS. JUSTIFICACIÓN: "Folio en categoría incorrecta '[bi_category]'."
4. folio_created=false O sin folio_number → 0 puntos

REGLA CRÍTICA: bi_category=null/ausente es caso 2 (parcial), NO es caso 3. Solo dar 0 por categoría si hay un valor explícito incorrecto.`,

 'Cumple con el script': `
COMPARAR transcripción contra el SCRIPT OFICIAL incluido arriba.

VERIFICAR los siguientes pasos obligatorios en ORDEN:

FRAUDE/INBOUND:
 1. Bienvenida: "Monitoreo bradescard, te atiende [nombre]... ¿con quién tengo el gusto?"
 2. Autenticación: Caller ID (últimos 4 dígitos) O OTP (código de seguridad) O preguntas de seguridad
 3. Sondeo: Preguntar fecha/comercio/monto del cargo no reconocido
 4. Información del proceso de bloqueo: mencionar que se bloqueará la tarjeta
 5. Recapitulación: Confirmar número de aclaración, comercios, fechas
 6. Información de reposición: sucursal O domicilio según socio
 7. Despedida: mencionar app, nombre del agente, encuesta de satisfacción

TH CONFIRMA:
 1. Inicio: Saludo con nombre del cliente
 2. Presentación: "Me comunico de Bradescard México para confirmar compras"
 3. Confirmación de movimientos: Mencionar fecha/monto/comercio, preguntar si reconoce
 4. Acción del sistema: Mantenimiento aplicado / aprobación de hotlist
 5. Despedida con nombre del agente

MONITOREO:
 1. Inicio: "Buenos días/tardes, ¿se encuentra [nombre del cliente]?"
 2. Presentación: "Me comunico de Bradescard México para confirmar compras"
 3. Mención de compras: Mencionar fecha, monto y comercio de cada transacción
 4. Confirmación/no reconocimiento: "¿Reconoce este movimiento?"
 5. Acción: mantenimiento (si confirma) O bloqueo (si no reconoce)
 6. Reposición si aplica
 7. Despedida con nombre del agente

CRITERIO:
 Siguió 6-7 pasos en orden correcto → PUNTOS COMPLETOS (17 o 5 según tipo)
 Siguió 4-5 pasos → PUNTOS PARCIALES (proporcional)
 Menos de 4 pasos o orden muy incorrecto → PUNTOS BAJOS

IMPORTANTE: No solo verificar QUE se dijo, sino que se dijo en el MOMENTO CORRECTO.
La autenticación debe ser ANTES de discutir cargos. La recapitulación ANTES de despedida.`,

 'Desbloquea tarjeta BLKI, BLKT, BPT0, BNFC': `
BUSCAR EN (para TH CONFIRMA - el cliente confirmó sus movimientos):
- VISION: data.block_types_marked muestra código de desbloqueo retirado (BLKI/BLKT/BPT0/BNFC)
- VCAS: account_status = ACTIVE (fue desbloqueada)
- Transcripción: agente menciona "desbloquear", "quitar el bloqueo", "habilitar tarjeta"

CRITERIO:
 block_types_marked muestra un código de desbloqueo retirado O VCAS muestra ACTIVE → PUNTOS COMPLETOS
 Sin evidencia de desbloqueo → 0 puntos`,

 'Ingresa a HOTLIST_APROBAR': `
BUSCAR EN (para TH CONFIRMA):
- FALCON: Evidencia de acceso a sección HOTLIST o APROBAR_HOTLIST
- FALCON: data.hotlist_action = "APROBAR" o similar
- Transcripción: menciones de "aprobado", "hotlist", "30 días"
- NOTA del script: "Ingresar tarjeta a APROBAR_HOTLIST en Falcon por 30+1 días calendario"

CRITERIO:
 Evidencia de HOTLIST_APROBAR en Falcon O transcripción menciona aprobación → PUNTOS COMPLETOS
 Sin evidencia de ingreso a HOTLIST → 0 puntos`,

 'Califica correctamente la llamada': `
BUSCAR EN (para TH CONFIRMA):
- FRONT: data.calificacion_tipo_llamada debe coincidir con tipo de llamada
- FRONT: Para TH CONFIRMA, debe mostrar "Confirma movimientos" o "TH CONFIRMA" o similar
- FRONT: data.case_code o subcalificación visible

CRITERIO:
 Calificación coincide con tipo de llamada TH CONFIRMA → PUNTOS COMPLETOS
 Calificación incorrecta o no visible → 0 puntos`,

 'Autentica correctamente': `
BUSCAR EN TRANSCRIPCIÓN (primeros 3 minutos):

Métodos de autenticación válidos:
1. CallerID / Caller ID / Identificador de llamada
2. OTP / Código de verificación / Token / PIN
3. Preguntas de seguridad: "último cargo", "saldo", "movimientos recientes"
4. Validación verbal: "verifico identidad", "confirmó datos", "validé información"

Palabras clave EXACTAS:
- "callerid", "caller id"
- "otp", "código", "token", "clave"
- "verifico", "verificó", "valido", "validó"
- "confirmo", "confirmó", "corroboro", "corroboró"
- "último cargo", "saldo actual", "últimos movimientos"
- "preguntas de seguridad"

CRITERIO ESTRICTO:
 Si menciona CallerID → PUNTOS COMPLETOS (11)
 Si menciona OTP/código → PUNTOS COMPLETOS (11)
 Si hace preguntas de seguridad específicas (último cargo, saldo) → PUNTOS COMPLETOS (11)
 Si dice "verifico identidad" o "validó" explícitamente → PUNTOS COMPLETOS (11)
 Si NO hay NINGUNA mención de autenticación → 0 puntos

REGLA TEMPORAL:
- La autenticación debe estar en los PRIMEROS 2-3 minutos de llamada
- Si la autenticación es posterior, calificar como PARCIAL (6 puntos)

JUSTIFICACIÓN SI OTORGA PUNTOS:
"Autenticación realizada mediante [CallerID/OTP/Preguntas de seguridad]: [cita exacta de transcripción]"

JUSTIFICACIÓN SI NO OTORGA PUNTOS:
"No se encontró evidencia de autenticación al inicio de la llamada."`,

 // ─────────────────────────────────────────────────
 // REGLAS DE CUMPLIMIENTO DE SCRIPT — FRAUDE (INBOUND)
 // ─────────────────────────────────────────────────
 'Script: Saludo y bienvenida': `
BUSCAR EXCLUSIVAMENTE EN TRANSCRIPCIÓN (primeros 60 segundos):

Frases obligatorias del script de bienvenida:
1. Saludo: "Monitoreo bradescard", "te atiende [nombre]", "¿con quién tengo el gusto?"
2. Motivo: "¿En qué te puedo ayudar?", "¿En qué le puedo servir?" o similar

Palabras clave:
- "monitoreo", "bradescard"
- "te atiende", "le atiende", "mi nombre es"
- "con quién tengo el gusto", "con quién hablo"
- "en qué te puedo ayudar", "en qué le puedo ayudar", "en qué le puedo servir"

CRITERIO:
 Saludo con identificación de Bradescard Y nombre del agente Y pregunta de motivo → PUNTOS COMPLETOS (2)
 Solo saludo sin preguntar motivo, o sin identificar Bradescard → PUNTOS PARCIALES (1)
 Sin saludo reconocible → 0 puntos`,

 'Script: Autenticación (CallerID / OTP)': `
BUSCAR EN TRANSCRIPCIÓN (primeros 2 minutos):

Elementos de autenticación del script:
1. CallerID: "últimos 4 dígitos de tu tarjeta", "4 dígitos", "terminación"
2. Titular: "¿eres el/la titular?", "¿es usted el titular?"
3. OTP SMS: "recibirás un mensaje de texto", "código de seguridad de 4 dígitos", "código por SMS"
4. OTP Email (fallback): "enviaré el código al correo", "correo registrado"
5. Fallo de autenticación: "no puedo brindarte información", "por motivos de seguridad"

CRITERIO DE PUNTOS (máx 4):
 Pide 4 dígitos + confirma titular + envía OTP → PUNTOS COMPLETOS (4)
 Pide 4 dígitos + confirma titular (sin OTP) → PUNTOS PARCIALES (2-3)
 Solo pide 4 dígitos → PUNTOS PARCIALES (1-2)
 Sin ninguna autenticación → 0 puntos

IMPORTANTE: La autenticación debe ocurrir ANTES de hablar sobre los cargos.`,

 'Script: Sondeo de movimientos': `
BUSCAR EN TRANSCRIPCIÓN:

Preguntas obligatorias del sondeo según script:
1. "¿me podrías indicar la fecha, cantidad o nombre del comercio de la compra que no reconoce?"
2. "¿Recibiste algún mensaje de texto?"
3. Mención de transacción del sistema: "en el sistema aparece una transacción del día XX por $XXX en XXX. ¿Reconoces este movimiento?"
4. "¿Tienes la tarjeta de crédito contigo?"
5. "¿Hay alguien más que utilice tu tarjeta?"

Palabras clave:
- "fecha", "cantidad", "comercio", "no reconoce", "no reconoció"
- "mensaje de texto", "sms"
- "en el sistema", "aparece", "transacción"
- "tarjeta contigo", "tienes la tarjeta"
- "alguien más", "otra persona", "autorizado"

CRITERIO DE PUNTOS (máx 3):
 3+ preguntas del sondeo realizadas → PUNTOS COMPLETOS (3)
 2 preguntas → PUNTOS PARCIALES (2)
 1 pregunta → PUNTOS PARCIALES (1)
 Sin sondeo → 0 puntos`,

 'Script: Información de bloqueo': `
BUSCAR EN TRANSCRIPCIÓN:

Elementos del script de bloqueo:
1. Datos comprometidos: "datos de tu tarjeta se encuentran comprometidos", "datos comprometidos"
2. Tipo de bloqueo: "bloqueo definitivo", "bloqueamos tu tarjeta", "vamos a hacer el bloqueo"
3. Costo de investigación: "$250", "250 pesos", "más IVA", "por investigación"
4. Confirmación: "¿estás de acuerdo?", "¿estás de acuerdo con continuar?", "¿autoriza el bloqueo?"

CRITERIO DE PUNTOS (máx 3):
 Informa datos comprometidos + tipo de bloqueo + menciona costo + pide confirmación → PUNTOS COMPLETOS (3)
 Informa bloqueo + costo (sin confirmación explícita) → PUNTOS PARCIALES (2)
 Solo informa bloqueo sin otros elementos → PUNTOS PARCIALES (1)
 Sin mención de bloqueo → 0 puntos`,

 'Script: Recapitulación del caso': `
BUSCAR EN TRANSCRIPCIÓN:

Elementos de recapitulación según script:
1. Número CNR: "aclaración [número/CNR]", "número de aclaración", "folio"
2. Comercios y fechas: confirma los comercios y rango de fechas de la aclaración
3. Duración: "60 días hábiles", "60 días", "dos meses"
4. Correo: "te confirmo tu correo", "correo electrónico", "¿es correcto?"

Palabras clave:
- "cnr", "número de aclaración", "folio de aclaración"
- "60 días", "días hábiles"
- "correo", "email", "electrónico"
- "te confirmo", "¿correcto?", "¿es correcto?"

CRITERIO DE PUNTOS (máx 3):
 Confirma CNR + duración + correo del cliente → PUNTOS COMPLETOS (3)
 2 de los 3 elementos → PUNTOS PARCIALES (2)
 Solo 1 elemento → PUNTOS PARCIALES (1)
 Sin recapitulación → 0 puntos`,

 'Script: Reposición de tarjeta': `
BUSCAR EN TRANSCRIPCIÓN:

Elementos de reposición según script:
- C&A/Bodega/GCC: "acudir a la sucursal participante", "sucursal más cercana", "identificación oficial"
- Suburbia/LOB: "a tu domicilio", "15 días hábiles", "reposición llegará"

Palabras clave:
- "reposición", "nueva tarjeta", "plástico"
- "sucursal", "tienda"
- "15 días", "domicilio"
- "identificación"

CRITERIO:
 Menciona proceso de reposición específico (sucursal O domicilio) con detalles → PUNTOS COMPLETOS (1)
 Menciona reposición vagamente sin detalles → PUNTOS PARCIALES (0 o 1)
 Sin mención de reposición → 0 puntos`,

 'Script: Despedida': `
BUSCAR EN TRANSCRIPCIÓN (últimos 60 segundos):

Elementos de despedida según script:
1. App: "descargar nuestra aplicación bradescard", "aplicación", "app bradescard"
2. Identificación: "te atendió [nombre y apellido]", "le atendió [nombre]", "me llamo"
3. Encuesta: "te transfiero a una breve encuesta", "calificar el servicio", "encuesta de satisfacción"

Para TH CONFIRMA (despedida diferente):
1. Seguimiento: "30 minutos", "seguimiento", "podrían comunicarse"
2. Identificación: "le atendió [nombre]", "de Bradescard México"

CRITERIO:
 Menciona app + se identifica con nombre + transfiere a encuesta → PUNTOS COMPLETOS (1)
 Solo 1-2 elementos → PUNTOS PARCIALES (0 o 1)
 Sin despedida reconocible → 0 puntos`,

 // ─────────────────────────────────────────────────
 // REGLAS DE CUMPLIMIENTO DE SCRIPT — TH CONFIRMA
 // ─────────────────────────────────────────────────
 'Script: Saludo e identificación del cliente': `
BUSCAR EN TRANSCRIPCIÓN (primeros 30 segundos):

Frase obligatoria del script:
"Buenos días/tardes/noches, ¿se encuentra el/la Sr./Sra./Srita. [Nombre y Apellido]?"

Palabras clave:
- "buenos días", "buenas tardes", "buenas noches"
- "se encuentra", "se encuentra el señor", "se encuentra la señora"
- "sr.", "sra.", "srita.", "señor", "señora", "señorita"

CRITERIO:
 Pregunta por cliente con tratamiento (Sr./Sra./Srita.) Y saludo inicial → PUNTOS COMPLETOS (2)
 Solo saludo sin preguntar por el cliente → PUNTOS PARCIALES (1)
 Sin saludo formal → 0 puntos`,

 'Script: Presentación de Bradescard y tarjeta': `
BUSCAR EN TRANSCRIPCIÓN (primeros 90 segundos):

Elementos de presentación del script:
1. Nombre del agente: "mi nombre es [nombre]"
2. Empresa: "Bradescard México", "me comunico de Bradescard"
3. Motivo: "para confirmar compras", "para confirmar movimientos"
4. Terminación de tarjeta: "terminación [4 dígitos]", "últimos 4 dígitos", "¿me puede apoyar a validarlos?"

CRITERIO DE PUNTOS (máx 3):
 Nombre + Bradescard México + terminación de tarjeta → PUNTOS COMPLETOS (3)
 Bradescard + terminación (sin nombre del agente) → PUNTOS PARCIALES (2)
 Solo menciona Bradescard → PUNTOS PARCIALES (1)
 Sin presentación → 0 puntos`,

 'Script: Mención y confirmación de movimientos': `
BUSCAR EN TRANSCRIPCIÓN:

Elementos obligatorios del script de confirmación:
1. Introduce compras: "le voy a mencionar compras", "voy a mencionar movimientos"
2. Detalle de transacción: día específico + cantidad en pesos + nombre del comercio
3. Pregunta de reconocimiento: "¿reconoce este movimiento?", "¿lo reconoce?", "¿usted realizó esta compra?"
4. Confirmación + mantenimiento: "ya que confirmó... aplicaré un mantenimiento", "se aplicará un mantenimiento"

CRITERIO DE PUNTOS (máx 5):
 Los 4 elementos presentes → PUNTOS COMPLETOS (5)
 3 elementos → PUNTOS PARCIALES (3-4)
 2 elementos → PUNTOS PARCIALES (2)
 1 elemento o sin mencionar compras → PUNTOS BAJOS (0-1)`,

 'Script: Acción de mantenimiento (HOTLIST / desbloqueo)': `
BUSCAR EN TRANSCRIPCIÓN Y CAPTURAS:

EN TRANSCRIPCIÓN:
- "Le pido esperar 5 minutos", "espere 5 minutos para volver a utilizarla"
- "aplicaré el mantenimiento", "mantenimiento aplicado"

EN CAPTURAS (sistemas):
- FALCON: acceso a APROBAR_HOTLIST, tarjeta ingresada por 30+1 días
- VISION: bloqueo BLKI/BLKT/BPT0/BNFC retirado (si aplica)
- Bypass habilitado por 24 horas (si la compra fue por internet)

CRITERIO DE PUNTOS (máx 5):
 Menciona espera de 5 minutos EN transcripción + evidencia de HOTLIST en capturas → PUNTOS COMPLETOS (5)
 Solo evidencia en capturas (sin mención verbal) → PUNTOS PARCIALES (3)
 Solo mención verbal (sin capturas de sistemas) → PUNTOS PARCIALES (2)
 Sin evidencia de ningún mantenimiento → 0 puntos`
 };

 return rules[topic] || `
BUSCAR EN:
- Sistema ${system}: Busca evidencia relevante en data estructurada
- Transcripción: Busca menciones relacionadas

CRITERIO:
 Si encuentras evidencia clara → PUNTOS COMPLETOS
 Si evidencia parcial → PUNTOS PARCIALES
 Si no hay evidencia → 0 puntos`;
 }

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