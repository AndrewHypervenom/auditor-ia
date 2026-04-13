// frontend/src/hooks/useCallTypesConfig.ts

import { useState, useEffect } from 'react';
import { callTypesConfigService, type CallTypeConfig } from '../services/api';

interface UseCallTypesConfigResult {
  callTypes: CallTypeConfig[];
  callTypeNames: string[];
  modes: string[];
  loading: boolean;
  error: string | null;
}

let cache: CallTypeConfig[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useCallTypesConfig(): UseCallTypesConfigResult {
  const [callTypes, setCallTypes] = useState<CallTypeConfig[]>(cache ?? []);
  const [loading, setLoading] = useState(cache === null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const now = Date.now();
    if (cache && now - cacheTime < CACHE_TTL) {
      setCallTypes(cache);
      setLoading(false);
      return;
    }

    setLoading(true);
    callTypesConfigService.getActive()
      .then((data) => {
        cache = data;
        cacheTime = Date.now();
        setCallTypes(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message ?? 'Error al cargar tipos de llamada');
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCallTypes = callTypes.filter((ct) => ct.is_active !== false);

  // Todos los nombres únicos de tipos (ej: ['FRAUDE', 'TH CONFIRMA'])
  const callTypeNames = activeCallTypes.map((ct) => ct.name);

  // Todos los modos únicos a través de todos los tipos (ej: ['INBOUND', 'MONITOREO'])
  const modes = [...new Set(activeCallTypes.flatMap((ct) => ct.modes ?? []))];

  return { callTypes: activeCallTypes, callTypeNames, modes, loading, error };
}
