// backend/src/services/progress-broadcaster.ts

import { Response } from 'express';
import { logger } from '../utils/logger.js';

export interface ProgressMessage {
 type: 'info' | 'success' | 'error' | 'progress' | 'stage' | 'result';
 stage?: string;
 progress?: number;
 message: string;
 data?: any;
 timestamp: string;
}

export class ProgressBroadcaster {
 private clients: Map<string, Response> = new Map();

 /**
 * Registrar un cliente SSE
 */
 addClient(clientId: string, res: Response) {
 // Configurar headers para SSE
 res.writeHead(200, {
 'Content-Type': 'text/event-stream',
 'Cache-Control': 'no-cache',
 'Connection': 'keep-alive',
 'X-Accel-Buffering': 'no'
 });

 this.clients.set(clientId, res);

 // Enviar mensaje de conexión
 this.sendToClient(clientId, {
 type: 'info',
 message: 'Conexión establecida - Esperando inicio de procesamiento',
 timestamp: new Date().toISOString()
 });

 logger.info(' SSE Client connected', { clientId });

 // Limpiar al desconectar
 res.on('close', () => {
 this.clients.delete(clientId);
 logger.info(' SSE Client disconnected', { clientId });
 });
 }

 /**
 * Enviar mensaje a un cliente específico
 */
 sendToClient(clientId: string, message: ProgressMessage) {
 const client = this.clients.get(clientId);
 if (!client) return;

 try {
 const data = JSON.stringify(message);
 client.write(`data: ${data}\n\n`);
 } catch (error) {
 logger.error('Error sending SSE message', { clientId, error });
 this.clients.delete(clientId);
 }
 }

 /**
 * Enviar mensaje a todos los clientes
 */
 broadcast(message: ProgressMessage) {
 this.clients.forEach((_, clientId) => {
 this.sendToClient(clientId, message);
 });
 }

 /**
 * Métodos de conveniencia
 */
 info(clientId: string, message: string, data?: any) {
 this.sendToClient(clientId, {
 type: 'info',
 message,
 data,
 timestamp: new Date().toISOString()
 });
 }

 success(clientId: string, message: string, data?: any) {
 this.sendToClient(clientId, {
 type: 'success',
 message,
 data,
 timestamp: new Date().toISOString()
 });
 }

 error(clientId: string, message: string, data?: any) {
 this.sendToClient(clientId, {
 type: 'error',
 message,
 data,
 timestamp: new Date().toISOString()
 });
 }

 progress(clientId: string, stage: string, progress: number, message: string, data?: any) {
 this.sendToClient(clientId, {
 type: 'progress',
 stage,
 progress,
 message,
 data,
 timestamp: new Date().toISOString()
 });
 }

 stage(clientId: string, stage: string, message: string, data?: any) {
 this.sendToClient(clientId, {
 type: 'stage',
 stage,
 message,
 data,
 timestamp: new Date().toISOString()
 });
 }

 result(clientId: string, data: any) {
 this.sendToClient(clientId, {
 type: 'result',
 message: 'Procesamiento completado',
 data,
 timestamp: new Date().toISOString()
 });
 }

 /**
 * Cerrar conexión con un cliente
 */
 closeClient(clientId: string) {
 const client = this.clients.get(clientId);
 if (client) {
 client.end();
 this.clients.delete(clientId);
 }
 }
}

// Singleton
let instance: ProgressBroadcaster | null = null;

export const getProgressBroadcaster = () => {
 if (!instance) {
 instance = new ProgressBroadcaster();
 }
 return instance;
};

export const progressBroadcaster = getProgressBroadcaster();