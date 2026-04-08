// frontend/src/pages/AiAnalysisPage.tsx
// Nueva pestaña que muestra el análisis de calidad IA en tiempo real (streaming)

import { useState, useEffect, useRef } from 'react';
import { Sparkles, Copy, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { aiAnalysisService } from '../services/api';

export default function AiAnalysisPage() {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<'connecting' | 'transcribing' | 'generating' | 'done' | 'error'>('connecting');
  const [errorMsg, setErrorMsg] = useState('');
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session');

    if (!sessionId) {
      setStatus('error');
      setErrorMsg('No se encontró el ID de sesión. Regresa y vuelve a hacer clic en "Confirmar y Auditar".');
      return;
    }

    const url = aiAnalysisService.getStreamUrl(sessionId);
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'status') {
          if (msg.message?.includes('audio') || msg.message?.includes('transcript')) {
            setStatus('transcribing');
          } else {
            setStatus('generating');
          }
        }

        if (msg.type === 'chunk') {
          setText(prev => prev + msg.text);
          setStatus('generating');
        }

        if (msg.type === 'done') {
          setStatus('done');
          es.close();
        }

        if (msg.type === 'error') {
          setStatus('error');
          setErrorMsg(msg.message || 'Error generando el análisis.');
          es.close();
        }
      } catch {
        // ignorar errores de parseo
      }
    };

    es.onerror = () => {
      if (status !== 'done') {
        setStatus('error');
        setErrorMsg('Se perdió la conexión con el servidor. El análisis puede estar incompleto.');
      }
      es.close();
    };

    return () => {
      es.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-scroll al final mientras va llegando texto
  useEffect(() => {
    if (text && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [text]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignorar
    }
  };

  const statusLabel: Record<string, string> = {
    connecting: 'Conectando...',
    transcribing: 'Obteniendo transcripción del audio...',
    generating: 'Generando análisis con IA...',
    done: 'Análisis completado',
    error: 'Error',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-600/20 border border-purple-500/30">
              <Sparkles className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Análisis de Calidad IA
              </h1>
              <p className="text-xs text-slate-500">Bradescard — Auditoría automática</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Indicador de estado */}
            <div className="flex items-center gap-2 text-sm">
              {status === 'done' ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  {statusLabel.done}
                </span>
              ) : status === 'error' ? (
                <span className="flex items-center gap-1.5 text-red-400">
                  <AlertTriangle className="w-4 h-4" />
                  {statusLabel.error}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-purple-300">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {statusLabel[status]}
                </span>
              )}
            </div>

            {/* Botón copiar */}
            {text && status === 'done' && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="text-emerald-400">Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-slate-400" />
                    <span className="text-slate-300">Copiar</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {status === 'error' ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 rounded-full bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-10 h-10 text-red-400" />
            </div>
            <p className="text-red-400 text-center max-w-md">{errorMsg}</p>
          </div>
        ) : status === 'connecting' ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/30">
              <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            </div>
            <p className="text-slate-400">Conectando con el servidor...</p>
          </div>
        ) : !text && (status === 'transcribing' || status === 'generating') ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="p-4 rounded-full bg-purple-500/10 border border-purple-500/30 animate-pulse">
              <Sparkles className="w-10 h-10 text-purple-400" />
            </div>
            <p className="text-slate-400">{statusLabel[status]}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Bloque de texto del análisis */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6 shadow-2xl">
              <pre
                className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-slate-200"
                style={{ fontFamily: 'inherit' }}
              >
                {text}
                {/* Cursor parpadeante mientras genera */}
                {status === 'generating' && (
                  <span className="inline-block w-2 h-4 bg-purple-400 ml-0.5 animate-pulse align-middle" />
                )}
              </pre>
            </div>

            <div ref={bottomRef} />
          </div>
        )}
      </main>
    </div>
  );
}
