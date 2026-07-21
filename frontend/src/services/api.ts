// frontend/src/services/api.ts

import axios from 'axios';
import { supabase } from '../config/supabase';
import type { AuditFormData, EvaluationResult, APICostsDB } from '../types';

// CONFIGURACIÓN MEJORADA DE LA URL DEL BACKEND
const getApiBaseUrl = (): string => {
 // 1. Si hay variable de entorno VITE_API_URL, usarla
 if (import.meta.env.VITE_API_URL) {
 return import.meta.env.VITE_API_URL;
 }
 
 // 2. Si estamos en desarrollo (puerto 5173), usar localhost:3000
 if (typeof window !== 'undefined' && window.location.port === '5173') {
 return 'http://localhost:3000';
 }
 
 // 3. Fallback - esto NO debería ocurrir en producción si VITE_API_URL está configurado
 console.error(' VITE_API_URL not configured! Please set it in Vercel environment variables');
 return 'http://localhost:3000';
};

const API_BASE_URL = getApiBaseUrl();


const api = axios.create({
 baseURL: `${API_BASE_URL}/api`,
 headers: {
 'Content-Type': 'application/json'
 },
 timeout: 600000,
});

api.interceptors.request.use(async (config) => {
 const { data: { session } } = await supabase.auth.getSession();
 
 if (session?.access_token) {
 config.headers.Authorization = `Bearer ${session.access_token}`;
 }
 
 return config;
});

api.interceptors.response.use(
 (response) => response,
 async (error) => {
 if (error.response?.status === 401) {
 await supabase.auth.signOut();
 window.location.href = '/login';
 }
 return Promise.reject(error);
 }
);

export interface Audit {
 id: string;
 user_id: string;
 executive_name: string;
 executive_id: string;
 call_type: string;
 calificacion?: string;
 sub_calificacion?: string;
 client_id: string;
 call_date: string;
 call_duration: string | null;
 status: 'processing' | 'completed' | 'error';
 error_message: string | null;
 created_at: string;
 completed_at: string | null;
 processing_time_seconds: number | null;
 excel_filename?: string;
 audio_filename?: string;
 gpf_data?: { attentionFields?: Record<string, any>; [key: string]: any } | null;
 // Info del creador de la auditoria
 created_by_name?: string;
 created_by_email?: string;
 evaluations: Array<{
 total_score: number;
 max_possible_score: number;
 percentage: number;
 excel_filename: string;
 detailed_scores?: any[];
 }>;
 api_costs: APICostsDB[];
}

export interface AuditDetail {
 audit: Audit;
 transcription: {
 full_text: string;
 utterances: any[];
 audio_duration: number;
 confidence?: number;
 } | null;
 imageAnalyses: Array<{
 system_detected: string;
 extracted_data: any;
 confidence: number;
 }>;
 evaluation: {
 total_score: number;
 max_possible_score: number;
 percentage: number;
 detailed_scores: any[];
 observations: string;
 recommendations: string[];
 key_moments: any[];
 excel_filename: string;
 openai_response?: any;
 supervisor_comments?: Record<string, string>;
 } | null;
 apiCosts: APICostsDB | null;
}

// HELPER para normalizar audits del backend - MEJORADO
const normalizeAudit = (audit: any): Audit => {
 if (!audit) {
 console.warn(' Attempted to normalize null/undefined audit');
 return audit;
 }
 
 // Normalizar evaluations: SIEMPRE un array
 let normalizedEvaluations: any[] = [];
 if (audit.evaluations) {
 if (Array.isArray(audit.evaluations)) {
 normalizedEvaluations = audit.evaluations;
 } else {
 normalizedEvaluations = [audit.evaluations];
 }
 }
 
 // Normalizar api_costs: SIEMPRE un array
 let normalizedApiCosts: any[] = [];
 if (audit.api_costs) {
 if (Array.isArray(audit.api_costs)) {
 normalizedApiCosts = audit.api_costs;
 } else {
 normalizedApiCosts = [audit.api_costs];
 }
 }
 
 return {
 ...audit,
 evaluations: normalizedEvaluations,
 api_costs: normalizedApiCosts
 };
};

export const auditService = {
 async processAudit(
 formData: AuditFormData,
 audioFile: File,
 imageFiles: File[],
 sseClientId: string
 ): Promise<EvaluationResult & { auditId: string; costs?: any }> {
 const formDataToSend = new FormData();
 formDataToSend.append('executiveName', formData.executiveName);
 formDataToSend.append('executiveId', formData.executiveId);
 formDataToSend.append('callType', formData.callType);
 formDataToSend.append('excelType', formData.excelType);
 formDataToSend.append('clientId', formData.clientId);
 formDataToSend.append('callDate', formData.callDate);
 if (formData.callDuration) {
 formDataToSend.append('callDuration', formData.callDuration);
 }
 formDataToSend.append('audio', audioFile);
 imageFiles.forEach((file) => {
 formDataToSend.append('images', file);
 });
 formDataToSend.append('sseClientId', sseClientId);

 const response = await api.post('/evaluate', formDataToSend, {
 headers: { 'Content-Type': 'multipart/form-data' }
 });
 return response.data;
 },

 async getUserAudits(limit?: number, offset?: number): Promise<{ audits: Audit[]; total: number }> {
 try {
 const params = new URLSearchParams();
 if (limit) params.append('limit', limit.toString());
 if (offset) params.append('offset', offset.toString());

 const response = await api.get(`/audits?${params.toString()}`);
 
 // NORMALIZAR: Asegurar que audits siempre sea un array Y normalizar cada audit
 const data = response.data;
 
 if (!data || typeof data !== 'object') {
 console.warn(' Invalid response format from /audits:', data);
 return { audits: [], total: 0 };
 }
 
 const rawAudits = Array.isArray(data.audits) ? data.audits : [];
 
 return {
 audits: rawAudits.map(normalizeAudit),
 total: data.total || 0
 };
 } catch (error: any) {
 console.error(' Error in getUserAudits:', error);
 throw error;
 }
 },

 async getAuditById(auditId: string): Promise<AuditDetail> {
 const response = await api.get(`/audits/${auditId}`);
 
 // NORMALIZAR el audit dentro de AuditDetail
 const data = response.data;
 if (data && data.audit) {
 data.audit = normalizeAudit(data.audit);
 }
 
 return data;
 },

 async downloadExcel(filename: string): Promise<Blob> {
 const response = await api.get(`/download/${filename}`, {
 responseType: 'blob'
 });
 return response.data;
 },

 async generateSentiment(auditId: string): Promise<{ sentimentResults: any[]; sentimentSummary: any }> {
 const response = await api.post(`/audits/${auditId}/sentiment`);
 return response.data;
 },

 async updateAuditComments(auditId: string, comments: Record<string, string>): Promise<void> {
 await api.patch(`/audits/${auditId}/comments`, { comments });
 },

 async updateAuditScores(auditId: string, detailedScores: any[]): Promise<{
 totalScore: number;
 maxPossibleScore: number;
 percentage: number;
 criticalFailure: boolean;
 failedCriticalCriteria?: string[];
 excel_filename?: string;
 }> {
 const response = await api.patch(`/audits/${auditId}/scores`, { detailedScores });
 return response.data;
 },

 async getStats(): Promise<{
 totalAudits: number;
 completedAudits: number;
 processingAudits: number;
 errorAudits: number;
 averageScore: number;
 totalExecutives: number;
 thisMonthAudits: number;
 totalCosts?: number;
 }> {
 try {
 const response = await api.get('/audits/stats');
 
 // Asegurar que todos los campos existen con valores por defecto
 const stats = response.data || {};
 return {
 totalAudits: stats.totalAudits || 0,
 completedAudits: stats.completedAudits || 0,
 processingAudits: stats.processingAudits || 0,
 errorAudits: stats.errorAudits || 0,
 averageScore: stats.averageScore || 0,
 totalExecutives: stats.totalExecutives || 0,
 thisMonthAudits: stats.thisMonthAudits || 0,
 totalCosts: stats.totalCosts || 0
 };
 } catch (error: any) {
 console.error(' Error in getStats:', error);
 // Retornar valores por defecto en caso de error
 return {
 totalAudits: 0,
 completedAudits: 0,
 processingAudits: 0,
 errorAudits: 0,
 averageScore: 0,
 totalExecutives: 0,
 thisMonthAudits: 0,
 totalCosts: 0
 };
 }
 },

 async getMyAudits(): Promise<{ audits: Audit[] }> {
 try {
 const response = await api.get('/audits/my-audits');
 
 // NORMALIZAR: Asegurar que audits siempre sea un array Y normalizar cada audit
 const data = response.data;
 
 if (!data || typeof data !== 'object') {
 console.warn(' Invalid response format from /audits/my-audits:', data);
 return { audits: [] };
 }
 
 const rawAudits = Array.isArray(data.audits) ? data.audits : [];
 
 return {
 audits: rawAudits.map(normalizeAudit)
 };
 } catch (error: any) {
 console.error(' Error in getMyAudits:', error);
 throw error;
 }
 },

 async getAnalytics(period?: string): Promise<{
 totalAudits: number;
 completedAudits: number;
 averageScore: number;
 totalCosts: number;
 monthlyTrend: any[];
 scoreDistribution: any[];
 topExecutives: any[];
 }> {
 const params = period ? `?period=${period}` : '';
 const response = await api.get(`/analytics${params}`);
 return response.data;
 },

 async deleteAudit(auditId: string): Promise<void> {
 const response = await api.delete(`/audits/${auditId}`);
 return response.data;
 },

 async evaluateFromGpf(params: {
 attentionId: string | number;
 env: 'test' | 'prod';
 excelType: string;
 sseClientId: string;
 attentionObject?: GpfAttention;
 }): Promise<{ success: boolean; auditId: string; excelFilename: string; costs?: any }> {
 const response = await api.post('/evaluate-from-gpf', params);
 return response.data;
 }
};

// FUNCIONES HELPER - Ahora son completamente seguras
export function getAuditTotalCost(audit: Audit | null | undefined): number {
 if (!audit) {
 return 0;
 }
 
 if (!audit.api_costs || !Array.isArray(audit.api_costs) || audit.api_costs.length === 0) {
 return 0;
 }

 const firstCost = audit.api_costs[0];
 if (!firstCost || typeof firstCost.total_cost === 'undefined' || firstCost.total_cost === null) {
 return 0;
 }

 const cost = Number(firstCost.total_cost);
 return isNaN(cost) ? 0 : cost;
}

export function getAuditCosts(audit: Audit | null | undefined): APICostsDB | null {
 if (!audit) {
 return null;
 }
 
 if (!audit.api_costs || !Array.isArray(audit.api_costs) || audit.api_costs.length === 0) {
 return null;
 }

 const firstCost = audit.api_costs[0];
 return firstCost || null;
}

export function hasAuditCosts(audit: Audit | null | undefined): boolean {
 return getAuditCosts(audit) !== null;
}

const num = (v: unknown): number => {
 const n = Number(v);
 return isNaN(n) ? 0 : n;
};

/** Costo de AssemblyAI (transcripción) de una auditoría. */
export function getAuditAssemblyAICost(audit: Audit | null | undefined): number {
 const c = getAuditCosts(audit);
 return c ? num(c.assemblyai_cost) : 0;
}

/** Costo total de Claude (corrección + sentimientos + imágenes + evaluación). */
export function getAuditClaudeCost(audit: Audit | null | undefined): number {
 const c = getAuditCosts(audit);
 if (!c) return 0;
 // Preferir el subtotal persistido; si falta, sumar los pasos disponibles.
 if (c.openai_total_cost != null) return num(c.openai_total_cost);
 return (
  num(c.claude_correction_cost) +
  num(c.claude_sentiment_cost) +
  num(c.openai_images_cost) +
  num(c.openai_evaluation_cost)
 );
}

export function formatAuditCost(audit: Audit | null | undefined): string {
 const cost = getAuditTotalCost(audit);
 return `$${cost.toFixed(4)}`;
}

// NUEVA función helper para obtener evaluaciones de forma segura
export function getAuditEvaluations(audit: Audit | null | undefined): Array<any> {
 if (!audit) {
 return [];
 }
 
 if (!audit.evaluations || !Array.isArray(audit.evaluations)) {
 return [];
 }
 
 return audit.evaluations;
}

// NUEVA función helper para obtener el score de forma segura
export function getAuditScore(audit: Audit | null | undefined): number | null {
 const evals = getAuditEvaluations(audit);
 
 if (evals.length === 0) {
 return null;
 }
 
 const firstEval = evals[0];
 if (firstEval && typeof firstEval.percentage === 'number') {
 return firstEval.percentage;
 }
 
 return null;
}

// GPF Attention interface — matches the API documentation field names exactly
export interface GpfAttention {
 // Primary key
 id_atencion?: string | number;
 // Spanish display-name fields from API docs
 'Llamada en curso'?: string;
 'Estado llamada'?: string;
 'Calificación'?: string;
 'Sub-calificación'?: string;
 'Origen validación'?: string;
 'Actualización de datos'?: string;
 'Socio'?: string;
 'Correo cliente'?: string;
 'Teléfono cliente'?: string;
 'Caso'?: string;
 'Agente'?: string;
 'Resultado dictamen'?: string;
 '4 dígitos TC'?: string;
 'Tiene afectación'?: string;
 'Folio BI'?: string;
 'Comercio'?: string;
 'Fecha de la compra'?: string;
 'Monto de la compra'?: string;
 'Estatus correo preventivo'?: string;
 'Estatus SMS preventivo'?: string;
 'Cliente no requiere re-plastificación'?: string;
 // Fallback camelCase fields
 id?: string | number;
 executive_name?: string;
 client_id?: string | number;
 call_date?: string;
 created_at?: string;
 [key: string]: any;
}

// GPF API integration
export interface GpfLoginParams {
 env: 'test' | 'prod';
 email?: string;
 password?: string;
}

export interface GpfProxyParams {
 env: 'test' | 'prod';
 endpoint: string;
 method: string;
 token?: string;
 body?: any;
 queryString?: string;
}

export interface GpfProxyResponse {
 gpf_status: number;
 gpf_status_text?: string;
 elapsed_ms: number;
 data: any;
 error?: string;
}

export interface GpfDownloadReportParams {
 env: 'test' | 'prod';
 token?: string;
 export_id: number;
}

export type GpfDownloadReportResult =
 | { isFile: false; data: GpfProxyResponse }
 | { isFile: true; blob: Blob; filename: string };

export interface GpfAttentionDetail {
 imageUrls: string[];
 rawComments: string[];
 transactions: { date: string; commerce_name: string; amount: string }[];
 comments: { date: string; comment: string; agent: string }[];
 otpValidations: { date: string; agent: string; resultado: boolean }[];
}

export const gpfService = {
 async getAttentions(
  env: 'test' | 'prod',
  dateFrom?: string,
  dateTo?: string
 ): Promise<{ attentions: GpfAttention[]; count: number }> {
  const params = new URLSearchParams({ env });
  if (dateFrom) params.set('date_from', dateFrom);
  if (dateTo)   params.set('date_to', dateTo);
  const response = await api.get(`/gpf/attentions?${params.toString()}`);
  return response.data;
 },

 async getCategories(env: 'test' | 'prod' = 'prod'): Promise<{
   categories: Array<{ calificacion: string; subcalificacion: string; count: number }>;
   total_attentions: number;
 }> {
  const response = await api.get(`/gpf/categories?env=${env}`);
  return response.data;
 },

 async discoverSystems(payload: {
   env: 'test' | 'prod';
   calificacion?: string;
   subcalificacion?: string;
   max_images?: number;
   date_from?: string;
   date_to?: string;
 }): Promise<{
   systems: Array<{ name: string; count: number }>;
   total_attentions: number;
   images_analyzed: number;
   cases_checked: string[];
   message?: string;
 }> {
  const response = await api.post('/gpf/discover-systems', payload);
  return response.data;
 },

 async getAttentionDetail(env: 'test' | 'prod', id: string | number): Promise<GpfAttentionDetail> {
 const response = await api.get(`/gpf/attention-detail?env=${env}&id=${encodeURIComponent(String(id))}`);
 return response.data;
 },

 async login(params: GpfLoginParams): Promise<GpfProxyResponse> {
 const response = await api.post('/gpf/login', params);
 return response.data;
 },

 async proxy(params: GpfProxyParams): Promise<GpfProxyResponse> {
 const response = await api.post('/gpf/proxy', params);
 return response.data;
 },

 async downloadReport(params: GpfDownloadReportParams): Promise<GpfDownloadReportResult> {
 const response = await api.post('/gpf/download-report', params, { responseType: 'arraybuffer' });
 const contentType: string = response.headers['content-type'] || '';
 if (contentType.includes('application/json')) {
 const text = new TextDecoder().decode(response.data as ArrayBuffer);
 return { isFile: false, data: JSON.parse(text) };
 }
 const disposition: string = response.headers['content-disposition'] || '';
 const match = disposition.match(/filename[^;=\n]*=['"]?([^'"\n;]+)['"]?/i);
 const filename = match ? match[1] : `export_${params.export_id}.xlsx`;
 const blob = new Blob([response.data as ArrayBuffer], { type: contentType || 'application/octet-stream' });
 return { isFile: true, blob, filename };
 },

 async getAudioBlob(env: 'test' | 'prod', attentionId: string | number): Promise<string | null> {
 try {
 const response = await api.post('/gpf/audio-proxy', { attentionId, env }, { responseType: 'blob' });
 if (response.data) {
 return URL.createObjectURL(response.data as Blob);
 }
 return null;
 } catch {
 return null;
 }
 }
};

// ============================================================
// Scripts dinámicos (admin)
// ============================================================
export const scriptsService = {
  async getAll() {
    const response = await api.get('/admin/scripts');
    return response.data as ScriptStep[];
  },
  async getByCallType(callType: string) {
    const response = await api.get(`/admin/scripts/${encodeURIComponent(callType)}`);
    return response.data as ScriptStep[];
  },
  async create(payload: Omit<ScriptStep, 'id' | 'is_active' | 'created_at' | 'updated_at'>) {
    const response = await api.post('/admin/scripts', payload);
    return response.data as ScriptStep;
  },
  async update(id: string, payload: Partial<Pick<ScriptStep, 'step_label' | 'step_order' | 'lines' | 'is_active' | 'tipo_cierre_overrides'>>) {
    const response = await api.put(`/admin/scripts/${id}`, payload);
    return response.data as ScriptStep;
  },
  async remove(id: string) {
    const response = await api.delete(`/admin/scripts/${id}`);
    return response.data;
  }
};

// ============================================================
// Criterios dinámicos (admin)
// ============================================================
export const criteriaService = {
  async getAll() {
    const response = await api.get('/admin/criteria');
    return response.data as CriteriaBlock[];
  },
  // Bloques
  async createBlock(payload: { call_type: string; mode: string; block_name: string; block_order: number; applicable_tipo_cierres?: string[] }) {
    const response = await api.post('/admin/blocks', payload);
    return response.data as CriteriaBlock;
  },
  async updateBlock(id: string, payload: Partial<{ block_name: string; block_order: number; is_active: boolean; applicable_tipo_cierres: string[] }>) {
    const response = await api.put(`/admin/blocks/${id}`, payload);
    return response.data as CriteriaBlock;
  },
  async removeBlock(id: string) {
    const response = await api.delete(`/admin/blocks/${id}`);
    return response.data;
  },
  // Criterios individuales
  async createCriteria(payload: Omit<CriteriaItem, 'id' | 'is_active' | 'created_at' | 'updated_at'>) {
    const response = await api.post('/admin/criteria', payload);
    return response.data as CriteriaItem;
  },
  async updateCriteria(id: string, payload: Partial<Omit<CriteriaItem, 'id' | 'block_id' | 'created_at' | 'updated_at'>>) {
    const response = await api.put(`/admin/criteria/${id}`, payload);
    return response.data as CriteriaItem;
  },
  async removeCriteria(id: string) {
    const response = await api.delete(`/admin/criteria/${id}`);
    return response.data;
  },
  async generatePrompt(payload: { description: string; topic: string; call_type: string }) {
    const response = await api.post('/admin/criteria/generate-prompt', payload);
    return response.data as { prompt: string };
  },
  async generateBlocks(payload: { description: string; call_type: string; mode: string }): Promise<{ blocks: GeneratedBlock[] }> {
    const response = await api.post('/admin/criteria/generate-blocks', payload);
    return response.data;
  }
};

// ============================================================
// Tipos para scripts y criterios
// ============================================================
export interface ScriptStepOverride {
  lines?: string[];
}

export interface ScriptStep {
  id: string;
  call_type: string;
  mode: string;
  step_key: string;
  step_label: string;
  step_order: number;
  lines: string[];
  /** Guion específico por subcalificación. Si no hay override para una sub,
   *  se usa `lines` (guion base, válido para todas las subcalificaciones). */
  tipo_cierre_overrides?: Record<string, ScriptStepOverride>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CriteriaBlock {
  id: string;
  call_type: string;
  mode: string;
  block_name: string;
  block_order: number;
  applicable_tipo_cierres: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  criteria: CriteriaItem[];
}

export interface GeneratedCriterion {
  topic: string;
  points: number | null;
  criticality: 'Crítico' | '-';
  what_to_look_for: string;
  validation_source: string[];
  applies: boolean;
}

export interface GeneratedBlock {
  block_name: string;
  criteria: GeneratedCriterion[];
}

export interface CriteriaItemOverride {
  applies?: boolean;
  what_to_look_for?: string | null;
  validation_source?: string[] | null;
  requires_manual_review?: boolean;
}

export interface CriteriaItem {
  id: string;
  block_id: string;
  topic: string;
  criticality: 'Crítico' | '-';
  points: number | null;
  applies: boolean;
  requires_manual_review: boolean;
  what_to_look_for: string | null;
  validation_source: string[] | null;
  tipo_cierre_overrides?: Record<string, CriteriaItemOverride>;
  criteria_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Plantilla GPF (admin)
// ============================================================
export interface PlantillaGPFItem {
  id: string;
  categoria: string;
  tipo_cierre: string;
  descripcion: string;
  categoria_orden: number;
  tipo_orden: number;
  call_type: string;  // 'FRAUDE' | 'TH CONFIRMA'
  mode: string;       // 'INBOUND' | 'MONITOREO'
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const plantillaService = {
  async getAll() {
    const response = await api.get('/admin/plantilla-gpf');
    return response.data as PlantillaGPFItem[];
  },
  async create(payload: { categoria: string; tipo_cierre: string; descripcion: string; categoria_orden: number; tipo_orden: number; call_type: string; mode: string }) {
    const response = await api.post('/admin/plantilla-gpf', payload);
    return response.data as PlantillaGPFItem;
  },
  async update(id: string, payload: Partial<Pick<PlantillaGPFItem, 'categoria' | 'tipo_cierre' | 'descripcion' | 'categoria_orden' | 'tipo_orden' | 'is_active'>>) {
    const response = await api.put(`/admin/plantilla-gpf/${id}`, payload);
    return response.data as PlantillaGPFItem;
  },
  async renameCategoria(oldName: string, newName: string, callType: string, mode: string) {
    const response = await api.put('/admin/plantilla-gpf/rename-categoria', { oldName, newName, call_type: callType, mode });
    return response.data;
  },
  async remove(id: string) {
    const response = await api.delete(`/admin/plantilla-gpf/${id}`);
    return response.data;
  },
};

// AI Prompts (admin)
export interface AiPrompt {
  id: string;
  prompt_key: string;
  prompt_name: string;
  description: string | null;
  content: string;
  model: string | null;
  call_type: string;  // 'FRAUDE' | 'TH CONFIRMA'
  mode: string;       // 'INBOUND' | 'MONITOREO'
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const promptsService = {
  async getAll(): Promise<AiPrompt[]> {
    const response = await api.get('/admin/ai-prompts');
    return response.data as AiPrompt[];
  },
  async update(id: string, payload: Partial<Pick<AiPrompt, 'content' | 'prompt_name' | 'description' | 'is_active'>>): Promise<AiPrompt> {
    const response = await api.put(`/admin/ai-prompts/${id}`, payload);
    return response.data as AiPrompt;
  },
};

// ── Word Boost Terms (admin) ─────────────────────────────────

export interface WordBoostTerm {
  id: string;
  term: string;
  category: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const wordBoostService = {
  async getAll(): Promise<WordBoostTerm[]> {
    const response = await api.get('/admin/word-boost');
    return response.data as WordBoostTerm[];
  },
  async create(payload: Pick<WordBoostTerm, 'term' | 'category'> & Partial<Pick<WordBoostTerm, 'is_active' | 'display_order'>>): Promise<WordBoostTerm> {
    const response = await api.post('/admin/word-boost', payload);
    return response.data as WordBoostTerm;
  },
  async update(id: string, payload: Partial<Pick<WordBoostTerm, 'term' | 'category' | 'is_active' | 'display_order'>>): Promise<WordBoostTerm> {
    const response = await api.put(`/admin/word-boost/${id}`, payload);
    return response.data as WordBoostTerm;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/admin/word-boost/${id}`);
  },
};

// ── Image Systems (admin) ────────────────────────────────────

export interface ImageSystemField {
  field_name: string;
  description: string;
  example?: string;
}

export interface ImageSystem {
  id: string;
  system_name: string;
  description: string;
  detection_hints: string | null;
  fields_schema: ImageSystemField[] | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const imageSystemsService = {
  async getAll(): Promise<ImageSystem[]> {
    const response = await api.get('/admin/image-systems');
    return response.data as ImageSystem[];
  },
  async create(payload: Pick<ImageSystem, 'system_name' | 'description'> & Partial<Pick<ImageSystem, 'detection_hints' | 'fields_schema' | 'is_active' | 'display_order'>>): Promise<ImageSystem> {
    const response = await api.post('/admin/image-systems', payload);
    return response.data as ImageSystem;
  },
  async update(id: string, payload: Partial<Pick<ImageSystem, 'system_name' | 'description' | 'detection_hints' | 'fields_schema' | 'is_active' | 'display_order'>>): Promise<ImageSystem> {
    const response = await api.put(`/admin/image-systems/${id}`, payload);
    return response.data as ImageSystem;
  },
  async analyzeScreenshot(payload: {
    image_base64: string;
    mime_type: string;
    system_name: string;
    user_description: string;
  }): Promise<{ detection_hints: string; fields: Array<{ field_name: string; description: string; example: string; how_to_evaluate: string }> }> {
    const response = await api.post('/admin/image-systems/analyze-screenshot', payload);
    return response.data;
  },
  async generateHints(system_name: string, description: string): Promise<{ detection_hints: string; suggested_fields: ImageSystemField[] }> {
    const response = await api.post('/admin/image-systems/generate-hints', { system_name, description });
    return response.data;
  },
  async getAnalytics(): Promise<Array<{ system_name: string; count: number; avg_confidence: number; last_seen: string | null }>> {
    const response = await api.get('/admin/image-systems/analytics');
    return response.data;
  },
  async getByCallType(calificacion?: string, subcalificacion?: string): Promise<Array<{ system_name: string; count: number; avg_confidence: number }>> {
    const params = new URLSearchParams();
    if (calificacion) params.set('calificacion', calificacion);
    if (subcalificacion) params.set('subcalificacion', subcalificacion);
    const response = await api.get(`/admin/image-systems/by-calltype?${params.toString()}`);
    return response.data;
  },
  async getCalificaciones(): Promise<Array<{ calificacion: string; subcalificaciones: string[] }>> {
    const response = await api.get('/admin/audits/calificaciones');
    return response.data;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/admin/image-systems/${id}`);
  },
};

// ── Call Types Config (admin) ────────────────────────────────

export interface CallTypeConfig {
  id: string;
  name: string;
  modes: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
}

export const callTypesConfigService = {
  // Endpoint público (cualquier usuario autenticado) — para uso en componentes de auditoría
  async getActive(): Promise<CallTypeConfig[]> {
    const response = await api.get('/call-types-config');
    return response.data as CallTypeConfig[];
  },
  // Endpoint admin — para el panel de administración
  async getAll(): Promise<CallTypeConfig[]> {
    const response = await api.get('/admin/call-types-config');
    return response.data as CallTypeConfig[];
  },
  async create(payload: Pick<CallTypeConfig, 'name'> & Partial<Pick<CallTypeConfig, 'modes' | 'is_active' | 'display_order'>> & { clone_from?: string }): Promise<CallTypeConfig> {
    const response = await api.post('/admin/call-types-config', payload);
    return response.data as CallTypeConfig;
  },
  async update(id: string, payload: Partial<Pick<CallTypeConfig, 'name' | 'modes' | 'is_active' | 'display_order'>>): Promise<CallTypeConfig> {
    const response = await api.put(`/admin/call-types-config/${id}`, payload);
    return response.data as CallTypeConfig;
  },
  async remove(id: string): Promise<void> {
    await api.delete(`/admin/call-types-config/${id}`);
  },
  // Alinea calificaciones/subcalificaciones con lo que entrega GPF
  async syncFromGpf(env: 'prod' | 'test' = 'prod'): Promise<{
    totalCategories: number;
    registeredTypes: string[];
    deactivatedTypes: string[];
    reactivatedTypes: string[];
    deactivatedSubs: number;
    reactivatedSubs: number;
    windowDays: number | null;
    deactivationSkipped: boolean;
  }> {
    const response = await api.post('/admin/call-types-config/sync-gpf', { env });
    return response.data;
  },
};

// ── Cola Nocturna / Batch Processing ─────────────────────────────────────────

export interface BatchItem {
  id: string;
  batch_job_id: string;
  audit_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  gpf_attention_id: string;
  gpf_env: string;
  gpf_excel_type: string;
  executive_name: string | null;
  call_type: string | null;
  call_date: string | null;
  error_message: string | null;
  created_at: string;
}

export interface BatchJob {
  id: string;
  name: string;
  status: 'pending' | 'assembling' | 'submitted' | 'completed' | 'failed' | 'cancelled';
  openai_batch_id: string | null;
  scheduled_for: string;
  submitted_at: string | null;
  completed_at: string | null;
  created_by: string;
  item_count: number;
  completed_count: number;
  failed_count: number;
  error_message: string | null;
  created_at: string;
  batch_items?: BatchItem[];
}

export interface CreateBatchItemInput {
  gpf_attention_id: string;
  gpf_env: string;
  gpf_attention_object: Record<string, any>;
  gpf_excel_type: string;
  executive_name?: string;
  call_type?: string;
  call_date?: string;
}

export const batchService = {
  async createJob(payload: {
    name: string;
    scheduled_for: string;
    items: CreateBatchItemInput[];
  }): Promise<BatchJob> {
    const response = await api.post('/batch/jobs', payload);
    return response.data;
  },

  async getJobs(): Promise<BatchJob[]> {
    const response = await api.get('/batch/jobs');
    return response.data;
  },

  async getJob(jobId: string): Promise<BatchJob> {
    const response = await api.get(`/batch/jobs/${jobId}`);
    return response.data;
  },

  async submitJob(jobId: string): Promise<{ success: boolean; message: string }> {
    const response = await api.post(`/batch/jobs/${jobId}/submit`);
    return response.data;
  },

  async checkJob(jobId: string): Promise<{ status: string; message: string }> {
    const response = await api.post(`/batch/jobs/${jobId}/check`);
    return response.data;
  },

  async deleteJob(jobId: string): Promise<void> {
    await api.delete(`/batch/jobs/${jobId}`);
  },

  async getSavingsEstimate(count: number): Promise<{
    item_count: number;
    estimated_savings_usd: number;
    discount_percentage: number;
    limits: BatchLimits;
  }> {
    const response = await api.get(`/batch/savings-estimate?count=${count}`);
    return response.data;
  },

  async validateItems(items: { gpf_attention_id: string; gpf_env: string }[]): Promise<Array<{
    gpf_attention_id: string;
    accessible: boolean;
    imageCount: number;
    error?: string;
  }>> {
    const response = await api.post('/batch/validate', { items });
    return response.data.results;
  },
};

export interface BatchLimits {
  model: string;
  context_window_tokens: number;
  max_output_tokens: number;
  max_file_size_mb: number;
  max_requests_per_batch: number;
  recommended_max_cases: number;
  hard_max_cases: number;
  estimated_mb_per_case: number;
}

// Constantes de límites (mirror del backend) para cálculos client-side sin llamada de red
export const BATCH_LIMITS_CLIENT = {
  MODEL: 'claude-sonnet-5',
  CONTEXT_WINDOW_TOKENS: 400_000,
  MAX_OUTPUT_TOKENS: 128_000,
  MAX_FILE_SIZE_MB: 200,
  MAX_REQUESTS_PER_BATCH: 50_000,
  RECOMMENDED_MAX_CASES: 50,
  HARD_MAX_CASES: 90,
  ESTIMATED_MB_PER_CASE: 2.0,
  AVG_IMAGES_PER_CASE: 5,
  MB_PER_IMAGE_BASE64: 0.4,
} as const;

// ─── Bines ──────────────────────────────────────────────────

export interface BinesItem {
  id: string;
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
  created_at: string;
  updated_at: string;
}

export const binesService = {
  getAll: (): Promise<BinesItem[]> =>
    api.get('/admin/bines').then(r => r.data),
  create: (payload: Omit<BinesItem, 'id' | 'is_active' | 'created_at' | 'updated_at'>): Promise<BinesItem> =>
    api.post('/admin/bines', payload).then(r => r.data),
  update: (id: string, payload: Partial<BinesItem>): Promise<BinesItem> =>
    api.put(`/admin/bines/${id}`, payload).then(r => r.data),
  remove: (id: string): Promise<void> =>
    api.delete(`/admin/bines/${id}`).then(r => r.data),
};

// CRUD de usuarios (admin)
export const userService = {
 async getUsers() {
 const response = await api.get('/admin/users');
 return response.data;
 },
 async createUser(userData: { email: string; password: string; full_name: string; role: string }) {
 const response = await api.post('/admin/users', userData);
 return response.data;
 },
 async updateUser(userId: string, userData: { full_name?: string; role?: string; is_active?: boolean }) {
 const response = await api.put(`/admin/users/${userId}`, userData);
 return response.data;
 },
 async deleteUser(userId: string) {
 const response = await api.delete(`/admin/users/${userId}`);
 return response.data;
 }
};

// Gestión de empresas (solo admin de plataforma)
export const companyService = {
  getAll: () => api.get('/platform/companies').then((r: any) => r.data),
  create: (payload: { name: string; slug: string; integration_type?: string }) =>
    api.post('/platform/companies', payload).then((r: any) => r.data),
  update: (id: string, payload: Record<string, unknown>) =>
    api.put(`/platform/companies/${id}`, payload).then((r: any) => r.data),
  getUsage: (id: string) => api.get(`/platform/companies/${id}/usage`).then((r: any) => r.data),
  setLimits: (id: string, limits: Record<string, unknown>) =>
    api.put(`/platform/companies/${id}/limits`, limits).then((r: any) => r.data),
  getOwnUsage: () => api.get('/admin/company/usage').then((r: any) => r.data),
  setRolePermissions: (permissions: Record<string, unknown>) =>
    api.put('/admin/company/role-permissions', permissions).then((r: any) => r.data),
};
