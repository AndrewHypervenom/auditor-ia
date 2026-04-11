// backend/src/services/database.service.ts

import { supabaseAdmin } from '../config/supabase.js';
import { logger } from '../utils/logger.js';
import type { 
  AuditInput, 
  TranscriptResult, 
  ImageAnalysis, 
  EvaluationResult,
  APICosts,
  TranscriptWord
} from '../types/index.js';

interface CreateAuditParams {
  userId: string;
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
  excelBase64: string;        // âœ… NUEVO: Excel como base64
  processingTimeMs: number;
  costs: APICosts;
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
      const { userId, auditInput, audioFilename, imageFilenames } = params;

      const { data, error } = await supabaseAdmin
        .from('audits')
        .insert({
          user_id: userId,
          executive_name: auditInput.executiveName,
          executive_id: auditInput.executiveId,
          call_type: auditInput.callType,
          client_id: auditInput.clientId,
          call_date: auditInput.callDate,
          call_duration: auditInput.callDuration || null,
          audio_filename: audioFilename,
          audio_path: auditInput.audioPath || '',
          image_filenames: imageFilenames,
          image_paths: auditInput.imagePaths || [],
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
  async saveAPICosts(auditId: string, costs: APICosts): Promise<void> {
    try {
      const { error } = await supabaseAdmin
        .from('api_costs')
        .insert({
          audit_id: auditId,
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
        costs
      } = params;

      // 1. Guardar transcripciÃ³n
      await supabaseAdmin.from('transcriptions').insert({
        audit_id: auditId,
        full_text: transcription,
        utterances: transcriptionWords || [],
        audio_duration: null,
        assemblyai_response: {},
        word_count: transcriptionWords?.length || 0,
        confidence: null,
        language: 'es'
      });

      // 2. Guardar anÃ¡lisis de imÃ¡genes (si existe)
      if (imageAnalysis && imageAnalysis !== 'No se proporcionaron imÃ¡genes para analizar') {
        await supabaseAdmin.from('image_analyses').insert({
          audit_id: auditId,
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

      // 3. Guardar evaluaciÃ³n - âœ… AHORA INCLUYE excel_data
      await supabaseAdmin.from('evaluations').insert({
        audit_id: auditId,
        total_score: evaluation.totalScore,
        max_possible_score: evaluation.maxPossibleScore,
        percentage: evaluation.percentage,
        detailed_scores: evaluation.detailedScores,
        observations: evaluation.observations || '',
        recommendations: evaluation.recommendations || [],
        key_moments: evaluation.keyMoments || [],
        openai_response: {},
        excel_filename: excelFilename,
        excel_path: excelFilename,
        excel_data: excelBase64              // âœ… NUEVO: Guardar Excel como base64
      });

      // 4. Guardar costos
      await this.saveAPICosts(auditId, costs);

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
  async deleteAudit(auditId: string, userId: string, userRole: string): Promise<void> {
    try {
      if (userRole !== 'admin' && userRole !== 'analyst' && userRole !== 'supervisor') {
        throw new Error('No tienes permisos para eliminar auditorÃ­as');
      }

      const { data: audit, error: fetchError } = await supabaseAdmin
        .from('audits')
        .select('id')
        .eq('id', auditId)
        .single();

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
  async getUserAudits(userId: string, userRole: string, limit = 50, offset = 0) {
    try {
      let query = supabaseAdmin
        .from('audits')
        .select('*, evaluations(*), api_costs(*)', { count: 'exact' });

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
  async getAuditById(auditId: string, userId: string, userRole: string) {
    try {
      let query = supabaseAdmin
        .from('audits')
        .select('*')
        .eq('id', auditId);

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

  async getScriptsForCallType(callType: string): Promise<any[]> {
    const key = callType.toUpperCase();
    const cached = this.scriptsCache.get(key);
    if (cached && this.isCacheValid(cached)) return cached.data;

    const { data, error } = await supabaseAdmin
      .from('call_scripts')
      .select('*')
      .eq('call_type', callType)
      .eq('is_active', true)
      .order('step_order', { ascending: true });

    if (error) {
      logger.warn('Warning: could not load scripts from DB, returning empty', { callType, error });
      return [];
    }

    this.scriptsCache.set(key, { data: data || [], timestamp: Date.now() });
    return data || [];
  }

  async getAllScripts(): Promise<any[]> {
    const { data, error } = await supabaseAdmin
      .from('call_scripts')
      .select('*')
      .order('call_type')
      .order('step_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createScript(payload: {
    call_type: string;
    step_key: string;
    step_label: string;
    step_order: number;
    lines: string[];
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
    if (upper.includes('MONITOREO')) return 'MONITOREO';
    if (upper.includes('TH CONFIRMA') || upper.includes('TH_CONFIRMA')) return 'TH CONFIRMA';
    if (upper.includes('FRAUDE') || upper.includes('ROEXT')) return 'FRAUDE';
    return callType;
  }

  async getCriteriaForCallType(callType: string): Promise<any[]> {
    const normalized = this.normalizeCallTypeForDB(callType);
    const key = normalized.toUpperCase();
    const cached = this.criteriaCache.get(key);
    if (cached && this.isCacheValid(cached)) return cached.data;

    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from('evaluation_blocks')
      .select('*')
      .eq('call_type', normalized)
      .eq('is_active', true)
      .order('block_order', { ascending: true });

    if (blocksError || !blocks || blocks.length === 0) {
      logger.warn('Warning: could not load criteria blocks from DB', { callType, normalized, blocksError });
      return [];
    }

    const blockIds = blocks.map((b: any) => b.id);

    const { data: criteria, error: criteriaError } = await supabaseAdmin
      .from('evaluation_criteria')
      .select('*')
      .in('block_id', blockIds)
      .order('criteria_order', { ascending: true });

    if (criteriaError) {
      logger.warn('Warning: could not load criteria from DB', { criteriaError });
      return [];
    }

    // Mapear al formato EvaluationBlock[] que usa el evaluator
    const result = blocks.map((block: any) => ({
      blockName: block.block_name,
      topics: (criteria || [])
        .filter((c: any) => c.block_id === block.id)
        .map((c: any) => ({
          topic: c.topic,
          criticality: c.criticality as 'Crítico' | '-',
          points: c.points === null ? 'n/a' : c.points,
          applies: c.applies,
          whatToLookFor: c.what_to_look_for || ''
        }))
    }));

    this.criteriaCache.set(key, { data: result, timestamp: Date.now() });
    return result;
  }

  async getAllCriteriaBlocks(): Promise<any[]> {
    const { data: blocks, error: blocksError } = await supabaseAdmin
      .from('evaluation_blocks')
      .select('*')
      .order('call_type')
      .order('block_order', { ascending: true });

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
    block_name: string;
    block_order: number;
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
    criteria_order: number;
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
    criteria_order: number;
    is_active: boolean;
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
  saveAPICosts: (auditId: string, costs: APICosts) => getDatabaseService().saveAPICosts(auditId, costs),
  completeAudit: (auditId: string, params: CompleteAuditParams) => getDatabaseService().completeAudit(auditId, params),
  deleteAudit: (auditId: string, userId: string, userRole: string) => getDatabaseService().deleteAudit(auditId, userId, userRole),
  markAuditError: (auditId: string, errorMessage: string) => getDatabaseService().markAuditError(auditId, errorMessage),
  getUserAudits: (userId: string, userRole: string, limit?: number, offset?: number) => getDatabaseService().getUserAudits(userId, userRole, limit, offset),
  getAuditById: (auditId: string, userId: string, userRole: string) => getDatabaseService().getAuditById(auditId, userId, userRole),
  getExcelData: (filename: string) => getDatabaseService().getExcelData(filename),
  logAuditActivity: (auditId: string, userId: string, action: string, details?: any, ip?: string, ua?: string) =>
    getDatabaseService().logAuditActivity(auditId, userId, action, details, ip, ua),
  // Scripts dinámicos
  getScriptsForCallType: (callType: string) => getDatabaseService().getScriptsForCallType(callType),
  getAllScripts: () => getDatabaseService().getAllScripts(),
  createScript: (payload: Parameters<DatabaseService['createScript']>[0]) => getDatabaseService().createScript(payload),
  updateScript: (id: string, payload: Parameters<DatabaseService['updateScript']>[1]) => getDatabaseService().updateScript(id, payload),
  deleteScript: (id: string) => getDatabaseService().deleteScript(id),
  // Criterios dinámicos
  getCriteriaForCallType: (callType: string) => getDatabaseService().getCriteriaForCallType(callType),
  getAllCriteriaBlocks: () => getDatabaseService().getAllCriteriaBlocks(),
  createBlock: (payload: Parameters<DatabaseService['createBlock']>[0]) => getDatabaseService().createBlock(payload),
  updateBlock: (id: string, payload: Parameters<DatabaseService['updateBlock']>[1]) => getDatabaseService().updateBlock(id, payload),
  deleteBlock: (id: string) => getDatabaseService().deleteBlock(id),
  createCriteria: (payload: Parameters<DatabaseService['createCriteria']>[0]) => getDatabaseService().createCriteria(payload),
  updateCriteria: (id: string, payload: Parameters<DatabaseService['updateCriteria']>[1]) => getDatabaseService().updateCriteria(id, payload),
  deleteCriteria: (id: string) => getDatabaseService().deleteCriteria(id),
};

export { DatabaseService };