// backend/src/services/batch.service.ts
// Procesa auditorías en lote con OpenAI Batch API (50% de descuento)

import OpenAI, { toFile } from 'openai';
import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import { gpfTokenService } from './gpf-token.service.js';
import { gpfDataService } from './gpf-data.service.js';
import { assemblyAIService } from './assemblyai.service.js';
import { openAIService } from './openai.service.js';
import { downloadImagesToTemp } from '../utils/image-downloader.js';
import { buildSyntheticTranscript } from '../utils/synthetic-transcript.js';
import { buildSentimentSummary } from '../utils/sentiment.js';
import { excelService } from './excel.service.js';
import { costCalculatorService } from './cost-calculator.service.js';
import { getDatabaseService } from './database.service.js';
import { gpfFetch } from '../utils/gpf-fetch.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─── Límites documentados de OpenAI Batch API (gpt-5.4-mini) ─────────────────
export const BATCH_LIMITS = {
  MODEL: 'gpt-5.4-mini',
  CONTEXT_WINDOW_TOKENS: 400_000,
  MAX_OUTPUT_TOKENS: 128_000,
  MAX_FILE_SIZE_MB: 200,          // Límite duro de OpenAI
  MAX_REQUESTS_PER_BATCH: 50_000, // Límite de solicitudes por lote
  // Estimaciones por caso (5 imágenes × 400 KB promedio en base64)
  ESTIMATED_MB_PER_CASE: 2.0,     // ~5 imgs × 400 KB base64 = ~2 MB/caso
  RECOMMENDED_MAX_CASES: 50,      // Conservador (~100 MB, margen de seguridad)
  HARD_MAX_CASES: 90,             // ~180 MB de los 200 permitidos
  PRICING_INPUT_PER_M: 0.375,     // USD/1M tokens en batch
  PRICING_OUTPUT_PER_M: 2.25,     // USD/1M tokens en batch
} as const;

interface BatchItemInput {
  gpf_attention_id: string;
  gpf_env: string;
  gpf_attention_object: Record<string, any>;
  gpf_excel_type: string;
  executive_name?: string;
  call_type?: string;
  call_date?: string;
}

interface CreateBatchJobParams {
  name: string;
  scheduled_for: string;
  created_by: string;
  items: BatchItemInput[];
}

// Tiempo estimado de ahorro: 50% del costo OpenAI normal
// Costo aproximado por caso: $0.02 (imágenes) + $0.005 (evaluación) = ~$0.025
const ESTIMATED_COST_PER_CASE_USD = 0.025;

class BatchService {
  private openai: OpenAI;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
    this.openai = new OpenAI({ apiKey });
  }

  // ─── CRUD ─────────────────────────────────────────────────────────────────

  async createBatchJob(params: CreateBatchJobParams) {
    const { name, scheduled_for, created_by, items } = params;

    if (items.length > BATCH_LIMITS.HARD_MAX_CASES) {
      throw new Error(
        `El lote supera el límite máximo de ${BATCH_LIMITS.HARD_MAX_CASES} casos. ` +
        `Divide en lotes más pequeños para evitar superar los 200 MB del archivo OpenAI.`
      );
    }

    const { data: job, error: jobErr } = await supabaseAdmin
      .from('batch_jobs')
      .insert({
        name,
        status: 'pending',
        scheduled_for,
        created_by,
        item_count: items.length,
      })
      .select()
      .single();

    if (jobErr || !job) throw new Error(`Error creando batch job: ${jobErr?.message}`);

    const rows = items.map(item => ({
      batch_job_id: job.id,
      gpf_attention_id: item.gpf_attention_id,
      gpf_env: item.gpf_env,
      gpf_attention_object: item.gpf_attention_object,
      gpf_excel_type: item.gpf_excel_type,
      executive_name: item.executive_name ?? null,
      call_type: item.call_type ?? null,
      call_date: item.call_date ?? null,
    }));

    const { error: itemsErr } = await supabaseAdmin.from('batch_items').insert(rows);
    if (itemsErr) throw new Error(`Error insertando batch items: ${itemsErr.message}`);

    logger.success('Batch job created', { jobId: job.id, items: items.length });
    return job;
  }

  async getBatchJobs(userId: string, role: string) {
    let query = supabaseAdmin
      .from('batch_jobs')
      .select('*, batch_items(id, status, executive_name, call_type, call_date, error_message)')
      .order('created_at', { ascending: false });

    if (role !== 'admin' && role !== 'supervisor') {
      query = query.eq('created_by', userId);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  async getBatchJobById(jobId: string) {
    const { data, error } = await supabaseAdmin
      .from('batch_jobs')
      .select('*, batch_items(*)')
      .eq('id', jobId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  async deleteBatchJob(jobId: string) {
    const { data: job } = await supabaseAdmin
      .from('batch_jobs')
      .select('status, openai_batch_id')
      .eq('id', jobId)
      .single();

    if (job?.openai_batch_id && job.status === 'submitted') {
      try {
        await this.openai.batches.cancel(job.openai_batch_id);
      } catch (e) {
        logger.warn('Could not cancel OpenAI batch', { jobId });
      }
    }

    await supabaseAdmin.from('batch_jobs').delete().eq('id', jobId);
  }

  // ─── SUBMIT ───────────────────────────────────────────────────────────────

  async submitBatchJob(jobId: string): Promise<void> {
    logger.info('Starting batch job submission', { jobId });

    await supabaseAdmin
      .from('batch_jobs')
      .update({ status: 'assembling' })
      .eq('id', jobId);

    const { data: items, error } = await supabaseAdmin
      .from('batch_items')
      .select('*')
      .eq('batch_job_id', jobId)
      .eq('status', 'pending');

    if (error || !items?.length) {
      await this.markJobFailed(jobId, 'No hay items pendientes en el lote');
      return;
    }

    const databaseService = getDatabaseService();
    const imageAnalysisPrompt = await databaseService.getPromptByKey('image_analysis') ?? '';
    const model = BATCH_LIMITS.MODEL;

    const batchRequests: Array<{
      custom_id: string;
      method: string;
      url: string;
      body: any;
    }> = [];

    const tempFiles: string[] = [];

    try {
      for (const item of items) {
        try {
          logger.info('Assembling batch item', { itemId: item.id, attentionId: item.gpf_attention_id });

          // Re-autenticar y obtener datos GPF (URLs de imágenes caducan en ~5 min)
          const token = await gpfTokenService.getTokenWithRetry(item.gpf_env);
          const attentionData = await gpfDataService.fetchAttentionData(
            item.gpf_env, item.gpf_attention_id, token
          );

          // Descargar imágenes. Si falla (URL caducada), re-autenticar y reintentar una vez.
          let downloadResult: Awaited<ReturnType<typeof downloadImagesToTemp>>;
          try {
            downloadResult = await downloadImagesToTemp(attentionData.imageUrls, token);
          } catch (downloadErr: any) {
            logger.warn('Image download failed, retrying with fresh token', {
              itemId: item.id,
              error: downloadErr.message,
            });
            const freshToken = await gpfTokenService.getTokenWithRetry(item.gpf_env);
            const freshData = await gpfDataService.fetchAttentionData(
              item.gpf_env, item.gpf_attention_id, freshToken
            );
            downloadResult = await downloadImagesToTemp(freshData.imageUrls, freshToken);
          }
          const { localPaths } = downloadResult;
          tempFiles.push(...localPaths);

          // Solicitudes de análisis de imágenes (una por imagen)
          for (let i = 0; i < localPaths.length; i++) {
            const imgPath = localPaths[i];
            try {
              const imageBuffer = fs.readFileSync(imgPath);
              const imageBase64 = imageBuffer.toString('base64');
              const ext = imgPath.split('.').pop()?.toLowerCase();
              const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';

              batchRequests.push({
                custom_id: `${item.id}__img__${i}`,
                method: 'POST',
                url: '/v1/chat/completions',
                body: {
                  model,
                  temperature: 0,
                  seed: 42,
                  messages: [{
                    role: 'user',
                    content: [
                      {
                        type: 'image_url',
                        image_url: {
                          url: `data:${mimeType};base64,${imageBase64}`,
                          detail: 'high',
                        },
                      },
                      { type: 'text', text: imageAnalysisPrompt },
                    ],
                  }],
                },
              });
            } catch (imgErr) {
              logger.warn('Could not read image for batch', { imgPath });
            }
          }

          // Solicitud de evaluación principal
          const attentionObject = item.gpf_attention_object || {};
          const syntheticTranscript = buildSyntheticTranscript(
            attentionData.comments,
            attentionData.transactions,
            attentionData.otpValidations,
            attentionData.rawComments
          );

          // ── Audio: descargar + transcribir con AssemblyAI (igual que tiempo real) ──
          let finalTranscriptText = syntheticTranscript.text;
          try {
            const audioToken = await gpfTokenService.getTokenWithRetry(item.gpf_env);
            const audioSecureUrl = await gpfDataService.fetchAudioUrl(item.gpf_env, item.gpf_attention_id, audioToken);
            if (audioSecureUrl) {
              const appToken = process.env.GPF_APP_TOKEN || '';
              const sessionCookie = gpfTokenService.getSessionCookie(item.gpf_env);
              let audioResponse = await gpfFetch(audioSecureUrl, {
                headers: {
                  'X-App-Token': appToken,
                  'Authorization': `Bearer ${audioToken}`,
                  'Accept': '*/*',
                  'ngrok-skip-browser-warning': 'true',
                  ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
                },
              });
              if (audioResponse.status >= 300 && audioResponse.status < 400) {
                const redirectUrl = audioResponse.headers.get('location');
                if (redirectUrl) audioResponse = await gpfFetch(redirectUrl, {});
              }
              if (!audioResponse.ok && sessionCookie) {
                audioResponse = await gpfFetch(audioSecureUrl, { headers: { 'Cookie': sessionCookie, 'Accept': '*/*' } });
              }
              if (!audioResponse.ok) {
                audioResponse = await gpfFetch(audioSecureUrl, {});
              }
              if (audioResponse.ok) {
                const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
                const audioExt = audioSecureUrl.toLowerCase().includes('.mp3') ? 'mp3' : 'wav';
                const localAudioPath = path.join(os.tmpdir(), `batch_audio_${item.id}_${Date.now()}.${audioExt}`);
                fs.writeFileSync(localAudioPath, audioBuffer);
                tempFiles.push(localAudioPath);
                logger.info('Batch: transcribing audio with AssemblyAI', { itemId: item.id, sizeMB: (audioBuffer.length / 1024 / 1024).toFixed(2) });
                const rawTranscript = await assemblyAIService.transcribe(localAudioPath);
                if (rawTranscript?.text) {
                  const corrected = await openAIService.correctTranscription(rawTranscript.text);
                  const audioText = corrected || rawTranscript.text;
                  finalTranscriptText = `${audioText}\n\n--- DATOS ESTRUCTURADOS GPF ---\n${syntheticTranscript.text}`;
                  logger.success('Batch: audio transcribed', { itemId: item.id, length: finalTranscriptText.length });

                  // Sentimientos: nativos AssemblyAI (EN) o GPT (ES/PT), igual que el flujo en tiempo real.
                  // Se calculan aquí porque las utterances no sobreviven hasta processBatchResults.
                  try {
                    let sentimentResults = rawTranscript.sentiment_analysis_results || [];
                    let sentimentProvider: 'assemblyai' | 'openai' = 'assemblyai';
                    if (sentimentResults.length === 0 && (rawTranscript.utterances?.length || 0) > 0) {
                      const gptSentiment = await openAIService.analyzeSentiment(rawTranscript.utterances);
                      sentimentResults = gptSentiment.results;
                      sentimentProvider = 'openai';
                    }
                    if (sentimentResults.length > 0) {
                      const sentimentSummary = buildSentimentSummary(sentimentResults, sentimentProvider);
                      const { error: sentErr } = await supabaseAdmin
                        .from('batch_items')
                        .update({ sentiment_results: sentimentResults, sentiment_summary: sentimentSummary })
                        .eq('id', item.id);
                      if (sentErr) {
                        logger.warn('Batch: no se pudieron guardar sentimientos — ¿faltan las columnas sentiment_results/sentiment_summary en batch_items?', {
                          itemId: item.id, error: sentErr.message,
                        });
                      } else {
                        logger.success('Batch: sentiment analysis saved', {
                          itemId: item.id, provider: sentimentProvider, frases: sentimentResults.length,
                        });
                      }
                    }
                  } catch (sentErr: any) {
                    logger.warn('Batch: análisis de sentimientos falló, continuando sin sentimientos', {
                      itemId: item.id, error: sentErr.message,
                    });
                  }
                }
              } else {
                logger.warn('Batch: audio download failed', { itemId: item.id, status: audioResponse.status });
              }
            }
          } catch (audioErr: any) {
            logger.warn('Batch: audio unavailable, using synthetic transcript', { itemId: item.id, error: audioErr.message });
          }

          // Resolver callType
          let resolvedCallType = item.call_type ?? '';
          const calificacion = attentionObject['Calificación'] || '';
          const subCalificacion = attentionObject['Sub-calificación'] || '';
          if (calificacion && !resolvedCallType) {
            const direct = await databaseService.resolveCallTypeFromText(calificacion);
            if (direct) {
              resolvedCallType = direct;
            } else {
              const fromPlantilla = await databaseService.getCallTypeFromPlantilla(
                calificacion, subCalificacion || undefined, item.gpf_excel_type as any
              );
              resolvedCallType = fromPlantilla ?? resolvedCallType;
            }
          }

          // Agregar request de evaluación al batch (mismo 50% de descuento)
          const criteria = await databaseService.getCriteriaForCallType(resolvedCallType, subCalificacion || undefined);
          const activeTopics = criteria.flatMap((b: any) => (b.topics || []).filter((t: any) => t.applies && !t.requiresManualReview));

          if (activeTopics.length === 0) {
            throw new Error(`Sin criterios activos para "${resolvedCallType}" — configura los criterios en el panel de administración`);
          }

          const evaluationSystemPrompt = await databaseService.getPromptByKey('evaluation_system') ?? '';
          const evalUserContent = this.buildBatchEvalPrompt(item, attentionObject, criteria, { text: finalTranscriptText });

          batchRequests.push({
            custom_id: `${item.id}__eval`,
            method: 'POST',
            url: '/v1/chat/completions',
            body: {
              model,
              temperature: 0,
              seed: 42,
              response_format: { type: 'json_object' },
              messages: [
                { role: 'system', content: evaluationSystemPrompt },
                { role: 'user', content: evalUserContent },
              ],
            },
          });

          // Persistir transcript para processBatchResults (llega horas después con los resultados de OpenAI)
          await supabaseAdmin
            .from('batch_items')
            .update({ status: 'processing', transcript_text: finalTranscriptText.substring(0, 100_000) })
            .eq('id', item.id);

        } catch (itemErr: any) {
          // Remove any image requests already added for this item (no eval was added, they'd be orphaned)
          const imgPrefix = `${item.id}__img__`;
          for (let k = batchRequests.length - 1; k >= 0; k--) {
            if ((batchRequests[k].custom_id as string).startsWith(imgPrefix)) {
              batchRequests.splice(k, 1);
            }
          }
          logger.error('Error assembling batch item', { itemId: item.id, error: itemErr.message });
          await supabaseAdmin
            .from('batch_items')
            .update({ status: 'failed', error_message: itemErr.message })
            .eq('id', item.id);
        }
      }

      // Check that at least one eval request was assembled (orphan-only requests were removed above)
      const hasEvalRequests = batchRequests.some(r => (r.custom_id as string).endsWith('__eval'));
      if (batchRequests.length === 0 || !hasEvalRequests) {
        await this.markJobFailed(jobId, 'No se pudieron preparar solicitudes de evaluación. Revisa los criterios de cada caso.');
        return;
      }

      // Crear archivo JSONL y subir a OpenAI
      const jsonlContent = batchRequests.map(r => JSON.stringify(r)).join('\n');
      const jsonlBuffer = Buffer.from(jsonlContent, 'utf-8');

      logger.info('Uploading batch JSONL to OpenAI', {
        jobId,
        requests: batchRequests.length,
        sizeKB: (jsonlBuffer.length / 1024).toFixed(1),
      });

      const uploadedFile = await this.openai.files.create({
        file: await toFile(jsonlBuffer, 'batch_input.jsonl', { type: 'application/jsonl' }),
        purpose: 'batch',
      });

      logger.info('Batch file uploaded', { fileId: uploadedFile.id });

      // Crear el batch en OpenAI
      const openAIBatch = await this.openai.batches.create({
        input_file_id: uploadedFile.id,
        endpoint: '/v1/chat/completions',
        completion_window: '24h',
        metadata: { batch_job_id: jobId },
      });

      logger.success('OpenAI batch created', { openAIBatchId: openAIBatch.id });

      await supabaseAdmin
        .from('batch_jobs')
        .update({
          status: 'submitted',
          openai_batch_id: openAIBatch.id,
          openai_input_file_id: uploadedFile.id,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', jobId);

    } finally {
      // Limpiar archivos temp
      for (const f of tempFiles) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
      }
    }
  }

  // ─── CHECK & PROCESS ──────────────────────────────────────────────────────

  async checkAndProcessBatchJob(jobId: string): Promise<{ status: string; message: string }> {
    const job = await this.getBatchJobById(jobId);
    if (!job) throw new Error('Batch job no encontrado');

    if (!job.openai_batch_id) {
      return { status: job.status, message: 'El lote aún no ha sido enviado a OpenAI' };
    }

    if (job.status === 'completed' || job.status === 'failed' || job.status === 'cancelled') {
      return { status: job.status, message: 'El lote ya ha sido procesado' };
    }

    const openAIBatch = await this.openai.batches.retrieve(job.openai_batch_id);
    logger.info('OpenAI batch status', { jobId, openAIStatus: openAIBatch.status });

    if (openAIBatch.status === 'completed') {
      await this.processBatchResults(job, openAIBatch);
      return { status: 'completed', message: 'Lote completado y auditorías procesadas' };
    }

    if (openAIBatch.status === 'failed' || openAIBatch.status === 'expired' || openAIBatch.status === 'cancelled') {
      await this.markJobFailed(jobId, `OpenAI batch status: ${openAIBatch.status}`);
      return { status: 'failed', message: `El lote falló en OpenAI: ${openAIBatch.status}` };
    }

    const completed = openAIBatch.request_counts?.completed ?? 0;
    const total = openAIBatch.request_counts?.total ?? 0;
    const itemCount = job.batch_items?.length ?? job.item_count ?? '?';
    const progressMsg = total > 0
      ? `${completed}/${total} requests listos`
      : 'OpenAI recibiendo el lote…';
    return {
      status: 'submitted',
      message: `OpenAI procesando ${itemCount} caso(s) — ${progressMsg}`,
    };
  }

  private async processBatchResults(job: any, openAIBatch: any): Promise<void> {
    if (!openAIBatch.output_file_id) {
      await this.markJobFailed(job.id, 'OpenAI batch completado sin output_file_id');
      return;
    }

    logger.info('Downloading batch results from OpenAI', { jobId: job.id });

    const fileResponse = await this.openai.files.content(openAIBatch.output_file_id);
    const resultsText = await fileResponse.text();

    // Parsear JSONL de resultados exitosos
    const resultMap = new Map<string, any>();
    for (const line of resultsText.split('\n').filter(l => l.trim())) {
      try {
        const result = JSON.parse(line);
        resultMap.set(result.custom_id, result);
      } catch {}
    }

    // Parsear JSONL de errores (requests que OpenAI rechazó)
    const errorMap = new Map<string, string>();
    if (openAIBatch.error_file_id) {
      try {
        const errResponse = await this.openai.files.content(openAIBatch.error_file_id);
        const errText = await errResponse.text();
        for (const line of errText.split('\n').filter(l => l.trim())) {
          try {
            const r = JSON.parse(line);
            errorMap.set(r.custom_id, r.error?.message || 'Request rechazada por OpenAI');
          } catch {}
        }
        if (errorMap.size > 0) logger.warn('Batch error file had failed requests', { count: errorMap.size });
      } catch {}
    }

    const databaseService = getDatabaseService();
    const items: any[] = job.batch_items ?? [];

    let completedCount = 0;
    let failedCount = 0;

    for (const item of items) {
      if (item.status === 'failed') { failedCount++; continue; }

      try {
        // Recolectar resultados de imágenes del batch
        const imageResults: any[] = [];
        let imgIdx = 0;
        while (resultMap.has(`${item.id}__img__${imgIdx}`)) {
          const imgResult = resultMap.get(`${item.id}__img__${imgIdx}`);
          if (imgResult?.response?.body?.choices?.[0]?.message?.content) {
            try {
              let content = imgResult.response.body.choices[0].message.content.trim();
              content = content.replace(/```json\n?/gi, '').replace(/```\n?/g, '');
              imageResults.push(JSON.parse(content));
            } catch {}
          }
          imgIdx++;
        }

        // Resultado de evaluación del batch
        const evalResult = resultMap.get(`${item.id}__eval`);
        if (!evalResult?.response?.body?.choices?.[0]?.message?.content) {
          const openAIError = errorMap.get(`${item.id}__eval`);
          throw new Error(openAIError
            ? `OpenAI rechazó la evaluación: ${openAIError}`
            : 'No se encontró resultado de evaluación en el lote');
        }

        const evalContent = evalResult.response.body.choices[0].message.content;
        let evaluation: any;
        try {
          evaluation = JSON.parse(evalContent);
        } catch {
          throw new Error('Respuesta de evaluación no es JSON válido');
        }

        // Construir metadata del audit
        const attentionObject = item.gpf_attention_object || {};
        let resolvedCallType = item.call_type ?? '';
        const calificacion = attentionObject['Calificación'] || '';
        const subCalificacion = attentionObject['Sub-calificación'] || '';
        if (calificacion && !resolvedCallType) {
          const direct = await databaseService.resolveCallTypeFromText(calificacion);
          if (direct) {
            resolvedCallType = direct;
          } else {
            const fromPlantilla = await databaseService.getCallTypeFromPlantilla(
              calificacion, subCalificacion || undefined, item.gpf_excel_type as any
            );
            resolvedCallType = fromPlantilla ?? resolvedCallType;
          }
        }

        const itemCriteria = await databaseService.getCriteriaForCallType(resolvedCallType, subCalificacion || undefined);
        const metadata = {
          ...gpfDataService.normalizeMetadata(attentionObject, item.gpf_attention_id),
          excelType: item.gpf_excel_type as 'INBOUND' | 'MONITOREO',
          callType: resolvedCallType,
          gpfData: {
            attentionFields: attentionObject,
            transactions: [],
            comments: [],
            otpValidations: [],
            rawComments: [],
          },
        };

        // Parsear evaluación con matching block|||topic contra criterios de la BD
        const normalizedEval = this.parseBatchEvalResult(evaluation, itemCriteria);

        logger.info('Batch eval parsed', {
          itemId: item.id,
          rawKeys: Object.keys(evaluation),
          criteriaCount: normalizedEval.detailedScores?.length ?? 0,
          totalScore: normalizedEval.totalScore,
          maxPossibleScore: normalizedEval.maxPossibleScore,
        });

        if (!Array.isArray(normalizedEval.detailedScores) || normalizedEval.detailedScores.length === 0) {
          throw new Error(`Evaluación vacía: sin criterios activos para "${resolvedCallType}"`);
        }

        // Crear audit record
        const auditId = await databaseService.createAudit({
          userId: job.created_by,
          companyId: job.company_id,
          auditInput: metadata,
          audioFilename: 'gpf-batch',
          imageFilenames: imageResults.map((_: any, i: number) => `batch-img-${i}.jpg`),
        });

        const excelResult = await excelService.generateExcelReport(metadata, normalizedEval);
        const excelBase64 = excelResult.buffer.toString('base64');
        const costs = costCalculatorService.calculateTotalCost(0, imageResults.length, 0, 0, 0, 0);

        await databaseService.completeAudit(auditId, {
          transcription: item.transcript_text || '[Procesado en lote nocturno]',
          imageAnalysis: imageResults.map((r: any, i: number) => `Imagen ${i + 1}: ${JSON.stringify(r)}`).join('\n'),
          evaluation: normalizedEval,
          excelFilename: excelResult.filename,
          excelBase64,
          processingTimeMs: 0,
          costs,
          sentimentResults: item.sentiment_results || [],
          sentimentSummary: item.sentiment_summary || null,
        });

        // Actualizar batch_item con audit_id
        await supabaseAdmin
          .from('batch_items')
          .update({ status: 'completed', audit_id: auditId })
          .eq('id', item.id);

        // Limpiar audits previos atascados en "processing" para el mismo caso GPF
        await supabaseAdmin
          .from('audits')
          .update({
            status: 'error',
            error_message: 'Reemplazado por procesamiento nocturno',
            completed_at: new Date().toISOString(),
          })
          .eq('executive_id', String(item.gpf_attention_id))
          .eq('status', 'processing')
          .neq('id', auditId);

        completedCount++;
        logger.success('Batch item completed', { itemId: item.id, auditId });

      } catch (itemErr: any) {
        logger.error('Error processing batch item result', { itemId: item.id, error: itemErr.message });
        await supabaseAdmin
          .from('batch_items')
          .update({ status: 'failed', error_message: itemErr.message })
          .eq('id', item.id);
        failedCount++;
      }
    }

    await supabaseAdmin
      .from('batch_jobs')
      .update({
        status: 'completed',
        completed_count: completedCount,
        failed_count: failedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', job.id);

    logger.success('Batch job processing complete', { jobId: job.id, completedCount, failedCount });
  }

  private normalizeEvaluation(raw: any, callType: string): any {
    // Already in the expected format (e.g. already normalized)
    if (Array.isArray(raw.detailedScores)) return raw;

    const totalScore = raw.total_score ?? raw.totalScore ?? 0;
    const maxScore = raw.max_possible_score ?? raw.max_score ?? raw.maxPossibleScore ?? 100;
    const percentage = raw.percentage ?? (maxScore > 0 ? (totalScore / maxScore) * 100 : 0);

    // Build detailedScores from evaluations array (OpenAI batch response format)
    const detailedScores: Array<{
      criterion: string;
      score: number;
      maxScore: number;
      observations: string;
      criticality?: string;
    }> = [];

    const evaluations = raw.evaluations ?? raw.criteria ?? raw.evaluacion ?? [];
    if (Array.isArray(evaluations)) {
      for (const ev of evaluations) {
        const block = ev.block ?? ev.bloque ?? '';
        const topic = ev.topic ?? ev.topico ?? ev.criterio ?? '';
        detailedScores.push({
          criterion: block && topic ? `[${block}] ${topic}` : (topic || block || 'Criterio'),
          score: ev.score ?? ev.puntaje ?? 0,
          maxScore: ev.max_score ?? ev.puntaje_maximo ?? ev.maxScore ?? 10,
          observations: ev.justification ?? ev.justificacion ?? ev.observations ?? '',
          criticality: ev.criticality ?? ev.criticidad ?? '-',
        });
      }
    } else if (typeof evaluations === 'object' && evaluations !== null) {
      // Fallback: scores as key-value object
      for (const [key, val] of Object.entries(evaluations)) {
        const v = val as any;
        detailedScores.push({
          criterion: key,
          score: typeof v === 'number' ? v : (v?.score ?? 0),
          maxScore: v?.max_score ?? v?.maxScore ?? 10,
          observations: v?.justification ?? v?.observations ?? '',
          criticality: v?.criticality ?? '-',
        });
      }
    }

    // Fallback final: claves raíz desconocidas como bloques/criterios
    // Cubre formatos tipo { Falcon: {...}, Front: {...}, Vcas: {...} }
    if (detailedScores.length === 0) {
      const META_KEYS = new Set([
        'total_score','totalScore','max_possible_score','max_score','maxPossibleScore',
        'percentage','observations','observaciones','recommendations','recomendaciones',
        'key_moments','keyMoments','momentosClave','evaluations','criteria','evaluacion',
        'detailedScores','usage',
      ]);
      for (const [blockKey, blockVal] of Object.entries(raw)) {
        if (META_KEYS.has(blockKey) || blockVal === null || blockVal === undefined) continue;
        const v = blockVal as any;
        if (typeof v === 'number') {
          detailedScores.push({ criterion: blockKey, score: v, maxScore: 10, observations: '', criticality: '-' });
        } else if (typeof v === 'object' && ('score' in v || 'puntaje' in v)) {
          // Bloque es directamente un criterio con score
          detailedScores.push({
            criterion: blockKey,
            score: v.score ?? v.puntaje ?? 0,
            maxScore: v.max_score ?? v.puntaje_maximo ?? v.maxScore ?? 10,
            observations: v.justification ?? v.justificacion ?? v.observations ?? v.observaciones ?? '',
            criticality: v.criticality ?? v.criticidad ?? '-',
          });
        } else if (typeof v === 'object') {
          // Bloque contiene sub-criterios como claves
          for (const [subKey, subVal] of Object.entries(v)) {
            const sv = subVal as any;
            detailedScores.push({
              criterion: `[${blockKey}] ${subKey}`,
              score: typeof sv === 'number' ? sv : (sv?.score ?? sv?.puntaje ?? 0),
              maxScore: sv?.max_score ?? sv?.puntaje_maximo ?? sv?.maxScore ?? 10,
              observations: sv?.justification ?? sv?.justificacion ?? sv?.observations ?? sv?.observaciones ?? '',
              criticality: sv?.criticality ?? sv?.criticidad ?? '-',
            });
          }
        }
      }
    }

    const keyMoments: Array<{ timestamp: string; type: string; description: string }> =
      (raw.key_moments ?? raw.keyMoments ?? raw.momentosClave ?? []).map((m: any) => ({
        timestamp: m.timestamp ?? '',
        type: m.event ?? m.type ?? m.tipo ?? '',
        description: m.description ?? m.descripcion ?? '',
      }));

    return {
      totalScore,
      maxPossibleScore: maxScore,
      percentage,
      detailedScores,
      observations: raw.observations ?? raw.observaciones ?? '',
      recommendations: raw.recommendations ?? raw.recomendaciones ?? [],
      keyMoments,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  // ─── PROMPT Y PARSER PARA EVALUACIÓN DE LOTE ─────────────────────────────

  private buildBatchEvalPrompt(
    item: any,
    attentionObject: any,
    criteria: any[],
    syntheticTranscript: { text: string }
  ): string {
    const topicsToEvaluate = criteria.flatMap((block: any) =>
      (block.topics || [])
        .filter((t: any) => t.applies && !t.requiresManualReview)
        .map((t: any) => ({
          block: block.blockName,
          topic: t.topic,
          criticality: t.criticality ?? '-',
          maxScore: t.points === 'n/a' ? 0 : (t.points as number ?? 0),
          whatToLookFor: t.whatToLookFor || '',
        }))
    );

    const maxPossibleScore = topicsToEvaluate.reduce((s: number, t: any) => s + t.maxScore, 0);

    const fieldLines = Object.entries(attentionObject)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `- ${k}: ${v}`)
      .join('\n');

    const topicsSection = topicsToEvaluate.map((t: any, i: number) =>
      `${i + 1}. ${t.topic}\n   Bloque: ${t.block}\n   Puntos máximos: ${t.maxScore}\n   Criticidad: ${t.criticality}\n   Qué buscar: ${t.whatToLookFor || 'Evaluar según contexto'}`
    ).join('\n\n');

    return `# AUDITORÍA DE ATENCIÓN

Tipo de llamada: ${item.call_type || 'No especificado'}
Ejecutivo: ${item.executive_name || attentionObject['Agente'] || item.gpf_attention_id}
Fecha: ${item.call_date || attentionObject['Fecha de la atención'] || '-'}

═══════════════════════════════════════
DATOS GPF
═══════════════════════════════════════
${fieldLines || '(sin campos registrados)'}

═══════════════════════════════════════
TRANSCRIPCIÓN / EVIDENCIA VERBAL
═══════════════════════════════════════
${syntheticTranscript.text.substring(0, 8000) || 'Sin transcripción disponible'}

═══════════════════════════════════════
TÓPICOS A EVALUAR (${topicsToEvaluate.length} criterios)
═══════════════════════════════════════
${topicsSection}

═══════════════════════════════════════
FORMATO DE RESPUESTA OBLIGATORIO (JSON)
═══════════════════════════════════════
REGLA CRÍTICA: Los campos "block" y "topic" deben ser EXACTAMENTE iguales a los nombres indicados arriba.

{
  "evaluations": [
    {
      "block": "<nombre exacto del Bloque>",
      "topic": "<nombre exacto del tópico>",
      "score": <puntos obtenidos>,
      "max_score": <puntos máximos del tópico>,
      "justification": "Evidencia concreta encontrada y conclusión."
    }
  ],
  "total_score": <suma de todos los scores>,
  "max_possible_score": ${maxPossibleScore},
  "percentage": <porcentaje de 0 a 100>,
  "observations": "Observaciones generales.",
  "recommendations": ["recomendación 1"]
}`;
  }

  private parseBatchEvalResult(rawEval: any, criteria: any[]): any {
    const topicCriticalityMap = new Map<string, string>(
      criteria.flatMap((block: any) =>
        (block.topics || []).map((t: any) => [t.topic, t.criticality || '-'])
      )
    );

    // Map de block|||topic → resultado de OpenAI
    const aiResultMap = new Map<string, any>();
    const evaluations = rawEval.evaluations ?? rawEval.evaluacion ?? rawEval.evaluaciones ?? [];
    if (Array.isArray(evaluations)) {
      for (const ev of evaluations) {
        aiResultMap.set(`${ev.block}|||${ev.topic}`, ev);
      }
    }

    const detailedScores = criteria.flatMap((block: any) =>
      (block.topics || [])
        .filter((t: any) => t.applies)
        .map((t: any) => {
          const maxScore = t.points === 'n/a' ? 0 : (t.points as number ?? 0);
          if (t.requiresManualReview) {
            return {
              criterion: `[${block.blockName}] ${t.topic}`,
              score: 0,
              maxScore,
              observations: 'Requiere validación manual',
              criticality: t.criticality || '-',
              requiresManualReview: true,
            };
          }
          const ai = aiResultMap.get(`${block.blockName}|||${t.topic}`);
          return {
            criterion: `[${block.blockName}] ${t.topic}`,
            score: ai?.score ?? 0,
            maxScore: ai?.max_score ?? maxScore,
            observations: ai?.justification ?? (ai ? '' : 'No evaluado por el modelo'),
            criticality: topicCriticalityMap.get(t.topic) || '-',
          };
        })
    ).filter(Boolean);

    const totalScore = rawEval.total_score ?? rawEval.totalScore ??
      detailedScores.reduce((s: number, d: any) => s + (d?.score ?? 0), 0);
    const maxPossibleScore = rawEval.max_possible_score ?? rawEval.maxPossibleScore ??
      detailedScores.reduce((s: number, d: any) => s + (d?.maxScore ?? 0), 0);
    const percentage = rawEval.percentage ??
      (maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0);

    const keyMoments = (rawEval.key_moments ?? rawEval.keyMoments ?? []).map((m: any) => ({
      timestamp: m.timestamp ?? '',
      type: m.event ?? m.type ?? m.tipo ?? '',
      description: m.description ?? m.descripcion ?? '',
    }));

    return {
      totalScore,
      maxPossibleScore,
      percentage,
      detailedScores,
      observations: rawEval.observations ?? rawEval.observaciones ?? '',
      recommendations: rawEval.recommendations ?? rawEval.recomendaciones ?? [],
      keyMoments,
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    };
  }

  private async markJobFailed(jobId: string, message: string) {
    await supabaseAdmin
      .from('batch_jobs')
      .update({ status: 'failed', error_message: message })
      .eq('id', jobId);
    logger.error('Batch job failed', { jobId, message });
  }

  // ─── STATS & LIMITS ───────────────────────────────────────────────────────

  get BATCH_LIMITS() { return BATCH_LIMITS; }

  getEstimatedSavings(itemCount: number): number {
    return itemCount * ESTIMATED_COST_PER_CASE_USD * 0.5;
  }

  /**
   * Verifica en paralelo si cada caso es accesible en GPF y cuántas imágenes tiene.
   * Concurrencia limitada a 10 peticiones simultáneas para no saturar GPF.
   */
  async validateBatchItems(items: { gpf_attention_id: string; gpf_env: string }[]) {
    const CONCURRENCY = 10;
    const results: { gpf_attention_id: string; accessible: boolean; imageCount: number; error?: string }[] = [];

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const chunk = items.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(
        chunk.map(async item => {
          const token = await gpfTokenService.getTokenWithRetry(item.gpf_env);
          const r = await gpfDataService.validateCaptures(item.gpf_env, item.gpf_attention_id, token);
          return { gpf_attention_id: item.gpf_attention_id, ...r };
        })
      );
      for (let j = 0; j < settled.length; j++) {
        const s = settled[j];
        if (s.status === 'fulfilled') {
          results.push(s.value);
        } else {
          results.push({
            gpf_attention_id: chunk[j].gpf_attention_id,
            accessible: false,
            imageCount: 0,
            error: s.reason?.message ?? 'Error desconocido',
          });
        }
      }
    }
    return results;
  }

  /**
   * Estima el tamaño del JSONL en MB para N casos con M imágenes cada uno.
   * Úsalo para alertar al usuario antes de enviar.
   */
  estimateFileSizeMB(caseCount: number, avgImagesPerCase = 5): number {
    return caseCount * avgImagesPerCase * 0.4; // ~400 KB por imagen en base64
  }

  /**
   * Cuántos casos caben en un lote dado el tamaño promedio de imagen.
   */
  maxCasesForFileLimit(avgImagesPerCase = 5): number {
    const mbPerCase = avgImagesPerCase * 0.4;
    return Math.floor((BATCH_LIMITS.MAX_FILE_SIZE_MB * 0.9) / mbPerCase); // 90% del límite
  }
}

export const batchService = new BatchService();
