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
 // Info del creador de la auditoria
 created_by_name?: string;
 created_by_email?: string;
 evaluations: Array<{
 total_score: number;
 max_possible_score: number;
 percentage: number;
 excel_filename: string;
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

 async updateAuditScores(auditId: string, detailedScores: any[]): Promise<{
 totalScore: number;
 maxPossibleScore: number;
 percentage: number;
 criticalFailure: boolean;
 failedCriticalCriteria?: string[];
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
 excelType: 'INBOUND' | 'MONITOREO';
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
 async getAttentions(env: 'test' | 'prod'): Promise<{ attentions: GpfAttention[]; count: number }> {
 const response = await api.get(`/gpf/attentions?env=${env}`);
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
  async update(id: string, payload: Partial<Pick<ScriptStep, 'step_label' | 'step_order' | 'lines' | 'is_active'>>) {
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
  async createBlock(payload: { call_type: string; block_name: string; block_order: number }) {
    const response = await api.post('/admin/blocks', payload);
    return response.data as CriteriaBlock;
  },
  async updateBlock(id: string, payload: Partial<{ block_name: string; block_order: number; is_active: boolean }>) {
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
  }
};

// ============================================================
// Tipos para scripts y criterios
// ============================================================
export interface ScriptStep {
  id: string;
  call_type: string;
  step_key: string;
  step_label: string;
  step_order: number;
  lines: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CriteriaBlock {
  id: string;
  call_type: string;
  block_name: string;
  block_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  criteria: CriteriaItem[];
}

export interface CriteriaItem {
  id: string;
  block_id: string;
  topic: string;
  criticality: 'Crítico' | '-';
  points: number | null;
  applies: boolean;
  what_to_look_for: string | null;
  criteria_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

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