// backend/src/services/gpf-config.service.ts
//
// Resuelve las credenciales GPF efectivas en tiempo de ejecución.
// GPF pertenece a la empresa PositivoS+: las credenciales se toman de su
// companies.integration_config, con fallback campo por campo a las variables
// de entorno (.env) para retrocompatibilidad. Cacheado con TTL corto.

import { logger } from '../utils/logger.js';
import { databaseService } from './database.service.js';

export interface GpfCredentials {
  apiUrlProd: string;
  apiUrlTest: string;
  appToken: string;
  email: string;
  password: string;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min

class GpfConfigService {
  private cached: GpfCredentials | null = null;
  private cachedAt = 0;

  private fromEnv(): GpfCredentials {
    return {
      apiUrlProd: process.env.GPF_API_URL_PROD || '',
      apiUrlTest: process.env.GPF_API_URL_TEST || '',
      appToken: process.env.GPF_APP_TOKEN || '',
      email: process.env.GPF_EMAIL || '',
      password: process.env.GPF_PASSWORD || '',
    };
  }

  /**
   * Devuelve las credenciales efectivas: integration_config de PositivoS+ con
   * prioridad y fallback a .env por cada campo ausente. Nunca lanza: ante un
   * error de resolución, retorna las de entorno.
   */
  async getCredentials(): Promise<GpfCredentials> {
    if (this.cached && Date.now() - this.cachedAt < CACHE_TTL_MS) {
      return this.cached;
    }
    const env = this.fromEnv();
    let resolved = env;
    try {
      const companyId = await databaseService.getPositivosCompanyId();
      if (companyId) {
        const company = await databaseService.getCompany(companyId);
        const cfg = (company?.integration_config ?? {}) as Record<string, any>;
        resolved = {
          apiUrlProd: (cfg.api_url_prod as string) || env.apiUrlProd,
          apiUrlTest: (cfg.api_url_test as string) || env.apiUrlTest,
          appToken: (cfg.app_token as string) || env.appToken,
          email: (cfg.email as string) || env.email,
          password: (cfg.password as string) || env.password,
        };
      }
    } catch (error: any) {
      logger.warn('No se pudo resolver integration_config de PositivoS+; usando .env', {
        error: error?.message,
      });
      resolved = env;
    }
    this.cached = resolved;
    this.cachedAt = Date.now();
    return resolved;
  }

  /** Invalida el cache. Llamar tras actualizar la integración de PositivoS+. */
  invalidate(): void {
    this.cached = null;
    this.cachedAt = 0;
    logger.info(' GPF credentials cache invalidated');
  }
}

export const gpfConfigService = new GpfConfigService();
