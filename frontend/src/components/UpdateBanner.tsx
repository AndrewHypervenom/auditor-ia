// frontend/src/components/UpdateBanner.tsx

import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence, EASE } from '../lib/motion';

interface UpdateBannerProps {
  visible: boolean;
  onUpdate: () => void;
}

export default function UpdateBanner({ visible, onUpdate }: UpdateBannerProps) {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);

  const show = visible && !dismissed;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-4 shadow-2xl"
        >
          <button
            onClick={() => setDismissed(true)}
            className="absolute right-2 top-2 rounded-md p-1 text-slate-500 transition-colors hover:text-slate-300"
            aria-label={t('common.close')}
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-3 pr-4">
            <div className="mt-0.5 rounded-lg bg-blue-500/10 p-2 text-blue-400">
              <RefreshCw className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {t('appUpdate.title')}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                {t('appUpdate.description')}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setUpdating(true);
              onUpdate();
            }}
            disabled={updating}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${updating ? 'animate-spin' : ''}`} />
            {updating ? t('appUpdate.updating') : t('appUpdate.button')}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
