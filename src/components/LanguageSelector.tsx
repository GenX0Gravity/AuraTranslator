'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check } from 'lucide-react';
import { LANGUAGES } from '@/utils/languages';

interface LanguageSelectorProps {
  selectedLanguage: string;
  onSelectLanguage: (code: string) => void;
  label: string;
  excludeLanguage?: string;
  isSource?: boolean;
}

export default function LanguageSelector({
  selectedLanguage,
  onSelectLanguage,
  label,
  excludeLanguage,
  isSource = false,
}: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (code: string) => {
    onSelectLanguage(code);
    setIsOpen(false);
    setSearchQuery('');
  };

  const filteredLanguages = LANGUAGES.filter((lang) => {
    if (lang.code === excludeLanguage) return false;
    const query = searchQuery.toLowerCase();
    return (
      lang.name.toLowerCase().includes(query) ||
      lang.nativeName.toLowerCase().includes(query) ||
      lang.code.toLowerCase().includes(query) ||
      lang.family.toLowerCase().includes(query)
    );
  });

  const currentLang = LANGUAGES.find((l) => l.code === selectedLanguage);

  return (
    <div className="relative w-full md:w-64" ref={dropdownRef}>
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1.5 px-1">
        {label}
      </label>
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 bg-white/70 dark:bg-slate-800/70 border border-slate-200/60 dark:border-slate-700/60 rounded-xl text-left font-medium text-slate-800 dark:text-slate-200 shadow-sm backdrop-blur-md hover:border-blue-500/50 dark:hover:border-blue-400/50 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="flex items-center gap-2 truncate">
          {currentLang ? (
            <>
              <span className="text-xl leading-none">{currentLang.flag}</span>
              <span className="truncate">{currentLang.name}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500 font-normal truncate">
                ({currentLang.nativeName})
              </span>
            </>
          ) : isSource && selectedLanguage === 'auto' ? (
            <>
              <span className="text-xl leading-none">🌐</span>
              <span>Detect Language</span>
            </>
          ) : (
            <span className="text-slate-400">Select language</span>
          )}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white/95 dark:bg-slate-900/95 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-xl backdrop-blur-lg overflow-hidden animate-in fade-in-50 slide-in-from-top-3 duration-200">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800/80 flex items-center gap-2">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-500 ml-2 shrink-0" />
            <input
              type="text"
              placeholder="Search language..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent border-0 py-1.5 px-2 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-0"
              autoFocus
            />
          </div>

          <ul
            className="max-h-60 overflow-y-auto py-1 text-sm scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800"
            role="listbox"
          >
            {isSource && (
              <li
                onClick={() => handleSelect('auto')}
                className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                  selectedLanguage === 'auto'
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                }`}
                role="option"
                aria-selected={selectedLanguage === 'auto'}
              >
                <span className="flex items-center gap-2">
                  <span className="text-xl">🌐</span>
                  <span>Detect Language</span>
                </span>
                {selectedLanguage === 'auto' && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
              </li>
            )}

            {filteredLanguages.length === 0 ? (
              <li className="px-4 py-3 text-xs text-center text-slate-400 dark:text-slate-500">
                No languages found
              </li>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected = selectedLanguage === lang.code;
                return (
                  <li
                    key={lang.code}
                    onClick={() => handleSelect(lang.code)}
                    className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                    }`}
                    role="option"
                    aria-selected={isSelected}
                  >
                    <span className="flex items-center gap-2 truncate max-w-[70%]">
                      <span className="text-xl shrink-0">{lang.flag}</span>
                      <span className="truncate">{lang.name}</span>
                      <span className="text-xs text-slate-400 dark:text-slate-500 font-normal truncate">
                        ({lang.nativeName})
                      </span>
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-850 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded truncate max-w-[100px]" title={lang.family}>
                        {lang.family.split(' / ').pop()}
                      </span>
                      {isSelected && <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
