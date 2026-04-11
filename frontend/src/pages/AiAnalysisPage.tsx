// frontend/src/pages/AiAnalysisPage.tsx
// Vista de referencia del caso GPF — se abre en nueva pestaña al confirmar auditoría.
// Muestra la misma información que la vista "confirming" de NewAuditPage, solo lectura.
// El procesamiento real (audio, imágenes, Excel) ocurre en la pestaña original.

import { useState, useEffect, useRef } from 'react';
import {
  Database,
  Image,
  CreditCard,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

interface AttentionDetail {
  imageUrls: string[];
  rawComments: string[];
  transactions: { date: string; commerce_name: string; amount: string }[];
  comments: { date: string; comment: string; agent: string }[];
  otpValidations: { date: string; agent: string; resultado: boolean }[];
}

interface CaseSnapshot {
  attention: Record<string, any>;
  attentionDetail: AttentionDetail;
  excelType: string;
  callType: string;
}

export default function AiAnalysisPage() {
  const [data, setData] = useState<CaseSnapshot | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'info' | 'captures' | 'transactions' | 'comments' | 'otp'>('info');

  // Lightbox
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });

  // ── Cargar datos desde localStorage ──────────────────────────────────────
  useEffect(() => {
    const key = new URLSearchParams(window.location.search).get('key');
    if (!key) {
      setError('No se encontró la clave del caso. Regresa y vuelve a hacer clic en "Confirmar y Auditar".');
      return;
    }
    try {
      const raw = localStorage.getItem(key);
      if (!raw) {
        setError('Los datos del caso ya no están disponibles. Regresa y vuelve a hacer clic en "Confirmar y Auditar".');
        return;
      }
      setData(JSON.parse(raw));
      // Limpiar localStorage después de cargar (ya no se necesita)
      localStorage.removeItem(key);
    } catch {
      setError('Error al cargar los datos del caso.');
    }
  }, []);

  // ── Lightbox: teclado ────────────────────────────────────────────────────
  useEffect(() => {
    if (!lightboxOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightboxOpen, lightboxIndex, data]);

  const openLightbox = (idx: number) => {
    setLightboxIndex(idx);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setLightboxOpen(true);
  };
  const closeLightbox = () => { setLightboxOpen(false); setZoom(1); setPan({ x: 0, y: 0 }); };
  const nextImage = () => {
    if (!data) return;
    setLightboxIndex(i => (i + 1) % data.attentionDetail.imageUrls.length);
    setZoom(1); setPan({ x: 0, y: 0 });
  };
  const prevImage = () => {
    if (!data) return;
    setLightboxIndex(i => (i - 1 + data.attentionDetail.imageUrls.length) % data.attentionDetail.imageUrls.length);
    setZoom(1); setPan({ x: 0, y: 0 });
  };

  const onMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    dragging.current = true;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setPan(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }));
    lastPos.current = { x: e.clientX, y: e.clientY };
  };
  const onMouseUp = () => { dragging.current = false; };

  // ── Helpers para campos de la atención ───────────────────────────────────
  const att = data?.attention ?? {};
  const detail = data?.attentionDetail;

  const attentionId = att['id_atencion'] ?? att.id ?? '—';
  const executive   = att['Agente'] ?? att.executive_name ?? '—';
  const callType    = data?.callType ?? '—';
  const excelType   = data?.excelType ?? '—';

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <div className="p-4 rounded-full bg-red-500/10 border border-red-500/30">
            <AlertTriangle className="w-10 h-10 text-red-400" />
          </div>
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const tabs = [
    { key: 'info',         label: 'Información',                                                          icon: <Database className="w-3.5 h-3.5" /> },
    { key: 'captures',     label: `Capturas (${detail?.imageUrls.length ?? 0})`,                          icon: <Image className="w-3.5 h-3.5" /> },
    { key: 'transactions', label: `Transacciones (${detail?.transactions.length ?? 0})`,                  icon: <CreditCard className="w-3.5 h-3.5" /> },
    { key: 'comments',     label: `Comentarios (${detail?.comments.length ?? 0})`,                        icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { key: 'otp',          label: `OTP (${detail?.otpValidations.length ?? 0})`,                          icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  ] as const;

  return (
    <div className="min-h-screen text-slate-100">

      {/* Header */}
      <header className="bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-600/20 border border-purple-500/30">
            <Sparkles className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-200">
              Vista de referencia · Caso <span className="font-mono text-brand-400">{String(attentionId)}</span>
            </h1>
            <p className="text-xs text-slate-500">
              {executive} · {callType} · {excelType}
              <span className="ml-2 text-yellow-500/80">— La auditoría se procesa en la pestaña anterior</span>
            </p>
          </div>
        </div>
      </header>

      {/* Contenido */}
      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-800 shadow-2xl p-8">

          {/* Tabs */}
          <div className="flex gap-1 mb-4 bg-slate-800/60 rounded-xl p-1 border border-slate-700 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  activeTab === tab.key
                    ? 'bg-purple-600/80 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab: Información */}
          {activeTab === 'info' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                ['ID Caso',                   String(att['id_atencion'] ?? att.id ?? '—')],
                ['Ejecutivo / Agente',         att['Agente'] ?? '—'],
                ['Calificación',              att['Calificación'] ?? '—'],
                ['Sub-calificación',           att['Sub-calificación'] ?? '—'],
                ['Estado llamada',             att['Estado llamada'] ?? '—'],
                ['Llamada en curso',           att['Llamada en curso'] ?? '—'],
                ['Cliente / Socio',            att['Socio'] ?? '—'],
                ['Correo cliente',             att['Correo cliente'] ?? '—'],
                ['Teléfono cliente',           att['Teléfono cliente'] ?? '—'],
                ['Caso',                       att['Caso'] ?? '—'],
                ['Fecha de la compra',         att['Fecha de la compra'] ?? '—'],
                ['Comercio',                   att['Comercio'] ?? '—'],
                ['Monto de la compra',         att['Monto de la compra'] ?? '—'],
                ['4 dígitos TC',               att['4 dígitos TC'] ?? '—'],
                ['Tiene afectación',           att['Tiene afectación'] ?? '—'],
                ['Folio BI',                   att['Folio BI'] ?? '—'],
                ['Resultado dictamen',         att['Resultado dictamen'] ?? '—'],
                ['Origen validación',          att['Origen validación'] ?? '—'],
                ['Actualización de datos',     att['Actualización de datos'] ?? '—'],
                ['Estatus correo preventivo',  att['Estatus correo preventivo'] ?? '—'],
                ['Estatus SMS preventivo',     att['Estatus SMS preventivo'] ?? '—'],
                ['Re-plastificación',          att['Cliente no requiere re-plastificación'] ?? '—'],
                ['Tipo de reporte',            excelType],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-3 px-3 py-2 bg-slate-800/40 rounded-lg border border-slate-700/50">
                  <span className="text-slate-400 text-xs flex-shrink-0">{label}</span>
                  <span className="text-slate-200 font-medium text-xs text-right break-all">{value || '—'}</span>
                </div>
              ))}
            </div>
          )}

          {/* Tab: Capturas */}
          {activeTab === 'captures' && (
            <div>
              {!detail || (detail.imageUrls.length === 0 && detail.rawComments.length === 0) ? (
                <p className="text-slate-500 text-sm text-center py-8 flex flex-col items-center gap-2">
                  <Image className="w-8 h-8 opacity-30" />
                  Sin capturas ni comentarios de imagen
                </p>
              ) : (
                <div className="space-y-4">
                  {detail.imageUrls.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-3 uppercase tracking-wide">
                        Imágenes ({detail.imageUrls.length}) · <span className="normal-case text-slate-500">Clic para ampliar</span>
                      </p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {detail.imageUrls.map((url, idx) => (
                          <button
                            key={idx}
                            onClick={() => openLightbox(idx)}
                            className="block rounded-lg overflow-hidden border border-slate-700 hover:border-purple-500/60 transition-all group text-left w-full"
                          >
                            <div className="relative">
                              <img
                                src={url}
                                alt={`Captura ${idx + 1}`}
                                className="w-full h-28 object-cover group-hover:opacity-80 transition-opacity"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                  (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
                                }}
                              />
                              <div className="hidden px-2 py-3 text-xs text-brand-400 font-mono break-all bg-slate-800/80">
                                {url}
                              </div>
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
                                <Maximize2 className="w-6 h-6 text-white drop-shadow" />
                              </div>
                            </div>
                            <p className="text-xs text-slate-500 px-2 py-1 bg-slate-900 truncate" title={url}>
                              {idx + 1} · {url.split('/').pop()}
                            </p>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {detail.rawComments.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                        Comentarios de captura ({detail.rawComments.length})
                      </p>
                      <ul className="space-y-1">
                        {detail.rawComments.map((c, idx) => (
                          <li key={idx} className="px-3 py-2 bg-slate-800/60 rounded-lg border border-slate-700 text-sm text-slate-300 flex gap-2">
                            <span className="text-slate-600 font-mono text-xs mt-0.5">{idx + 1}.</span>
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tab: Transacciones */}
          {activeTab === 'transactions' && (
            <div>
              {!detail || detail.transactions.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8 flex flex-col items-center gap-2">
                  <CreditCard className="w-8 h-8 opacity-30" />
                  Sin transacciones registradas
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase">
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-4 py-2 text-left">Fecha</th>
                        <th className="px-4 py-2 text-left">Comercio</th>
                        <th className="px-4 py-2 text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.transactions.map((t, idx) => (
                        <tr key={idx} className={`border-t border-slate-700/50 ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                          <td className="px-4 py-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-2 text-slate-400 whitespace-nowrap text-xs">{t.date || '—'}</td>
                          <td className="px-4 py-2 text-slate-300 max-w-[200px] truncate" title={t.commerce_name}>{t.commerce_name || '—'}</td>
                          <td className="px-4 py-2 text-emerald-400 font-semibold text-right whitespace-nowrap">{t.amount || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 bg-slate-800/40 border-t border-slate-700 text-xs text-slate-500">
                    {detail.transactions.length} transacción{detail.transactions.length !== 1 ? 'es' : ''}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Comentarios */}
          {activeTab === 'comments' && (
            <div>
              {!detail || detail.comments.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8 flex flex-col items-center gap-2">
                  <MessageSquare className="w-8 h-8 opacity-30" />
                  Sin comentarios registrados
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase">
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-4 py-2 text-left">Fecha</th>
                        <th className="px-4 py-2 text-left">Agente</th>
                        <th className="px-4 py-2 text-left">Comentario</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.comments.map((c, idx) => (
                        <tr key={idx} className={`border-t border-slate-700/50 ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                          <td className="px-4 py-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-2 text-slate-400 whitespace-nowrap text-xs">{c.date || '—'}</td>
                          <td className="px-4 py-2 text-teal-400 whitespace-nowrap text-xs">{c.agent || '—'}</td>
                          <td className="px-4 py-2 text-slate-300">{c.comment || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 bg-slate-800/40 border-t border-slate-700 text-xs text-slate-500">
                    {detail.comments.length} comentario{detail.comments.length !== 1 ? 's' : ''}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: OTP */}
          {activeTab === 'otp' && (
            <div>
              {!detail || detail.otpValidations.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-8 flex flex-col items-center gap-2">
                  <ShieldCheck className="w-8 h-8 opacity-30" />
                  Sin validaciones OTP registradas
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-700">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-800/80 text-slate-400 text-xs uppercase">
                        <th className="px-4 py-2 text-left">#</th>
                        <th className="px-4 py-2 text-left">Fecha</th>
                        <th className="px-4 py-2 text-left">Agente</th>
                        <th className="px-4 py-2 text-left">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.otpValidations.map((v, idx) => (
                        <tr key={idx} className={`border-t border-slate-700/50 ${idx % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                          <td className="px-4 py-2 text-slate-500 font-mono text-xs">{idx + 1}</td>
                          <td className="px-4 py-2 text-slate-400 whitespace-nowrap text-xs">{v.date || '—'}</td>
                          <td className="px-4 py-2 text-teal-400 whitespace-nowrap text-xs">{v.agent || '—'}</td>
                          <td className="px-4 py-2">
                            {v.resultado === true || (v.resultado as any) === 'true' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                                <CheckCircle2 className="w-3 h-3" /> Validado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-semibold">
                                <XCircle className="w-3 h-3" /> Fallido
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="px-4 py-2 bg-slate-800/40 border-t border-slate-700 text-xs text-slate-500">
                    {detail.otpValidations.length} validación{detail.otpValidations.length !== 1 ? 'es' : ''}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Lightbox */}
      {lightboxOpen && detail && detail.imageUrls.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex flex-col"
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* Lightbox toolbar */}
          <div className="flex items-center justify-between px-4 py-3 bg-black/60 border-b border-slate-800 flex-shrink-0">
            <span className="text-slate-400 text-sm font-mono">
              {lightboxIndex + 1} / {detail.imageUrls.length}
            </span>
            <div className="flex items-center gap-2">
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.5))} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-slate-400 text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(5, z + 0.5))} className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs">
                Reset
              </button>
              <button onClick={closeLightbox} className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/50 text-slate-300 hover:text-red-400 ml-2">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Image area */}
          <div
            className="flex-1 overflow-hidden flex items-center justify-center relative"
            style={{ cursor: zoom > 1 ? 'grab' : 'default' }}
          >
            <button onClick={prevImage} className="absolute left-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <img
              src={detail.imageUrls[lightboxIndex]}
              alt={`Captura ${lightboxIndex + 1}`}
              draggable={false}
              onMouseDown={onMouseDown}
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
                transition: dragging.current ? 'none' : 'transform 0.15s ease',
                maxWidth: '100%',
                maxHeight: '100%',
                userSelect: 'none',
              }}
            />
            <button onClick={nextImage} className="absolute right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/80 text-white">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
