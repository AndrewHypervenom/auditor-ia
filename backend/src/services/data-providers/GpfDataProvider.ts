// backend/src/services/data-providers/GpfDataProvider.ts
// Implementación del IDataProvider que delega al servicio GPF existente.
// Las credenciales vienen de companies.integration_config o de .env (retrocompatibilidad).

import type { IDataProvider, AttentionSearchParams, AttentionListItem, AttentionFullData } from './IDataProvider.js';
import { gpfDataService } from '../gpf-data.service.js';
import { gpfTokenService } from '../gpf-token.service.js';

export class GpfDataProvider implements IDataProvider {
  readonly supportsExternalData = true;

  async searchAttentions(params: AttentionSearchParams): Promise<AttentionListItem[]> {
    const env = params.env ?? 'test';
    try {
      const token = await gpfTokenService.getToken(env);
      const raw = await gpfDataService.getAttentions(env, token, params.dateFrom, params.dateTo);
      // Mapear al formato común
      return (raw || []).map((a: any) => ({
        id: String(a['id_atencion'] ?? a.id ?? ''),
        executiveName: a['Agente'] ?? '',
        executiveId: a['id_agente'] ?? '',
        callDate: a['Fecha de la compra'] ?? a['call_date'] ?? '',
        callType: a['Calificación'] ?? '',
        clientId: a['Socio'] ?? '',
        metadata: a,
      }));
    } catch (err: any) {
      console.warn('[GpfDataProvider] searchAttentions error:', err?.message);
      return [];
    }
  }

  async getAttentionFullData(attentionId: string, env = 'test'): Promise<AttentionFullData> {
    const token = await gpfTokenService.getToken(env);
    return gpfDataService.fetchAttentionData(env, attentionId, token);
  }
}

export const gpfDataProvider = new GpfDataProvider();
