import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';

const LANGUAGES = [
  { code: 'es', label: 'ES' },
  { code: 'pt', label: 'PT' },
] as const;

export default function LanguageSelector() {
  const { i18n } = useTranslation();
  const current = i18n.language?.slice(0, 2) ?? 'es';

  return (
    <div className="flex items-center gap-1">
      <Globe className="w-3.5 h-3.5 text-slate-500" />
      {LANGUAGES.map((lang) => (
        <button
          key={lang.code}
          onClick={() => i18n.changeLanguage(lang.code)}
          className={`text-xs px-1.5 py-0.5 rounded transition-colors ${
            current === lang.code
              ? 'text-brand-400 font-semibold'
              : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          {lang.label}
        </button>
      ))}
    </div>
  );
}
