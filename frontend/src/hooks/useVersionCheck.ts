import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'app_version';
const POLL_INTERVAL = 5 * 60 * 1000;

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch('/version.json?t=' + Date.now());
    if (!res.ok) return null;
    const data = await res.json();
    return data.version ?? null;
  } catch {
    return null;
  }
}

export function useVersionCheck() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const pendingVersion = useRef<string | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let cancelled = false;

    const check = async () => {
      const latest = await fetchVersion();
      if (cancelled || !latest || latest === 'dev') return;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored !== latest) {
        // No recargamos solos: la auditoría abierta se perdería.
        // Avisamos y dejamos que el usuario actualice cuando pueda.
        pendingVersion.current = latest;
        setUpdateAvailable(true);
      } else if (!stored) {
        localStorage.setItem(STORAGE_KEY, latest);
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const applyUpdate = useCallback(() => {
    if (pendingVersion.current) {
      localStorage.setItem(STORAGE_KEY, pendingVersion.current);
    }
    window.location.reload();
  }, []);

  return { updateAvailable, applyUpdate };
}
