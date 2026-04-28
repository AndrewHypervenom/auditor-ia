import { useEffect } from 'react';
import toast from 'react-hot-toast';

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
  useEffect(() => {
    if (!import.meta.env.PROD) return;

    const check = async () => {
      const latest = await fetchVersion();
      if (!latest || latest === 'dev') return;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && stored !== latest) {
        localStorage.setItem(STORAGE_KEY, latest);
        toast('Nueva versión disponible, actualizando...', { duration: 2000 });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        localStorage.setItem(STORAGE_KEY, latest);
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);
}
