// backend/src/services/data-providers/IDataProvider.ts
// Contrato común para integraciones de datos de llamadas.
// Cada empresa puede tener su propio proveedor (GPF, CSV, API, etc.).

import type { AuditInput } from '../../types/index.js';

export interface AttentionSearchParams {
  executiveId?: string;
  attentionId?: string;
  dateFrom?: string;
  dateTo?: string;
  env?: string;
}

export interface AttentionListItem {
  id: string;
  executiveName: string;
  executiveId: string;
  callDate: string;
  callType?: string;
  clientId?: string;
  metadata?: Record<string, unknown>;
}

export interface AttentionFullData {
  attention: any;
  imageUrls: string[];
  rawComments: string[];
  transactions: Array<{ date: string; commerce_name: string; amount: string }>;
  comments: Array<{ date: string; comment: string; agent: string }>;
  otpValidations: Array<{ date: string; agent: string; resultado: boolean }>;
  metadata: AuditInput;
}

export interface IDataProvider {
  /**
   * Buscar atenciones/llamadas según parámetros.
   * Retorna lista vacía si el proveedor no soporta búsqueda (modo manual).
   */
  searchAttentions(params: AttentionSearchParams): Promise<AttentionListItem[]>;

  /**
   * Obtener todos los datos de una atención específica.
   */
  getAttentionFullData(attentionId: string, env?: string): Promise<AttentionFullData>;

  /**
   * Indica si este proveedor soporta importar datos externos.
   * false = modo manual (el usuario ingresa los datos en el formulario).
   */
  readonly supportsExternalData: boolean;
}
