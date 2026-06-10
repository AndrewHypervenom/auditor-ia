-- Congela los criterios usados al armar el prompt del lote (fase 1) para que
-- processBatchResults (fase 2, horas después) parsee con los mismos criterios.
-- Sin esto, editar criterios entre fases descarta las calificaciones del modelo.
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE batch_items
  ADD COLUMN IF NOT EXISTS criteria_snapshot jsonb;
