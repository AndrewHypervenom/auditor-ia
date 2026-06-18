// backend/src/services/database.service.ts

import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import type { 
  AuditInput, 
  TranscriptResult, 
  ImageAnalysis, 
  EvaluationResult,
  APICosts,
  TranscriptWord,
  SentimentResult,
  SentimentSummary
} from '../types/index.js';

interface CreateAuditParams {
  userId: string;
  companyId?: string | null;
  auditInput: AuditInput;
  audioFilename: string;
  imageFilenames: string[];
}

interface SaveTranscriptionParams {
  auditId: string;
  transcript: TranscriptResult;
  assemblyaiResponse: any;
}

interface SaveImageAnalysisParams {
  auditId: string;
  imageAnalysis: ImageAnalysis;
  openaiResponse: any;
}

interface SaveEvaluationParams {
  auditId: string;
  evaluation: Omit<EvaluationResult, 'excelUrl'>;
  excelFilename: string;
  excelPath: string;
  openaiResponse: any;
}

interface CompleteAuditParams {
  transcription: string;
  transcriptionWords?: TranscriptWord[];
  imageAnalysis: string;
  evaluation: EvaluationResult;
  excelFilename: string;
  excelBase64: string;
  processingTimeMs: number;
  costs: APICosts;
  companyId?: string | null;
  audioDuration?: number | null;
  transcriptionConfidence?: number | null;
  languageCode?: string;
  sentimentResults?: SentimentResult[];
  sentimentSummary?: SentimentSummary | null;
}

class DatabaseService {
  // Propiedad para acceder al client directamente (necesario para stats)
  get client() {
    return supabaseAdmin;
  }

  /**
   * Crear una nueva auditorÃ­a
   */
  async createAudit(params: CreateAuditParams): Promise<string> {
    try {
      const { userId, companyId, auditInput, audioFilename, imageFilenames } = params;

      const { data, error } = await supabaseAdmin
        .from('audits')
        .insert({
          user_id: userId,
          ...(companyId ? { company_id: companyId } : {}),
          executive_name: auditInput.executiveName,
          executive_id: auditInput.executiveId,
          call_type: auditInput.callType,
          calificacion: auditInput.calificacion || null,
          sub_calificacion: auditInput.subCalificacion || null,
          client_id: auditInput.clientId,
          call_date: auditInput.callDate,
          call_duration: auditInput.callDuration || null,
          audio_filename: audioFilename,
          audio_path: auditInput.audioPath || '',
          image_filenames: imageFilenames,
          image_paths: auditInput.imagePaths || [],
          gpf_data: auditInput.gpfData ?? null,
          status: 'processing'
        })
        .select('id')
        .single();

      if (error) throw error;

      logger.success('âœ… Audit created in database', { auditId: data.id });
      return data.id;
    } catch (error) {
      logger.error('âŒ Error creating audit in database', error);
      throw error;
    }
  }

  /**
   * Guardar transcripciÃ³n
   */
  async saveTranscription(params: SaveTranscriptionParams): Promise<void> {
    try {
      const { auditId, transcript, assemblyaiResponse } = params;

      const { error } = await supabaseAdmin
        .from('transcriptions')
        .insert({
          audit_id: auditId,
          full_text: transcript.text,
          utterances: transcript.utterances,
          audio_duration: transcript.duration || null,
          assemblyai_response: assemblyaiResponse,
          word_count: transcript.utterances.length,
          confidence: assemblyaiResponse.confidence || null,
          language: 'es'
        });

      if (error) throw error;

      logger.success('âœ… Transcription saved to database', { auditId });
    } catch (error) {
      logger.error('âŒ Error saving transcription', error);
      throw error;
    }
  }

  /**
   * Guardar anÃ¡lisis de imagen
   */
  async saveImageAnalysis(params: SaveImageAnalysisParams): Promise<void> {
    try {
      const { auditId, imageAnalysis, openaiResponse } = params;

      const { error } = await supabaseAdmin
        .from('image_analyses')
        .insert({
          audit_id: auditId,
          image_path: imageAnalysis.imagePath,
          image_filename: imageAnalysis.imagePath.split('/').pop() || '',
          system_detected: imageAnalysis.system,
          extracted_data: imageAnalysis.data,
          critical_fields: imageAnalysis.data.critical_fields || null,
          findings: [],
          confidence: imageAnalysis.confidence,
          openai_response: openaiResponse
        });

      if (error) throw error;

      logger.success('âœ… Image analysis saved to database', { auditId });
    } catch (error) {
      logger.error('âŒ Error saving image analysis', error);
      throw error;
    }
  }

  /**
   * Guardar evaluaciÃ³n completa
   */
  async saveEvaluation(params: SaveEvaluationParams): Promise<void> {
    try {
      const { auditId, evaluation, excelFilename, excelPath, openaiResponse } = params;

      const { error } = await supabaseAdmin
        .from('evaluations')
        .insert({
          audit_id: auditId,
          total_score: evaluation.totalScore,
          max_possible_score: evaluation.maxPossibleScore,
          percentage: evaluation.percentage,
          detailed_scores: evaluation.detailedScores,
          observations: evaluation.observations,
          recommendations: evaluation.recommendations,
          key_moments: evaluation.keyMoments,
          openai_response: openaiResponse,
          excel_filename: excelFilename,
          excel_path: excelPath
        });

      if (error) throw error;

      logger.success('âœ… Evaluation saved to database', { auditId });
    } catch (error) {
      logger.error('âŒ Error saving evaluation', error);
      throw error;
    }
  }

  /**
   * Guardar costos de API
   */
  async saveAPICosts(auditId: string, costs: APICosts, companyId?: string | null): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('api_costs')
        .insert({
          audit_id: auditId,
          ...(companyId ? { company_id: companyId } : {}),
          assemblyai_duration_minutes: costs.assemblyai.audioDurationMinutes,
          assemblyai_cost: costs.assemblyai.totalCost,
          openai_images_count: costs.openai.images.count,
          openai_images_input_tokens: costs.openai.images.inputTokens,
          openai_images_output_tokens: costs.openai.images.outputTokens,
          openai_images_cost: costs.openai.images.cost,
          openai_evaluation_input_tokens: costs.openai.evaluation.inputTokens,
          openai_evaluation_output_tokens: costs.openai.evaluation.outputTokens,
          openai_evaluation_cost: costs.openai.evaluation.cost,
          openai_total_cost: costs.openai.totalCost,
          total_cost: costs.totalCost,
          currency: costs.currency
        });

      if (error) throw error;

      logger.success('âœ… API costs saved to database', { 
        auditId, 
        totalCost: `$${costs.totalCost.toFixed(4)}` 
      });
    } catch (error) {
      logger.error('âŒ Error saving API costs', error);
      throw error;
    }
  }

  /**
   * Completar auditorÃ­a con todos los datos - âœ… MODIFICADO para guardar Excel en DB
   */
  async completeAudit(auditId: string, params: CompleteAuditParams): Promise<void> {
    try {
      const {
        transcription,
        transcriptionWords,
        imageAnalysis,
        evaluation,
        excelFilename,
        excelBase64,
        processingTimeMs,
        costs,
        companyId,
        audioDuration,
        transcriptionConfidence,
        languageCode,
        sentimentResults,
        sentimentSummary
      } = params;

      const cid = companyId ? { company_id: companyId } : {};

      // 1. Guardar transcripción
      // Los sentimientos se guardan dentro del jsonb assemblyai_response
      // para no requerir migración de esquema.
      await supabaseAdmin.from('transcriptions').insert({
        audit_id: auditId,
        ...cid,
        full_text: transcription,
        utterances: transcriptionWords || [],
        audio_duration: audioDuration ?? null,
        assemblyai_response: {
          sentiment_analysis_results: sentimentResults || [],
          sentiment_summary: sentimentSummary || null,
          language_code: languageCode || 'es',
          speech_model: 'universal-3-pro'
        },
        word_count: transcriptionWords?.length || 0,
        confidence: transcriptionConfidence ?? null,
        language: languageCode || 'es'
      });

      // 2. Guardar análisis de imágenes (si existe)
      if (imageAnalysis && imageAnalysis !== 'No se proporcionaron imágenes para analizar') {
        await supabaseAdmin.from('image_analyses').insert({
          audit_id: auditId,
          ...cid,
          image_path: '',
          image_filename: '',
          system_detected: 'multiple',
          extracted_data: { analysis: imageAnalysis },
          critical_fields: null,
          findings: [],
          confidence: 0,
          openai_response: {}
        });
      }

      // 3. Guardar evaluación
      const { error: evalError } = await supabaseAdmin.from('evaluations').insert({
        audit_id: auditId,
        ...cid,
        total_score: evaluation.totalScore,
        max_possible_score: evaluation.maxPossibleScore,
        percentage: evaluation.percentage,
        detailed_scores: evaluation.detailedScores,
        observations: evaluation.observations || '',
        recommendations: evaluation.recommendations || [],
        key_moments: evaluation.keyMoments || [],
        openai_response: { dataWarnings: (evaluation as any).dataWarnings || [] },
        excel_filename: excelFilename,
        excel_path: excelFilename,
        excel_data: excelBase64
      });
      if (evalError) throw evalError;

      // 4. Guardar costos
      await this.saveAPICosts(auditId, costs, companyId);

      // 5. Marcar como completada
      const { error } = await supabaseAdmin
        .from('audits')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          processing_time_seconds: Math.round(processingTimeMs / 1000)
        })
        .eq('id', auditId);

      if (error) throw error;

      logger.success('âœ… Audit completed successfully (Excel stored in DB)', { auditId });
    } catch (error) {
      logger.error('âŒ Error completing audit', error);
      throw error;
    }
  }

  /**
   * âœ… NUEVO: Obtener Excel desde la base de datos
   */
  async getExcelData(filename: string): Promise<{ excelData: string; excelFilename: string } | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('evaluations')
        .select('excel_data, excel_filename')
        .eq('excel_filename', filename)
        .single();

      if (error || !data || !data.excel_data) {
        logger.warn('âš ï¸ Excel not found in database', { filename });
        return null;
      }

      return {
        excelData: data.excel_data,
        excelFilename: data.excel_filename
      };
    } catch (error) {
      logger.error('âŒ Error getting Excel from database', error);
      return null;
    }
  }

  /**
   * Marcar auditorÃ­a como error
   */
  async markAuditError(auditId: string, errorMessage: string): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('audits')
        .update({
          status: 'error',
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq('id', auditId);

      if (error) throw error;

      logger.warn('âš ï¸ Audit marked as error', { auditId, errorMessage });
    } catch (error) {
      logger.error('âŒ Error marking audit as error', error);
      throw error;
    }
  }

  /**
   * Eliminar una auditorÃ­a y todos sus datos relacionados
   */
  async deleteAudit(auditId: string, userId: string, userRole: string, companyId?: string | null): Promise<void> {
    try {
      if (userRole !== 'superadmin' && userRole !== 'lider' && userRole !== 'auditor') {
        throw new Error('No tienes permisos para eliminar auditorÃ­as');
      }

      // Aislamiento por empresa: solo superadmin puede borrar fuera de su empresa
      let fetchQuery = supabaseAdmin
        .from('audits')
        .select('id')
        .eq('id', auditId);
      if (companyId) fetchQuery = fetchQuery.eq('company_id', companyId);
      const { data: audit, error: fetchError } = await fetchQuery.single();

      if (fetchError || !audit) {
        throw new Error('AuditorÃ­a no encontrada');
      }

      const { error: deleteError } = await supabaseAdmin
        .from('audits')
        .delete()
        .eq('id', auditId);

      if (deleteError) throw deleteError;

      logger.success('âœ… Audit deleted successfully', { auditId, userId });
    } catch (error) {
      logger.error('âŒ Error deleting audit', error);
      throw error;
    }
  }

  /**
   * HELPER: Enriquecer auditorias con info del creador
   */
  private async enrichAuditsWithCreatorInfo(audits: any[]): Promise<any[]> {
    try {
      if (!audits || audits.length === 0) return audits;
      const userIds = [...new Set(audits.map(a => a.user_id).filter(Boolean))];
      if (userIds.length === 0) return audits;

      const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .in('id', userIds);

      if (error) {
        logger.warn('Warning: Error fetching creator info:', error);
        return audits;
      }

      const userMap = new Map((users || []).map(u => [u.id, u]));

      return audits.map(audit => {
        const creator = userMap.get(audit.user_id);
        return {
          ...audit,
          created_by_name: creator?.full_name || creator?.email || 'Desconocido',
          created_by_email: creator?.email || ''
        };
      });
    } catch (error) {
      logger.warn('Warning: Error enriching audits with creator info:', error);
      return audits;
    }
  }

  /**
   * Obtener todas las auditorias (incluye created_by_name y created_by_email)
   */
  async getUserAudits(userId: string, userRole: string, companyId: string | null, limit = 50, offset = 0) {
    try {
      let query = supabaseAdmin
        .from('audits')
        .select('*, evaluations(*), api_costs(*)', { count: 'exact' });

      // admin (companyId=null) ve todas las empresas; el resto solo su empresa
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      // Normalizar api_costs a formato array
      const normalizedData = (data || []).map(audit => {
        if (audit.api_costs && !Array.isArray(audit.api_costs)) {
          return {
            ...audit,
            api_costs: [audit.api_costs]
          };
        }
        return audit;
      });

      // Enriquecer con info del creador
      const enrichedData = await this.enrichAuditsWithCreatorInfo(normalizedData);

      return { audits: enrichedData, total: count || 0 };
    } catch (error) {
      logger.error('Error fetching user audits', error);
      throw error;
    }
  }

  /**
   * Obtener una auditorÃ­a completa con todos sus datos
   */
  async getAuditById(auditId: string, userId: string, userRole: string, companyId?: string | null) {
    try {
      let query = supabaseAdmin
        .from('audits')
        .select('*')
        .eq('id', auditId);

      // Aislamiento por empresa: superadmin (companyId null) ve cualquier auditoría;
      // el resto solo puede acceder a las de su empresa.
      if (companyId) {
        query = query.eq('company_id', companyId);
      }

      const { data: audit, error: auditError } = await query.single();

      if (auditError) throw auditError;

      const { data: transcription } = await supabaseAdmin
        .from('transcriptions')
        .select('*')
        .eq('audit_id', auditId)
        .single();

      const { data: imageAnalyses } = await supabaseAdmin
        .from('image_analyses')
        .select('*')
        .eq('audit_id', auditId);

      const { data: evaluation } = await supabaseAdmin
        .from('evaluations')
        .select('*')
        .eq('audit_id', auditId)
        .single();

      const { data: apiCosts } = await supabaseAdmin
        .from('api_costs')
        .select('*')
        .eq('audit_id', auditId)
        .single();

      // Obtener info del creador
      let creatorName = 'Desconocido';
      let creatorEmail = '';
      if (audit.user_id) {
        const { data: creator } = await supabaseAdmin
          .from('users')
          .select('full_name, email')
          .eq('id', audit.user_id)
          .single();
        if (creator) {
          creatorName = creator.full_name || creator.email || 'Desconocido';
          creatorEmail = creator.email || '';
        }
      }

      // Enriquecer detailed_scores con criticidad actual de la BD
      if (evaluation && Array.isArray(evaluation.detailed_scores) && audit.call_type) {
        try {
          const currentCriteria = await this.getCriteriaForCallType(audit.call_type, audit.sub_calificacion || undefined);
          const topicCriticalityMap = new Map<string, string>();
          for (const block of currentCriteria) {
            for (const t of (block.topics || [])) {
              topicCriticalityMap.set(t.topic, t.criticality || '-');
            }
          }
          if (topicCriticalityMap.size > 0) {
            evaluation.detailed_scores = evaluation.detailed_scores.map((s: any) => {
              const topic = (s.criterion ?? '').replace(/^\[.*?\]\s*/, '');
              const currentCriticality = topicCriticalityMap.get(topic);
              return currentCriticality !== undefined
                ? { ...s, criticality: currentCriticality }
                : s;
            });
          }
          // Re-ordenar para que coincida con el orden actual de bloques/criterios en BD.
          // Incluir criterios manuales aunque applies=false, para que siempre aparezcan al auditor.
          const orderedKeys: string[] = (currentCriteria as any[]).flatMap((block: any) =>
            (block.topics || [])
              .filter((t: any) => t.applies || t.requiresManualReview)
              .map((t: any) => `[${block.blockName}] ${t.topic}`)
          );
          const topicMetaMap = new Map<string, any>();
          for (const block of currentCriteria as any[]) {
            for (const t of (block.topics || [])) {
              topicMetaMap.set(`[${block.blockName}] ${t.topic}`, t);
            }
          }
          if (orderedKeys.length > 0) {
            const scoreMap = new Map(evaluation.detailed_scores.map((s: any) => [s.criterion, s]));
            const sorted = orderedKeys.map((k: string) => {
              if (scoreMap.has(k)) return scoreMap.get(k);
              // Inyectar criterio faltante (evaluaciones ya guardadas sin ese rubro)
              const meta = topicMetaMap.get(k);
              if (meta?.requiresManualReview) {
                return {
                  criterion: k,
                  score: 0,
                  maxScore: meta.points === null ? 0 : meta.points,
                  observations: 'Requiere validación manual — este criterio no puede evaluarse automáticamente a partir de las capturas de pantalla.',
                  criticality: meta.criticality || '-',
                  requiresManualReview: true,
                };
              }
              if (meta?.applies) {
                return {
                  criterion: k,
                  score: 0,
                  maxScore: meta.points === null ? 0 : meta.points,
                  observations: 'Criterio no evaluado en la auditoría original — asigna el puntaje manualmente.',
                  criticality: meta.criticality || '-',
                  requiresManualReview: false,
                };
              }
              return null;
            }).filter(Boolean);
            const extra = evaluation.detailed_scores.filter((s: any) => !orderedKeys.includes(s.criterion));
            evaluation.detailed_scores = [...sorted, ...extra];
          }
        } catch {
          // Si falla el enriquecimiento, usar los valores guardados
        }
      }

      return {
        audit: {
          ...audit,
          created_by_name: creatorName,
          created_by_email: creatorEmail
        },
        transcription,
        imageAnalyses: imageAnalyses || [],
        evaluation,
        apiCosts
      };
    } catch (error) {
      logger.error('âŒ Error fetching audit by ID', error);
      throw error;
    }
  }

  // ============================================================
  // SCRIPTS DINÁMICOS
  // ============================================================

  private scriptsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private criteriaCache: Map<string, { data: any; timestamp: number }> = new Map();
  private promptsCache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

  private isCacheValid(entry: { data: any; timestamp: number }): boolean {
    return Date.now() - entry.timestamp < this.CACHE_TTL_MS;
  }

  invalidateScriptsCache(): void {
    this.scriptsCache.clear();
  }

  invalidateCriteriaCache(): void {
    this.criteriaCache.clear();
  }

  invalidatePromptsCache(): void {
    this.promptsCache.clear();
  }

  async getScriptsForCallType(callType: string, subCalificacion?: string, companyId?: string): Promise<any[]> {
    const normalized = this.normalizeCallTypeForDB(callType);
    const key = `${normalized.toUpperCase()}__${companyId ?? 'all'}`;
    const cached = this.scriptsCache.get(key);
    const rows = cached && this.isCacheValid(cached) ? cached.data : await (async () => {
      let query = supabaseAdmin
        .from('call_scripts')
        .select('*')
        .eq('call_type', normalized)
        .eq('is_active', true);

      if (companyId) query = query.eq('company_id', companyId);

      const { data, error } = await query.order('step_order', { ascending: true });

      if (error) {
        logger.warn('Warning: could not load scripts from DB, returning empty', { callType, error });
        return null;
      }

      this.scriptsCache.set(key, { data: data || [], timestamp: Date.now() });
      return data || [];
    })();

    if (!rows) return [];

    // Resolver override de guion por subcalificación (lines específicas).
    // La cache guarda la fila completa (con overrides); aplicamos el override aquí
    // para no invalidar la cache cuando cambia la subcalificación.
    if (subCalificacion) {
      const target = subCalificacion.toUpperCase().trim();
      return rows.map((r: any) => {
        const ov = r.tipo_cierre_overrides?.[target] ?? r.tipo_cierre_overrides?.[subCalificacion];
        if (ov && Array.isArray(ov.lines)) {
          return { ...r, lines: ov.lines };
        }
        return r;
      });
    }

    return rows;
  }

  async getAllScripts(companyId?: string): Promise<any[]> {
    let query = supabaseAdmin
      .from('call_scripts')
      .select('*')
      .order('call_type')
      .order('step_order', { ascending: true });

    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async createScript(payload: {
    call_type: string;
    mode: string;
    step_key: string;
    step_label: string;
    step_order: number;
    lines: string[];
    company_id?: string | null;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('call_scripts')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    this.invalidateScriptsCache();
    return data;
  }

  async updateScript(id: string, payload: Partial<{
    step_label: string;
    step_order: number;
    lines: string[];
    is_active: boolean;
    tipo_cierre_overrides: Record<string, unknown>;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('call_scripts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateScriptsCache();
    return data;
  }

  async deleteScript(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('call_scripts')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.invalidateScriptsCache();
  }

  // ============================================================
  // CRITERIOS DINÁMICOS
  // ============================================================

  private normalizeCallTypeForDB(callType: string): string {
    const upper = callType.toUpperCase().trim();
    // MONITOREO es un modo (INBOUND/OUTBOUND), no una categoría de llamada
    // Nombres canónicos = los que entrega GPF (cubren también los nombres
    // internos históricos 'TH CONFIRMA' y 'FRAUDE' guardados en auditorías viejas)
    if (upper.includes('TH CONFIRMA') || upper.includes('TH_CONFIRMA')) return 'TH CONFIRMA MOVIMIENTOS';
    if (upper.includes('FRAUDE') || upper.includes('ROEXT')) return 'FRAUDE/ROEXT';
    return callType;
  }

  /** Resuelve el call_type desde el texto de la calificación.
   *  Primero aplica las reglas de texto conocidas ('FRAUDE', 'TH CONFIRMA') y luego
   *  compara dinámicamente contra los tipos activos en call_types_config (con caché),
   *  de modo que cualquier calificación nueva de GPF configurada en el admin funcione.
   *  Retorna null si no hay coincidencia con ningún tipo configurado.
   *  Nota: MONITOREO es un modo (INBOUND vs OUTBOUND), no un call_type.
   */
  async resolveCallTypeFromText(text: string): Promise<string | null> {
    const normalized = this.normalizeCallTypeForDB(text);
    if (normalized === 'FRAUDE/ROEXT' || normalized === 'TH CONFIRMA MOVIMIENTOS') return normalized;

    // Comparación flexible: mayúsculas, sin acentos, coincidencia por inclusión
    const strip = (s: string) => s.toUpperCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    const target = strip(text);
    if (!target) return null;

    const types = (await this.getCallTypesConfig()).filter((t: any) => t.is_active !== false);
    const exact = types.find((t: any) => strip(t.name) === target);
    if (exact) return exact.name;
    const partial = types.find((t: any) => {
      const name = strip(t.name);
      return target.includes(name) || name.includes(target);
    });
    return partial ? partial.name : null;
  }

  async getCriteriaForCallType(callType: string, subCalificacion?: string, companyId?: string): Promise<any[]> {
    const normalized = this.normalizeCallTypeForDB(callType);
    const key = `${normalized.toUpperCase()}${subCalificacion ? `__${subCalificacion.toUpperCase()}` : ''}__${companyId ?? 'all'}`;
    const cached = this.criteriaCache.get(key);
    if (cached && this.isCacheValid(cached)) return cached.data;

    let blocksQuery = supabaseAdmin
      .from('evaluation_blocks')
      .select('*')
      .eq('call_type', normalized)
      .eq('is_active', true);

    if (companyId) blocksQuery = blocksQuery.eq('company_id', companyId);

    const { data: blocks, error: blocksError } = await blocksQuery.order('block_order', { ascending: true });

    if (blocksError) {
      throw new Error(`Error al cargar bloques de criterios desde la BD: ${blocksError.message}`);
    }
    if (!blocks || blocks.length === 0) {
      // Info de base compartida: si el call_type aún no tiene criterios propios,
      // usar los criterios base de FRAUDE/ROEXT para que la evaluación siempre funcione.
      if (normalized !== 'FRAUDE/ROEXT') {
        logger.warn(`getCriteriaForCallType: sin bloques para "${normalized}" — usando criterios base compartidos (FRAUDE/ROEXT)`, { original: callType });
        return this.getCriteriaForCallType('FRAUDE/ROEXT', subCalificacion, companyId);
      }
      throw new Error(`No hay bloques activos en la BD para call_type: "${normalized}" (original: "${callType}")`);
    }

    // Filtrar secciones por subcalificación: si un bloque define
    // applicable_tipo_cierres (no vacío), solo aplica cuando la subcalificación
    // de la auditoría está en esa lista. Lista vacía/null = aplica a todas.
    const stripText = (s: string) => String(s ?? '').toUpperCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
    let applicableBlocks = blocks;
    if (subCalificacion) {
      const target = stripText(subCalificacion);
      applicableBlocks = blocks.filter((b: any) => {
        const list: string[] = Array.isArray(b.applicable_tipo_cierres)
          ? b.applicable_tipo_cierres.filter(Boolean) : [];
        if (list.length === 0) return true;
        return list.some((tc: string) => stripText(tc) === target);
      });
      if (applicableBlocks.length === 0) {
        logger.warn(`getCriteriaForCallType: ningún bloque aplica a la subcalificación "${subCalificacion}" — se usan todos los bloques de "${normalized}"`);
        applicableBlocks = blocks;
      }
    }

    const blockIds = applicableBlocks.map((b: any) => b.id);

    const { data: criteria, error: criteriaError } = await supabaseAdmin
      .from('evaluation_criteria')
      .select('*')
      .in('block_id', blockIds)
      .order('criteria_order', { ascending: true });

    if (criteriaError) {
      throw new Error(`Error al cargar criterios desde la BD: ${criteriaError.message}`);
    }

    // Mapear al formato EvaluationBlock[] que usa el evaluator
    // Deduplicar por block_name: si existen bloques con el mismo nombre,
    // mantener solo el primero (menor block_order) y combinar sus criterios únicos.
    const seenBlockNames = new Set<string>();
    const criteriaByBlockId = new Map<string, any[]>();
    for (const c of (criteria || [])) {
      if (!criteriaByBlockId.has(c.block_id)) criteriaByBlockId.set(c.block_id, []);
      criteriaByBlockId.get(c.block_id)!.push(c);
    }

    const result: any[] = [];
    for (const block of applicableBlocks) {
      if (seenBlockNames.has(block.block_name)) {
        logger.warn(`getCriteriaForCallType: bloque duplicado ignorado → "${block.block_name}" (id: ${block.id})`);
        continue;
      }
      seenBlockNames.add(block.block_name);
      const blockCriteria = criteriaByBlockId.get(block.id) || [];
      result.push({
        blockName: block.block_name,
        topics: blockCriteria.map((c: any) => {
          let applies: boolean = c.applies;
          let whatToLookFor: string = c.what_to_look_for || '';
          let validationSource: string[] = c.validation_source || [];
          let requiresManualReview: boolean = c.requires_manual_review ?? false;
          if (subCalificacion && c.tipo_cierre_overrides) {
            const ov = c.tipo_cierre_overrides[subCalificacion];
            if (ov) {
              if (ov.applies !== undefined) applies = ov.applies;
              if (ov.what_to_look_for !== undefined) whatToLookFor = ov.what_to_look_for || '';
              if (ov.validation_source !== undefined) validationSource = ov.validation_source || [];
              if (ov.requires_manual_review !== undefined) requiresManualReview = ov.requires_manual_review;
            }
          }
          return {
            topic: c.topic,
            criticality: c.criticality as 'Crítico' | '-',
            points: c.points === null ? 'n/a' : c.points,
            applies,
            whatToLookFor,
            validationSource,
            requiresManualReview
          };
        })
      });
    }

    this.criteriaCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  }

  async getAllCriteriaBlocks(companyId?: string): Promise<any[]> {
    let blocksQuery = supabaseAdmin
      .from('evaluation_blocks')
      .select('*')
      .order('call_type')
      .order('block_order', { ascending: true });

    if (companyId) blocksQuery = blocksQuery.eq('company_id', companyId);

    const { data: blocks, error: blocksError } = await blocksQuery;

    if (blocksError) throw blocksError;
    if (!blocks || blocks.length === 0) return [];

    const blockIds = blocks.map((b: any) => b.id);

    const { data: criteria, error: criteriaError } = await supabaseAdmin
      .from('evaluation_criteria')
      .select('*')
      .in('block_id', blockIds)
      .order('criteria_order', { ascending: true });

    if (criteriaError) throw criteriaError;

    return blocks.map((block: any) => ({
      ...block,
      criteria: (criteria || []).filter((c: any) => c.block_id === block.id)
    }));
  }

  async createBlock(payload: {
    call_type: string;
    mode: string;
    block_name: string;
    block_order: number;
    applicable_tipo_cierres?: string[];
    company_id?: string | null;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('evaluation_blocks')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCriteriaCache();
    return data;
  }

  async updateBlock(id: string, payload: Partial<{
    block_name: string;
    block_order: number;
    is_active: boolean;
    applicable_tipo_cierres: string[];
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('evaluation_blocks')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCriteriaCache();
    return data;
  }

  async deleteBlock(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('evaluation_blocks')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.invalidateCriteriaCache();
  }

  async createCriteria(payload: {
    block_id: string;
    topic: string;
    criticality: string;
    points: number | null;
    applies: boolean;
    what_to_look_for?: string;
    validation_source?: string[];
    criteria_order: number;
    requires_manual_review?: boolean;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('evaluation_criteria')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCriteriaCache();
    return data;
  }

  async updateCriteria(id: string, payload: Partial<{
    topic: string;
    criticality: string;
    points: number | null;
    applies: boolean;
    what_to_look_for: string;
    validation_source: string[];
    criteria_order: number;
    is_active: boolean;
    requires_manual_review: boolean;
    tipo_cierre_overrides: Record<string, unknown>;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('evaluation_criteria')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCriteriaCache();
    return data;
  }

  async deleteCriteria(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('evaluation_criteria')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.invalidateCriteriaCache();
  }

  // ── Plantilla GPF ──────────────────────────────────────────

  async getAllPlantillaGPF(companyId?: string): Promise<any[]> {
    let query = supabaseAdmin
      .from('plantilla_gpf')
      .select('*')
      .eq('is_active', true);
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query
      .order('categoria_orden', { ascending: true })
      .order('tipo_orden', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  /** Resuelve el call_type de evaluación consultando la tabla plantilla_gpf.
   *  Busca por categoria (= Calificación) y opcionalmente tipo_cierre (= Sub-calificación).
   *  Retorna null si no hay ninguna entrada activa que coincida.
   */
  async getCallTypeFromPlantilla(categoria: string, tipoCierre?: string, mode?: 'INBOUND' | 'MONITOREO', companyId?: string): Promise<string | null> {
    // Helper: normaliza texto para comparación flexible
    const normalize = (s: string) => s.toUpperCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Traer entradas activas filtrando por mode si se proporciona
    let query = supabaseAdmin
      .from('plantilla_gpf')
      .select('categoria, tipo_cierre, call_type')
      .eq('is_active', true);
    if (mode) {
      query = query.eq('mode', mode);
    }
    if (companyId) {
      query = query.eq('company_id', companyId);
    }
    const { data, error } = await query;

    if (error || !data || data.length === 0) return null;

    const normCat = normalize(categoria);
    const normTipo = tipoCierre ? normalize(tipoCierre) : null;

    // Intento 1: coincidencia exacta en categoria + tipo_cierre
    if (normTipo) {
      const exact = data.find(r =>
        normalize(r.categoria) === normCat && normalize(r.tipo_cierre) === normTipo
      );
      if (exact) return exact.call_type as string;
    }

    // Intento 2: GPF contiene el texto de la plantilla (o viceversa) + tipo_cierre exacto
    if (normTipo) {
      const partial = data.find(r => {
        const rCat = normalize(r.categoria);
        const catMatch = normCat.includes(rCat) || rCat.includes(normCat);
        const tipoMatch = normalize(r.tipo_cierre) === normTipo;
        return catMatch && tipoMatch;
      });
      if (partial) return partial.call_type as string;
    }

    // Intento 3: solo categoria (exacta o parcial)
    const catOnly = data.find(r => {
      const rCat = normalize(r.categoria);
      return normalize(r.categoria) === normCat || normCat.includes(rCat) || rCat.includes(normCat);
    });
    if (catOnly) return catOnly.call_type as string;

    return null;
  }

  async createPlantillaItem(payload: {
    categoria: string;
    tipo_cierre: string;
    descripcion: string;
    categoria_orden: number;
    tipo_orden: number;
    call_type: string;
    mode: string;
    company_id?: string | null;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('plantilla_gpf')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updatePlantillaItem(id: string, payload: Partial<{
    categoria: string;
    tipo_cierre: string;
    descripcion: string;
    categoria_orden: number;
    tipo_orden: number;
    is_active: boolean;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('plantilla_gpf')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deletePlantillaItem(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('plantilla_gpf')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  async renamePlantillaCategoria(oldName: string, newName: string, callType: string, mode: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('plantilla_gpf')
      .update({ categoria: newName, updated_at: new Date().toISOString() })
      .eq('categoria', oldName)
      .eq('call_type', callType)
      .eq('mode', mode);
    if (error) throw error;
  }

  // ============================================================
  // AI PROMPTS
  // ============================================================

  async getPromptByKey(key: string): Promise<string | null> {
    const cached = this.promptsCache.get(key);
    if (cached && this.isCacheValid(cached)) return cached.data;

    const { data, error } = await supabaseAdmin
      .from('ai_prompts')
      .select('content')
      .eq('prompt_key', key)
      .eq('is_active', true)
      .single();

    if (error || !data) {
      logger.warn(`ai_prompts: no se pudo cargar el prompt '${key}' desde BD`, { error });
      return null;
    }

    this.promptsCache.set(key, { data: data.content, timestamp: Date.now() });
    return data.content;
  }

  async getAllPrompts(companyId?: string): Promise<any[]> {
    let query = supabaseAdmin
      .from('ai_prompts')
      .select('*')
      .order('prompt_key');
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async updatePrompt(id: string, payload: Partial<{
    content: string;
    prompt_name: string;
    description: string;
    is_active: boolean;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('ai_prompts')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidatePromptsCache();
    return data;
  }

  // ============================================================
  // WORD BOOST TERMS
  // ============================================================

  private wordBoostCache: Map<string, { data: any; timestamp: number }> = new Map();

  invalidateWordBoostCache(): void {
    this.wordBoostCache.clear();
  }

  async getWordBoostTerms(companyId?: string): Promise<any[]> {
    const cacheKey = `wb__${companyId ?? 'all'}`;
    const cached = this.wordBoostCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) return cached.data;

    let query = supabaseAdmin
      .from('word_boost_terms')
      .select('*');
    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query
      .order('category')
      .order('display_order', { ascending: true });

    if (error) {
      logger.warn('word_boost_terms: no se pudo cargar desde BD', { error });
      return [];
    }

    const result = data || [];
    this.wordBoostCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  async createWordBoostTerm(payload: {
    term: string;
    category: string;
    is_active?: boolean;
    display_order?: number;
    company_id?: string | null;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('word_boost_terms')
      .insert({ ...payload, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    this.invalidateWordBoostCache();
    return data;
  }

  async updateWordBoostTerm(id: string, payload: Partial<{
    term: string;
    category: string;
    is_active: boolean;
    display_order: number;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('word_boost_terms')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateWordBoostCache();
    return data;
  }

  async deleteWordBoostTerm(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('word_boost_terms')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.invalidateWordBoostCache();
  }

  // ============================================================
  // IMAGE SYSTEMS
  // ============================================================

  private imageSystemsCache: Map<string, { data: any; timestamp: number }> = new Map();

  invalidateImageSystemsCache(): void {
    this.imageSystemsCache.clear();
  }

  async getImageSystems(companyId?: string): Promise<any[]> {
    const cacheKey = `is__${companyId ?? 'all'}`;
    const cached = this.imageSystemsCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) return cached.data;

    let query = supabaseAdmin
      .from('image_systems')
      .select('*');
    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query
      .order('display_order', { ascending: true });

    if (error) {
      logger.warn('image_systems: no se pudo cargar desde BD', { error });
      return [];
    }

    const result = data || [];
    this.imageSystemsCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  async createImageSystem(payload: {
    system_name: string;
    description: string;
    detection_hints?: string;
    fields_schema?: any[];
    is_active?: boolean;
    display_order?: number;
    company_id?: string | null;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('image_systems')
      .insert({ ...payload, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw error;
    this.invalidateImageSystemsCache();
    return data;
  }

  async updateImageSystem(id: string, payload: Partial<{
    system_name: string;
    description: string;
    detection_hints: string;
    fields_schema: any[];
    is_active: boolean;
    display_order: number;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('image_systems')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateImageSystemsCache();
    return data;
  }

  async deleteImageSystem(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('image_systems')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.invalidateImageSystemsCache();
  }

  async getCalificacionesFromAudits(companyId?: string): Promise<Array<{ calificacion: string; subcalificaciones: string[] }>> {
    let query = supabaseAdmin
      .from('audits')
      .select('calificacion, sub_calificacion')
      .not('calificacion', 'is', null)
      .eq('status', 'completed');
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query;

    if (error) { logger.warn('getCalificaciones: error', { error }); return []; }

    const map: Record<string, Set<string>> = {};
    for (const row of (data || [])) {
      const cal = (row.calificacion as string || '').trim();
      const sub = (row.sub_calificacion as string || '').trim();
      if (!cal) continue;
      if (!map[cal]) map[cal] = new Set();
      if (sub) map[cal].add(sub);
    }
    return Object.entries(map)
      .map(([calificacion, subs]) => ({ calificacion, subcalificaciones: Array.from(subs).sort() }))
      .sort((a, b) => a.calificacion.localeCompare(b.calificacion));
  }

  async getImageSystemsByCallType(calificacion?: string, subcalificacion?: string, companyId?: string): Promise<Array<{ system_name: string; count: number; avg_confidence: number }>> {
    // Paso 1: obtener IDs de auditorías que coincidan con el filtro
    let auditQuery = supabaseAdmin
      .from('audits')
      .select('id')
      .eq('status', 'completed');
    if (calificacion) auditQuery = auditQuery.eq('calificacion', calificacion);
    if (subcalificacion) auditQuery = auditQuery.eq('sub_calificacion', subcalificacion);
    if (companyId) auditQuery = auditQuery.eq('company_id', companyId);

    const { data: audits, error: auditErr } = await auditQuery.limit(2000);
    if (auditErr || !audits?.length) return [];

    const auditIds = audits.map((a: any) => a.id as string);

    // Paso 2: obtener image_analyses para esos audits
    const { data: images, error: imgErr } = await supabaseAdmin
      .from('image_analyses')
      .select('system_detected, confidence')
      .in('audit_id', auditIds)
      .not('system_detected', 'is', null);

    if (imgErr || !images?.length) return [];

    const grouped: Record<string, { count: number; totalConf: number }> = {};
    for (const row of images) {
      const name = (row.system_detected as string || '').trim();
      if (!name) continue;
      if (!grouped[name]) grouped[name] = { count: 0, totalConf: 0 };
      grouped[name].count++;
      grouped[name].totalConf += Number(row.confidence) || 0;
    }

    return Object.entries(grouped)
      .map(([system_name, s]) => ({
        system_name,
        count: s.count,
        avg_confidence: s.count > 0 ? Math.round((s.totalConf / s.count) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  async getImageSystemAnalytics(companyId?: string): Promise<Array<{ system_name: string; count: number; avg_confidence: number; last_seen: string | null }>> {
    let query = supabaseAdmin
      .from('image_analyses')
      .select('system_detected, confidence, created_at')
      .not('system_detected', 'is', null);
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .limit(3000);

    if (error) {
      logger.warn('getImageSystemAnalytics: error', { error });
      return [];
    }

    const grouped: Record<string, { count: number; totalConf: number; lastSeen: string | null }> = {};
    for (const row of (data || [])) {
      const name = (row.system_detected as string) || 'DESCONOCIDO';
      if (!grouped[name]) grouped[name] = { count: 0, totalConf: 0, lastSeen: null };
      grouped[name].count++;
      grouped[name].totalConf += Number(row.confidence) || 0;
      if (!grouped[name].lastSeen || (row.created_at && row.created_at > grouped[name].lastSeen!)) {
        grouped[name].lastSeen = row.created_at as string;
      }
    }

    return Object.entries(grouped)
      .map(([system_name, s]) => ({
        system_name,
        count: s.count,
        avg_confidence: s.count > 0 ? Math.round((s.totalConf / s.count) * 100) / 100 : 0,
        last_seen: s.lastSeen,
      }))
      .sort((a, b) => b.count - a.count);
  }

  // ============================================================
  // CALL TYPES CONFIG
  // ============================================================

  private callTypesCache: Map<string, { data: any; timestamp: number }> = new Map();

  invalidateCallTypesCache(): void {
    this.callTypesCache.clear();
  }

  async getCallTypesConfig(companyId?: string): Promise<any[]> {
    const cacheKey = `ctc__${companyId ?? 'all'}`;
    const cached = this.callTypesCache.get(cacheKey);
    if (cached && this.isCacheValid(cached)) return cached.data;

    let query = supabaseAdmin
      .from('call_types_config')
      .select('*');
    if (companyId) query = query.eq('company_id', companyId);

    const { data, error } = await query
      .order('display_order', { ascending: true });

    if (error) {
      logger.warn('call_types_config: no se pudo cargar desde BD', { error });
      return [];
    }

    const result = data || [];
    this.callTypesCache.set(cacheKey, { data: result, timestamp: Date.now() });
    return result;
  }

  async createCallTypeConfig(payload: {
    name: string;
    modes?: string[];
    is_active?: boolean;
    display_order?: number;
    company_id?: string | null;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('call_types_config')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCallTypesCache();
    return data;
  }

  async updateCallTypeConfig(id: string, payload: Partial<{
    name: string;
    modes: string[];
    is_active: boolean;
    display_order: number;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('call_types_config')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    this.invalidateCallTypesCache();
    return data;
  }

  async deleteCallTypeConfig(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('call_types_config')
      .delete()
      .eq('id', id);
    if (error) throw error;
    this.invalidateCallTypesCache();
  }

  /**
   * Clona la configuración base (bloques de criterios + criterios + scripts)
   * de un call_type existente hacia uno nuevo, para que arranque con la
   * info de base compartida y sea editable de forma independiente.
   * Es idempotente: si el destino ya tiene bloques, no hace nada.
   */
  async cloneCallTypeData(fromCallType: string, toCallType: string): Promise<void> {
    if (!fromCallType || !toCallType || fromCallType === toCallType) return;

    // No clonar si el destino ya tiene bloques propios
    const { data: existing } = await supabaseAdmin
      .from('evaluation_blocks')
      .select('id')
      .eq('call_type', toCallType)
      .limit(1);
    if (existing && existing.length > 0) {
      logger.info(`cloneCallTypeData: "${toCallType}" ya tiene bloques, no se clona`);
      return;
    }

    // 1. Clonar bloques de criterios
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from('evaluation_blocks')
      .select('*')
      .eq('call_type', fromCallType);
    if (blocksError) throw blocksError;

    for (const block of (blocks || [])) {
      const { id: oldBlockId, created_at, updated_at, ...blockFields } = block;
      // Las subcalificaciones del tipo destino son distintas: el clon arranca
      // aplicando a todas (lista vacía) para no heredar restricciones ajenas.
      const { data: newBlock, error: insertBlockError } = await supabaseAdmin
        .from('evaluation_blocks')
        .insert({ ...blockFields, call_type: toCallType, applicable_tipo_cierres: [] })
        .select('id')
        .single();
      if (insertBlockError) throw insertBlockError;

      const { data: criteria, error: criteriaError } = await supabaseAdmin
        .from('evaluation_criteria')
        .select('*')
        .eq('block_id', oldBlockId);
      if (criteriaError) throw criteriaError;

      if (criteria && criteria.length > 0) {
        const newCriteria = criteria.map((c: any) => {
          const { id, created_at: ca, updated_at: ua, ...fields } = c;
          return { ...fields, block_id: newBlock.id };
        });
        const { error: insertCriteriaError } = await supabaseAdmin
          .from('evaluation_criteria')
          .insert(newCriteria);
        if (insertCriteriaError) throw insertCriteriaError;
      }
    }

    // 2. Clonar scripts de agentes
    const { data: scripts, error: scriptsError } = await supabaseAdmin
      .from('call_scripts')
      .select('*')
      .eq('call_type', fromCallType);
    if (scriptsError) throw scriptsError;

    if (scripts && scripts.length > 0) {
      const newScripts = scripts.map((s: any) => {
        const { id, created_at, updated_at, ...fields } = s;
        return { ...fields, call_type: toCallType };
      });
      const { error: insertScriptsError } = await supabaseAdmin
        .from('call_scripts')
        .insert(newScripts);
      if (insertScriptsError) throw insertScriptsError;
    }

    this.invalidateCriteriaCache();
    this.invalidateScriptsCache();
    logger.success(`cloneCallTypeData: configuración base clonada de "${fromCallType}" → "${toCallType}"`, {
      bloques: blocks?.length ?? 0,
      scripts: scripts?.length ?? 0
    });
  }

  /**
   * Sincroniza las calificaciones/subcalificaciones observadas en GPF con la
   * configuración del sistema: cada calificación nueva se registra como call_type
   * (clonando la config base de FRAUDE) y sus subcalificaciones se agregan a la
   * plantilla GPF para que aparezcan en el admin y todo funcione de inmediato.
   */
  async syncCallTypesFromGpf(entries: Array<{ calificacion: string; subcalificacion: string }>, companyId?: string | null): Promise<void> {
    // Agrupar subcalificaciones por calificación (limpias y únicas)
    const byCal = new Map<string, Set<string>>();
    for (const e of entries) {
      const cal = (e.calificacion || '').trim();
      if (!cal) continue;
      if (!byCal.has(cal)) byCal.set(cal, new Set());
      const sub = (e.subcalificacion || '').trim();
      if (sub) byCal.get(cal)!.add(sub);
    }
    if (byCal.size === 0) return;

    const existingTypes = await this.getCallTypesConfig();
    const maxOrder = existingTypes.reduce((m: number, t: any) => Math.max(m, t.display_order ?? 0), 0);
    let nextOrder = maxOrder + 1;
    // company_id es NOT NULL en call_types_config: usar el del usuario o el de los tipos existentes
    const effectiveCompanyId = companyId
      ?? existingTypes.find((t: any) => t.company_id)?.company_id
      ?? null;

    const stripName = (s: string) => String(s ?? '').toUpperCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');

    for (const [calificacion, subcals] of byCal) {
      // ¿Ya se resuelve a un tipo configurado por texto? (No usar la plantilla aquí:
      // la plantilla histórica mapea todas las categorías a FRAUDE/TH CONFIRMA y
      // eso impediría registrar las calificaciones nuevas como tipos propios.)
      let resolved = await this.resolveCallTypeFromText(calificacion);

      // Si no resuelve contra los tipos ACTIVOS, buscar también entre los
      // inactivos (tolerante a acentos/mayúsculas) y reactivar en lugar de
      // crear un duplicado (ej. "ACLARACION SIMPLE" vs "ACLARACIÓN SIMPLE").
      if (!resolved) {
        const target = stripName(calificacion);
        const existing = existingTypes.find((t: any) =>
          stripName(t.name) === target || stripName(this.normalizeCallTypeForDB(t.name)) === target);
        if (existing) {
          if (existing.is_active === false) {
            try {
              await this.updateCallTypeConfig(existing.id, { is_active: true });
              logger.info(`syncCallTypesFromGpf: tipo inactivo reactivado → "${existing.name}"`);
            } catch (err: any) {
              logger.warn(`syncCallTypesFromGpf: no se pudo reactivar "${existing.name}": ${err.message}`);
            }
          }
          resolved = existing.name;
        }
      }

      const callTypeName = resolved ?? calificacion.toUpperCase();

      if (!resolved) {
        // Registrar la calificación nueva como call_type editable en el admin
        try {
          await this.createCallTypeConfig({
            name: callTypeName,
            modes: ['INBOUND', 'MONITOREO'],
            is_active: true,
            display_order: nextOrder++,
            company_id: effectiveCompanyId
          });
          logger.info(`syncCallTypesFromGpf: calificación nueva registrada → "${callTypeName}"`);
        } catch (err: any) {
          // Carrera o duplicado: continuar sin fallar
          logger.warn(`syncCallTypesFromGpf: no se pudo crear "${callTypeName}": ${err.message}`);
          continue;
        }

        // Clonar criterios y scripts base (info compartida) para que sea editable
        try {
          await this.cloneCallTypeData('FRAUDE/ROEXT', callTypeName);
        } catch (err: any) {
          logger.warn(`syncCallTypesFromGpf: error clonando base para "${callTypeName}": ${err.message}`);
        }
      }

      // Asegurar que las subcalificaciones observadas existan en la plantilla GPF
      if (subcals.size === 0) continue;
      try {
        const { data: plantillaRows } = await supabaseAdmin
          .from('plantilla_gpf')
          .select('categoria, tipo_cierre, mode, categoria_orden, tipo_orden')
          .eq('call_type', callTypeName);

        const normalize = (s: string) => s.toUpperCase().trim()
          .normalize('NFD').replace(/[̀-ͯ]/g, '');
        const existingPairs = new Set(
          (plantillaRows || []).map((r: any) => `${r.mode}|||${normalize(r.tipo_cierre)}`)
        );
        const categoriaOrden = (plantillaRows || []).find((r: any) => normalize(r.categoria) === normalize(calificacion))?.categoria_orden
          ?? ((plantillaRows || []).reduce((m: number, r: any) => Math.max(m, r.categoria_orden ?? 0), 0) + 1);
        let tipoOrden = (plantillaRows || []).reduce((m: number, r: any) => Math.max(m, r.tipo_orden ?? 0), 0) + 1;

        const newRows: any[] = [];
        for (const sub of subcals) {
          for (const mode of ['INBOUND', 'MONITOREO']) {
            if (existingPairs.has(`${mode}|||${normalize(sub)}`)) continue;
            newRows.push({
              categoria: calificacion.toUpperCase(),
              tipo_cierre: sub.toUpperCase(),
              descripcion: '',
              categoria_orden: categoriaOrden,
              tipo_orden: tipoOrden,
              call_type: callTypeName,
              mode,
              ...(effectiveCompanyId ? { company_id: effectiveCompanyId } : {})
            });
          }
          tipoOrden++;
        }
        if (newRows.length > 0) {
          const { error: plantillaError } = await supabaseAdmin
            .from('plantilla_gpf')
            .insert(newRows);
          if (plantillaError) throw plantillaError;
          logger.info(`syncCallTypesFromGpf: ${newRows.length} subcalificaciones agregadas a plantilla para "${callTypeName}"`);
        }
      } catch (err: any) {
        logger.warn(`syncCallTypesFromGpf: error sincronizando plantilla de "${callTypeName}": ${err.message}`);
      }
    }
  }

  /**
   * Reconciliación completa con GPF: deja la configuración del sistema con los
   * MISMOS nombres de calificaciones y subcalificaciones que entrega GPF.
   * 1. Registra calificaciones/subcalificaciones nuevas (syncCallTypesFromGpf).
   * 2. Desactiva los call types activos que GPF ya no entrega (ej. duplicados
   *    provenientes del ambiente de pruebas con nombres distintos).
   * 3. En la plantilla GPF: reactiva los tipos de cierre que GPF entrega y
   *    desactiva los que ya no existen, por cada calificación entregada.
   * Todo es reversible (solo cambia is_active, no borra nada).
   */
  async reconcileCallTypesWithGpf(
    entries: Array<{ calificacion: string; subcalificacion: string }>,
    companyId?: string | null,
    options?: { allowDeactivation?: boolean }
  ): Promise<{
    totalCategories: number;
    registeredTypes: string[];
    deactivatedTypes: string[];
    reactivatedTypes: string[];
    deactivatedSubs: number;
    reactivatedSubs: number;
  }> {
    const strip = (s: string) => String(s ?? '').toUpperCase().trim()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');

    const typesBefore = await this.getCallTypesConfig();
    const namesBefore = new Set(typesBefore.map((t: any) => strip(t.name)));

    // 1. Registrar lo nuevo (calificaciones + subcalificaciones en plantilla)
    await this.syncCallTypesFromGpf(entries, companyId);

    // Agrupar subcalificaciones por calificación entregada por GPF
    const byCal = new Map<string, Set<string>>();
    for (const e of entries) {
      const cal = (e.calificacion || '').trim();
      if (!cal) continue;
      if (!byCal.has(cal)) byCal.set(cal, new Set());
      const sub = (e.subcalificacion || '').trim();
      if (sub) byCal.get(cal)!.add(sub);
    }

    // 2. Resolver el call_type de cada calificación GPF → set de tipos "en uso"
    this.invalidateCallTypesCache();
    const usedTypeNames = new Set<string>();
    for (const cal of byCal.keys()) {
      const resolved = await this.resolveCallTypeFromText(cal);
      usedTypeNames.add(strip(resolved ?? cal));
    }

    const typesAfter = await this.getCallTypesConfig();
    const registeredTypes = typesAfter
      .filter((t: any) => !namesBefore.has(strip(t.name)))
      .map((t: any) => t.name);

    const allowDeactivation = options?.allowDeactivation !== false;
    const deactivatedTypes: string[] = [];
    const reactivatedTypes: string[] = [];
    for (const t of typesAfter) {
      // Comparar también el nombre normalizado: cubre nombres internos
      // históricos (ej. 'FRAUDE' → 'FRAUDE/ROEXT') aún sin migrar.
      const inUse = usedTypeNames.has(strip(t.name))
        || usedTypeNames.has(strip(this.normalizeCallTypeForDB(t.name)));
      if (t.is_active !== false && !inUse && allowDeactivation) {
        await this.updateCallTypeConfig(t.id, { is_active: false });
        deactivatedTypes.push(t.name);
      } else if (t.is_active === false && inUse) {
        await this.updateCallTypeConfig(t.id, { is_active: true });
        reactivatedTypes.push(t.name);
      }
    }

    // 3. Plantilla: alinear tipos de cierre con los entregados por GPF,
    //    solo para las calificaciones que GPF entregó en esta corrida.
    let deactivatedSubs = 0;
    let reactivatedSubs = 0;
    for (const [cal, subs] of byCal) {
      const callTypeName = (await this.resolveCallTypeFromText(cal)) ?? cal.toUpperCase();
      const gpfSubs = new Set([...subs].map(strip));
      const { data: rows } = await supabaseAdmin
        .from('plantilla_gpf')
        .select('id, tipo_cierre, is_active')
        .eq('call_type', callTypeName);
      for (const row of (rows || [])) {
        const delivered = gpfSubs.has(strip(row.tipo_cierre));
        if (row.is_active !== false && !delivered && allowDeactivation) {
          await supabaseAdmin.from('plantilla_gpf').update({ is_active: false }).eq('id', row.id);
          deactivatedSubs++;
        } else if (row.is_active === false && delivered) {
          await supabaseAdmin.from('plantilla_gpf').update({ is_active: true }).eq('id', row.id);
          reactivatedSubs++;
        }
      }
    }

    this.invalidateCallTypesCache();
    this.invalidateCriteriaCache();

    const summary = {
      totalCategories: byCal.size,
      registeredTypes,
      deactivatedTypes,
      reactivatedTypes,
      deactivatedSubs,
      reactivatedSubs,
    };
    logger.success('reconcileCallTypesWithGpf: configuración alineada con GPF', summary);
    return summary;
  }

  /**
   * Registrar actividad de auditorÃ­a
   */
  async logAuditActivity(
    auditId: string,
    userId: string,
    action: string,
    details?: any,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await supabaseAdmin
        .from('audit_logs')
        .insert({
          audit_id: auditId,
          user_id: userId,
          action,
          details: details || null,
          ip_address: ipAddress || null,
          user_agent: userAgent || null
        });

      logger.info(`ðŸ“ Audit activity logged: ${action}`, { auditId, userId });
    } catch (error) {
      logger.warn('âš ï¸ Failed to log audit activity', error);
    }
  }

  // ─── Bines ──────────────────────────────────────────────────

  async getAllBines(companyId?: string): Promise<any[]> {
    let query = supabaseAdmin
      .from('bines')
      .select('*');
    if (companyId) query = query.eq('company_id', companyId);
    const { data, error } = await query
      .order('categoria_orden', { ascending: true })
      .order('item_order', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async createBin(payload: {
    categoria: string;
    categoria_orden: number;
    nombre: string;
    bin: string;
    socio: string;
    producto: string;
    nombre_comercial?: string;
    marca?: string;
    company_id?: string | null;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('bines')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateBin(id: string, payload: Partial<{
    categoria: string;
    categoria_orden: number;
    item_order: number;
    nombre: string;
    bin: string;
    socio: string;
    producto: string;
    nombre_comercial: string | null;
    marca: string | null;
    is_active: boolean;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('bines')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async deleteBin(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from('bines')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }

  // ============================================================
  // COMPANIES (multi-tenancy)
  // ============================================================

  // Caché del id de la empresa dueña de la integración GPF (PositivoS+).
  // undefined = aún no resuelto; null = no encontrada.
  private positivosCompanyId: string | null | undefined = undefined;

  /**
   * Resuelve el id de la empresa PositivoS+ (dueña de toda la data de GPF).
   * Se usa para atribuir las auditorías de GPF (tiempo real + cola nocturna)
   * y para resolver sus criterios/guiones. Cacheado en memoria.
   */
  async getPositivosCompanyId(): Promise<string | null> {
    if (this.positivosCompanyId !== undefined) return this.positivosCompanyId;
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('id')
      .eq('slug', 'positivo-splus')
      .maybeSingle();
    if (error) {
      logger.warn('No se pudo resolver la empresa PositivoS+ (slug positivo-splus)', { error: error.message });
      this.positivosCompanyId = null;
      return null;
    }
    this.positivosCompanyId = data?.id ?? null;
    if (!this.positivosCompanyId) {
      logger.warn('Empresa PositivoS+ (slug positivo-splus) no encontrada en companies');
    }
    return this.positivosCompanyId ?? null;
  }

  async getAllCompanies(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .order('name');
    if (error) throw error;
    return data || [];
  }

  async getCompany(companyId: string): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();
    if (error) throw error;
    return data;
  }

  async createCompany(payload: {
    name: string;
    slug: string;
    logo_url?: string;
    integration_type?: string;
    integration_config?: Record<string, unknown>;
    role_permissions?: Record<string, unknown>;
    usage_limits?: Record<string, unknown>;
  }): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCompany(id: string, payload: Partial<{
    name: string;
    slug: string;
    logo_url: string | null;
    is_active: boolean;
    integration_type: string;
    integration_config: Record<string, unknown>;
    role_permissions: Record<string, unknown>;
    usage_limits: Record<string, unknown>;
  }>): Promise<any> {
    const { data, error } = await supabaseAdmin
      .from('companies')
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateCompanyRolePermissions(companyId: string, rolePermissions: Record<string, unknown>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('companies')
      .update({ role_permissions: rolePermissions, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    if (error) throw error;
  }

  async updateCompanyUsageLimits(companyId: string, usageLimits: Record<string, unknown>): Promise<void> {
    const { error } = await supabaseAdmin
      .from('companies')
      .update({ usage_limits: usageLimits, updated_at: new Date().toISOString() })
      .eq('id', companyId);
    if (error) throw error;
  }

  async getCompanyMonthlyUsage(companyId: string, month?: Date): Promise<{
    total_audits: number;
    total_cost_usd: number;
    total_openai_tokens: number;
    image_tokens: number;
    evaluation_tokens: number;
    total_assemblyai_minutes: number;
  }> {
    const targetMonth = month || new Date();
    const monthStart = new Date(targetMonth.getFullYear(), targetMonth.getMonth(), 1).toISOString();
    const monthEnd = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 1).toISOString();

    const { data, error } = await supabaseAdmin
      .from('api_costs')
      .select('total_cost, openai_images_input_tokens, openai_images_output_tokens, openai_evaluation_input_tokens, openai_evaluation_output_tokens, assemblyai_duration_minutes, audit_id')
      .eq('company_id', companyId)
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd);

    if (error) throw error;

    const rows = data || [];
    return {
      total_audits: rows.length,
      total_cost_usd: rows.reduce((s, r) => s + (Number(r.total_cost) || 0), 0),
      image_tokens: rows.reduce((s, r) => s + (r.openai_images_input_tokens || 0) + (r.openai_images_output_tokens || 0), 0),
      evaluation_tokens: rows.reduce((s, r) => s + (r.openai_evaluation_input_tokens || 0) + (r.openai_evaluation_output_tokens || 0), 0),
      total_openai_tokens: rows.reduce((s, r) => s + (r.openai_images_input_tokens || 0) + (r.openai_images_output_tokens || 0) + (r.openai_evaluation_input_tokens || 0) + (r.openai_evaluation_output_tokens || 0), 0),
      total_assemblyai_minutes: rows.reduce((s, r) => s + (Number(r.assemblyai_duration_minutes) || 0), 0),
    };
  }

  async getAllCompaniesMonthlyUsage(): Promise<any[]> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

    const { data, error } = await supabaseAdmin
      .from('api_costs')
      .select('company_id, total_cost, openai_images_input_tokens, openai_images_output_tokens, openai_evaluation_input_tokens, openai_evaluation_output_tokens, assemblyai_duration_minutes')
      .gte('created_at', monthStart)
      .lt('created_at', monthEnd);

    if (error) throw error;

    const byCompany: Record<string, { total_cost: number; total_tokens: number; total_audits: number }> = {};
    for (const row of (data || [])) {
      const cid = row.company_id as string;
      if (!byCompany[cid]) byCompany[cid] = { total_cost: 0, total_tokens: 0, total_audits: 0 };
      byCompany[cid].total_cost += Number(row.total_cost) || 0;
      byCompany[cid].total_tokens += (row.openai_images_input_tokens || 0) + (row.openai_images_output_tokens || 0) + (row.openai_evaluation_input_tokens || 0) + (row.openai_evaluation_output_tokens || 0);
      byCompany[cid].total_audits++;
    }
    return Object.entries(byCompany).map(([company_id, stats]) => ({ company_id, ...stats }));
  }
}

// Exportar instancia singleton
let instance: DatabaseService | null = null;

export const getDatabaseService = () => {
  if (!instance) {
    instance = new DatabaseService();
  }
  return instance;
};

export const databaseService = {
  client: supabaseAdmin,
  createAudit: (params: CreateAuditParams) => getDatabaseService().createAudit(params),
  saveTranscription: (params: SaveTranscriptionParams) => getDatabaseService().saveTranscription(params),
  saveImageAnalysis: (params: SaveImageAnalysisParams) => getDatabaseService().saveImageAnalysis(params),
  saveEvaluation: (params: SaveEvaluationParams) => getDatabaseService().saveEvaluation(params),
  saveAPICosts: (auditId: string, costs: APICosts, companyId?: string | null) => getDatabaseService().saveAPICosts(auditId, costs, companyId),
  completeAudit: (auditId: string, params: CompleteAuditParams) => getDatabaseService().completeAudit(auditId, params),
  deleteAudit: (auditId: string, userId: string, userRole: string, companyId?: string | null) => getDatabaseService().deleteAudit(auditId, userId, userRole, companyId),
  markAuditError: (auditId: string, errorMessage: string) => getDatabaseService().markAuditError(auditId, errorMessage),
  getUserAudits: (userId: string, userRole: string, companyId: string | null, limit?: number, offset?: number) => getDatabaseService().getUserAudits(userId, userRole, companyId, limit, offset),
  getAuditById: (auditId: string, userId: string, userRole: string, companyId?: string | null) => getDatabaseService().getAuditById(auditId, userId, userRole, companyId),
  getExcelData: (filename: string) => getDatabaseService().getExcelData(filename),
  logAuditActivity: (auditId: string, userId: string, action: string, details?: any, ip?: string, ua?: string) =>
    getDatabaseService().logAuditActivity(auditId, userId, action, details, ip, ua),
  // Word Boost Terms
  getWordBoostTerms: (companyId?: string) => getDatabaseService().getWordBoostTerms(companyId),
  createWordBoostTerm: (payload: Parameters<DatabaseService['createWordBoostTerm']>[0]) => getDatabaseService().createWordBoostTerm(payload),
  updateWordBoostTerm: (id: string, payload: Parameters<DatabaseService['updateWordBoostTerm']>[1]) => getDatabaseService().updateWordBoostTerm(id, payload),
  deleteWordBoostTerm: (id: string) => getDatabaseService().deleteWordBoostTerm(id),
  // Image Systems
  getImageSystems: (companyId?: string) => getDatabaseService().getImageSystems(companyId),
  createImageSystem: (payload: Parameters<DatabaseService['createImageSystem']>[0]) => getDatabaseService().createImageSystem(payload),
  updateImageSystem: (id: string, payload: Parameters<DatabaseService['updateImageSystem']>[1]) => getDatabaseService().updateImageSystem(id, payload),
  deleteImageSystem: (id: string) => getDatabaseService().deleteImageSystem(id),
  // Call Types Config
  getCallTypesConfig: (companyId?: string) => getDatabaseService().getCallTypesConfig(companyId),
  createCallTypeConfig: (payload: Parameters<DatabaseService['createCallTypeConfig']>[0]) => getDatabaseService().createCallTypeConfig(payload),
  updateCallTypeConfig: (id: string, payload: Parameters<DatabaseService['updateCallTypeConfig']>[1]) => getDatabaseService().updateCallTypeConfig(id, payload),
  deleteCallTypeConfig: (id: string) => getDatabaseService().deleteCallTypeConfig(id),
  cloneCallTypeData: (fromCallType: string, toCallType: string) => getDatabaseService().cloneCallTypeData(fromCallType, toCallType),
  syncCallTypesFromGpf: (entries: Array<{ calificacion: string; subcalificacion: string }>, companyId?: string | null) => getDatabaseService().syncCallTypesFromGpf(entries, companyId),
  reconcileCallTypesWithGpf: (entries: Array<{ calificacion: string; subcalificacion: string }>, companyId?: string | null, options?: { allowDeactivation?: boolean }) => getDatabaseService().reconcileCallTypesWithGpf(entries, companyId, options),
  // Scripts dinámicos
  getScriptsForCallType: (callType: string, subCalificacion?: string, companyId?: string) => getDatabaseService().getScriptsForCallType(callType, subCalificacion, companyId),
  getAllScripts: (companyId?: string) => getDatabaseService().getAllScripts(companyId),
  createScript: (payload: Parameters<DatabaseService['createScript']>[0]) => getDatabaseService().createScript(payload),
  updateScript: (id: string, payload: Parameters<DatabaseService['updateScript']>[1]) => getDatabaseService().updateScript(id, payload),
  deleteScript: (id: string) => getDatabaseService().deleteScript(id),
  // Criterios dinámicos
  getCriteriaForCallType: (callType: string, subCalificacion?: string, companyId?: string) => getDatabaseService().getCriteriaForCallType(callType, subCalificacion, companyId),
  getAllCriteriaBlocks: (companyId?: string) => getDatabaseService().getAllCriteriaBlocks(companyId),
  createBlock: (payload: Parameters<DatabaseService['createBlock']>[0]) => getDatabaseService().createBlock(payload),
  updateBlock: (id: string, payload: Parameters<DatabaseService['updateBlock']>[1]) => getDatabaseService().updateBlock(id, payload),
  deleteBlock: (id: string) => getDatabaseService().deleteBlock(id),
  createCriteria: (payload: Parameters<DatabaseService['createCriteria']>[0]) => getDatabaseService().createCriteria(payload),
  updateCriteria: (id: string, payload: Parameters<DatabaseService['updateCriteria']>[1]) => getDatabaseService().updateCriteria(id, payload),
  deleteCriteria: (id: string) => getDatabaseService().deleteCriteria(id),
  // Plantilla GPF
  resolveCallTypeFromText: (text: string) => getDatabaseService().resolveCallTypeFromText(text),
  getCallTypeFromPlantilla: (categoria: string, tipoCierre?: string, mode?: 'INBOUND' | 'MONITOREO', companyId?: string) => getDatabaseService().getCallTypeFromPlantilla(categoria, tipoCierre, mode, companyId),
  getAllPlantillaGPF: (companyId?: string) => getDatabaseService().getAllPlantillaGPF(companyId),
  createPlantillaItem: (payload: Parameters<DatabaseService['createPlantillaItem']>[0]) => getDatabaseService().createPlantillaItem(payload),
  updatePlantillaItem: (id: string, payload: Parameters<DatabaseService['updatePlantillaItem']>[1]) => getDatabaseService().updatePlantillaItem(id, payload),
  renamePlantillaCategoria: (oldName: string, newName: string, callType: string, mode: string) => getDatabaseService().renamePlantillaCategoria(oldName, newName, callType, mode),
  deletePlantillaItem: (id: string) => getDatabaseService().deletePlantillaItem(id),
  // AI Prompts
  getPromptByKey: (key: string) => getDatabaseService().getPromptByKey(key),
  getAllPrompts: (companyId?: string) => getDatabaseService().getAllPrompts(companyId),
  updatePrompt: (id: string, payload: Parameters<DatabaseService['updatePrompt']>[1]) => getDatabaseService().updatePrompt(id, payload),
  invalidatePromptsCache: () => getDatabaseService().invalidatePromptsCache(),
  // Bines
  getAllBines: (companyId?: string) => getDatabaseService().getAllBines(companyId),
  createBin: (payload: Parameters<DatabaseService['createBin']>[0]) => getDatabaseService().createBin(payload),
  updateBin: (id: string, payload: Parameters<DatabaseService['updateBin']>[1]) => getDatabaseService().updateBin(id, payload),
  deleteBin: (id: string) => getDatabaseService().deleteBin(id),
  // Analytics
  getImageSystemAnalytics: (companyId?: string) => getDatabaseService().getImageSystemAnalytics(companyId),
  getCalificacionesFromAudits: (companyId?: string) => getDatabaseService().getCalificacionesFromAudits(companyId),
  getImageSystemsByCallType: (calificacion?: string, subcalificacion?: string, companyId?: string) => getDatabaseService().getImageSystemsByCallType(calificacion, subcalificacion, companyId),
  // Companies
  getPositivosCompanyId: () => getDatabaseService().getPositivosCompanyId(),
  getAllCompanies: () => getDatabaseService().getAllCompanies(),
  getCompany: (companyId: string) => getDatabaseService().getCompany(companyId),
  createCompany: (payload: Parameters<DatabaseService['createCompany']>[0]) => getDatabaseService().createCompany(payload),
  updateCompany: (id: string, payload: Parameters<DatabaseService['updateCompany']>[1]) => getDatabaseService().updateCompany(id, payload),
  updateCompanyRolePermissions: (companyId: string, perms: Record<string, unknown>) => getDatabaseService().updateCompanyRolePermissions(companyId, perms),
  updateCompanyUsageLimits: (companyId: string, limits: Record<string, unknown>) => getDatabaseService().updateCompanyUsageLimits(companyId, limits),
  getCompanyMonthlyUsage: (companyId: string, month?: Date) => getDatabaseService().getCompanyMonthlyUsage(companyId, month),
  getAllCompaniesMonthlyUsage: () => getDatabaseService().getAllCompaniesMonthlyUsage(),
};

export { DatabaseService };