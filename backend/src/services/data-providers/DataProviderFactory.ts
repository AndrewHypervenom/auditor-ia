// backend/src/services/data-providers/DataProviderFactory.ts
// Selecciona el proveedor correcto según el tipo de integración de la empresa.

import type { IDataProvider } from './IDataProvider.js';
import { GpfDataProvider } from './GpfDataProvider.js';
import { ManualDataProvider, manualDataProvider } from './ManualDataProvider.js';

export function createDataProvider(company: {
  integration_type: string;
  integration_config?: Record<string, unknown>;
}): IDataProvider {
  switch (company.integration_type) {
    case 'gpf':
      return new GpfDataProvider();
    case 'manual':
    case 'csv':
    case 'api_webhook':
    default:
      return manualDataProvider;
  }
}
