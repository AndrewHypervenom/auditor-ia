// backend/src/server.ts

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env') });

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger.js';
import { assemblyAIService } from './services/assemblyai.service.js';
import { openAIService } from './services/openai.service.js';
import { evaluatorService } from './services/evaluator.service.js';
import { excelService } from './services/excel.service.js';
import { databaseService } from './services/database.service.js';
import { costCalculatorService } from './services/cost-calculator.service.js';
import { buildSentimentSummary } from './utils/sentiment.js';
import { authenticateUser, requireAdmin, requireAdminOrAnalyst, requireAdminOrSupervisor } from './middleware/auth.middleware.js';
import { checkUsageLimits } from './middleware/usage-limit.middleware.js';
import { gpfTokenService } from './services/gpf-token.service.js';
import { gpfDataService } from './services/gpf-data.service.js';
import { gpfConfigService } from './services/gpf-config.service.js';
import { buildSyntheticTranscript } from './utils/synthetic-transcript.js';
import { downloadImagesToTemp } from './utils/image-downloader.js';
import { gpfFetch } from './utils/gpf-fetch.js';
import { supabase, supabaseAdmin } from './config/supabase.js';
import { progressBroadcaster } from './services/progress-broadcaster.js';
import type { AuditInput } from './types/index.js';
import statsRoutes from './routes/stats.routes.js';
import { batchService } from './services/batch.service.js';

const app = express();
app.set('trust proxy', 1); // Render.com está detrás de un proxy — necesario para req.protocol y req.ip
const PORT = process.env.PORT || 3000;

// Crear directorio temporal para uploads (solo temporal durante procesamiento)
const uploadDir = './tmp/uploads';

[uploadDir, `${uploadDir}/audio`, `${uploadDir}/images`].forEach(dir => {
 if (!fs.existsSync(dir)) {
 fs.mkdirSync(dir, { recursive: true });
 }
});

// Helper para limpiar archivos temporales
const cleanupTempFiles = (filePaths: string[]) => {
 for (const filePath of filePaths) {
 try {
 if (fs.existsSync(filePath)) {
 fs.unlinkSync(filePath);
 logger.info(' Temp file cleaned up', { filePath });
 }
 } catch (error) {
 logger.warn(' Failed to cleanup temp file', { filePath, error });
 }
 }
};

// Configurar multer para archivos temporales
const storage = multer.diskStorage({
 destination: (req, file, cb) => {
 const folder = file.fieldname === 'audio' ? 'audio' : 'images';
 cb(null, path.join(uploadDir, folder));
 },
 filename: (req, file, cb) => {
 const uniqueName = `${uuidv4()}-${file.originalname}`;
 cb(null, uniqueName);
 }
});

const upload = multer({
 storage,
 limits: {
 fileSize: Number(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024
 },
 fileFilter: (req, file, cb) => {
 if (file.fieldname === 'audio') {
 const allowedMimes = ['audio/wav', 'audio/mpeg', 'audio/mp3'];
 if (allowedMimes.includes(file.mimetype)) {
 cb(null, true);
 } else {
 cb(new Error('Solo se permiten archivos de audio WAV o MP3'));
 }
 } else if (file.fieldname === 'images') {
 const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png'];
 if (allowedMimes.includes(file.mimetype)) {
 cb(null, true);
 } else {
 cb(new Error('Solo se permiten imágenes JPEG o PNG'));
 }
 } else {
 cb(null, true);
 }
 }
});

// Middleware - CORS actualizado para multiples origenes
const allowedOrigins = [
 'https://audit-ai-gamma.vercel.app',
 'http://localhost:5173',
 'http://localhost:5174',
 'https://auditoria-kappa.vercel.app',
 process.env.CORS_ORIGIN
].filter(Boolean) as string[];

app.use(cors({
 origin: (origin, callback) => {
 if (!origin) return callback(null, true);
 
 // Permitir cualquier subdominio de vercel.app
 if (origin.endsWith('.vercel.app') || allowedOrigins.includes(origin)) {
 callback(null, true);
 } else if (origin.startsWith('http://localhost:')) {
 callback(null, true);
 } else {
 logger.warn(`CORS blocked origin: ${origin}`);
 callback(new Error('Not allowed by CORS'));
 }
 },
 credentials: true,
 methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
 allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// MIDDLEWARE UTF-8
// ============================================

// Forzar UTF-8 en todas las respuestas
app.use((req: Request, res: Response, next: NextFunction) => {
 res.setHeader('Content-Type', 'application/json; charset=utf-8');
 res.setHeader('X-Content-Type-Options', 'nosniff');
 next();
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ELIMINADO: Ya no se sirven archivos estáticos desde results
// app.use('/results', express.static(resultsDir));

// Health check
app.get('/health', (req, res) => {
 res.json({
 status: 'ok',
 timestamp: new Date().toISOString(),
 openai: !!process.env.OPENAI_API_KEY,
 assemblyai: !!process.env.ASSEMBLYAI_API_KEY,
 supabase: !!process.env.SUPABASE_URL
 });
});

app.get('/api/health', (req, res) => {
 res.json({
 status: 'ok',
 timestamp: new Date().toISOString(),
 version: '2.1.0',
 cors_origins: allowedOrigins.length
 });
});

// Registrar router de stats
app.use('/api/audits', statsRoutes);

// ============================================
// AUTH ENDPOINTS
// ============================================

app.post('/api/auth/signup', (req: Request, res: Response) => {
 res.status(403).json({ 
 error: 'Registro deshabilitado. Contacte al administrador para crear una cuenta.',
 code: 'SIGNUP_DISABLED'
 });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
 try {
 const { email, password } = req.body;

 if (!email || !password) {
 return res.status(400).json({ error: 'Email y contraseña son requeridos' });
 }

 const { data, error } = await supabase.auth.signInWithPassword({
 email,
 password
 });

 if (error) {
 logger.error('Login error:', error);
 return res.status(401).json({ error: 'Credenciales inválidas' });
 }

 res.json({
 user: data.user,
 session: data.session
 });
 } catch (error: any) {
 logger.error('Login error:', error);
 res.status(500).json({ error: 'Error al iniciar sesión' });
 }
});

app.post('/api/auth/logout', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { error } = await supabase.auth.signOut();

 if (error) {
 logger.error('Logout error:', error);
 return res.status(500).json({ error: 'Error al cerrar sesión' });
 }

 res.json({ message: 'Sesión cerrada exitosamente' });
 } catch (error: any) {
 logger.error('Logout error:', error);
 res.status(500).json({ error: 'Error al cerrar sesión' });
 }
});

app.get('/api/auth/me', authenticateUser, async (req: Request, res: Response) => {
 try {
 const userId = req.user!.id;

 const { data: userData, error } = await supabaseAdmin
 .from('users')
 .select('*')
 .eq('id', userId)
 .single();

 if (error) {
 logger.error('Get user error:', error);
 return res.status(404).json({ error: 'Usuario no encontrado' });
 }

 res.json(userData);
 } catch (error: any) {
 logger.error('Get user error:', error);
 res.status(500).json({ error: 'Error al obtener usuario' });
 }
});

// ============================================
// SSE PROGRESS ENDPOINT
// ============================================

app.get('/api/progress/:clientId', (req: Request, res: Response) => {
 const { clientId } = req.params;
 progressBroadcaster.addClient(clientId, res);
});

// ============================================
// DOWNLOAD ENDPOINT - AHORA LEE DESDE LA BASE DE DATOS
// ============================================

app.get('/api/download/:filename', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { filename } = req.params;
 
 // Validar que el filename no contenga caracteres peligrosos
 if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
 logger.warn('Attempt to access file with invalid path:', filename);
 return res.status(400).json({ error: 'Nombre de archivo inválido' });
 }

 logger.info(' Downloading Excel from database:', { filename, userId: req.user!.id });

 // NUEVO: Buscar el Excel en la base de datos
 const excelResult = await databaseService.getExcelData(filename);

 if (!excelResult || !excelResult.excelData) {
 logger.error('Excel not found in database:', filename);
 return res.status(404).json({ error: 'Archivo no encontrado en la base de datos' });
 }

 // Convertir base64 a buffer y enviar
 const excelBuffer = Buffer.from(excelResult.excelData, 'base64');

 res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
 res.setHeader('Content-Length', excelBuffer.length);

 res.send(excelBuffer);

 logger.success(' Excel downloaded from database successfully', { filename });

 } catch (error: any) {
 logger.error('Error downloading file:', error);
 if (!res.headersSent) {
 res.status(500).json({ error: 'Error al descargar el archivo' });
 }
 }
});

// ============================================
// AUDIT ENDPOINTS
// ============================================

app.get('/api/audits', authenticateUser, async (req: Request, res: Response) => {
 try {
 const limit = parseInt(req.query.limit as string) || 50;
 const offset = parseInt(req.query.offset as string) || 0;

 // superadmin ve todas las empresas; el resto solo la suya
 const effectiveCompanyId = req.user!.role === 'superadmin' ? null : req.user!.company_id;
 const { audits, total } = await databaseService.getUserAudits(
 req.user!.id,
 req.user!.role,
 effectiveCompanyId,
 limit,
 offset
 );

 res.json({
 audits,
 total,
 limit,
 offset
 });
 } catch (error: any) {
 logger.error('Error fetching audits', error);
 res.status(500).json({ error: 'Error al obtener auditorías' });
 }
});

app.get('/api/audits/:auditId', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { auditId } = req.params;

 const effectiveCompanyId = req.user!.role === 'superadmin' ? null : req.user!.company_id;
 const auditData = await databaseService.getAuditById(auditId, req.user!.id, req.user!.role, effectiveCompanyId);

 await databaseService.logAuditActivity(
 auditId,
 req.user!.id,
 'viewed',
 null,
 req.ip,
 req.headers['user-agent']
 );

 res.json(auditData);
 } catch (error: any) {
 logger.error('Error fetching audit', error);
 
 if (error.message === 'Audit not found' || error.message === 'Auditoría no encontrada') {
 return res.status(404).json({ error: 'Auditoría no encontrada' });
 }
 
 if (error.message === 'Access denied' || error.message === 'Acceso denegado') {
 return res.status(403).json({ error: 'Acceso denegado' });
 }
 
 res.status(500).json({ error: 'Error al obtener auditoría' });
 }
});

// POST /api/evaluate - Crear nueva auditoría
app.post('/api/evaluate',
 authenticateUser,
 checkUsageLimits,
 upload.fields([
 { name: 'audio', maxCount: 1 },
 { name: 'images', maxCount: 15 }
 ]),
 async (req: Request, res: Response) => {
 const startTime = Date.now();
 let auditId: string | null = null;
 
 const sseClientId = req.body.sseClientId || uuidv4();

 // Recopilar rutas de archivos temporales para limpiar después
 const tempFilePaths: string[] = [];

 try {
 logger.info(' Starting new audit process...', {
 userId: req.user!.id,
 userEmail: req.user!.email,
 sseClientId
 });

 // Validar archivos requeridos
 const files = req.files as { [fieldname: string]: Express.Multer.File[] };

 if (!files || !files.audio || files.audio.length === 0) {
 return res.status(400).json({ error: 'Se requiere un archivo de audio' });
 }

 const audioFile = files.audio[0];
 const imageFiles = files.images || [];

 // Registrar archivos temporales para limpieza
 tempFilePaths.push(audioFile.path);
 imageFiles.forEach(f => tempFilePaths.push(f.path));

 logger.info(' Files received:', {
 audio: audioFile.originalname,
 audioSize: audioFile.size,
 images: imageFiles.length
 });

 const callType: string = req.body.callType || '';
 const rawExcelType = req.body.excelType || '';
 const excelType: 'INBOUND' | 'MONITOREO' =
 rawExcelType === 'MONITOREO' ? 'MONITOREO' :
 rawExcelType === 'INBOUND' ? 'INBOUND' :
 callType.toUpperCase().includes('MONITOREO') ? 'MONITOREO' : 'INBOUND';

 const metadata: AuditInput = {
 executiveName: req.body.executiveName || '',
 executiveId: req.body.executiveId || '',
 callType,
 excelType,
 clientId: req.body.clientId || '',
 callDate: req.body.callDate || new Date().toISOString().split('T')[0],
 callDuration: req.body.callDuration || null,
 audioPath: audioFile.path,
 imagePaths: imageFiles.map(f => f.path),
 // Carga manual: la auditoría pertenece a la empresa del usuario (multi-tenant)
 companyId: req.user!.company_id ?? null
 };

 logger.info(' Audit metadata:', metadata);

 // 1. Crear entrada en la base de datos
 progressBroadcaster.progress(sseClientId, 'upload', 10, 'Archivos subidos correctamente');

 auditId = await databaseService.createAudit({
 userId: req.user!.id,
 companyId: req.user!.company_id ?? undefined,
 auditInput: metadata,
 audioFilename: audioFile.filename,
 imageFilenames: imageFiles.map(f => f.filename)
 });

 logger.success(' Audit record created', { auditId });

 // 2. Transcribir audio
 progressBroadcaster.progress(sseClientId, 'transcription', 25, 'Iniciando transcripción...');
 
 const transcriptionRaw = await assemblyAIService.transcribe(audioFile.path);

 // Post-corrección: arregla errores de ASR en nombres de marca y términos bancarios
 const correctedText = await openAIService.correctTranscription(transcriptionRaw.text);
 const transcription = { ...transcriptionRaw, text: correctedText };

 logger.success(' Transcription completed', {
 duration: transcription.audio_duration,
 words: transcription.words?.length
 });

 // 2b. Análisis de sentimientos
 // AssemblyAI solo soporta sentimientos nativos en inglés; para ES/PT
 // se calculan con OpenAI sobre las utterances.
 progressBroadcaster.progress(sseClientId, 'transcription', 35, 'Analizando sentimientos...');

 let sentimentResults = transcription.sentiment_analysis_results || [];
 let sentimentProvider: 'assemblyai' | 'openai' = 'assemblyai';
 let sentimentUsage = { inputTokens: 0, outputTokens: 0 };

 if (sentimentResults.length === 0 && (transcription.utterances?.length || 0) > 0) {
 const gptSentiment = await openAIService.analyzeSentiment(transcription.utterances);
 sentimentResults = gptSentiment.results;
 sentimentUsage = gptSentiment.usage;
 sentimentProvider = 'openai';
 }

 const sentimentSummary = buildSentimentSummary(sentimentResults, sentimentProvider);

 if (sentimentSummary) {
 logger.success(' Sentiment analysis completed', {
 provider: sentimentProvider,
 overall: sentimentSummary.overall,
 positivas: sentimentSummary.positive,
 negativas: sentimentSummary.negative
 });
 }

 // 3. Analizar imágenes con OpenAI
 progressBroadcaster.progress(sseClientId, 'analysis', 50, 'Analizando imágenes...');

 const imageAnalyses = imageFiles.length > 0 
 ? await openAIService.analyzeMultipleImages(imageFiles.map(f => f.path))
 : [];

 const imageAnalysis = imageAnalyses.length > 0
 ? imageAnalyses.map(img => `${img.system}: ${JSON.stringify(img.data)}`).join('\n\n')
 : 'No se proporcionaron imágenes para analizar';

 logger.success(' Image analysis completed');

 // 4. Evaluar con criterios
 progressBroadcaster.progress(sseClientId, 'evaluation', 75, 'Evaluando con IA...');

 const evaluation = await evaluatorService.evaluate(
 metadata,
 transcription,
 imageAnalyses
 );

 logger.success(' Evaluation completed', {
 totalScore: evaluation.totalScore,
 maxPossibleScore: evaluation.maxPossibleScore,
 percentage: evaluation.percentage
 });

 // 5. Generar Excel EN MEMORIA (ya no se guarda en disco)
 progressBroadcaster.progress(sseClientId, 'excel', 90, 'Generando reporte Excel...');

 const excelResult = await excelService.generateExcelReport(metadata, evaluation);

 logger.success(' Excel report generated in memory', { 
 filename: excelResult.filename,
 sizeKB: (excelResult.buffer.length / 1024).toFixed(1)
 });

 // 6. Calcular costos (fix: usar tokens reales del análisis de imágenes)
 const imgInputTokens = imageAnalyses.reduce((s: number, img: any) => s + (img.usage?.input_tokens || 0), 0);
 const imgOutputTokens = imageAnalyses.reduce((s: number, img: any) => s + (img.usage?.output_tokens || 0), 0);
 const costs = costCalculatorService.calculateTotalCost(
 transcription.audio_duration || 0,
 imageFiles.length,
 imgInputTokens,
 imgOutputTokens,
 (evaluation.usage?.inputTokens || 0) + sentimentUsage.inputTokens,
 (evaluation.usage?.outputTokens || 0) + sentimentUsage.outputTokens,
 sentimentProvider === 'assemblyai' && sentimentResults.length > 0
 );

 logger.info(' Costs calculated:', costs);

 // 7. Actualizar en base de datos (Excel como base64)
 const excelBase64 = excelResult.buffer.toString('base64');
 
 await databaseService.completeAudit(auditId, {
 transcription: transcription.text,
 transcriptionWords: transcription.words,
 imageAnalysis: imageAnalysis,
 evaluation,
 excelFilename: excelResult.filename,
 excelBase64: excelBase64,
 processingTimeMs: Date.now() - startTime,
 costs,
 companyId: req.user!.company_id ?? null,
 audioDuration: transcription.audio_duration ?? null,
 transcriptionConfidence: transcription.confidence ?? null,
 languageCode: transcription.language_code,
 sentimentResults,
 sentimentSummary
 });

 logger.success(' Audit completed successfully', {
 auditId,
 totalTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`,
 totalCost: `$${costs.totalCost.toFixed(4)}`
 });

 // 8. Enviar progreso final
 progressBroadcaster.progress(sseClientId, 'completed', 100, '¡Auditoría completada!');

 // Registrar actividad
 await databaseService.logAuditActivity(
 auditId,
 req.user!.id,
 'created',
 null,
 req.ip,
 req.headers['user-agent']
 );

 // Limpiar archivos temporales (audio e imágenes ya no se necesitan)
 cleanupTempFiles(tempFilePaths);

 // Responder con el ID
 res.json({
 success: true,
 auditId,
 excelFilename: excelResult.filename,
 processingTime: Date.now() - startTime,
 costs
 });

 } catch (error: any) {
 logger.error(' Error processing audit:', error);

 if (auditId) {
 await databaseService.markAuditError(auditId, error.message);
 }

 progressBroadcaster.progress(sseClientId, 'error', 0, `Error: ${error.message}`);

 // Limpiar archivos temporales incluso en caso de error
 cleanupTempFiles(tempFilePaths);

 res.status(500).json({ 
 error: 'Error procesando auditoría', 
 details: error.message,
 auditId 
 });
 }
 }
);

// Verifica que la auditoría pertenezca a la empresa del usuario (superadmin: acceso total).
// Responde 404 y devuelve false si no puede operar sobre ella.
async function ensureAuditCompany(req: Request, res: Response, auditId: string): Promise<boolean> {
 if (req.user!.role === 'superadmin' || !req.user!.company_id) return true;
 const { data } = await supabaseAdmin
 .from('audits')
 .select('id')
 .eq('id', auditId)
 .eq('company_id', req.user!.company_id)
 .maybeSingle();
 if (!data) {
 res.status(404).json({ error: 'Auditoría no encontrada' });
 return false;
 }
 return true;
}

// ============================================================
// POST /api/audits/:auditId/sentiment — Generar sentimientos bajo demanda
// (para auditorías guardadas antes de la función de sentimientos)
// ============================================================
app.post('/api/audits/:auditId/sentiment', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { auditId } = req.params;
 if (!(await ensureAuditCompany(req, res, auditId))) return;

 const { data: t, error } = await databaseService.client
 .from('transcriptions')
 .select('*')
 .eq('audit_id', auditId)
 .single();

 if (error || !t) {
 return res.status(404).json({ error: 'La auditoría no tiene transcripción' });
 }

 // Si ya existen sentimientos, devolverlos sin regenerar
 const existing = t.assemblyai_response?.sentiment_analysis_results;
 if (Array.isArray(existing) && existing.length > 0) {
 return res.json({
 sentimentResults: existing,
 sentimentSummary: t.assemblyai_response?.sentiment_summary
 ?? buildSentimentSummary(existing, t.assemblyai_response?.sentiment_summary?.provider || 'openai')
 });
 }

 // Usar utterances guardadas; si no hay (p. ej. lotes antiguos), derivar
 // pseudo-utterances del texto plano (sin hablante ni timestamps)
 let utterances: any[] = Array.isArray(t.utterances) ? t.utterances.filter((u: any) => u?.text) : [];
 if (utterances.length === 0 && t.full_text) {
 const cleanText = String(t.full_text).split('--- DATOS ESTRUCTURADOS GPF ---')[0];
 utterances = cleanText
 .split(/(?<=[.!?])\s+|\n+/)
 .map((s: string) => s.trim())
 .filter((s: string) => s.length > 3)
 .slice(0, 400)
 .map((s: string) => ({ speaker: '', text: s, start: 0, end: 0 }));
 }

 if (utterances.length === 0) {
 return res.status(400).json({ error: 'No hay texto de transcripción para analizar' });
 }

 const { results } = await openAIService.analyzeSentiment(utterances);
 if (results.length === 0) {
 return res.status(500).json({ error: 'No se pudo generar el análisis de sentimientos' });
 }

 const summary = buildSentimentSummary(results, 'openai');

 await databaseService.client
 .from('transcriptions')
 .update({
 assemblyai_response: {
 ...(t.assemblyai_response || {}),
 sentiment_analysis_results: results,
 sentiment_summary: summary
 }
 })
 .eq('id', t.id);

 logger.success(' Sentiment generated on demand', { auditId, frases: results.length });

 res.json({ sentimentResults: results, sentimentSummary: summary });
 } catch (error: any) {
 logger.error(' Error generating sentiment on demand', error);
 res.status(500).json({ error: error.message });
 }
});

// ============================================================
// PATCH /api/audits/:auditId/scores — Actualizar puntajes manualmente
// ============================================================
app.patch('/api/audits/:auditId/scores', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { auditId } = req.params;
 if (!(await ensureAuditCompany(req, res, auditId))) return;
 const { detailedScores } = req.body as { detailedScores: Array<{ criterion: string; score: number; maxScore: number; observations: string; criticality?: string; requiresManualReview?: boolean }> };

 if (!Array.isArray(detailedScores) || detailedScores.length === 0) {
 return res.status(400).json({ error: 'detailedScores es requerido y debe ser un array no vacío' });
 }

 // Recalcular totales
 const totalScore = detailedScores.reduce((sum, s) => sum + (s.score ?? 0), 0);
 const maxPossibleScore = detailedScores.reduce((sum, s) => sum + (s.maxScore ?? 0), 0);
 const rawPercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

 // Reevaluar fallo crítico — excluir ítems de validación manual (score 0 es su estado inicial, no una falla)
 const failedCritical = detailedScores.filter(s =>
   s.criticality === 'Crítico' &&
   s.score === 0 &&
   !s.requiresManualReview &&
   !(typeof s.observations === 'string' && s.observations.includes('Requiere validación manual'))
 ).map(s => s.criterion);
 const criticalFailure = failedCritical.length > 0;
 const percentage = criticalFailure ? 0 : rawPercentage;

 const { error } = await supabaseAdmin
 .from('evaluations')
 .update({
 detailed_scores: detailedScores,
 total_score: criticalFailure ? 0 : totalScore,
 max_possible_score: maxPossibleScore,
 percentage
 })
 .eq('audit_id', auditId);

 if (error) {
 logger.error('Error updating scores', error);
 return res.status(500).json({ error: 'Error al actualizar puntajes en la base de datos' });
 }

 logger.success('Scores updated manually', { auditId, totalScore, percentage, criticalFailure });

 // Regenerar Excel con los puntajes actualizados
 let newExcelFilename: string | undefined;
 try {
   const auditData = await databaseService.getAuditById(auditId, req.user!.id, req.user!.role, req.user!.role === 'superadmin' ? null : req.user!.company_id);
   if (auditData?.audit) {
     const { audit, evaluation: evalRow } = auditData;
     const auditInput: AuditInput = {
       executiveName:   audit.executive_name   || '',
       executiveId:     audit.executive_id     || '',
       callType:        audit.call_type        || '',
       clientId:        audit.client_id        || '',
       callDate:        audit.call_date        || '',
       calificacion:    audit.calificacion     || undefined,
       subCalificacion: audit.sub_calificacion || undefined,
       excelType:       audit.excel_type       || undefined,
     };
     const evalForExcel = {
       ...(evalRow || {}),
       detailedScores,
       totalScore: criticalFailure ? 0 : totalScore,
       maxPossibleScore,
       percentage,
     };
     const newExcel = await excelService.generateExcelReport(auditInput, evalForExcel as any);
     const newBase64 = newExcel.buffer.toString('base64');
     await supabaseAdmin.from('evaluations').update({
       excel_data:     newBase64,
       excel_filename: newExcel.filename,
     }).eq('audit_id', auditId);
     newExcelFilename = newExcel.filename;
     logger.success('Excel regenerado tras actualización de puntajes', { auditId, filename: newExcel.filename });
   }
 } catch (excelErr: any) {
   logger.warn('No se pudo regenerar el Excel tras actualizar puntajes', { auditId, error: excelErr?.message });
 }

 return res.json({ totalScore, maxPossibleScore, percentage, criticalFailure, failedCriticalCriteria: criticalFailure ? failedCritical : undefined, excel_filename: newExcelFilename });
 } catch (error: any) {
 logger.error('Error in PATCH /api/audits/:auditId/scores', error);
 return res.status(500).json({ error: 'Error interno del servidor' });
 }
});

// ============================================================
// PATCH /api/audits/:auditId/comments — Guardar comentarios del supervisor por rubro
// ============================================================
app.patch('/api/audits/:auditId/comments', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { auditId } = req.params;
 if (!(await ensureAuditCompany(req, res, auditId))) return;
 const { comments } = req.body as { comments: Record<string, string> };

 if (!comments || typeof comments !== 'object' || Array.isArray(comments)) {
 return res.status(400).json({ error: 'comments debe ser un objeto { [criterion]: string }' });
 }

 const { error } = await supabaseAdmin
 .from('evaluations')
 .update({ supervisor_comments: comments })
 .eq('audit_id', auditId);

 if (error) {
 logger.error('Error saving supervisor comments', error);
 return res.status(500).json({ error: 'Error al guardar comentarios en la base de datos' });
 }

 logger.success('Supervisor comments saved', { auditId, count: Object.keys(comments).length });
 return res.json({ success: true });
 } catch (error: any) {
 logger.error('Error in PATCH /api/audits/:auditId/comments', error);
 return res.status(500).json({ error: 'Error interno del servidor' });
 }
});

app.delete('/api/audits/:auditId', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { auditId } = req.params;
 const userId = req.user!.id;
 const userRole = req.user!.role;
 const effectiveCompanyId = userRole === 'superadmin' ? null : req.user!.company_id;

 await databaseService.deleteAudit(auditId, userId, userRole, effectiveCompanyId);

 logger.success('Audit deleted successfully', { auditId });

 res.json({ 
 success: true, 
 message: 'Auditoría eliminada exitosamente' 
 });

 } catch (error: any) {
 logger.error('Error deleting audit:', error);

 if (error.message.includes('No tienes permisos')) {
 return res.status(403).json({ error: error.message });
 }

 if (error.message.includes('no encontrada')) {
 return res.status(404).json({ error: 'Auditoría no encontrada' });
 }

 res.status(500).json({ error: 'Error al eliminar auditoría' });
 }
});

// ============================================
// ADMIN USER MANAGEMENT
// ============================================

app.get('/api/admin/users', authenticateUser, requireAdminOrSupervisor, async (req: Request, res: Response) => {
 try {
 let query = supabaseAdmin
 .from('users')
 .select('*')
 .order('created_at', { ascending: false });

 // superadmin ve todos los usuarios; lider solo los de su empresa
 if (req.user!.role !== 'superadmin' && req.user!.company_id) {
 query = query.eq('company_id', req.user!.company_id);
 }

 const { data: users, error } = await query;

 if (error) {
 logger.error('Error fetching users:', error);
 return res.status(500).json({ error: 'Error al obtener usuarios' });
 }

 res.json(users);
 } catch (error: any) {
 logger.error('Error fetching users:', error);
 res.status(500).json({ error: 'Error al obtener usuarios' });
 }
});

app.post('/api/admin/users', authenticateUser, requireAdminOrSupervisor, async (req: Request, res: Response) => {
 try {
 const { email, password, full_name, role } = req.body;

 if (!email || !password || !full_name || !role) {
 return res.status(400).json({ error: 'Todos los campos son requeridos' });
 }

 const validRoles = ['superadmin', 'lider', 'auditor'];
 if (!validRoles.includes(role)) {
 return res.status(400).json({ error: 'Rol inválido' });
 }

 // lider no puede crear superadmins
 if (req.user!.role === 'lider' && role === 'superadmin') {
 return res.status(403).json({ error: 'No tienes permisos para crear superadministradores' });
 }

 // company_id del nuevo usuario = company_id del usuario que lo crea
 const companyId = req.user!.company_id;
 if (!companyId) {
 return res.status(400).json({ error: 'No hay empresa asociada al usuario creador' });
 }

 const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
 email,
 password,
 email_confirm: true,
 user_metadata: {
 full_name,
 role
 }
 });

 if (authError) {
 logger.error('Error creating user in auth:', authError);
 return res.status(500).json({ error: 'Error al crear usuario en autenticación' });
 }

 const { data: userData, error: dbError } = await supabaseAdmin
 .from('users')
 .insert({
 id: authData.user.id,
 email,
 full_name,
 role,
 company_id: companyId
 })
 .select()
 .single();

 if (dbError) {
 logger.error('Error creating user in database:', dbError);
 await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
 return res.status(500).json({ error: 'Error al crear usuario en base de datos' });
 }

 logger.success('User created successfully', { userId: userData.id, email });
 res.status(201).json(userData);
 } catch (error: any) {
 logger.error('Error creating user:', error);
 res.status(500).json({ error: 'Error al crear usuario' });
 }
});

app.put('/api/admin/users/:userId', authenticateUser, requireAdminOrSupervisor, async (req: Request, res: Response) => {
 try {
 const { userId } = req.params;
 const { email, full_name, role, password } = req.body;

 if (role) {
 const validRoles = ['superadmin', 'lider', 'auditor'];
 if (!validRoles.includes(role)) {
 return res.status(400).json({ error: 'Rol inválido' });
 }
 }

 const { data: userData, error: dbError } = await supabaseAdmin
 .from('users')
 .update({
 ...(email && { email }),
 ...(full_name && { full_name }),
 ...(role && { role })
 })
 .eq('id', userId)
 .select()
 .single();

 if (dbError) {
 logger.error('Error updating user in database:', dbError);
 return res.status(500).json({ error: 'Error al actualizar usuario en base de datos' });
 }

 if (email || password || full_name || role) {
 await supabaseAdmin.auth.admin.updateUserById(userId, {
 ...(email && { email }),
 ...(password && { password }),
 user_metadata: {
 full_name: full_name || userData.full_name,
 role: role || userData.role
 }
 });
 }

 logger.success('User updated successfully', { userId });
 res.json(userData);
 } catch (error: any) {
 logger.error('Error updating user:', error);
 res.status(500).json({ error: 'Error al actualizar usuario' });
 }
});

app.delete('/api/admin/users/:userId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const { userId } = req.params;

 if (userId === req.user!.id) {
 return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
 }

 const { error: dbError } = await supabaseAdmin
 .from('users')
 .delete()
 .eq('id', userId);

 if (dbError) {
 logger.error('Error deleting user from database:', dbError);
 return res.status(500).json({ error: 'Error al eliminar usuario de la base de datos' });
 }

 const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

 if (authError) {
 logger.warn('Error deleting user from auth (user may not exist):', authError);
 }

 logger.success('User deleted successfully', { userId });
 res.json({ success: true, message: 'Usuario eliminado exitosamente' });
 } catch (error: any) {
 logger.error('Error deleting user:', error);
 res.status(500).json({ error: 'Error al eliminar usuario' });
 }
});

// ============================================
// SYSTEM CONFIGURATION
// ============================================

app.get('/api/admin/config', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 res.json({
 openai_api_key: process.env.OPENAI_API_KEY || '',
 assemblyai_api_key: process.env.ASSEMBLYAI_API_KEY || '',
 supabase_url: process.env.SUPABASE_URL || '',
 supabase_anon_key: process.env.SUPABASE_ANON_KEY || '',
 supabase_service_role_key: process.env.SUPABASE_SERVICE_ROLE_KEY || ''
 });
 } catch (error: any) {
 logger.error('Error fetching config:', error);
 res.status(500).json({ error: 'Error al obtener configuración' });
 }
});

app.put('/api/admin/config', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const { 
 openai_api_key, 
 assemblyai_api_key, 
 supabase_url, 
 supabase_anon_key, 
 supabase_service_role_key 
 } = req.body;

 if (openai_api_key !== undefined) process.env.OPENAI_API_KEY = openai_api_key;
 if (assemblyai_api_key !== undefined) process.env.ASSEMBLYAI_API_KEY = assemblyai_api_key;
 if (supabase_url !== undefined) process.env.SUPABASE_URL = supabase_url;
 if (supabase_anon_key !== undefined) process.env.SUPABASE_ANON_KEY = supabase_anon_key;
 if (supabase_service_role_key !== undefined) process.env.SUPABASE_SERVICE_ROLE_KEY = supabase_service_role_key;

 const envPath = resolve(process.cwd(), '.env');
 let envContent = '';

 try {
 envContent = fs.readFileSync(envPath, 'utf-8');
 } catch (error) {
 envContent = '';
 }

 const updateEnvVar = (content: string, key: string, value: string) => {
 const regex = new RegExp(`^${key}=.*$`, 'm');
 if (regex.test(content)) {
 return content.replace(regex, `${key}=${value}`);
 } else {
 return content + `\n${key}=${value}`;
 }
 };

 if (openai_api_key !== undefined) {
 envContent = updateEnvVar(envContent, 'OPENAI_API_KEY', openai_api_key);
 }
 if (assemblyai_api_key !== undefined) {
 envContent = updateEnvVar(envContent, 'ASSEMBLYAI_API_KEY', assemblyai_api_key);
 }
 if (supabase_url !== undefined) {
 envContent = updateEnvVar(envContent, 'SUPABASE_URL', supabase_url);
 }
 if (supabase_anon_key !== undefined) {
 envContent = updateEnvVar(envContent, 'SUPABASE_ANON_KEY', supabase_anon_key);
 }
 if (supabase_service_role_key !== undefined) {
 envContent = updateEnvVar(envContent, 'SUPABASE_SERVICE_ROLE_KEY', supabase_service_role_key);
 }

 fs.writeFileSync(envPath, envContent.trim());

 logger.success('Configuration updated successfully');
 res.json({ success: true, message: 'Configuración actualizada exitosamente' });
 } catch (error: any) {
 logger.error('Error updating config:', error);
 res.status(500).json({ error: 'Error al actualizar configuración' });
 }
});

app.get('/api/admin/test/:service', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const { service } = req.params;

 switch (service) {
 case 'openai':
 try {
 const response = await fetch('https://api.openai.com/v1/models', {
 headers: {
 'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
 }
 });
 
 if (response.ok) {
 res.json({ success: true, message: 'Conexión exitosa con OpenAI' });
 } 
 } catch (error) {
 const errorMessage = error instanceof Error ? error.message : 'Error de conexión';
 res.json({ success: false, error: errorMessage });
 }
 break;

 case 'assemblyai':
 try {
 const response = await fetch('https://api.assemblyai.com/v2/transcript', {
 headers: {
 'Authorization': process.env.ASSEMBLYAI_API_KEY || ''
 }
 });
 
 if (response.status === 400 || response.status === 404) {
 res.json({ success: true, message: 'Conexión exitosa con AssemblyAI' });
 } else if (response.status === 401) {
 res.json({ success: false, error: 'API key inválida' });
 } else {
 res.json({ success: true, message: 'Conexión exitosa con AssemblyAI' });
 }
 } catch (error: any) {
 res.json({ success: false, error: error.message });
 }
 break;

 case 'supabase':
 try {
 const { data, error } = await supabaseAdmin
 .from('users')
 .select('count')
 .limit(1);

 if (error) {
 res.json({ success: false, error: error.message });
 } else {
 res.json({ success: true, message: 'Conexión exitosa con Supabase' });
 }
 } catch (error: any) {
 res.json({ success: false, error: error.message });
 }
 break;

 default:
 res.status(400).json({ error: 'Servicio no válido' });
 }
 } catch (error: any) {
 logger.error('Error testing service:', error);
 res.status(500).json({ error: 'Error al probar conexión' });
 }
});

// ============================================================
// SCRIPTS DINÁMICOS — CRUD
// ============================================================

app.get('/api/admin/scripts', authenticateUser, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.company_id ?? undefined;
    const scripts = await databaseService.getAllScripts(companyId);
    res.json(scripts);
  } catch (error: any) {
    logger.error('Error fetching scripts:', error);
    res.status(500).json({ error: 'Error al obtener scripts' });
  }
});

app.get('/api/admin/scripts/:callType', authenticateUser, async (req: Request, res: Response) => {
  try {
    const callType = decodeURIComponent(req.params.callType);
    const scripts = await databaseService.getScriptsForCallType(callType);
    res.json(scripts);
  } catch (error: any) {
    logger.error('Error fetching scripts by call type:', error);
    res.status(500).json({ error: 'Error al obtener scripts' });
  }
});

app.post('/api/admin/scripts', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { call_type, mode, step_key, step_label, step_order, lines } = req.body;
    if (!call_type || !step_key || !step_label) {
      return res.status(400).json({ error: 'call_type, step_key y step_label son requeridos' });
    }
    const script = await databaseService.createScript({
      call_type,
      mode: mode ?? 'INBOUND',
      step_key,
      step_label,
      step_order: step_order ?? 0,
      lines: lines ?? [],
      ...(req.user!.company_id ? { company_id: req.user!.company_id } : {})
    });
    res.status(201).json(script);
  } catch (error: any) {
    logger.error('Error creating script:', error);
    res.status(500).json({ error: 'Error al crear script' });
  }
});

app.put('/api/admin/scripts/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { step_label, step_order, lines, is_active, tipo_cierre_overrides } = req.body;
    const script = await databaseService.updateScript(id, { step_label, step_order, lines, is_active, tipo_cierre_overrides });
    res.json(script);
  } catch (error: any) {
    logger.error('Error updating script:', error);
    res.status(500).json({ error: 'Error al actualizar script' });
  }
});

app.delete('/api/admin/scripts/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteScript(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting script:', error);
    res.status(500).json({ error: 'Error al eliminar script' });
  }
});

// ============================================================
// CRITERIOS DINÁMICOS — CRUD
// ============================================================

app.get('/api/admin/criteria', authenticateUser, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.company_id ?? undefined;
    const blocks = await databaseService.getAllCriteriaBlocks(companyId);
    res.json(blocks);
  } catch (error: any) {
    logger.error('Error fetching criteria:', error);
    res.status(500).json({ error: 'Error al obtener criterios' });
  }
});

app.post('/api/admin/blocks', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { call_type, mode, block_name, block_order, applicable_tipo_cierres } = req.body;
    if (!call_type || !block_name) {
      return res.status(400).json({ error: 'call_type y block_name son requeridos' });
    }
    const block = await databaseService.createBlock({
      call_type,
      mode: mode ?? 'INBOUND',
      block_name,
      block_order: block_order ?? 0,
      ...(req.user!.company_id ? { company_id: req.user!.company_id } : {}),
      ...(applicable_tipo_cierres !== undefined && { applicable_tipo_cierres })
    });
    res.status(201).json(block);
  } catch (error: any) {
    logger.error('Error creating block:', error);
    res.status(500).json({ error: 'Error al crear bloque' });
  }
});

app.put('/api/admin/blocks/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { block_name, block_order, is_active, applicable_tipo_cierres } = req.body;
    const block = await databaseService.updateBlock(id, {
      block_name,
      block_order,
      is_active,
      ...(applicable_tipo_cierres !== undefined && { applicable_tipo_cierres })
    });
    res.json(block);
  } catch (error: any) {
    logger.error('Error updating block:', error);
    res.status(500).json({ error: 'Error al actualizar bloque' });
  }
});

app.delete('/api/admin/blocks/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteBlock(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting block:', error);
    res.status(500).json({ error: 'Error al eliminar bloque' });
  }
});

app.post('/api/admin/criteria', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { block_id, topic, criticality, points, applies, what_to_look_for, validation_source, criteria_order, requires_manual_review } = req.body;
    if (!block_id || !topic) {
      return res.status(400).json({ error: 'block_id y topic son requeridos' });
    }
    const criteria = await databaseService.createCriteria({
      block_id,
      topic,
      criticality: criticality ?? '-',
      points: points === 'n/a' || points === null ? null : Number(points),
      applies: applies !== false,
      what_to_look_for,
      validation_source: Array.isArray(validation_source) ? validation_source : [],
      criteria_order: criteria_order ?? 0,
      requires_manual_review: requires_manual_review === true
    });
    res.status(201).json(criteria);
  } catch (error: any) {
    logger.error('Error creating criteria:', error);
    res.status(500).json({ error: 'Error al crear criterio' });
  }
});

app.post('/api/admin/criteria/generate-prompt', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { description, topic, call_type } = req.body;
    if (!description || !description.trim()) {
      return res.status(400).json({ error: 'description es requerida' });
    }
    const prompt = await openAIService.generateCriterionPrompt(
      description.trim(),
      topic ?? '',
      call_type ?? ''
    );
    res.json({ prompt });
  } catch (error: any) {
    logger.error('Error generando prompt de criterio:', error);
    res.status(500).json({ error: 'Error al generar instrucción con IA' });
  }
});

app.put('/api/admin/criteria/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { topic, criticality, points, applies, what_to_look_for, validation_source, criteria_order, is_active, requires_manual_review, tipo_cierre_overrides } = req.body;
    const payload: Record<string, any> = {};
    if (topic !== undefined) payload.topic = topic;
    if (criticality !== undefined) payload.criticality = criticality;
    if (points !== undefined) payload.points = points === 'n/a' || points === null ? null : Number(points);
    if (applies !== undefined) payload.applies = applies;
    if (what_to_look_for !== undefined) payload.what_to_look_for = what_to_look_for;
    if (validation_source !== undefined) payload.validation_source = Array.isArray(validation_source) ? validation_source : [];
    if (criteria_order !== undefined) payload.criteria_order = criteria_order;
    if (is_active !== undefined) payload.is_active = is_active;
    if (requires_manual_review !== undefined) payload.requires_manual_review = requires_manual_review;
    if (tipo_cierre_overrides !== undefined) payload.tipo_cierre_overrides = tipo_cierre_overrides;
    const criteria = await databaseService.updateCriteria(id, payload);
    res.json(criteria);
  } catch (error: any) {
    logger.error('Error updating criteria:', error);
    res.status(500).json({ error: 'Error al actualizar criterio' });
  }
});

app.delete('/api/admin/criteria/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteCriteria(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting criteria:', error);
    res.status(500).json({ error: 'Error al eliminar criterio' });
  }
});

// ============================================================
// PLANTILLA GPF — CRUD
// ============================================================

app.get('/api/admin/plantilla-gpf', authenticateUser, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const items = await databaseService.getAllPlantillaGPF(companyId);
    res.json(items);
  } catch (error: any) {
    logger.error('Error fetching plantilla GPF:', error);
    res.status(500).json({ error: 'Error al obtener plantilla GPF' });
  }
});

app.post('/api/admin/plantilla-gpf', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { categoria, tipo_cierre, descripcion, categoria_orden, tipo_orden, call_type, mode } = req.body;
    if (!categoria || !tipo_cierre) {
      return res.status(400).json({ error: 'categoria y tipo_cierre son requeridos' });
    }
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const callTypesConfig = await databaseService.getCallTypesConfig(companyId);
    const validCallTypes = callTypesConfig.filter((c: any) => c.is_active !== false).map((c: any) => c.name);
    const validModes = [...new Set(callTypesConfig.flatMap((c: any) => c.modes || []))];
    if (!call_type || !validCallTypes.includes(call_type)) {
      return res.status(400).json({ error: `call_type debe ser uno de: ${validCallTypes.join(', ')}` });
    }
    if (!mode || !validModes.includes(mode)) {
      return res.status(400).json({ error: `mode debe ser uno de: ${validModes.join(', ')}` });
    }
    const item = await databaseService.createPlantillaItem({
      categoria,
      tipo_cierre,
      descripcion: descripcion || '',
      categoria_orden: categoria_orden ?? 0,
      tipo_orden: tipo_orden ?? 0,
      call_type,
      mode,
      company_id: req.user!.company_id ?? undefined,
    });
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating plantilla item:', error);
    res.status(500).json({ error: 'Error al crear item de plantilla' });
  }
});

app.put('/api/admin/plantilla-gpf/rename-categoria', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { oldName, newName, call_type, mode } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'oldName y newName son requeridos' });
    }
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const callTypesConfig = await databaseService.getCallTypesConfig(companyId);
    const validCallTypes = callTypesConfig.filter((c: any) => c.is_active !== false).map((c: any) => c.name);
    const validModes = [...new Set(callTypesConfig.flatMap((c: any) => c.modes || []))];
    if (!call_type || !validCallTypes.includes(call_type)) {
      return res.status(400).json({ error: `call_type debe ser uno de: ${validCallTypes.join(', ')}` });
    }
    if (!mode || !validModes.includes(mode)) {
      return res.status(400).json({ error: `mode debe ser uno de: ${validModes.join(', ')}` });
    }
    await databaseService.renamePlantillaCategoria(oldName, newName, call_type, mode);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error renaming categoria:', error);
    res.status(500).json({ error: 'Error al renombrar categoría' });
  }
});

app.put('/api/admin/plantilla-gpf/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { categoria, tipo_cierre, descripcion, categoria_orden, tipo_orden, is_active } = req.body;
    const item = await databaseService.updatePlantillaItem(id, { categoria, tipo_cierre, descripcion, categoria_orden, tipo_orden, is_active });
    res.json(item);
  } catch (error: any) {
    logger.error('Error updating plantilla item:', error);
    res.status(500).json({ error: 'Error al actualizar item de plantilla' });
  }
});

app.delete('/api/admin/plantilla-gpf/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deletePlantillaItem(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting plantilla item:', error);
    res.status(500).json({ error: 'Error al eliminar item de plantilla' });
  }
});

// ============================================
// AI PROMPTS — CRUD (admin only)
// ============================================

app.get('/api/admin/ai-prompts', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.company_id ?? undefined;
    const prompts = await databaseService.getAllPrompts(companyId);
    res.json(prompts);
  } catch (error: any) {
    logger.error('Error fetching ai_prompts:', error);
    res.status(500).json({ error: 'Error al obtener prompts' });
  }
});

app.put('/api/admin/ai-prompts/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { content, prompt_name, description, is_active } = req.body;
    if (content === undefined) {
      return res.status(400).json({ error: 'content es requerido' });
    }
    const updated = await databaseService.updatePrompt(id, { content, prompt_name, description, is_active });
    res.json(updated);
  } catch (error: any) {
    logger.error('Error updating ai_prompt:', error);
    res.status(500).json({ error: 'Error al actualizar prompt' });
  }
});

// ============================================================
// WORD BOOST TERMS — CRUD (admin only)
// ============================================================

app.get('/api/admin/word-boost', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const terms = await databaseService.getWordBoostTerms(companyId);
    res.json(terms);
  } catch (error: any) {
    logger.error('Error fetching word_boost_terms:', error);
    res.status(500).json({ error: 'Error al obtener términos de vocabulario' });
  }
});

app.post('/api/admin/word-boost', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { term, category, is_active, display_order } = req.body;
    if (!term || !category) {
      return res.status(400).json({ error: 'term y category son requeridos' });
    }
    const item = await databaseService.createWordBoostTerm({ term, category, is_active, display_order, company_id: req.user!.company_id ?? undefined });
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating word_boost_term:', error);
    res.status(500).json({ error: 'Error al crear término de vocabulario' });
  }
});

app.put('/api/admin/word-boost/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { term, category, is_active, display_order } = req.body;
    const item = await databaseService.updateWordBoostTerm(id, { term, category, is_active, display_order });
    res.json(item);
  } catch (error: any) {
    logger.error('Error updating word_boost_term:', error);
    res.status(500).json({ error: 'Error al actualizar término de vocabulario' });
  }
});

app.delete('/api/admin/word-boost/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteWordBoostTerm(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting word_boost_term:', error);
    res.status(500).json({ error: 'Error al eliminar término de vocabulario' });
  }
});

// ============================================================
// IMAGE SYSTEMS — CRUD (admin only)
// ============================================================

app.get('/api/admin/image-systems', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const systems = await databaseService.getImageSystems(companyId);
    res.json(systems);
  } catch (error: any) {
    logger.error('Error fetching image_systems:', error);
    res.status(500).json({ error: 'Error al obtener sistemas de imagen' });
  }
});

app.post('/api/admin/image-systems', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { system_name, description, detection_hints, fields_schema, is_active, display_order } = req.body;
    if (!system_name || !description) {
      return res.status(400).json({ error: 'system_name y description son requeridos' });
    }
    const item = await databaseService.createImageSystem({ system_name, description, detection_hints, fields_schema, is_active, display_order, company_id: req.user!.company_id ?? undefined });
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating image_system:', error);
    res.status(500).json({ error: 'Error al crear sistema de imagen' });
  }
});

app.get('/api/admin/image-systems/analytics', authenticateUser, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const data = await databaseService.getImageSystemAnalytics(companyId);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching image system analytics:', error);
    res.status(500).json({ error: 'Error al obtener analytics' });
  }
});

app.get('/api/admin/audits/calificaciones', authenticateUser, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const data = await databaseService.getCalificacionesFromAudits(companyId);
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching calificaciones:', error);
    res.status(500).json({ error: 'Error al obtener calificaciones' });
  }
});

app.get('/api/admin/image-systems/by-calltype', authenticateUser, async (req: Request, res: Response) => {
  try {
    const calificacion = req.query.calificacion as string | undefined;
    const subcalificacion = req.query.subcalificacion as string | undefined;
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const data = await databaseService.getImageSystemsByCallType(
      calificacion || undefined,
      subcalificacion || undefined,
      companyId
    );
    res.json(data);
  } catch (error: any) {
    logger.error('Error fetching image systems by calltype:', error);
    res.status(500).json({ error: 'Error al obtener sistemas' });
  }
});

app.post('/api/admin/criteria/generate-blocks', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { description, call_type, mode } = req.body;
    if (!description?.trim() || !call_type) {
      return res.status(400).json({ error: 'description y call_type son requeridos' });
    }
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const imageSystems = await databaseService.getImageSystems(companyId);
    const systemNames = imageSystems.filter((s: any) => s.is_active !== false).map((s: any) => s.system_name as string);
    const result = await openAIService.generateCriteriaBlocks(description.trim(), call_type, mode ?? 'INBOUND', systemNames);
    res.json(result);
  } catch (error: any) {
    logger.error('Error generando criterios con IA:', error);
    res.status(500).json({ error: 'Error al generar criterios' });
  }
});

app.post('/api/admin/image-systems/analyze-screenshot', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { image_base64, mime_type, system_name, user_description } = req.body;
    if (!image_base64 || !system_name) {
      return res.status(400).json({ error: 'image_base64 y system_name son requeridos' });
    }
    const result = await openAIService.analyzeScreenshotForConfig(
      image_base64,
      mime_type || 'image/png',
      system_name,
      user_description || ''
    );
    res.json(result);
  } catch (error: any) {
    logger.error('Error analizando screenshot:', error);
    res.status(500).json({ error: 'Error al analizar imagen con IA' });
  }
});

app.post('/api/admin/image-systems/generate-hints', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { system_name, description } = req.body;
    if (!system_name || !description?.trim()) {
      return res.status(400).json({ error: 'system_name y description son requeridos' });
    }
    const result = await openAIService.generateImageSystemHints(system_name, description.trim());
    res.json(result);
  } catch (error: any) {
    logger.error('Error generando hints de sistema de imagen:', error);
    res.status(500).json({ error: 'Error al generar con IA' });
  }
});

app.put('/api/admin/image-systems/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { system_name, description, detection_hints, fields_schema, is_active, display_order } = req.body;
    const item = await databaseService.updateImageSystem(id, { system_name, description, detection_hints, fields_schema, is_active, display_order });
    res.json(item);
  } catch (error: any) {
    logger.error('Error updating image_system:', error);
    res.status(500).json({ error: 'Error al actualizar sistema de imagen' });
  }
});

app.delete('/api/admin/image-systems/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteImageSystem(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting image_system:', error);
    res.status(500).json({ error: 'Error al eliminar sistema de imagen' });
  }
});

// ============================================================
// CALL TYPES CONFIG — lectura pública (cualquier usuario autenticado)
// ============================================================

app.get('/api/call-types-config', authenticateUser, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const items = await databaseService.getCallTypesConfig(companyId);
    res.json(items);
  } catch (error: any) {
    logger.error('Error fetching call_types_config (public):', error);
    res.status(500).json({ error: 'Error al obtener tipos de llamada' });
  }
});

// ============================================================
// CALL TYPES CONFIG — CRUD (admin only)
// ============================================================

app.get('/api/admin/call-types-config', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const items = await databaseService.getCallTypesConfig(companyId);
    res.json(items);
  } catch (error: any) {
    logger.error('Error fetching call_types_config:', error);
    res.status(500).json({ error: 'Error al obtener tipos de llamada' });
  }
});

app.post('/api/admin/call-types-config', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { name, modes, is_active, display_order, clone_from } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name es requerido' });
    }
    const item = await databaseService.createCallTypeConfig({ name, modes, is_active, display_order, company_id: req.user!.company_id ?? undefined });
    // Clonar la configuración base (criterios + scripts) desde otro call_type si se solicita
    if (clone_from) {
      try {
        await databaseService.cloneCallTypeData(clone_from, item.name);
      } catch (cloneError: any) {
        logger.warn(`No se pudo clonar configuración de "${clone_from}" a "${item.name}":`, cloneError.message);
      }
    }
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating call_type_config:', error);
    res.status(500).json({ error: 'Error al crear tipo de llamada' });
  }
});

app.put('/api/admin/call-types-config/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, modes, is_active, display_order } = req.body;
    const item = await databaseService.updateCallTypeConfig(id, { name, modes, is_active, display_order });
    res.json(item);
  } catch (error: any) {
    logger.error('Error updating call_type_config:', error);
    res.status(500).json({ error: 'Error al actualizar tipo de llamada' });
  }
});

app.delete('/api/admin/call-types-config/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteCallTypeConfig(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting call_type_config:', error);
    res.status(500).json({ error: 'Error al eliminar tipo de llamada' });
  }
});

// Sincroniza calificaciones y subcalificaciones con lo que entrega GPF:
// registra las nuevas, desactiva las que GPF ya no entrega y alinea la plantilla.
app.post('/api/admin/call-types-config/sync-gpf', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  const env = (req.body?.env as string) || 'prod';
  try {
    const token = await gpfTokenService.getTokenWithRetry(env);

    // Ventana de 29 días (GPF maneja alrededor de un mes): sin fechas la API
    // devuelve solo las atenciones recientes y se desactivarían calificaciones
    // válidas. Si GPF no soporta el rango (timeout/5xx), intentar ventanas más cortas.
    const dateTo = new Date().toISOString().slice(0, 10);
    const windows = [29, 14, 7, null];
    let attentions: any[] | null = null;
    let windowDays: number | null = null;
    let lastError: any = null;

    for (const days of windows) {
      try {
        const dateFrom = days !== null
          ? new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10)
          : undefined;
        attentions = await gpfDataService.getAttentions(env, token, dateFrom, days !== null ? dateTo : undefined);
        windowDays = days;
        break;
      } catch (err: any) {
        lastError = err;
        logger.warn(`sync-gpf: fallo con ventana de ${days ?? 'sin fechas'} días, intentando una más corta`, { error: err.message });
      }
    }

    if (!attentions) {
      throw lastError ?? new Error('GPF no respondió');
    }

    const entries = attentions
      .map((a: any) => ({
        calificacion: (a['Calificación'] || '').trim(),
        subcalificacion: (a['Sub-calificación'] || '').trim()
      }))
      .filter((e: any) => e.calificacion);

    if (entries.length === 0) {
      return res.status(422).json({ error: 'GPF no devolvió atenciones con calificación — no se modificó nada' });
    }

    // Solo desactivar lo que GPF "ya no entrega" cuando se logró la ventana
    // completa; con una ventana corta solo se registra/reactiva (evita falsos negativos).
    const allowDeactivation = windowDays !== null && windowDays >= 29;
    const summary = await databaseService.reconcileCallTypesWithGpf(
      entries,
      req.user!.company_id ?? undefined,
      { allowDeactivation }
    );
    res.json({ ...summary, windowDays, deactivationSkipped: !allowDeactivation });
  } catch (error: any) {
    logger.error('Error sincronizando call types con GPF:', error);
    if (error.message?.includes('401')) gpfTokenService.invalidate(env);
    res.status(502).json({ error: `Error sincronizando con GPF: ${error.message}` });
  }
});

// ============================================
// GPF API PROXY
// ============================================

// Resuelven credenciales GPF desde integration_config de PositivoS+ (fallback .env).
const getGpfBaseUrl = async (env: string): Promise<string> => {
 const creds = await gpfConfigService.getCredentials();
 return env === 'prod' ? creds.apiUrlProd : creds.apiUrlTest;
};

const buildGpfHeaders = async (token?: string): Promise<Record<string, string>> => {
 const creds = await gpfConfigService.getCredentials();
 const headers: Record<string, string> = {
 'Accept': 'application/json',
 'Content-Type': 'application/json',
 'X-App-Token': creds.appToken,
 'ngrok-skip-browser-warning': 'true'
 };
 if (token) {
 headers['Authorization'] = `Bearer ${token}`;
 }
 return headers;
};

app.post('/api/gpf/login', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const env: string = req.body.env || 'test';
 const baseUrl = await getGpfBaseUrl(env);

 if (!baseUrl) {
 return res.status(500).json({ error: 'URL de GPF no configurada' });
 }

 const creds = await gpfConfigService.getCredentials();
 const email: string = req.body.email || creds.email;
 const password: string = req.body.password || creds.password;

 const start = Date.now();
 const response = await fetch(`${baseUrl}/api/login`, {
 method: 'POST',
 headers: await buildGpfHeaders(),
 body: JSON.stringify({ email, password })
 });

 const data = await response.json();
 const elapsed = Date.now() - start;

 logger.info('GPF login proxy', { env, status: response.status, elapsed });

 res.status(response.status).json({
 gpf_status: response.status,
 elapsed_ms: elapsed,
 data
 });
 } catch (error: any) {
 logger.error('GPF login proxy error:', error);
 res.status(502).json({ error: `Error conectando con GPF: ${error.message}` });
 }
});

app.post('/api/gpf/proxy', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const {
 env = 'test',
 endpoint,
 method = 'GET',
 token,
 body: requestBody,
 queryString
 } = req.body;

 if (!endpoint) {
 return res.status(400).json({ error: 'El campo endpoint es requerido' });
 }

 const baseUrl = await getGpfBaseUrl(env);
 if (!baseUrl) {
 return res.status(500).json({ error: 'URL de GPF no configurada' });
 }

 const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
 let url = `${baseUrl}${normalizedEndpoint}`;
 if (queryString) {
 url += `?${queryString}`;
 }

 const fetchOptions: RequestInit = {
 method: method.toUpperCase(),
 headers: await buildGpfHeaders(token)
 };

 if (requestBody && !['GET', 'HEAD'].includes(method.toUpperCase())) {
 fetchOptions.body = typeof requestBody === 'string'
 ? requestBody
 : JSON.stringify(requestBody);
 }

 const start = Date.now();
 const response = await fetch(url, fetchOptions);
 const elapsed = Date.now() - start;

 let data: any;
 const contentType = response.headers.get('content-type') || '';
 if (contentType.includes('application/json')) {
 data = await response.json();
 } else {
 const text = await response.text();
 data = { raw: text };
 }

 logger.info('GPF proxy request', { env, endpoint, method, status: response.status, elapsed });

 res.status(200).json({
 gpf_status: response.status,
 gpf_status_text: response.statusText,
 elapsed_ms: elapsed,
 data
 });
 } catch (error: any) {
 logger.error('GPF proxy request error:', error);
 res.status(502).json({ error: `Error conectando con GPF: ${error.message}` });
 }
});

// GPF Download Report — puede retornar JSON de progreso (0-100) o archivo binario
app.post('/api/gpf/download-report', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const { env = 'test', token, export_id } = req.body;

 if (export_id === undefined || export_id === null) {
 return res.status(400).json({ error: 'export_id es requerido' });
 }

 const baseUrl = await getGpfBaseUrl(env);
 if (!baseUrl) {
 return res.status(500).json({ error: 'URL de GPF no configurada' });
 }

 const start = Date.now();
 const response = await fetch(`${baseUrl}/api/quality-control/v1/download-report`, {
 method: 'POST',
 headers: await buildGpfHeaders(token),
 body: JSON.stringify({ export_id })
 });
 const elapsed = Date.now() - start;

 const contentType = response.headers.get('content-type') || '';

 if (contentType.includes('application/json')) {
 const data = await response.json();
 logger.info('GPF download-report progress', { env, export_id, status: response.status, elapsed });
 return res.status(200).json({ gpf_status: response.status, elapsed_ms: elapsed, data });
 }

 // Archivo listo — devolver como stream
 const contentDisposition = response.headers.get('content-disposition') || `attachment; filename="export_${export_id}.xlsx"`;
 const buffer = await response.arrayBuffer();
 logger.info('GPF download-report file', { env, export_id, bytes: buffer.byteLength, elapsed });
 res.set({
 'Content-Type': contentType || 'application/octet-stream',
 'Content-Disposition': contentDisposition,
 'X-GPF-Status': response.status.toString(),
 'X-GPF-Elapsed': elapsed.toString()
 });
 res.send(Buffer.from(buffer));
 } catch (error: any) {
 logger.error('GPF download-report error:', error);
 res.status(502).json({ error: `Error conectando con GPF: ${error.message}` });
 }
});

// ============================================
// GPF ATTENTIONS (auto-auth)
// ============================================

// Analiza imágenes reales de GPF para descubrir sistemas de pantalla
app.post('/api/gpf/discover-systems', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
 const { env = 'prod', calificacion, subcalificacion, max_images = 6, date_from, date_to } = req.body;
 const tempPaths: string[] = [];
 try {
  const token = await gpfTokenService.getTokenWithRetry(env);

  // 1. Traer atenciones filtradas por fecha y calificación
  const allAttentions = await gpfDataService.getAttentions(env, token, date_from, date_to);
  const filtered = allAttentions.filter((a: any) => {
   if (calificacion && (a['Calificación'] || '').trim() !== calificacion) return false;
   if (subcalificacion && (a['Sub-calificación'] || '').trim() !== subcalificacion) return false;
   return true;
  });

  logger.info(`[DISCOVER-SYS] ${filtered.length} atenciones encontradas para "${calificacion}/${subcalificacion}"`);
  if (!filtered.length) {
   return res.json({ systems: [], total_attentions: 0, images_analyzed: 0, cases_checked: [] });
  }

  // 2. Muestra aleatoria de hasta 5 atenciones — usa fetchAttentionData (mismo código que nueva auditoría)
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const toCheck = shuffled.slice(0, 5);
  const casesChecked: string[] = [];

  for (const att of toCheck) {
   if (tempPaths.length >= max_images) break;
   const id = att['id_atencion'] || att['Caso'] || att.id;
   if (!id) continue;
   casesChecked.push(String(id));
   try {
    // Reutilizamos gpfDataService.fetchAttentionData — idéntico al flujo de nueva auditoría
    const detail = await gpfDataService.fetchAttentionData(env, id, token);
    logger.info(`[DISCOVER-SYS] Atención ${id}: ${detail.imageUrls.length} capturas encontradas`);
    if (!detail.imageUrls.length) continue;

    const urlsToDownload = detail.imageUrls.slice(0, max_images - tempPaths.length);
    const { localPaths } = await downloadImagesToTemp(urlsToDownload, token);
    tempPaths.push(...localPaths);
    logger.info(`[DISCOVER-SYS] Descargadas ${localPaths.length} imágenes de atención ${id}`);
   } catch (e: any) {
    logger.warn(`[DISCOVER-SYS] Error en atención ${id}: ${e.message}`);
   }
  }

  if (!tempPaths.length) {
   return res.json({
    systems: [], total_attentions: filtered.length, images_analyzed: 0,
    cases_checked: casesChecked,
    message: `Se revisaron ${casesChecked.length} casos y ninguno tiene capturas de pantalla registradas. Prueba un rango de fechas diferente o agrega los sistemas manualmente.`
   });
  }

  // 3. Analizar imágenes con IA
  logger.info(`[DISCOVER-SYS] Analizando ${tempPaths.length} imágenes con OpenAI...`);
  const analyses = await openAIService.analyzeMultipleImages(tempPaths);

  // 4. Agregar sistemas detectados
  const tally: Record<string, number> = {};
  for (const a of analyses) {
   const sys = (a.system || '').trim().toUpperCase();
   if (sys && sys !== 'DESCONOCIDO' && sys !== 'MULTIPLE' && sys !== 'UNKNOWN' && sys !== 'NONE') {
    tally[sys] = (tally[sys] || 0) + 1;
   }
  }

  const systems = Object.entries(tally)
   .map(([name, count]) => ({ name, count }))
   .sort((a, b) => b.count - a.count);

  logger.info(`[DISCOVER-SYS] Sistemas detectados: ${systems.map(s => s.name).join(', ')}`);
  return res.json({ systems, total_attentions: filtered.length, images_analyzed: analyses.length, cases_checked: casesChecked });

 } catch (error: any) {
  logger.error('Error en discover-systems:', error);
  if (error.message?.includes('401')) gpfTokenService.invalidate(env);
  return res.status(502).json({ error: `Error conectando con GPF: ${error.message}` });
 } finally {
  // Limpiar archivos temporales
  for (const p of tempPaths) { try { fs.unlinkSync(p); } catch {} }
 }
});

app.get('/api/gpf/categories', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
 try {
 const env = (req.query.env as string) || 'test';
 const token = await gpfTokenService.getTokenWithRetry(env);
 const attentions = await gpfDataService.getAttentions(env, token);

 // Agrupa por Calificación + Sub-calificación
 const groups: Record<string, { calificacion: string; subcalificacion: string; count: number }> = {};
 for (const a of attentions) {
  const cal = (a['Calificación'] || '').trim();
  const sub = (a['Sub-calificación'] || '').trim();
  if (!cal) continue;
  const key = `${cal}|||${sub}`;
  if (!groups[key]) groups[key] = { calificacion: cal, subcalificacion: sub, count: 0 };
  groups[key].count++;
 }

 const result = Object.values(groups)
  .sort((a, b) => b.count - a.count)
  .slice(0, 50);

 res.json({ categories: result, total_attentions: attentions.length });
 } catch (error: any) {
 logger.error('Error fetching GPF categories:', error);
 if (error.message?.includes('401')) gpfTokenService.invalidate((req.query.env as string) || 'test');
 res.status(502).json({ error: `Error obteniendo categorías GPF: ${error.message}` });
 }
});

app.get('/api/gpf/attentions', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
 try {
 const env      = (req.query.env as string) || 'test';
 const dateFrom = req.query.date_from as string | undefined;
 const dateTo   = req.query.date_to   as string | undefined;
 const token = await gpfTokenService.getTokenWithRetry(env);
 const attentions = await gpfDataService.getAttentions(env, token, dateFrom, dateTo);

 // Auto-registrar calificaciones/subcalificaciones nuevas de GPF (en segundo plano,
 // no bloquea la respuesta): crea call types con config base clonada y plantilla.
 void databaseService.syncCallTypesFromGpf(
  attentions.map((a: any) => ({
   calificacion: (a['Calificación'] || '').trim(),
   subcalificacion: (a['Sub-calificación'] || '').trim()
  })),
  req.user!.company_id ?? undefined
 ).catch((syncError: any) => logger.warn('syncCallTypesFromGpf falló:', syncError.message));

 res.json({ attentions, count: attentions.length });
 } catch (error: any) {
 logger.error('Error fetching GPF attentions:', error);

 // If 401, invalidate token and let client retry
 if (error.message?.includes('401')) {
 gpfTokenService.invalidate((req.query.env as string) || 'test');
 }

 res.status(502).json({ error: `Error obteniendo atenciones GPF: ${error.message}` });
 }
});

// ============================================

// GET /api/gpf/attention-detail?env=test&id=123
// Fetches captures, transactions, comments and OTP validations for one attention
app.get('/api/gpf/attention-detail', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
 try {
 const env = (req.query.env as string) || 'test';
 const id = req.query.id as string;
 if (!id) return res.status(400).json({ error: 'El parámetro id es requerido' });

 const token = await gpfTokenService.getTokenWithRetry(env);
 const data = await gpfDataService.fetchAttentionData(env, id, token);

 // Rewrite image URLs to go through our proxy (avoids SSL/localhost issues in browser)
 const backendUrl = process.env.BACKEND_URL ||
 `${req.protocol}://${req.get('host')}`;
 data.imageUrls = data.imageUrls.map((imgUrl: string) =>
 `${backendUrl}/api/gpf/image-proxy?url=${encodeURIComponent(imgUrl)}&env=${env}`
 );

 res.json(data);
 } catch (error: any) {
 logger.error('Error fetching GPF attention detail:', error);
 if (error.message?.includes('401')) {
 gpfTokenService.invalidate((req.query.env as string) || 'test');
 }
 res.status(502).json({ error: `Error obteniendo detalle de atención GPF: ${error.message}` });
 }
});

// ============================================
// GPF IMAGE PROXY (sin auth — solo permite URLs de GPF)
// ============================================

app.get('/api/gpf/image-proxy', async (req: Request, res: Response) => {
 const { url, env = 'test' } = req.query as { url: string; env?: string };
 if (!url) return res.status(400).end();

 // Protección SSRF: solo permitir URLs de los servidores GPF configurados
 const creds = await gpfConfigService.getCredentials();
 const allowed = [
 creds.apiUrlProd,
 creds.apiUrlTest,
 '200.94.158.81',
 'ngrok-free.app',
 'ngrok.io'
 ].filter(Boolean);

 const isAllowed = allowed.some(host => url.includes(host.replace(/https?:\/\//, '')));
 if (!isAllowed) {
 logger.warn('[image-proxy] URL bloqueada por SSRF — agregar host a lista blanca', {
 url: url.substring(0, 150),
 allowedHosts: allowed.map(h => h.replace(/https?:\/\//, ''))
 });
 return res.status(403).end();
 }

 // Obtener Bearer token GPF (requerido por nuevas URLs /api/file/)
 let gpfToken = '';
 try {
 gpfToken = await gpfTokenService.getTokenWithRetry(env as string);
 } catch {
 logger.warn('[image-proxy] No se pudo obtener token GPF, intentando sin Bearer');
 }

 const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
 const gpfOrigin = url.replace(/(https?:\/\/[^/]+).*/, '$1');
 const httpUrl = url.replace(/^https:\/\//, 'http://');

 const imgAttempts: Array<{ label: string; url: string; headers: Record<string, string> }> = [
 { label: 'Bearer+AppToken', url, headers: { 'Authorization': `Bearer ${gpfToken}`, 'X-App-Token': creds.appToken, 'ngrok-skip-browser-warning': 'true' } },
 { label: 'AppToken-solo', url, headers: { 'X-App-Token': creds.appToken, 'ngrok-skip-browser-warning': 'true' } },
 { label: 'browser-UA', url, headers: { 'User-Agent': browserUA, 'Referer': gpfOrigin + '/', 'Accept': 'image/*,*/*' } },
 { label: 'http', url: httpUrl, headers: {} },
 { label: 'http-browser-UA', url: httpUrl, headers: { 'User-Agent': browserUA, 'Referer': gpfOrigin + '/', 'Accept': 'image/*,*/*' } },
 ];

 try {
 let imgBuffer: Buffer | null = null;
 let contentType = 'image/jpeg';

 for (const attempt of imgAttempts) {
 const imgResponse = await gpfFetch(attempt.url, { headers: attempt.headers });
 if (imgResponse.ok) {
 contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
 imgBuffer = Buffer.from(await imgResponse.arrayBuffer());
 break;
 }
 let body = '';
 try { body = await imgResponse.text(); } catch { body = '(no body)'; }
 logger.warn(`[image-proxy] ${attempt.label} falló`, { status: imgResponse.status, body: body.substring(0, 150) });
 }

 if (!imgBuffer) {
 return res.status(502).end();
 }

 res.setHeader('Content-Type', contentType);
 res.setHeader('Cache-Control', 'public, max-age=300');
 res.send(imgBuffer);
 } catch (error: any) {
 logger.warn('[image-proxy] Error en proxy de imagen GPF', { error: error.message });
 res.status(500).end();
 }
});

// ============================================
// GPF AUDIO URL + PROXY
// ============================================

app.post('/api/gpf/audio-url', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
 const { attentionId, env = 'test' } = req.body;
 if (!attentionId) return res.status(400).json({ error: 'attentionId requerido' });
 try {
 const token = await gpfTokenService.getTokenWithRetry(env);
 const audioUrl = await gpfDataService.fetchAudioUrl(env, attentionId, token);
 res.json({ audioUrl });
 } catch (error: any) {
 logger.warn('Error obteniendo URL de audio GPF', { error: error.message });
 res.json({ audioUrl: null });
 }
});

// ── Helpers para descarga de audio GPF ──────────────────────────────────────

async function logFailedAudioAttempt(
 label: string,
 response: { status: number; text: () => Promise<string> }
): Promise<void> {
 let body = '';
 try { body = await response.text(); } catch { body = '(no body)'; }
 logger.warn(`[audio-proxy] ${label} falló`, {
 status: response.status,
 body: body.substring(0, 300)
 });
}

interface AudioDownloadResult {
 buffer: Buffer;
 contentType: string;
}

async function tryDownloadAudio(
 audioSecureUrl: string,
 token: string,
 sessionCookie: string,
 appToken: string
): Promise<AudioDownloadResult | null> {
 // También probar con HTTP en caso de que Apache restrinja solo HTTPS por IP
 const httpUrl = audioSecureUrl.replace(/^https:\/\//, 'http://');
 const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
 const gpfOrigin = audioSecureUrl.replace(/(https?:\/\/[^/]+).*/, '$1');

 const attempts: Array<{ label: string; url: string; headers: Record<string, string> }> = [
 {
 label: 'Bearer+Cookie+AppToken',
 url: audioSecureUrl,
 headers: {
 'X-App-Token': appToken,
 'Authorization': `Bearer ${token}`,
 'Accept': '*/*',
 'ngrok-skip-browser-warning': 'true',
 ...(sessionCookie ? { 'Cookie': sessionCookie } : {})
 }
 },
 {
 // Sin cookie: por si la sesión expiró y el servidor rechaza la petición
 label: 'Bearer+AppToken-sin-cookie',
 url: audioSecureUrl,
 headers: {
 'X-App-Token': appToken,
 'Authorization': `Bearer ${token}`,
 'Accept': '*/*',
 'ngrok-skip-browser-warning': 'true',
 }
 },
 {
 // Apache a veces restringe por User-Agent/Referer — simular browser
 label: 'browser-UA+Referer',
 url: audioSecureUrl,
 headers: {
 'User-Agent': browserUA,
 'Referer': gpfOrigin + '/',
 'Accept': 'audio/*,*/*',
 ...(sessionCookie ? { 'Cookie': sessionCookie } : {})
 }
 },
 {
 // Probar HTTP en caso de que la restricción sea solo en HTTPS
 label: 'http-sin-headers',
 url: httpUrl,
 headers: {}
 },
 {
 label: 'http-browser-UA',
 url: httpUrl,
 headers: {
 'User-Agent': browserUA,
 'Referer': gpfOrigin + '/',
 'Accept': 'audio/*,*/*'
 }
 },
 {
 label: 'AppToken-solo',
 url: audioSecureUrl,
 headers: { 'X-App-Token': appToken, 'Accept': '*/*' }
 },
 {
 label: 'sin-headers',
 url: audioSecureUrl,
 headers: {}
 }
 ];

 for (const attempt of attempts) {
 let response = await gpfFetch(attempt.url, { headers: attempt.headers });

 // Seguir redirects 3xx manualmente
 if (response.status >= 300 && response.status < 400) {
 const redirectUrl = response.headers.get('location');
 if (redirectUrl) {
 logger.info(`[audio-proxy] Siguiendo redirect (${attempt.label})`, { redirectUrl: redirectUrl.substring(0, 80) });
 response = await gpfFetch(redirectUrl, {});
 }
 }

 if (response.ok) {
 const contentType = response.headers.get('content-type') || 'audio/mpeg';
 const buffer = Buffer.from(await response.arrayBuffer());
 logger.success(`[audio-proxy] Descarga exitosa con ${attempt.label}`, { bytes: buffer.length, contentType });
 return { buffer, contentType };
 }

 await logFailedAudioAttempt(attempt.label, response);
 }

 return null;
}

// Descarga el audio y lo devuelve como stream — evita el error SSL en el browser
app.post('/api/gpf/audio-proxy', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
 const { attentionId, env = 'test' } = req.body;
 if (!attentionId) return res.status(400).json({ error: 'attentionId requerido' });
 try {
 const appToken = (await gpfConfigService.getCredentials()).appToken;

 // Ciclo 1: token/cookie cacheados
 let token = await gpfTokenService.getTokenWithRetry(env);
 let audioSecureUrl = await gpfDataService.fetchAudioUrl(env, attentionId, token);
 if (!audioSecureUrl) {
 return res.status(404).json({ error: 'Sin audio disponible para esta atención' });
 }
 logger.info('[audio-proxy] Descargando audio GPF', { url: audioSecureUrl.substring(0, 80), attentionId, env });

 let sessionCookie = gpfTokenService.getSessionCookie(env);
 let result = await tryDownloadAudio(audioSecureUrl, token, sessionCookie, appToken);

 // Ciclo 2: forceRefresh si todos los intentos fallaron (cookie probablemente expirada)
 if (!result) {
 logger.warn('[audio-proxy] Todos los intentos fallaron — forzando refresh de token y cookie', { env });
 token = await gpfTokenService.forceRefreshAndGetToken(env);
 sessionCookie = gpfTokenService.getSessionCookie(env);

 // Pedir nueva secure_download_url (la anterior puede ser inválida con la sesión vieja)
 audioSecureUrl = await gpfDataService.fetchAudioUrl(env, attentionId, token);
 if (!audioSecureUrl) {
 return res.status(404).json({ error: 'Sin audio disponible tras refresco de sesión' });
 }
 logger.info('[audio-proxy] Reintentando descarga con credenciales frescas', { url: audioSecureUrl.substring(0, 80) });
 result = await tryDownloadAudio(audioSecureUrl, token, sessionCookie, appToken);
 }

 if (!result) {
 logger.error('[audio-proxy] No se pudo descargar audio GPF tras todos los intentos y refresco', { attentionId, env });
 return res.status(502).json({
 error: 'GPF devolvió error al descargar audio tras múltiples intentos',
 hint: 'Revisar logs del servidor para el body de la respuesta 403'
 });
 }

 res.setHeader('Content-Type', result.contentType);
 res.setHeader('Content-Length', result.buffer.length);
 res.setHeader('Cache-Control', 'no-store');
 res.send(result.buffer);
 } catch (error: any) {
 logger.warn('[audio-proxy] Error en proxy de audio GPF', { error: error.message });
 res.status(500).json({ error: 'Error al obtener audio' });
 }
});

// ============================================
// EVALUATE FROM GPF (no file upload needed)
// ============================================

app.post('/api/evaluate-from-gpf', authenticateUser, requireAdminOrAnalyst, checkUsageLimits, async (req: Request, res: Response) => {
 const startTime = Date.now();
 let auditId: string | null = null;
 const tempFilePaths: string[] = [];

 // attentionObject: the full attention row from the attentions list (passed by frontend)
 const { attentionId, env = 'test', excelType, sseClientId: clientSseId, attentionObject } = req.body;
 const sseClientId = clientSseId || uuidv4();

 try {
 if (!attentionId) {
 return res.status(400).json({ error: 'attentionId es requerido' });
 }

 logger.info('[INICIO] Iniciando auditoria desde GPF', { attentionId, env, userId: req.user!.id });

 // ── 1. Fetch attention data ──────────────────────────────────────────────
 progressBroadcaster.progress(sseClientId, 'upload', 10, 'Obteniendo datos de atención...');

 const token = await gpfTokenService.getTokenWithRetry(env);
 logger.info('[PASO 1] Token GPF obtenido, consultando datos de atencion...');
 const attentionData = await gpfDataService.fetchAttentionData(env, attentionId, token);

 logger.info('[PASO 1] Datos de atencion recibidos', {
 imageUrls: attentionData.imageUrls.length,
 comentarios: attentionData.comments.length,
 transacciones: attentionData.transactions.length,
 otpValidaciones: attentionData.otpValidations.length,
 comentariosRaw: attentionData.rawComments.length
 });

 const rawExcelType = excelType || '';
 const resolvedExcelType: 'INBOUND' | 'MONITOREO' =
 rawExcelType === 'MONITOREO' ? 'MONITOREO' : 'INBOUND';

 // Toda la data de GPF pertenece a PositivoS+ (multi-tenant)
 const gpfCompanyId = await databaseService.getPositivosCompanyId();

 // Use the full attention object from the list for rich metadata
 const metadata = {
 ...gpfDataService.normalizeMetadata(attentionObject || {}, attentionId),
 excelType: resolvedExcelType,
 companyId: gpfCompanyId,
 gpfData: {
  attentionFields: attentionObject || {},
  transactions: attentionData.transactions,
  comments: attentionData.comments,
  otpValidations: attentionData.otpValidations,
  rawComments: attentionData.rawComments
 }
 };

 // Resolver el callType correcto: primero por texto directo, luego por plantilla_gpf
 const calificacion = (attentionObject || {})['Calificación'] || '';
 const subCalificacion = (attentionObject || {})['Sub-calificación'] || '';
 if (calificacion) {
   // Intento 1: resolver directamente desde el texto (ej. "TH Confirma Movimientos" → "TH CONFIRMA")
   const directCallType = await databaseService.resolveCallTypeFromText(calificacion);
   if (directCallType) {
     metadata.callType = directCallType;
     logger.info('[PASO 1] callType resuelto por texto directo', { calificacion, directCallType });
   } else {
     // Intento 2: buscar en plantilla_gpf solo para calificaciones no reconocidas por texto
     const resolvedCallType =
       await databaseService.getCallTypeFromPlantilla(calificacion, subCalificacion || undefined, resolvedExcelType, gpfCompanyId ?? undefined)
       ?? await databaseService.getCallTypeFromPlantilla(calificacion, undefined, resolvedExcelType, gpfCompanyId ?? undefined);
     if (resolvedCallType) {
       metadata.callType = resolvedCallType;
       logger.info('[PASO 1] callType resuelto desde plantilla_gpf', { calificacion, subCalificacion, resolvedCallType });
     } else {
       logger.warn('[PASO 1] No se encontró callType, se usa valor original', { calificacion, fallback: metadata.callType });
     }
   }
 }

 logger.info('[PASO 1] Metadata de auditoria', {
 callType: metadata.callType,
 executiveName: metadata.executiveName,
 excelType: resolvedExcelType
 });

 // ── 2. Download images ───────────────────────────────────────────────────
 progressBroadcaster.progress(sseClientId, 'upload', 20, 'Descargando capturas...');

 logger.info('[PASO 2] Descargando imagenes', {
 totalUrls: attentionData.imageUrls.length,
 urls: attentionData.imageUrls.map((u: string) => u.substring(0, 80))
 });

 const { localPaths } = await downloadImagesToTemp(attentionData.imageUrls, token);
 tempFilePaths.push(...localPaths);
 metadata.imagePaths = localPaths;

 logger.info('[PASO 2] Resultado descarga imagenes', {
 urlsRecibidas: attentionData.imageUrls.length,
 imagenesDescargadas: localPaths.length,
 archivosLocales: localPaths
 });

 // ── 3. Create audit record ───────────────────────────────────────────────
 progressBroadcaster.progress(sseClientId, 'upload', 25, 'Creando registro de auditoría...');

 auditId = await databaseService.createAudit({
 userId: req.user!.id,
 companyId: gpfCompanyId,
 auditInput: metadata,
 audioFilename: 'gpf-sourced',
 imageFilenames: localPaths.map(p => path.basename(p))
 });

 logger.success('[PASO 3] Registro de auditoria creado', { auditId });

 // ── 4. Analyze images ────────────────────────────────────────────────────
 progressBroadcaster.progress(sseClientId, 'analysis', 50, `[IMAGENES] Analizando ${localPaths.length} capturas con IA...`);

 logger.info('[PASO 4] Iniciando analisis de imagenes con OpenAI Vision', {
 imagenesAAnalizar: localPaths.length
 });

 let imageAnalyses: any[] = [];
 try {
 if (localPaths.length > 0) {
 imageAnalyses = await openAIService.analyzeMultipleImages(localPaths);
 }
 logger.info('[PASO 4] Resultado analisis de imagenes', {
 imagenesAnalizadas: imageAnalyses.length,
 sistemasDetectados: imageAnalyses.map((i: any) => i.system)
 });
 progressBroadcaster.progress(sseClientId, 'analysis', 55,
 `[IMAGENES] ${imageAnalyses.length}/${localPaths.length} capturas analizadas`);
 } catch (imgError: any) {
 logger.error('[PASO 4] Error analizando imagenes con OpenAI', {
 message: imgError.message,
 code: imgError.code,
 status: imgError.status,
 type: imgError.type
 });
 progressBroadcaster.progress(sseClientId, 'analysis', 52,
 `[IMAGENES] ERROR: ${imgError.message || 'Fallo OpenAI Vision'} | code: ${imgError.code || imgError.status || 'N/A'}`);
 }

 const imageAnalysisSummary = imageAnalyses.length > 0
 ? imageAnalyses.map(img => `${img.system}: ${JSON.stringify(img.data)}`).join('\n\n')
 : 'No se encontraron capturas para analizar';

 // ── Diagnóstico de calidad de datos ─────────────────────────────────────
 const dataWarnings: string[] = [];

 // Imágenes idénticas (mismo tamaño de archivo)
 if (localPaths.length > 1) {
   const sizes = localPaths.map(p => { try { return fs.statSync(p).size; } catch { return 0; } });
   const uniqueSizes = new Set(sizes.filter(s => s > 0));
   if (uniqueSizes.size === 1) {
     dataWarnings.push(
       `Las ${localPaths.length} capturas son idénticas (${[...uniqueSizes][0].toLocaleString()} bytes c/u). ` +
       `El agente posiblemente capturó solo la pantalla de inicio de sesión. La evidencia visual no pudo validarse.`
     );
   }
 } else if (localPaths.length === 0) {
   dataWarnings.push('No se encontraron capturas adjuntas a esta atención. Los criterios de evidencia visual no pueden evaluarse.');
 }

 // Todas las capturas clasificadas como sistema desconocido
 if (imageAnalyses.length > 0 && imageAnalyses.every((i: any) => i.system === 'OTRO')) {
   if (!dataWarnings.some(w => w.includes('capturas son idénticas'))) {
     dataWarnings.push(
       'Ninguna captura muestra pantallas operativas reconocibles (Falcon, VCAS, Vision, VRM, BI). ' +
       'La evidencia visual no pudo asignarse a ningún sistema.'
     );
   }
 }

 // Datos GPF faltantes
 const ao = attentionObject || {};
 const missingGpf: string[] = [];
 if (!ao['Comercio']) missingGpf.push('Comercio');
 if (!ao['Fecha de la compra']) missingGpf.push('Fecha de la compra');
 if (!ao['Monto de la compra']) missingGpf.push('Monto de la compra');
 if (missingGpf.length > 0) {
   dataWarnings.push(`Datos no registrados en GPF: ${missingGpf.join(', ')}.`);
 }

 // ── 5. Obtener audio y transcribir (o generar transcript sintético) ──────
 progressBroadcaster.progress(sseClientId, 'audio', 57, '[AUDIO] Buscando grabacion de la llamada...');

 logger.info('[PASO 5] Datos GPF disponibles para transcript sintetico', {
 comentarios: attentionData.comments.length,
 transacciones: attentionData.transactions.length,
 otpValidaciones: attentionData.otpValidations.length,
 comentariosRaw: attentionData.rawComments.length
 });

 const syntheticTranscript = buildSyntheticTranscript(
 attentionData.comments,
 attentionData.transactions,
 attentionData.otpValidations,
 attentionData.rawComments
 );

 logger.info('[PASO 5] Transcript sintetico construido', {
 longitudTexto: syntheticTranscript.text.length,
 utterances: syntheticTranscript.words?.length ?? 0
 });

 let finalTranscript = syntheticTranscript;
 let audioDurationSeconds = 0;
 let audioOnlyTranscriptText: string | null = null; // solo la transcripción de AssemblyAI, sin datos GPF
 let gpfUtterances: any[] = []; // utterances reales del audio (para sentimientos)
 let gpfNativeSentiment: any[] = []; // sentimientos nativos de AssemblyAI (solo EN)
 let gpfLanguageCode: string | undefined;
 let gpfTranscriptionConfidence: number | null = null;

 try {
 logger.info('[PASO 5] Solicitando URL de audio a GPF...', { attentionId, env });
 const audioSecureUrl = await gpfDataService.fetchAudioUrl(env, attentionId, token);
 logger.info('[PASO 5] Resultado URL de audio', {
 urlObtenida: audioSecureUrl ? audioSecureUrl.substring(0, 100) : 'NULL - sin audio disponible'
 });

 if (audioSecureUrl) {
 progressBroadcaster.progress(sseClientId, 'audio', 62, '[AUDIO] Descargando grabacion...');
 const appToken = (await gpfConfigService.getCredentials()).appToken;
 const sessionCookie = gpfTokenService.getSessionCookie(env);
 logger.info('[PASO 5] Descargando audio (intento 1 con Bearer + cookie)...', { url: audioSecureUrl.substring(0, 80) });
 let audioResponse = await gpfFetch(audioSecureUrl, {
 headers: {
 'X-App-Token': appToken,
 'Authorization': `Bearer ${token}`,
 'Accept': '*/*',
 'ngrok-skip-browser-warning': 'true',
 ...(sessionCookie ? { 'Cookie': sessionCookie } : {})
 }
 });
 logger.info('[PASO 5] Respuesta descarga audio intento 1', { status: audioResponse.status, ok: audioResponse.ok });

 // Seguir redirecciones 3xx (URLs presignadas de S3/Azure)
 if (audioResponse.status >= 300 && audioResponse.status < 400) {
 const redirectUrl = audioResponse.headers.get('location');
 logger.info('[PASO 5] Redirect detectado, siguiendo...', { redirectUrl: redirectUrl?.substring(0, 80) });
 if (redirectUrl) {
 audioResponse = await gpfFetch(redirectUrl, {});
 logger.info('[PASO 5] Respuesta despues de redirect', { status: audioResponse.status, ok: audioResponse.ok });
 }
 }

 // Intento 2: solo cookie (sin Bearer)
 if (!audioResponse.ok && sessionCookie) {
 logger.warn('[PASO 5] Audio con Bearer falló, reintentando solo con cookie', { status: audioResponse.status });
 audioResponse = await gpfFetch(audioSecureUrl, {
 headers: { 'Cookie': sessionCookie, 'Accept': '*/*' }
 });
 logger.info('[PASO 5] Respuesta intento solo cookie', { status: audioResponse.status, ok: audioResponse.ok });
 }

 // Intento 3: sin headers (URL pre-firmada pública)
 if (!audioResponse.ok) {
 logger.warn('[PASO 5] Audio con cookie falló, reintentando sin headers', { status: audioResponse.status });
 audioResponse = await gpfFetch(audioSecureUrl, {});
 logger.info('[PASO 5] Respuesta intento sin headers', { status: audioResponse.status, ok: audioResponse.ok });
 }

 if (audioResponse.ok) {
 const audioBuffer = Buffer.from(await audioResponse.arrayBuffer());
 const audioExt = audioSecureUrl.toLowerCase().includes('.mp3') ? 'mp3' : 'wav';
 const localAudioPath = path.join('./tmp/uploads/audio', `gpf_audio_${attentionId}_${Date.now()}.${audioExt}`);
 fs.mkdirSync(path.dirname(localAudioPath), { recursive: true });
 fs.writeFileSync(localAudioPath, audioBuffer);
 tempFilePaths.push(localAudioPath);
 logger.info('[PASO 5] Audio guardado en disco', {
 ruta: localAudioPath,
 tamanoBytes: audioBuffer.length,
 tamanoMB: (audioBuffer.length / 1024 / 1024).toFixed(2) + ' MB'
 });
 logger.info('[PASO 5] Enviando audio a AssemblyAI para transcripcion...');
 progressBroadcaster.progress(sseClientId, 'audio', 66, '[AUDIO] Transcribiendo con AssemblyAI...');
 const transcriptionResultRaw = await assemblyAIService.transcribe(localAudioPath);
 logger.info('[PASO 5] Resultado transcripcion AssemblyAI', {
 tieneTexto: !!transcriptionResultRaw?.text,
 longitudTexto: transcriptionResultRaw?.text?.length ?? 0,
 duracionAudio: transcriptionResultRaw?.audio_duration ?? 0
 });
 // Post-corrección de errores ASR en nombres de marca y términos bancarios
 const correctedGpfText = transcriptionResultRaw?.text
 ? await openAIService.correctTranscription(transcriptionResultRaw.text)
 : transcriptionResultRaw?.text;
 const transcriptionResult = transcriptionResultRaw
 ? { ...transcriptionResultRaw, text: correctedGpfText ?? transcriptionResultRaw.text }
 : transcriptionResultRaw;
 if (transcriptionResult?.text) {
 audioOnlyTranscriptText = transcriptionResult.text; // guardar solo el audio para mostrar en UI
 gpfUtterances = transcriptionResult.utterances || [];
 gpfNativeSentiment = transcriptionResult.sentiment_analysis_results || [];
 gpfLanguageCode = transcriptionResult.language_code;
 gpfTranscriptionConfidence = transcriptionResult.confidence ?? null;
 // Combinar transcript real de audio + datos estructurados GPF
 // para que el evaluador tenga TODO el contexto disponible
 const combinedText = `${transcriptionResult.text}\n\n--- DATOS ESTRUCTURADOS GPF ---\n${syntheticTranscript.text}`;
 finalTranscript = {
 ...transcriptionResult,
 text: combinedText
 } as typeof syntheticTranscript;
 audioDurationSeconds = transcriptionResult.audio_duration ?? 0;
 logger.success('[PASO 5] Audio transcrito exitosamente', {
 attentionId,
 duracion: audioDurationSeconds + 's',
 longitudTotal: combinedText.length
 });
 progressBroadcaster.progress(sseClientId, 'audio', 72,
 `[AUDIO] Transcripcion completada (${audioDurationSeconds}s de grabacion)`);
 }
 } else {
 logger.warn('[PASO 5] No se pudo descargar el audio, usando transcript sintetico', {
 statusFinal: audioResponse.status
 });
 progressBroadcaster.progress(sseClientId, 'audio', 72, '[AUDIO] Sin grabacion, usando datos de texto GPF');
 }
 } else {
 logger.info('[PASO 5] Sin audio disponible, usando transcript sintetico', { attentionId });
 progressBroadcaster.progress(sseClientId, 'audio', 72, '[AUDIO] Sin grabacion disponible, usando datos de texto GPF');
 }
 } catch (audioError: any) {
 logger.warn('[PASO 5] Error al obtener/transcribir audio, usando transcript sintetico', {
 error: audioError.message,
 code: audioError.code,
 status: audioError.status,
 stack: audioError.stack
 });
 progressBroadcaster.progress(sseClientId, 'audio', 72,
 `[AUDIO] ERROR: ${audioError.message || 'fallo al obtener audio'}`);
 }

 // ── 5b. Análisis de sentimientos (automático en cada llamada con audio) ──
 // AssemblyAI solo soporta sentimientos nativos en inglés; para ES/PT se
 // calculan con OpenAI sobre las utterances reales del audio.
 let sentimentResults: any[] = gpfNativeSentiment;
 let sentimentProvider: 'assemblyai' | 'openai' = 'assemblyai';
 let sentimentUsage = { inputTokens: 0, outputTokens: 0 };

 if (sentimentResults.length === 0 && gpfUtterances.length > 0) {
 progressBroadcaster.progress(sseClientId, 'audio', 73, '[AUDIO] Analizando sentimientos de la llamada...');
 try {
 const gptSentiment = await openAIService.analyzeSentiment(gpfUtterances);
 sentimentResults = gptSentiment.results;
 sentimentUsage = gptSentiment.usage;
 sentimentProvider = 'openai';
 } catch (sentErr: any) {
 logger.warn('[PASO 5b] Análisis de sentimientos falló, continuando sin sentimientos', { error: sentErr.message });
 }
 }

 const sentimentSummary = buildSentimentSummary(sentimentResults, sentimentProvider);
 if (sentimentSummary) {
 logger.success('[PASO 5b] Sentimientos analizados', {
 provider: sentimentProvider,
 overall: sentimentSummary.overall,
 frases: sentimentResults.length
 });
 }

 // ── 6. Evaluate ──────────────────────────────────────────────────────────
 progressBroadcaster.progress(sseClientId, 'evaluation', 75, '[EVALUACION] Evaluando con IA todos los datos...');

 logger.info('[PASO 6] Iniciando evaluacion con IA', {
 fuenteTranscript: audioDurationSeconds > 0 ? 'AUDIO REAL (AssemblyAI)' : 'SINTETICO (datos GPF)',
 longitudTranscript: finalTranscript.text.length,
 imagenesAnalizadas: imageAnalyses.length,
 callType: metadata.callType
 });

 const evaluation = await evaluatorService.evaluate(
 metadata,
 finalTranscript,
 imageAnalyses
 );

 logger.success('[PASO 6] Evaluacion completada', {
 puntajeTotal: evaluation.totalScore,
 puntajeMaximo: evaluation.maxPossibleScore,
 porcentaje: evaluation.percentage + '%',
 criteriosEvaluados: evaluation.detailedScores?.length ?? 0,
 tokensUsados: evaluation.usage
 });

 // ── 6b. Auto-score "Subir Excel" basado en transacciones GPF ─────────────
 // Regla: si GPF tiene transacciones, el agente debió haberlas subido.
 const hasTransactions = attentionData.transactions.length > 0;

 if (hasTransactions) {
   const excelIdx = evaluation.detailedScores.findIndex(
     (s: any) => s.criterion.includes('Subir Excel')
   );

   if (excelIdx !== -1) {
     const excelDs = evaluation.detailedScores[excelIdx];
     const prevScore = excelDs.score;

     if (prevScore < excelDs.maxScore) {
       const scoreDiff = excelDs.maxScore - prevScore;

       evaluation.detailedScores[excelIdx] = {
         ...excelDs,
         score: excelDs.maxScore,
         observations:
           `[Auto-calificado] GPF reporta ${attentionData.transactions.length} transacción(es); ` +
           `el agente debió haber subido el Excel. ` +
           `Evaluador IA asignó: ${prevScore}/${excelDs.maxScore}. ` +
           excelDs.observations
       };

       (evaluation as any).totalScore = evaluation.totalScore + scoreDiff;

       // Respetar la regla de fallo crítico: si hay fallo, percentage se mantiene en 0
       if (!evaluation.criticalFailure) {
         (evaluation as any).percentage = evaluation.maxPossibleScore > 0
           ? Math.round((evaluation.totalScore / evaluation.maxPossibleScore) * 100)
           : 0;
       }

       logger.info('[PASO 6b] Auto-calificacion "Subir Excel" aplicada', {
         transacciones: attentionData.transactions.length,
         scoreAnterior: prevScore,
         scoreNuevo: excelDs.maxScore,
         totalScoreNuevo: evaluation.totalScore,
         percentageNuevo: evaluation.percentage,
         criticalFailure: evaluation.criticalFailure ?? false
       });
     } else {
       logger.info('[PASO 6b] "Subir Excel" ya tenia puntaje maximo, sin cambios', {
         score: excelDs.score,
         maxScore: excelDs.maxScore
       });
     }
   } else {
     logger.warn('[PASO 6b] Criterio "Subir Excel" no encontrado en detailedScores', {
       criterios: evaluation.detailedScores.map((s: any) => s.criterion)
     });
   }
 }

 // ── 7. Generate Excel ────────────────────────────────────────────────────
 progressBroadcaster.progress(sseClientId, 'excel', 88, 'Generando reporte Excel...');

 const excelResult = await excelService.generateExcelReport(metadata, evaluation);

 // ── 8. Calculate costs (fix: usar tokens reales del análisis de imágenes) ─
 const imgInputTokensGpf = imageAnalyses.reduce((s: number, img: any) => s + (img.usage?.input_tokens || 0), 0);
 const imgOutputTokensGpf = imageAnalyses.reduce((s: number, img: any) => s + (img.usage?.output_tokens || 0), 0);
 const costs = costCalculatorService.calculateTotalCost(
 audioDurationSeconds, // en segundos (calculateAssemblyAICost divide entre 60 internamente)
 localPaths.length,
 imgInputTokensGpf,
 imgOutputTokensGpf,
 (evaluation.usage?.inputTokens || 0) + sentimentUsage.inputTokens,
 (evaluation.usage?.outputTokens || 0) + sentimentUsage.outputTokens,
 sentimentProvider === 'assemblyai' && sentimentResults.length > 0
 );

 // Adjuntar advertencias de calidad de datos al resultado
 if (dataWarnings.length > 0) {
   (evaluation as any).dataWarnings = dataWarnings;
 }

 // ── 9. Persist to DB ─────────────────────────────────────────────────────
 const excelBase64 = excelResult.buffer.toString('base64');

 await databaseService.completeAudit(auditId, {
 transcription: audioOnlyTranscriptText ?? '',
 transcriptionWords: finalTranscript.words,
 imageAnalysis: imageAnalysisSummary,
 evaluation,
 excelFilename: excelResult.filename,
 excelBase64,
 processingTimeMs: Date.now() - startTime,
 costs,
 companyId: gpfCompanyId,
 audioDuration: audioDurationSeconds || null,
 transcriptionConfidence: gpfTranscriptionConfidence,
 languageCode: gpfLanguageCode,
 sentimentResults,
 sentimentSummary
 });

 logger.success(' GPF audit completed', {
 auditId,
 totalTime: `${((Date.now() - startTime) / 1000).toFixed(2)}s`
 });

 // ── 10. Cleanup & respond ────────────────────────────────────────────────
 cleanupTempFiles(tempFilePaths);

 progressBroadcaster.progress(sseClientId, 'completed', 100, '¡Auditoría completada!');

 await databaseService.logAuditActivity(
 auditId,
 req.user!.id,
 'created',
 null,
 req.ip,
 req.headers['user-agent']
 );

 res.json({
 success: true,
 auditId,
 excelFilename: excelResult.filename,
 processingTime: Date.now() - startTime,
 costs
 });

 } catch (error: any) {
 logger.error(' Error processing GPF audit:', error);

 if (auditId) {
 await databaseService.markAuditError(auditId, error.message);
 }

 progressBroadcaster.progress(sseClientId, 'error', 0, `Error: ${error.message}`);
 cleanupTempFiles(tempFilePaths);

 res.status(500).json({
 error: 'Error procesando auditoría GPF',
 details: error.message,
 auditId
 });
 }
});


// ============================================================
// BINES — CRUD
// ============================================================

app.get('/api/admin/bines', authenticateUser, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? undefined : (req.user!.company_id ?? undefined);
    const bines = await databaseService.getAllBines(companyId);
    res.json(bines);
  } catch (error: any) {
    logger.error('Error fetching bines:', error);
    res.status(500).json({ error: 'Error al obtener bines' });
  }
});

app.post('/api/admin/bines', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { categoria, categoria_orden, nombre, bin, socio, producto, nombre_comercial, marca } = req.body;
    if (!categoria || !nombre || !bin || !socio || !producto) {
      return res.status(400).json({ error: 'categoria, nombre, bin, socio y producto son requeridos' });
    }
    const item = await databaseService.createBin({
      categoria,
      categoria_orden: categoria_orden ?? 0,
      nombre,
      bin,
      socio,
      producto,
      nombre_comercial,
      marca,
      company_id: req.user!.company_id ?? undefined,
    });
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating bin:', error);
    res.status(500).json({ error: 'Error al crear bin' });
  }
});

app.put('/api/admin/bines/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { categoria, categoria_orden, nombre, bin, socio, producto, nombre_comercial, marca, is_active } = req.body;
    const item = await databaseService.updateBin(id, {
      categoria, categoria_orden, nombre, bin, socio, producto, nombre_comercial, marca, is_active,
    });
    res.json(item);
  } catch (error: any) {
    logger.error('Error updating bin:', error);
    res.status(500).json({ error: 'Error al actualizar bin' });
  }
});

app.delete('/api/admin/bines/:id', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteBin(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting bin:', error);
    res.status(500).json({ error: 'Error al eliminar bin' });
  }
});

// ============================================
// BATCH PROCESSING (Cola Nocturna - 50% desc.)
// ============================================

app.post('/api/batch/jobs', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { name, scheduled_for, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un caso en el lote' });
    }
    const job = await batchService.createBatchJob({
      name: name || `Lote ${new Date().toLocaleDateString('es-ES')}`,
      scheduled_for: scheduled_for || new Date().toISOString(),
      created_by: req.user!.id,
      items,
    });
    res.status(201).json(job);
  } catch (error: any) {
    logger.error('Error creating batch job', error);
    res.status(500).json({ error: error.message || 'Error al crear el lote' });
  }
});

app.get('/api/batch/jobs', authenticateUser, async (req: Request, res: Response) => {
  try {
    const companyId = req.user!.role === 'superadmin' ? null : req.user!.company_id;
    const jobs = await batchService.getBatchJobs(req.user!.id, req.user!.role, companyId);
    res.json(jobs);
  } catch (error: any) {
    logger.error('Error listing batch jobs', error);
    res.status(500).json({ error: 'Error al obtener los lotes' });
  }
});

app.get('/api/batch/jobs/:jobId', authenticateUser, async (req: Request, res: Response) => {
  try {
    const job = await batchService.getBatchJobById(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Lote no encontrado' });
    // Aislamiento por empresa: solo superadmin o miembros de la empresa dueña
    if (req.user!.role !== 'superadmin' && req.user!.company_id && job.company_id !== req.user!.company_id) {
      return res.status(404).json({ error: 'Lote no encontrado' });
    }
    res.json(job);
  } catch (error: any) {
    logger.error('Error fetching batch job', error);
    res.status(500).json({ error: 'Error al obtener el lote' });
  }
});

app.post('/api/batch/jobs/:jobId/submit', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    // Fire and forget — la respuesta llega antes de que termine
    res.json({ success: true, message: 'Enviando lote a OpenAI Batch API...' });
    batchService.submitBatchJob(jobId).catch(err =>
      logger.error('Batch submit failed async', { jobId, err: err.message })
    );
  } catch (error: any) {
    logger.error('Error submitting batch job', error);
    res.status(500).json({ error: error.message || 'Error al enviar el lote' });
  }
});

app.post('/api/batch/jobs/:jobId/check', authenticateUser, async (req: Request, res: Response) => {
  try {
    const result = await batchService.checkAndProcessBatchJob(req.params.jobId);
    res.json(result);
  } catch (error: any) {
    logger.error('Error checking batch job', error);
    res.status(500).json({ error: error.message || 'Error al verificar el lote' });
  }
});

app.delete('/api/batch/jobs/:jobId', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
  try {
    await batchService.deleteBatchJob(req.params.jobId);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting batch job', error);
    res.status(500).json({ error: 'Error al eliminar el lote' });
  }
});

app.get('/api/batch/savings-estimate', authenticateUser, (req: Request, res: Response) => {
  const count = parseInt(req.query.count as string) || 1;
  const { BATCH_LIMITS } = batchService;
  res.json({
    item_count: count,
    estimated_savings_usd: batchService.getEstimatedSavings(count),
    discount_percentage: 50,
    limits: {
      model: BATCH_LIMITS.MODEL,
      context_window_tokens: BATCH_LIMITS.CONTEXT_WINDOW_TOKENS,
      max_output_tokens: BATCH_LIMITS.MAX_OUTPUT_TOKENS,
      max_file_size_mb: BATCH_LIMITS.MAX_FILE_SIZE_MB,
      max_requests_per_batch: BATCH_LIMITS.MAX_REQUESTS_PER_BATCH,
      recommended_max_cases: BATCH_LIMITS.RECOMMENDED_MAX_CASES,
      hard_max_cases: BATCH_LIMITS.HARD_MAX_CASES,
      estimated_mb_per_case: BATCH_LIMITS.ESTIMATED_MB_PER_CASE,
    },
  });
});

app.post('/api/batch/validate', authenticateUser, async (req: Request, res: Response) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Se requiere un array de items' });
    }
    if (items.length > 100) {
      return res.status(400).json({ error: 'Máximo 100 items por validación' });
    }
    const results = await batchService.validateBatchItems(items);
    res.json({ results });
  } catch (error: any) {
    logger.error('Error validating batch items', error);
    res.status(500).json({ error: error.message || 'Error al validar los casos' });
  }
});

// Manejador de errores
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
 logger.error('Unhandled error:', err);

 res.status(500).json({
 error: err.message || 'Error interno del servidor',
 details: process.env.NODE_ENV === 'development' ? err.stack : undefined
 });
});

// ── Auto-submit de lotes programados ─────────────────────────────────────────
// Cada 2 minutos: envía lotes pending cuya hora programada ya llegó
setInterval(async () => {
  try {
    const { data: dueJobs } = await supabaseAdmin
      .from('batch_jobs')
      .select('id, name')
      .eq('status', 'pending')
      .lte('scheduled_for', new Date().toISOString());

    if (!dueJobs?.length) return;

    for (const job of dueJobs) {
      logger.info('Auto-submitting scheduled batch job', { jobId: job.id, name: job.name });
      batchService.submitBatchJob(job.id).catch((err: Error) =>
        logger.error('Auto-submit failed', { jobId: job.id, err: err.message })
      );
    }
  } catch (err: any) {
    logger.warn('Batch auto-submit check error', { err: err.message });
  }
}, 2 * 60 * 1000);

// Cada 10 minutos: verifica lotes enviados a OpenAI para detectar cuando terminan
setInterval(async () => {
  try {
    const { data: submittedJobs } = await supabaseAdmin
      .from('batch_jobs')
      .select('id, name')
      .in('status', ['submitted', 'assembling']);

    if (!submittedJobs?.length) return;

    for (const job of submittedJobs) {
      batchService.checkAndProcessBatchJob(job.id)
        .then(result => {
          if (result.status === 'completed') {
            logger.success('Batch job auto-completed', { jobId: job.id, name: job.name });
          }
        })
        .catch((err: Error) =>
          logger.warn('Auto-check failed', { jobId: job.id, err: err.message })
        );
    }
  } catch (err: any) {
    logger.warn('Batch auto-check error', { err: err.message });
  }
}, 10 * 60 * 1000);

// Cada 30 min: marcar como error las auditorías atascadas en "processing" por más de 45 minutos
setInterval(async () => {
  try {
    const staleThreshold = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const { data: staleAudits } = await supabaseAdmin
      .from('audits')
      .select('id')
      .eq('status', 'processing')
      .lt('created_at', staleThreshold);

    if (!staleAudits?.length) return;

    for (const audit of staleAudits) {
      await supabaseAdmin
        .from('audits')
        .update({ status: 'error', error_message: 'Procesamiento interrumpido (timeout automático)', completed_at: new Date().toISOString() })
        .eq('id', audit.id);
      logger.warn('Stale audit marked as error', { auditId: audit.id });
    }
  } catch (err: any) {
    logger.warn('Stale audit cleanup error', { err: err.message });
  }
}, 30 * 60 * 1000);

// ============================================================
// PLATFORM — Companies (solo admin)
// ============================================================

app.get('/api/platform/companies', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const companies = await databaseService.getAllCompanies();
 const usageMap = await databaseService.getAllCompaniesMonthlyUsage();
 const usageByCompany = new Map(usageMap.map((u: any) => [u.company_id, u]));
 const result = companies.map((c: any) => ({
 ...c,
 usage_this_month: usageByCompany.get(c.id) ?? { total_audits: 0, total_cost: 0, total_tokens: 0 }
 }));
 res.json(result);
 } catch (error: any) {
 logger.error('Error fetching companies', error);
 res.status(500).json({ error: 'Error al obtener empresas' });
 }
});

app.post('/api/platform/companies', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const company = await databaseService.createCompany(req.body);
 res.status(201).json(company);
 } catch (error: any) {
 logger.error('Error creating company', error);
 res.status(500).json({ error: 'Error al crear empresa' });
 }
});

app.put('/api/platform/companies/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const company = await databaseService.updateCompany(req.params.id, req.body);
 res.json(company);
 } catch (error: any) {
 logger.error('Error updating company', error);
 res.status(500).json({ error: 'Error al actualizar empresa' });
 }
});

app.get('/api/platform/companies/:id/usage', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const usage = await databaseService.getCompanyMonthlyUsage(req.params.id);
 res.json(usage);
 } catch (error: any) {
 logger.error('Error fetching company usage', error);
 res.status(500).json({ error: 'Error al obtener consumo de empresa' });
 }
});

app.put('/api/platform/companies/:id/limits', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 await databaseService.updateCompanyUsageLimits(req.params.id, req.body);
 res.json({ ok: true });
 } catch (error: any) {
 logger.error('Error updating usage limits', error);
 res.status(500).json({ error: 'Error al actualizar límites' });
 }
});

// ── Company own usage (supervisor o admin de esa empresa) ─────────────────
app.get('/api/admin/company/usage', authenticateUser, requireAdminOrSupervisor, async (req: Request, res: Response) => {
 try {
 const companyId = req.user!.company_id;
 if (!companyId) return res.status(400).json({ error: 'No company associated' });
 const usage = await databaseService.getCompanyMonthlyUsage(companyId);
 res.json(usage);
 } catch (error: any) {
 logger.error('Error fetching own company usage', error);
 res.status(500).json({ error: 'Error al obtener consumo' });
 }
});

// ── Role permissions (supervisor o admin) ────────────────────────────────
app.put('/api/admin/company/role-permissions', authenticateUser, requireAdminOrSupervisor, async (req: Request, res: Response) => {
 try {
 const companyId = req.user!.company_id;
 if (!companyId) return res.status(400).json({ error: 'No company associated' });
 await databaseService.updateCompanyRolePermissions(companyId, req.body);
 res.json({ ok: true });
 } catch (error: any) {
 logger.error('Error updating role permissions', error);
 res.status(500).json({ error: 'Error al actualizar permisos' });
 }
});

// ── Integración interna por empresa (lider o superadmin) ──────────────────
// El lider edita únicamente los endpoints internos de SU empresa
// (companies.integration_config). Las APIs globales (OpenAI/AssemblyAI) NO
// se tocan aquí; viven en /api/admin/config (solo superadmin).
app.get('/api/company/integration', authenticateUser, requireAdminOrSupervisor, async (req: Request, res: Response) => {
 try {
 // El superadmin puede inspeccionar otra empresa con ?companyId=; el lider solo la suya.
 const targetId = req.user!.role === 'superadmin'
   ? ((req.query.companyId as string) || req.user!.company_id)
   : req.user!.company_id;
 if (!targetId) return res.status(400).json({ error: 'No company associated' });

 const company = await databaseService.getCompany(targetId);
 res.json({
   company_id: company.id,
   name: company.name,
   integration_type: company.integration_type ?? 'none',
   integration_config: company.integration_config ?? {},
 });
 } catch (error: any) {
 logger.error('Error fetching company integration', error);
 res.status(500).json({ error: 'Error al obtener integración' });
 }
});

app.put('/api/company/integration', authenticateUser, requireAdminOrSupervisor, async (req: Request, res: Response) => {
 try {
 const { integration_type, integration_config } = req.body ?? {};
 // El superadmin puede dirigir otra empresa por body.companyId; el lider solo la suya.
 const targetId = req.user!.role === 'superadmin'
   ? ((req.body?.companyId as string) || req.user!.company_id)
   : req.user!.company_id;
 if (!targetId) return res.status(400).json({ error: 'No company associated' });

 // Mezclar config existente con la nueva para no perder claves no enviadas.
 const current = await databaseService.getCompany(targetId);
 const mergedConfig = {
   ...((current?.integration_config as Record<string, unknown>) ?? {}),
   ...((integration_config as Record<string, unknown>) ?? {}),
 };

 const payload: { integration_type?: string; integration_config: Record<string, unknown> } = {
   integration_config: mergedConfig,
 };
 if (typeof integration_type === 'string') payload.integration_type = integration_type;

 const updated = await databaseService.updateCompany(targetId, payload);
 logger.success('Company integration updated', { companyId: targetId, by: req.user!.id });

 // Si se actualizó PositivoS+ (dueña de GPF), invalidar las cachés de
 // credenciales y de token para que el runtime tome los nuevos valores.
 const positivosId = await databaseService.getPositivosCompanyId();
 if (positivosId && targetId === positivosId) {
   gpfConfigService.invalidate();
   gpfTokenService.invalidate('prod');
   gpfTokenService.invalidate('test');
 }
 res.json({
   company_id: updated.id,
   name: updated.name,
   integration_type: updated.integration_type ?? 'none',
   integration_config: updated.integration_config ?? {},
 });
 } catch (error: any) {
 logger.error('Error updating company integration', error);
 res.status(500).json({ error: 'Error al actualizar integración' });
 }
});

// Iniciar servidor
app.listen(PORT, () => {
 logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
 logger.info(` SERVER STARTED ON PORT ${PORT}`);
 logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
 logger.info(` Environment: ${process.env.NODE_ENV || 'development'}`);
 logger.info(` CORS origins: ${allowedOrigins.join(', ')}`);
 logger.info(` OpenAI API: ${process.env.OPENAI_API_KEY ? ' Configured' : ' Missing'}`);
 logger.info(` AssemblyAI API: ${process.env.ASSEMBLYAI_API_KEY ? ' Configured' : ' Missing'}`);
 logger.info(` Supabase: ${process.env.SUPABASE_URL ? ' Configured' : ' Missing'}`);
 logger.info(` Excel storage: Database (base64)`);
 logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});

export default app;