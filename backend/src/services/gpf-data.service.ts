// backend/src/services/gpf-data.service.ts
// Fetches all data for an attention from the GPF API.
//
// All API responses follow the wrapper: { data: ..., error: ..., is_success: bool, status: int }
//
// Endpoint shapes (from API docs):
// GET attentions-quality-control → data: [ { id_atencion, "Agente", "Llamada en curso", "Socio", "Fecha de la compra", ... } ]
// GET captures-comments/{id} → data: { captures: [url_string], comments: [string] }
// GET transactions/{id} → data: { transactions: [{ date, commerce_name, amount }] }
// GET comments/{id} → data: { comments: [{ date, comment, agent }] }
// GET otp-validations/{id} → data: { otpValidations: [{ date, agent, resultado }] }

import { logger } from '../utils/logger.js';
import type { AuditInput } from '../types/index.js';
import { gpfFetch, normalizeGpfUrl } from '../utils/gpf-fetch.js';

export interface AttentionFullData {
 attention: any;
 imageUrls: string[];
 rawComments: string[]; // from captures-comments (plain strings)
 transactions: TransactionItem[];
 comments: CommentItem[];
 otpValidations: OtpItem[];
 metadata: AuditInput;
}

export interface TransactionItem {
 date: string;
 commerce_name: string;
 amount: string;
}

export interface CommentItem {
 date: string;
 comment: string;
 agent: string;
}

export interface OtpItem {
 date: string;
 agent: string;
 resultado: boolean;
}

class GpfDataService {
 private getBaseUrl(env: string): string {
 const raw = env === 'prod'
  ? (process.env.GPF_API_URL_PROD || '')
  : (process.env.GPF_API_URL_TEST || '');
 return normalizeGpfUrl(raw);
 }

 private buildHeaders(token: string): Record<string, string> {
 return {
 'Accept': 'application/json',
 'Content-Type': 'application/json',
 'X-App-Token': process.env.GPF_APP_TOKEN || '',
 'Authorization': `Bearer ${token}`,
 'ngrok-skip-browser-warning': 'true'
 };
 }

 /** Fetch JSON from a GPF endpoint. Returns null on error (for optional data). */
 private async fetchJson(url: string, headers: Record<string, string>): Promise<any> {
 try {
 const response = await gpfFetch(url, { headers });
 if (!response.ok) {
 logger.warn(`GPF fetch failed ${url}: ${response.status}`);
 return null;
 }
 const body: any = await response.json();
 if (!body?.is_success) {
 logger.warn(`GPF endpoint error ${url}: ${body?.error?.message}`);
 return null;
 }
 return body.data; // unwrap the API wrapper — return the actual data
 } catch (error) {
 logger.warn(`GPF fetch error ${url}:`, error);
 return null;
 }
 }

 async getAttentions(env: string, token: string): Promise<any[]> {
 const baseUrl = this.getBaseUrl(env);
 if (!baseUrl) throw new Error(`GPF URL not configured for env: ${env}`);

 const response = await gpfFetch(
  `${baseUrl}/api/quality-control/v1/attentions-quality-control`,
  { headers: this.buildHeaders(token) }
 );

 if (!response.ok) {
 throw new Error(`GPF attentions fetch failed: ${response.status} ${response.statusText}`);
 }

 const body: any = await response.json();

 if (!body?.is_success) {
 throw new Error(`GPF attentions error: ${body?.error?.message || 'unknown'}`);
 }

 // data is directly the array
 const attentions = body.data;
 if (Array.isArray(attentions)) {
  if (attentions.length > 0) {
   const sample = attentions[0];
   logger.info('[DEBUG-CAMPOS] Primera atención recibida de la API', {
    id: sample['id_atencion'],
    Agente: sample['Agente'],
    Comercio: sample['Comercio'],
    Fecha_de_la_compra: sample['Fecha de la compra'],
    Monto_de_la_compra: sample['Monto de la compra'],
    Estado_llamada: sample['Estado llamada'],
    Calificacion: sample['Calificación'],
    todasLasClaves: Object.keys(sample)
   });
   // Verificar si las claves tienen encoding inesperado
   const keys = Object.keys(sample);
   const comercioKey = keys.find(k => k.toLowerCase().includes('comercio'));
   if (comercioKey) {
    logger.info('[DEBUG-CAMPOS] Clave "Comercio" encontrada', {
     claveExacta: comercioKey,
     bytes: Buffer.from(comercioKey).toString('hex'),
     valor: sample[comercioKey]
    });
   } else {
    logger.warn('[DEBUG-CAMPOS] NO se encontró clave que contenga "comercio" en la respuesta');
   }
  }
  return attentions;
 }

 logger.warn('GPF attentions: unexpected shape', body);
 return [];
 }

 async fetchAttentionData(
 env: string,
 attentionId: string | number,
 token: string
 ): Promise<AttentionFullData> {
 const baseUrl = this.getBaseUrl(env);
 if (!baseUrl) throw new Error(`GPF URL not configured for env: ${env}`);

 const headers = this.buildHeaders(token);
 const id = String(attentionId);

 logger.info(' Fetching GPF attention data (parallel)', { attentionId: id, env });

 // Parallel fetch — all return unwrapped `data` field or null
 const [capturesData, transactionsData, commentsData, otpData] = await Promise.all([
 this.fetchJson(`${baseUrl}/api/quality-control/v1/captures-comments/${id}`, headers),
 this.fetchJson(`${baseUrl}/api/quality-control/v1/transactions/${id}`, headers),
 this.fetchJson(`${baseUrl}/api/quality-control/v1/comments/${id}`, headers),
 this.fetchJson(`${baseUrl}/api/quality-control/v1/otp-validations/${id}`, headers)
 ]);

 // captures-comments → { captures: [url], comments: [string] }
 // Rewrite localhost/127.0.0.1 URLs to use the real GPF server
 const imageUrls: string[] = Array.isArray(capturesData?.captures)
 ? capturesData.captures
 .filter((u: any) => typeof u === 'string' && u.length > 0)
 .map((u: string) => {
 if (u.includes('127.0.0.1') || u.match(/^https?:\/\/localhost/i)) {
 const parsed = new URL(u);
 return `${baseUrl}${parsed.pathname}${parsed.search}`;
 }
 if (u.startsWith('/')) {
 return `${baseUrl}${u}`;
 }
 return u;
 })
 : [];

 const rawComments: string[] = Array.isArray(capturesData?.comments)
 ? capturesData.comments.filter((c: any) => typeof c === 'string')
 : [];

 // transactions → { transactions: [{ date, commerce_name, amount }] }
 const transactions: TransactionItem[] = Array.isArray(transactionsData?.transactions)
 ? transactionsData.transactions
 : [];

 // comments → { comments: [{ date, comment, agent }] }
 const comments: CommentItem[] = Array.isArray(commentsData?.comments)
 ? commentsData.comments
 : [];

 // otp-validations → { otpValidations: [{ date, agent, resultado }] }
 const otpValidations: OtpItem[] = Array.isArray(otpData?.otpValidations)
 ? otpData.otpValidations
 : [];

 // attention object is not returned by these endpoints directly —
 // it must be found from the attentions list. We pass it in normalizeMetadata.
 // We use a placeholder here; the caller should pass the full attention object.
 const metadata = this.normalizeMetadata({}, attentionId);

 logger.info(' GPF attention data fetched', {
 attentionId: id,
 imageUrls: imageUrls.length,
 transactions: transactions.length,
 comments: comments.length,
 rawComments: rawComments.length,
 otpValidations: otpValidations.length
 });

 return {
 attention: {},
 imageUrls,
 rawComments,
 transactions,
 comments,
 otpValidations,
 metadata
 };
 }

 /** Build AuditInput from a GPF attention object (fields use Spanish display names). */
 normalizeMetadata(attention: any, attentionId: string | number): AuditInput {
 const a = attention || {};

 return {
 executiveName:
 a['Agente'] || a.executive_name || a.agent_name || String(attentionId),
 executiveId: String(
 a['id_atencion'] || a.executive_id || attentionId
 ),
 callType:
 a['Calificación'] || a['Sub-calificación'] || 'GPF',
 calificacion: a['Calificación'] || undefined,
 subCalificacion: a['Sub-calificación'] || undefined,
 clientId: String(
 a['Socio'] || a['Caso'] || a.client_id || ''
 ),
 callDate:
 a['Fecha de la atención'] || a['Fecha de la llamada'] || a['Fecha'] || a['Fecha de la compra'] || a.call_date || new Date().toISOString().split('T')[0],
 callDuration: null,
 audioPath: 'gpf-sourced',
 imagePaths: []
 };
 }

 /** Obtiene la URL segura de descarga del audio de una atención (caduca en 5 minutos). */
 async fetchAudioUrl(env: string, attentionId: string | number, token: string): Promise<string | null> {
 const baseUrl = this.getBaseUrl(env);
 if (!baseUrl) return null;
 const url = `${baseUrl}/api/quality-control/v1/download-audio-file`;
 const headers = this.buildHeaders(token);
 try {
 const response = await gpfFetch(url, {
 method: 'POST',
 headers,
 body: JSON.stringify({ attention_id: Number(attentionId) })
 });
 if (!response.ok) {
 logger.warn(`GPF audio URL fetch failed ${url}: ${response.status}`);
 return null;
 }
 const body: any = await response.json();
 if (!body?.is_success) {
 logger.warn(`GPF audio URL error: ${body?.error?.message}`);
 return null;
 }
 return body.data?.secure_download_url ?? null;
 } catch (error) {
 logger.warn('Error fetching GPF audio URL:', error);
 return null;
 }
 }
}

export const gpfDataService = new GpfDataService();
