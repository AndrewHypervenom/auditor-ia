-- Permite dejar un guion (script) por defecto para todas las subcalificaciones
-- de una calificación y, opcionalmente, sobrescribir las frases (`lines`) para
-- subcalificaciones puntuales. Mismo patrón que `tipo_cierre_overrides` en criterios.
--
-- Forma del JSON:
--   { "<SUBCALIFICACION>": { "lines": ["...", "..."] }, ... }
--
-- Ejecutar en el SQL Editor de Supabase.

ALTER TABLE call_scripts
  ADD COLUMN IF NOT EXISTS tipo_cierre_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;
