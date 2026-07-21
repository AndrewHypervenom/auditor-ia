//backend/src/services/cost-calculator.service.ts

import { logger } from '../utils/logger.js';
import type { APICosts, ClaudeUsage } from '../types/index.js';

/**
 * Cálculo de costos de APIs (Claude + AssemblyAI).
 *
 * El objetivo es que el costo registrado por auditoría sea EXACTO y quede
 * desglosado por API y por paso, porque no tenemos acceso a las consolas de
 * facturación de los proveedores.
 *
 * Pasos de Claude que se tarifan por auditoría:
 *   1. Corrección de transcripción (post-ASR)
 *   2. Análisis de sentimientos (solo cuando NO lo hace AssemblyAI nativo)
 *   3. Análisis de imágenes
 *   4. Evaluación con criterios
 *
 * Precios verificados a Julio 2026. Fuentes:
 * - AssemblyAI Universal-3 Pro: https://www.assemblyai.com/pricing
 * - Claude (Anthropic): https://platform.claude.com/docs/en/pricing
 */

interface ClaudeModelPrice {
  inputPer1M: number;
  outputPer1M: number;
}

// Precios de lista por 1M de tokens (USD). La clave es un prefijo del model id.
const CLAUDE_PRICES: Record<string, ClaudeModelPrice> = {
  'claude-fable-5': { inputPer1M: 10.0, outputPer1M: 50.0 },
  'claude-opus-4-8': { inputPer1M: 5.0, outputPer1M: 25.0 },
  'claude-opus-4-7': { inputPer1M: 5.0, outputPer1M: 25.0 },
  'claude-opus-4-6': { inputPer1M: 5.0, outputPer1M: 25.0 },
  'claude-opus': { inputPer1M: 5.0, outputPer1M: 25.0 },
  'claude-sonnet-5': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-sonnet-4-6': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-haiku-4-5': { inputPer1M: 1.0, outputPer1M: 5.0 },
  'claude-haiku': { inputPer1M: 1.0, outputPer1M: 5.0 },
};

const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5';

/** Parámetros para el costo total de una auditoría. */
export interface CostCalcInput {
  /** Modelo de Claude usado (para tarifar). Por defecto CLAUDE_MODEL del entorno. */
  model?: string;
  /** Duración del audio en segundos (AssemblyAI). */
  audioDurationSeconds: number;
  /** true si AssemblyAI hizo el análisis de sentimientos nativo (add-on inglés). */
  includeNativeSentiment?: boolean;
  /** Tokens de la post-corrección de transcripción con Claude. */
  correction?: ClaudeUsage;
  /** Tokens del análisis de sentimientos con Claude (solo ES/PT). */
  sentiment?: ClaudeUsage;
  /** Análisis de imágenes con Claude. */
  images?: { count: number; inputTokens: number; outputTokens: number };
  /** Evaluación con criterios (Claude). */
  evaluation?: ClaudeUsage;
  /**
   * Aplica el descuento del 50% de la Batch API de Anthropic a los pasos que
   * realmente pasan por el batch (imágenes + evaluación). La corrección y los
   * sentimientos se calculan en tiempo real (precio completo) aun en lotes.
   */
  batchDiscountOnBatchedSteps?: boolean;
}

const ZERO_USAGE: ClaudeUsage = { inputTokens: 0, outputTokens: 0 };

class CostCalculatorService {
  // ============================================
  // PRECIOS ASSEMBLYAI — UNIVERSAL-3 PRO (Julio 2026)
  // ============================================
  private readonly ASSEMBLYAI_U3PRO_PER_HOUR = 0.21; // Universal-3 Pro base
  private readonly ASSEMBLYAI_DIARIZATION_PER_HOUR = 0.02; // Speaker labels (add-on)
  private readonly ASSEMBLYAI_SENTIMENT_PER_HOUR = 0.02; // Sentiment nativo (solo EN)
  private readonly ASSEMBLYAI_COST_PER_MINUTE =
    (this.ASSEMBLYAI_U3PRO_PER_HOUR + this.ASSEMBLYAI_DIARIZATION_PER_HOUR) / 60; // ≈ $0.00383/min

  /** Resuelve el precio del modelo por prefijo del id (con fallback seguro). */
  private priceFor(model?: string): { model: string; price: ClaudeModelPrice } {
    const id = (model || process.env.CLAUDE_MODEL || DEFAULT_CLAUDE_MODEL).toLowerCase();
    // Buscar la coincidencia de prefijo más larga (más específica).
    const key = Object.keys(CLAUDE_PRICES)
      .filter(k => id.startsWith(k))
      .sort((a, b) => b.length - a.length)[0];
    const price = key ? CLAUDE_PRICES[key] : CLAUDE_PRICES[DEFAULT_CLAUDE_MODEL];
    if (!key) {
      logger.warn('[COSTOS] Modelo Claude no reconocido en tabla de precios, usando sonnet-5', { model: id });
    }
    return { model: id, price };
  }

  private round(n: number, decimals = 4): number {
    return parseFloat(n.toFixed(decimals));
  }

  /** Costo de un paso de Claude a partir de sus tokens. */
  private claudeStepCost(
    usage: ClaudeUsage | undefined,
    price: ClaudeModelPrice,
    discount = false
  ): { inputTokens: number; outputTokens: number; cost: number } {
    const u = usage ?? ZERO_USAGE;
    const factor = discount ? 0.5 : 1;
    const inputCost = (u.inputTokens / 1_000_000) * price.inputPer1M * factor;
    const outputCost = (u.outputTokens / 1_000_000) * price.outputPer1M * factor;
    return {
      inputTokens: u.inputTokens,
      outputTokens: u.outputTokens,
      cost: this.round(inputCost + outputCost),
    };
  }

  /**
   * Calcular costo de transcripción de AssemblyAI.
   */
  calculateAssemblyAICost(audioDurationSeconds: number, includeNativeSentiment = false): {
    audioDurationMinutes: number;
    costPerMinute: number;
    totalCost: number;
  } {
    const durationMinutes = audioDurationSeconds / 60;
    const costPerMinute = this.ASSEMBLYAI_COST_PER_MINUTE +
      (includeNativeSentiment ? this.ASSEMBLYAI_SENTIMENT_PER_HOUR / 60 : 0);
    const totalCost = durationMinutes * costPerMinute;

    return {
      audioDurationMinutes: this.round(durationMinutes, 2),
      costPerMinute: this.round(costPerMinute, 6),
      totalCost: this.round(totalCost),
    };
  }

  /**
   * Calcular costo total de una auditoría completa, desglosado por API y por paso.
   */
  calculateTotalCost(input: CostCalcInput): APICosts {
    const { model, price } = this.priceFor(input.model);
    const discount = !!input.batchDiscountOnBatchedSteps;

    const assemblyai = this.calculateAssemblyAICost(
      input.audioDurationSeconds || 0,
      !!input.includeNativeSentiment
    );

    // Corrección y sentimientos son en tiempo real (sin descuento de batch).
    const correction = this.claudeStepCost(input.correction, price, false);
    const sentiment = this.claudeStepCost(input.sentiment, price, false);
    // Imágenes y evaluación sí pasan por el batch cuando aplica.
    const imagesUsage: ClaudeUsage = {
      inputTokens: input.images?.inputTokens ?? 0,
      outputTokens: input.images?.outputTokens ?? 0,
    };
    const imagesStep = this.claudeStepCost(imagesUsage, price, discount);
    const images = { count: input.images?.count ?? 0, ...imagesStep };
    const evaluation = this.claudeStepCost(input.evaluation, price, discount);

    const claudeTotal = this.round(
      correction.cost + sentiment.cost + images.cost + evaluation.cost
    );
    const totalCost = this.round(assemblyai.totalCost + claudeTotal);

    const claude = {
      model,
      correction,
      sentiment,
      images,
      evaluation,
      totalCost: claudeTotal,
    };

    const costs: APICosts = {
      assemblyai,
      claude,
      // Alias histórico: el resto del código y la BD siguen usando "openai".
      openai: {
        images,
        evaluation,
        totalCost: claudeTotal,
      },
      totalCost,
      total: totalCost,
      currency: 'USD',
    };

    logger.success('[COSTOS] Costo total de auditoría', {
      modelo: model,
      assemblyai: `$${assemblyai.totalCost.toFixed(4)}`,
      claude: `$${claudeTotal.toFixed(4)}`,
      total: `$${totalCost.toFixed(4)}`,
      batch: discount,
    });

    return costs;
  }

  /**
   * Formatear costos para mostrar en logs.
   */
  formatCostSummary(costs: APICosts): string {
    const c = costs.claude;
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 RESUMEN DE COSTOS (${c.model})
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

 AssemblyAI (Transcripción):
 • Duración: ${costs.assemblyai.audioDurationMinutes} min
 • Costo:   $${costs.assemblyai.totalCost.toFixed(4)}

 Claude:
 • Corrección transcripción: $${c.correction.cost.toFixed(4)}
 • Sentimientos:             $${c.sentiment.cost.toFixed(4)}
 • Análisis de imágenes:     $${c.images.cost.toFixed(4)}
 • Evaluación:               $${c.evaluation.cost.toFixed(4)}
 • Subtotal Claude:          $${c.totalCost.toFixed(4)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 COSTO TOTAL: $${costs.totalCost.toFixed(4)} USD
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
}

// Exportar singleton
let instance: CostCalculatorService | null = null;

export const getCostCalculatorService = () => {
  if (!instance) {
    instance = new CostCalculatorService();
  }
  return instance;
};

export const costCalculatorService = getCostCalculatorService();

export { CostCalculatorService };
