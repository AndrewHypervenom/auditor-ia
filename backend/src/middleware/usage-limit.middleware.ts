// backend/src/middleware/usage-limit.middleware.ts
// Bloquea requests de auditoría cuando la empresa supera sus límites mensuales.
// Solo aplica a endpoints que consumen APIs externas (transcripción, imagen, evaluación).

import { Request, Response, NextFunction } from 'express';
import { databaseService } from '../services/database.service.js';
import { logger } from '../utils/logger.js';

export const checkUsageLimits = async (req: Request, res: Response, next: NextFunction) => {
  // admin (company_id null) no tiene límites
  const companyId = req.user?.company_id;
  if (!companyId) return next();

  try {
    const company = await databaseService.getCompany(companyId);
    const limits = company?.usage_limits ?? {};

    // Sin límites configurados — dejar pasar
    if (!limits.monthly_cost_usd && !limits.monthly_audits && !limits.monthly_tokens) {
      return next();
    }

    const usage = await databaseService.getCompanyMonthlyUsage(companyId);

    if (limits.monthly_cost_usd && usage.total_cost_usd >= Number(limits.monthly_cost_usd)) {
      logger.warn('Usage limit exceeded (cost)', { companyId, current: usage.total_cost_usd, limit: limits.monthly_cost_usd });
      return res.status(429).json({ error: 'USAGE_LIMIT_EXCEEDED', type: 'cost' });
    }

    if (limits.monthly_audits && usage.total_audits >= Number(limits.monthly_audits)) {
      logger.warn('Usage limit exceeded (audits)', { companyId, current: usage.total_audits, limit: limits.monthly_audits });
      return res.status(429).json({ error: 'USAGE_LIMIT_EXCEEDED', type: 'audits' });
    }

    if (limits.monthly_tokens && usage.total_openai_tokens >= Number(limits.monthly_tokens)) {
      logger.warn('Usage limit exceeded (tokens)', { companyId, current: usage.total_openai_tokens, limit: limits.monthly_tokens });
      return res.status(429).json({ error: 'USAGE_LIMIT_EXCEEDED', type: 'tokens' });
    }

    next();
  } catch (err: any) {
    // Si falla la verificación de límites, dejar pasar (no bloquear por error)
    logger.warn('Usage limit check failed, allowing request', { companyId, error: err?.message });
    next();
  }
};
