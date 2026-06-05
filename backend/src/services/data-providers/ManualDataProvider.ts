// backend/src/services/data-providers/ManualDataProvider.ts
// Proveedor sin integración externa. Los datos se ingresan manualmente en el formulario.

import type { IDataProvider, AttentionSearchParams, AttentionListItem, AttentionFullData } from './IDataProvider.js';

export class ManualDataProvider implements IDataProvider {
  readonly supportsExternalData = false;

  async searchAttentions(_params: AttentionSearchParams): Promise<AttentionListItem[]> {
    return [];
  }

  async getAttentionFullData(_attentionId: string, _env?: string): Promise<AttentionFullData> {
    throw new Error('ManualDataProvider does not support external data fetch');
  }
}

export const manualDataProvider = new ManualDataProvider();
