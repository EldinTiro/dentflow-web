import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  className?: string;
}

/** The search box of the list pages, on the right of their filters (user request 2026-11-12). */
export function SearchInput({ value, onChange, label, placeholder, className = 'w-56 sm:w-64' }: Props) {
  const { t } = useTranslation('common');
  return (
    <div className={`relative ml-auto ${className}`}>
      <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400" aria-hidden />
      <input
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-full rounded-lg border border-control bg-white pl-8 pr-8 text-sm text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      {value && (
        <button
          type="button"
          aria-label={t('button.clearSearch')}
          onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
