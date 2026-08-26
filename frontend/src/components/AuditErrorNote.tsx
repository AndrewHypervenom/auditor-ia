import { AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/**
 * Motivo por el que fallo una auditoria (columna `error_message`).
 * Se muestra igual en todas las vistas que listan auditorias.
 *
 * `compact` = una sola linea con elipsis (para filas de tabla).
 */
export default function AuditErrorNote({
  message,
  compact = false,
  className = '',
}: {
  message?: string | null;
  compact?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const text = (message ?? '').trim() || t('auditError.unknown');

  if (compact) {
    return (
      <p
        className={`text-[11px] text-red-400/90 truncate max-w-[220px] ${className}`}
        title={`${t('auditError.reason')}: ${text}`}
      >
        {text}
      </p>
    );
  }

  return (
    <div
      className={`flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2 ${className}`}
    >
      <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-red-400" />
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-red-400/70">
          {t('auditError.reason')}
        </p>
        <p className="text-[11px] text-red-300/90 break-words whitespace-pre-wrap" title={text}>
          {text}
        </p>
      </div>
    </div>
  );
}
