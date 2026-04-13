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
import { authenticateUser, requireAdmin, requireAdminOrAnalyst } from './middleware/auth.middleware.js';
import { gpfTokenService } from './services/gpf-token.service.js';
import { gpfDataService } from './services/gpf-data.service.js';
import { buildSyntheticTranscript } from './utils/synthetic-transcript.js';
import { downloadImagesToTemp } from './utils/image-downloader.js';
import { gpfFetch } from './utils/gpf-fetch.js';
import { supabase, supabaseAdmin } from './config/supabase.js';
import { progressBroadcaster } from './services/progress-broadcaster.js';
import type { AuditInput } from './types/index.js';
import statsRoutes from './routes/stats.routes.js';

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
 methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

 const { audits, total } = await databaseService.getUserAudits(
 req.user!.id,
 req.user!.role,
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

 const auditData = await databaseService.getAuditById(auditId, req.user!.id, req.user!.role);

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
 imagePaths: imageFiles.map(f => f.path)
 };

 logger.info(' Audit metadata:', metadata);

 // 1. Crear entrada en la base de datos
 progressBroadcaster.progress(sseClientId, 'upload', 10, 'Archivos subidos correctamente');

 auditId = await databaseService.createAudit({
 userId: req.user!.id,
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

 // 6. Calcular costos
 const costs = costCalculatorService.calculateTotalCost(
 transcription.audio_duration || 0,
 imageFiles.length,
 0,
 0,
 evaluation.usage?.inputTokens || 0,
 evaluation.usage?.outputTokens || 0
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
 excelBase64: excelBase64, // NUEVO
 processingTimeMs: Date.now() - startTime,
 costs
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

// ============================================================
// PATCH /api/audits/:auditId/scores — Actualizar puntajes manualmente
// ============================================================
app.patch('/api/audits/:auditId/scores', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { auditId } = req.params;
 const { detailedScores } = req.body as { detailedScores: Array<{ criterion: string; score: number; maxScore: number; observations: string; criticality?: string }> };

 if (!Array.isArray(detailedScores) || detailedScores.length === 0) {
 return res.status(400).json({ error: 'detailedScores es requerido y debe ser un array no vacío' });
 }

 // Recalcular totales
 const totalScore = detailedScores.reduce((sum, s) => sum + (s.score ?? 0), 0);
 const maxPossibleScore = detailedScores.reduce((sum, s) => sum + (s.maxScore ?? 0), 0);
 const rawPercentage = maxPossibleScore > 0 ? (totalScore / maxPossibleScore) * 100 : 0;

 // Reevaluar fallo crítico
 const failedCritical = detailedScores.filter(s => s.criticality === 'Crítico' && s.score === 0).map(s => s.criterion);
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

 return res.json({ totalScore, maxPossibleScore, percentage, criticalFailure, failedCriticalCriteria: criticalFailure ? failedCritical : undefined });
 } catch (error: any) {
 logger.error('Error in PATCH /api/audits/:auditId/scores', error);
 return res.status(500).json({ error: 'Error interno del servidor' });
 }
});

app.delete('/api/audits/:auditId', authenticateUser, async (req: Request, res: Response) => {
 try {
 const { auditId } = req.params;
 const userId = req.user!.id;
 const userRole = req.user!.role;

 await databaseService.deleteAudit(auditId, userId, userRole);

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

app.get('/api/admin/users', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const { data: users, error } = await supabaseAdmin
 .from('users')
 .select('*')
 .order('created_at', { ascending: false });

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

app.post('/api/admin/users', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const { email, password, full_name, role } = req.body;

 if (!email || !password || !full_name || !role) {
 return res.status(400).json({ error: 'Todos los campos son requeridos' });
 }

 const validRoles = ['admin', 'supervisor', 'analyst'];
 if (!validRoles.includes(role)) {
 return res.status(400).json({ error: 'Rol inválido' });
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
 role
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

app.put('/api/admin/users/:userId', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
 try {
 const { userId } = req.params;
 const { email, full_name, role, password } = req.body;

 if (role) {
 const validRoles = ['admin', 'supervisor', 'analyst'];
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

app.get('/api/admin/scripts', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const scripts = await databaseService.getAllScripts();
    res.json(scripts);
  } catch (error: any) {
    logger.error('Error fetching scripts:', error);
    res.status(500).json({ error: 'Error al obtener scripts' });
  }
});

app.get('/api/admin/scripts/:callType', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const callType = decodeURIComponent(req.params.callType);
    const scripts = await databaseService.getScriptsForCallType(callType);
    res.json(scripts);
  } catch (error: any) {
    logger.error('Error fetching scripts by call type:', error);
    res.status(500).json({ error: 'Error al obtener scripts' });
  }
});

app.post('/api/admin/scripts', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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
      lines: lines ?? []
    });
    res.status(201).json(script);
  } catch (error: any) {
    logger.error('Error creating script:', error);
    res.status(500).json({ error: 'Error al crear script' });
  }
});

app.put('/api/admin/scripts/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { step_label, step_order, lines, is_active } = req.body;
    const script = await databaseService.updateScript(id, { step_label, step_order, lines, is_active });
    res.json(script);
  } catch (error: any) {
    logger.error('Error updating script:', error);
    res.status(500).json({ error: 'Error al actualizar script' });
  }
});

app.delete('/api/admin/scripts/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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

app.get('/api/admin/criteria', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const blocks = await databaseService.getAllCriteriaBlocks();
    res.json(blocks);
  } catch (error: any) {
    logger.error('Error fetching criteria:', error);
    res.status(500).json({ error: 'Error al obtener criterios' });
  }
});

app.post('/api/admin/blocks', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { call_type, mode, block_name, block_order } = req.body;
    if (!call_type || !block_name) {
      return res.status(400).json({ error: 'call_type y block_name son requeridos' });
    }
    const block = await databaseService.createBlock({
      call_type,
      mode: mode ?? 'INBOUND',
      block_name,
      block_order: block_order ?? 0
    });
    res.status(201).json(block);
  } catch (error: any) {
    logger.error('Error creating block:', error);
    res.status(500).json({ error: 'Error al crear bloque' });
  }
});

app.put('/api/admin/blocks/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { block_name, block_order, is_active } = req.body;
    const block = await databaseService.updateBlock(id, { block_name, block_order, is_active });
    res.json(block);
  } catch (error: any) {
    logger.error('Error updating block:', error);
    res.status(500).json({ error: 'Error al actualizar bloque' });
  }
});

app.delete('/api/admin/blocks/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteBlock(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting block:', error);
    res.status(500).json({ error: 'Error al eliminar bloque' });
  }
});

app.post('/api/admin/criteria', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { block_id, topic, criticality, points, applies, what_to_look_for, criteria_order } = req.body;
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
      criteria_order: criteria_order ?? 0
    });
    res.status(201).json(criteria);
  } catch (error: any) {
    logger.error('Error creating criteria:', error);
    res.status(500).json({ error: 'Error al crear criterio' });
  }
});

app.put('/api/admin/criteria/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { topic, criticality, points, applies, what_to_look_for, criteria_order, is_active } = req.body;
    const criteria = await databaseService.updateCriteria(id, {
      topic,
      criticality,
      points: points === 'n/a' || points === null ? null : (points !== undefined ? Number(points) : undefined),
      applies,
      what_to_look_for,
      criteria_order,
      is_active
    });
    res.json(criteria);
  } catch (error: any) {
    logger.error('Error updating criteria:', error);
    res.status(500).json({ error: 'Error al actualizar criterio' });
  }
});

app.delete('/api/admin/criteria/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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

app.get('/api/admin/plantilla-gpf', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const items = await databaseService.getAllPlantillaGPF();
    res.json(items);
  } catch (error: any) {
    logger.error('Error fetching plantilla GPF:', error);
    res.status(500).json({ error: 'Error al obtener plantilla GPF' });
  }
});

app.post('/api/admin/plantilla-gpf', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { categoria, tipo_cierre, descripcion, categoria_orden, tipo_orden, call_type, mode } = req.body;
    if (!categoria || !tipo_cierre) {
      return res.status(400).json({ error: 'categoria y tipo_cierre son requeridos' });
    }
    const callTypesConfig = await databaseService.getCallTypesConfig();
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
    });
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating plantilla item:', error);
    res.status(500).json({ error: 'Error al crear item de plantilla' });
  }
});

app.put('/api/admin/plantilla-gpf/rename-categoria', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { oldName, newName, call_type, mode } = req.body;
    if (!oldName || !newName) {
      return res.status(400).json({ error: 'oldName y newName son requeridos' });
    }
    const callTypesConfig = await databaseService.getCallTypesConfig();
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

app.put('/api/admin/plantilla-gpf/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { categoria, tipo_cierre, descripcion, categoria_orden, tipo_orden } = req.body;
    const item = await databaseService.updatePlantillaItem(id, { categoria, tipo_cierre, descripcion, categoria_orden, tipo_orden });
    res.json(item);
  } catch (error: any) {
    logger.error('Error updating plantilla item:', error);
    res.status(500).json({ error: 'Error al actualizar item de plantilla' });
  }
});

app.delete('/api/admin/plantilla-gpf/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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
    const prompts = await databaseService.getAllPrompts();
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

app.get('/api/admin/word-boost', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const terms = await databaseService.getWordBoostTerms();
    res.json(terms);
  } catch (error: any) {
    logger.error('Error fetching word_boost_terms:', error);
    res.status(500).json({ error: 'Error al obtener términos de vocabulario' });
  }
});

app.post('/api/admin/word-boost', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { term, category, is_active, display_order } = req.body;
    if (!term || !category) {
      return res.status(400).json({ error: 'term y category son requeridos' });
    }
    const item = await databaseService.createWordBoostTerm({ term, category, is_active, display_order });
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating word_boost_term:', error);
    res.status(500).json({ error: 'Error al crear término de vocabulario' });
  }
});

app.put('/api/admin/word-boost/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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

app.delete('/api/admin/word-boost/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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

app.get('/api/admin/image-systems', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const systems = await databaseService.getImageSystems();
    res.json(systems);
  } catch (error: any) {
    logger.error('Error fetching image_systems:', error);
    res.status(500).json({ error: 'Error al obtener sistemas de imagen' });
  }
});

app.post('/api/admin/image-systems', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { system_name, description, detection_hints, fields_schema, is_active, display_order } = req.body;
    if (!system_name || !description) {
      return res.status(400).json({ error: 'system_name y description son requeridos' });
    }
    const item = await databaseService.createImageSystem({ system_name, description, detection_hints, fields_schema, is_active, display_order });
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating image_system:', error);
    res.status(500).json({ error: 'Error al crear sistema de imagen' });
  }
});

app.put('/api/admin/image-systems/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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

app.delete('/api/admin/image-systems/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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
    const items = await databaseService.getCallTypesConfig();
    res.json(items);
  } catch (error: any) {
    logger.error('Error fetching call_types_config (public):', error);
    res.status(500).json({ error: 'Error al obtener tipos de llamada' });
  }
});

// ============================================================
// CALL TYPES CONFIG — CRUD (admin only)
// ============================================================

app.get('/api/admin/call-types-config', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const items = await databaseService.getCallTypesConfig();
    res.json(items);
  } catch (error: any) {
    logger.error('Error fetching call_types_config:', error);
    res.status(500).json({ error: 'Error al obtener tipos de llamada' });
  }
});

app.post('/api/admin/call-types-config', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { name, modes, is_active, display_order } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name es requerido' });
    }
    const item = await databaseService.createCallTypeConfig({ name, modes, is_active, display_order });
    res.status(201).json(item);
  } catch (error: any) {
    logger.error('Error creating call_type_config:', error);
    res.status(500).json({ error: 'Error al crear tipo de llamada' });
  }
});

app.put('/api/admin/call-types-config/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
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

app.delete('/api/admin/call-types-config/:id', authenticateUser, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await databaseService.deleteCallTypeConfig(id);
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Error deleting call_type_config:', error);
    res.status(500).json({ error: 'Error al eliminar tipo de llamada' });
  }
});

// ============================================
// GPF API PROXY
// ============================================

const getGpfBaseUrl = (env: string): string => {
 return env === 'prod'
 ? (process.env.GPF_API_URL_PROD || '')
 : (process.env.GPF_API_URL_TEST || '');
};

const buildGpfHeaders = (token?: string): Record<string, string> => {
 const headers: Record<string, string> = {
 'Accept': 'application/json',
 'Content-Type': 'application/json',
 'X-App-Token': process.env.GPF_APP_TOKEN || '',
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
 const baseUrl = getGpfBaseUrl(env);

 if (!baseUrl) {
 return res.status(500).json({ error: 'URL de GPF no configurada' });
 }

 const email: string = req.body.email || process.env.GPF_EMAIL || '';
 const password: string = req.body.password || process.env.GPF_PASSWORD || '';

 const start = Date.now();
 const response = await fetch(`${baseUrl}/api/login`, {
 method: 'POST',
 headers: buildGpfHeaders(),
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

 const baseUrl = getGpfBaseUrl(env);
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
 headers: buildGpfHeaders(token)
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

 const baseUrl = getGpfBaseUrl(env);
 if (!baseUrl) {
 return res.status(500).json({ error: 'URL de GPF no configurada' });
 }

 const start = Date.now();
 const response = await fetch(`${baseUrl}/api/quality-control/v1/download-report`, {
 method: 'POST',
 headers: buildGpfHeaders(token),
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

app.get('/api/gpf/attentions', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
 try {
 const env = (req.query.env as string) || 'test';
 const token = await gpfTokenService.getTokenWithRetry(env);
 const attentions = await gpfDataService.getAttentions(env, token);
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
 const allowed = [
 process.env.GPF_API_URL_PROD || '',
 process.env.GPF_API_URL_TEST || '',
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
 { label: 'Bearer+AppToken', url, headers: { 'Authorization': `Bearer ${gpfToken}`, 'X-App-Token': process.env.GPF_APP_TOKEN || '', 'ngrok-skip-browser-warning': 'true' } },
 { label: 'AppToken-solo', url, headers: { 'X-App-Token': process.env.GPF_APP_TOKEN || '', 'ngrok-skip-browser-warning': 'true' } },
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
 const appToken = process.env.GPF_APP_TOKEN || '';

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

app.post('/api/evaluate-from-gpf', authenticateUser, requireAdminOrAnalyst, async (req: Request, res: Response) => {
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

 // Use the full attention object from the list for rich metadata
 const metadata = {
 ...gpfDataService.normalizeMetadata(attentionObject || {}, attentionId),
 excelType: resolvedExcelType
 };

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

 try {
 logger.info('[PASO 5] Solicitando URL de audio a GPF...', { attentionId, env });
 const audioSecureUrl = await gpfDataService.fetchAudioUrl(env, attentionId, token);
 logger.info('[PASO 5] Resultado URL de audio', {
 urlObtenida: audioSecureUrl ? audioSecureUrl.substring(0, 100) : 'NULL - sin audio disponible'
 });

 if (audioSecureUrl) {
 progressBroadcaster.progress(sseClientId, 'audio', 62, '[AUDIO] Descargando grabacion...');
 const appToken = process.env.GPF_APP_TOKEN || '';
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

 // ── 8. Calculate costs ───────────────────────────────────────────────────
 const costs = costCalculatorService.calculateTotalCost(
 audioDurationSeconds / 60, // duración real si hubo audio, 0 si no
 localPaths.length,
 0,
 0,
 evaluation.usage?.inputTokens || 0,
 evaluation.usage?.outputTokens || 0
 );

 // ── 9. Persist to DB ─────────────────────────────────────────────────────
 const excelBase64 = excelResult.buffer.toString('base64');

 await databaseService.completeAudit(auditId, {
 transcription: finalTranscript.text,
 transcriptionWords: finalTranscript.words,
 imageAnalysis: imageAnalysisSummary,
 evaluation,
 excelFilename: excelResult.filename,
 excelBase64,
 processingTimeMs: Date.now() - startTime,
 costs
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


// Manejador de errores
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
 logger.error('Unhandled error:', err);

 res.status(500).json({
 error: err.message || 'Error interno del servidor',
 details: process.env.NODE_ENV === 'development' ? err.stack : undefined
 });
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