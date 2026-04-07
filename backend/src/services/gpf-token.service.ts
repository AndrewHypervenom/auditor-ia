// backend/src/services/gpf-token.service.ts
// Manages GPF bearer token with in-memory cache.
// API response shape: { data: { token: "...", user: {...} }, error: null, is_success: true, status: 200 }

import { logger } from '../utils/logger.js';
import { gpfFetch, normalizeGpfUrl } from '../utils/gpf-fetch.js';

interface TokenCache {
 token: string;
 expiresAt: number;
 sessionCookie: string; // Cookie de sesión Laravel para secure-download
}

const BUFFER_MS = 10 * 60 * 1000; // 10 min buffer
const TOKEN_TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 days (per API docs)

class GpfTokenService {
 private cache: Map<string, TokenCache> = new Map();

 private getBaseUrl(env: string): string {
 const raw = env === 'prod'
  ? (process.env.GPF_API_URL_PROD || '')
  : (process.env.GPF_API_URL_TEST || '');
 return normalizeGpfUrl(raw);
 }

 private buildHeaders(): Record<string, string> {
 return {
 'Accept': 'application/json',
 'Content-Type': 'application/json',
 'X-App-Token': process.env.GPF_APP_TOKEN || '',
 'ngrok-skip-browser-warning': 'true'
 };
 }

 private async login(env: string): Promise<{ token: string; sessionCookie: string }> {
 const baseUrl = this.getBaseUrl(env);
 if (!baseUrl) throw new Error(`GPF URL not configured for env: ${env}`);

 const email = process.env.GPF_EMAIL || '';
 const password = process.env.GPF_PASSWORD || '';

 if (!email || !password) {
 throw new Error('GPF_EMAIL and GPF_PASSWORD must be configured');
 }

 logger.info(' GPF auto-login', { env });

 const response = await gpfFetch(`${baseUrl}/api/login`, {
 method: 'POST',
 headers: this.buildHeaders(),
 body: JSON.stringify({ email, password })
 });

 if (!response.ok) {
 const text = await response.text();
 throw new Error(`GPF login failed: ${response.status} — ${text}`);
 }

 // API shape: { data: { token: "...", user: {...} }, is_success: true, ... }
 const body: any = await response.json();

 if (!body?.is_success) {
 throw new Error(`GPF login error: ${body?.error?.message || 'unknown'}`);
 }

 const token = body?.data?.token;
 if (!token) {
 throw new Error(`GPF login response did not contain data.token: ${JSON.stringify(body)}`);
 }

 // Capturar cookie de sesión Laravel (necesaria para /secure-download/)
 const sessionCookie = response.cookies
 .map(c => c.split(';')[0]) // solo nombre=valor, sin Path/HttpOnly/etc.
 .join('; ');

 if (sessionCookie) {
 logger.info(' GPF session cookie capturada', { env, length: sessionCookie.length });
 } else {
 logger.warn(' GPF login no devolvió Set-Cookie — secure-download puede fallar', { env });
 }

 return { token: token as string, sessionCookie };
 }

 async getToken(env: string): Promise<string> {
 const cached = this.cache.get(env);
 if (cached && Date.now() < cached.expiresAt) {
 return cached.token;
 }

 const { token, sessionCookie } = await this.login(env);
 this.cache.set(env, {
 token,
 sessionCookie,
 expiresAt: Date.now() + TOKEN_TTL_MS - BUFFER_MS
 });

 logger.success(' GPF token obtained and cached', { env });
 return token;
 }

 /** Devuelve la cookie de sesión de Laravel guardada al hacer login. */
 getSessionCookie(env: string): string {
 return this.cache.get(env)?.sessionCookie ?? '';
 }

 invalidate(env: string): void {
 this.cache.delete(env);
 logger.info(' GPF token cache invalidated', { env });
 }

 /** Returns a valid token, retrying once after cache invalidation on failure. */
 async getTokenWithRetry(env: string): Promise<string> {
 try {
 return await this.getToken(env);
 } catch {
 this.invalidate(env);
 return await this.getToken(env);
 }
 }
}

export const gpfTokenService = new GpfTokenService();
