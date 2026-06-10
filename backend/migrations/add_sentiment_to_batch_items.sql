-- Agrega columnas de sentimientos a batch_items para el flujo de lote nocturno.
-- Ejecutar en el SQL Editor de Supabase.
-- Las utterances no sobreviven entre la fase de transcripción y la de resultados,
-- por eso el sentimiento se calcula en la fase 1 y se persiste aquí.

ALTER TABLE batch_items
  ADD COLUMN IF NOT EXISTS sentiment_results jsonb,
  ADD COLUMN IF NOT EXISTS sentiment_summary jsonb;
