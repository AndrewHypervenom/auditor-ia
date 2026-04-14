// frontend/src/types/index.ts

// ============================================
// TIPOS DE AUDITORÍA
// ============================================

export type CallType = string;
export type ExcelType = string;

export interface AuditFormData {
  executiveName: string;
  executiveId: string;
  callType: string;
  excelType: string;
  clientId: string;
  callDate: string;
  callDuration?: string;
}

// ============================================
// TIPOS DE EVALUACIÓN
// ============================================

export interface EvaluationCriteria {
  id: string;
  category: string;
  name: string;
  description: string;
  maxScore: number;
  weight: number;
}

export interface DetailedScore {
  criteriaId: string;
  criteriaName: string;
  score: number;
  maxScore: number;
  observations: string;
  evidences: string[];
  requiresManualReview?: boolean;
}

export interface EvaluationResult {
  totalScore: number;
  maxPossibleScore: number;
  percentage: number;
  detailedScores: DetailedScore[];
  observations: string;
  recommendations: string[];
  keyMoments: KeyMoment[];
  excelFilename: string;
  transcript?: string;
  audioConfidence?: number;
  criticalFailure?: boolean;
  failedCriticalCriteria?: string[];
  dataWarnings?: string[];
}

export interface KeyMoment {
  timestamp: string;
  type: 'positive' | 'negative' | 'neutral';
  description: string;
  criteriaId?: string;
}

// ============================================
// TIPOS DE TRANSCRIPCIÓN
// ============================================

export interface Utterance {
  speaker: 'A' | 'B';
  text: string;
  start: number;
  end: number;
  confidence: number;
}

export interface TranscriptionResult {
  id: string;
  text: string;
  utterances: Utterance[];
  audioDuration: number;
  confidence: number;
  language: string;
}

// ============================================
// TIPOS DE ANÁLISIS DE IMÁGENES
// ============================================

export interface ImageAnalysisResult {
  id: string;
  systemDetected: string;
  extractedData: Record<string, any>;
  confidence: number;
  processingTime: number;
}

// ============================================
// TIPOS DE COSTOS API
// ============================================

export interface APICostsDB {
  id: string;
  audit_id: string;
  transcription_cost: number;
  image_analysis_cost: number;
  evaluation_cost: number;
  total_cost: number;
  tokens_used: {
    transcription?: number;
    imageAnalysis?: number;
    evaluation?: number;
    total?: number;
  };
  created_at: string;
}

export interface APICosts {
  transcription: {
    cost: number;
    tokens?: number;
  };
  imageAnalysis: {
    cost: number;
    tokens?: number;
  };
  evaluation: {
    cost: number;
    tokens?: number;
  };
  total: number;
}

// ============================================
// TIPOS DE USUARIO Y AUTENTICACIÓN
// ============================================

export type UserRole = 'admin' | 'supervisor' | 'analyst';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ============================================
// TIPOS DE ESTADÍSTICAS
// ============================================

export interface AuditStats {
  totalAudits: number;
  completedAudits: number;
  processingAudits: number;
  errorAudits: number;
  averageScore: number;
  totalExecutives: number;
  thisMonthAudits: number;
  totalCosts?: number;
}

export interface Analytics {
  totalAudits: number;
  completedAudits: number;
  averageScore: number;
  totalCosts: number;
  monthlyTrend: MonthlyTrendData[];
  scoreDistribution: ScoreDistributionData[];
  topExecutives: TopExecutiveData[];
}

export interface MonthlyTrendData {
  month: string;
  audits: number;
  avgScore: number;
}

export interface ScoreDistributionData {
  range: string;
  count: number;
}

export interface TopExecutiveData {
  name: string;
  audits: number;
  avgScore: number;
}

// ============================================
// TIPOS DE PROCESAMIENTO
// ============================================

export type ProcessingStage = 
  | 'uploading'
  | 'transcription'
  | 'analysis'
  | 'evaluation'
  | 'excel'
  | 'completed'
  | 'error';

export interface ProcessingStatus {
  stage: ProcessingStage;
  progress: number;
  message: string;
}

// ============================================
// TIPOS DE SSE (Server-Sent Events)
// ============================================

export interface SSEMessage {
  type: 'info' | 'success' | 'error' | 'progress' | 'stage' | 'result';
  stage?: ProcessingStage;
  progress?: number;
  message: string;
  data?: any;
  timestamp: string;
}

// ============================================
// TIPOS DE RESPUESTAS API
// ============================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================
// TIPOS DE ERRORES
// ============================================

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
  details?: any;
}

// ============================================
// TIPOS DE FILTROS Y BÚSQUEDA
// ============================================

export interface AuditFilters {
  status?: 'processing' | 'completed' | 'error';
  dateFrom?: string;
  dateTo?: string;
  executiveId?: string;
  callType?: CallType;
  search?: string;
}

export interface SortOptions {
  field: string;
  order: 'asc' | 'desc';
}

// ============================================
// TIPOS AUXILIARES
// ============================================

export interface FileUploadProgress {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'completed' | 'error';
  error?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}