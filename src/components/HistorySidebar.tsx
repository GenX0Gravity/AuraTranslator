'use client';

import { X, Trash2, Clock, RotateCcw, Download } from 'lucide-react';
import { getLanguageName } from '@/utils/languages';

export interface HistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
  detectedLang?: string;
}

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onSelectHistory: (item: HistoryItem) => void;
  onDeleteHistory: (id: string) => void;
  onClearHistory: () => void;
  onExportHistory?: (format: 'pdf' | 'csv' | 'docx') => void;
}

export default function HistorySidebar({
  isOpen,
  onClose,
  history,
  onSelectHistory,
  onDeleteHistory,
  onClearHistory,
  onExportHistory,
}: HistorySidebarProps) {
  return (
    <>
      {/* Backdrop for mobile drawers */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-slate-900/40 dark:bg-slate-955/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300"
        />
      )}

      {/* Sidebar Panel */}
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-sm bg-white/90 dark:bg-slate-900/90 border-l border-slate-200/50 dark:border-slate-800/50 shadow-2xl backdrop-blur-xl z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-200/50 dark:border-slate-800/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-semibold">
            <Clock className="w-5 h-5 text-blue-500" />
            <span>Translation History</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
            aria-label="Close history"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center text-slate-400 dark:text-slate-500 gap-2 p-6">
              <Clock className="w-10 h-10 text-slate-300 dark:text-slate-700 stroke-[1.5]" />
              <p className="font-medium text-sm">No history yet</p>
              <p className="text-xs text-slate-455">Your translations will be saved here automatically.</p>
            </div>
          ) : (
            history.map((item) => (
              <div
                key={item.id}
                className="group relative p-3 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 rounded-xl hover:border-blue-500/30 dark:hover:border-blue-400/20 hover:bg-white dark:hover:bg-slate-800/50 transition-all duration-300"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-1.5">
                  <span>
                    {getLanguageName(item.sourceLang)}
                    {item.sourceLang === 'auto' && item.detectedLang && ` (${getLanguageName(item.detectedLang)})`}
                    <span> → </span>
                    {getLanguageName(item.targetLang)}
                  </span>
                  <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                
                <div className="space-y-1 pr-6">
                  <p className="text-sm text-slate-700 dark:text-slate-300 font-medium truncate">
                    {item.sourceText}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                    {item.translatedText}
                  </p>
                </div>

                {/* Actions overlay */}
                <div className="absolute right-2 bottom-2 flex gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={() => onSelectHistory(item)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-slate-600 hover:text-blue-650 dark:text-slate-400 dark:hover:text-blue-400 shadow-sm transition-colors cursor-pointer"
                    title="Restore translation"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteHistory(item.id)}
                    className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-slate-650 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 shadow-sm transition-colors cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {history.length > 0 && (
          <div className="p-4 border-t border-slate-200/50 dark:border-slate-800/50 flex flex-col gap-2">
            {onExportHistory && (
              <div className="flex gap-2">
                <button
                  onClick={() => onExportHistory('pdf')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 border border-slate-200/40 dark:border-slate-700/50 rounded-xl transition-all cursor-pointer"
                  title="Export to PDF"
                >
                  <Download className="w-3.5 h-3.5" /> PDF
                </button>
                <button
                  onClick={() => onExportHistory('docx')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 border border-slate-200/40 dark:border-slate-700/50 rounded-xl transition-all cursor-pointer"
                  title="Export to DOCX"
                >
                  <Download className="w-3.5 h-3.5" /> DOCX
                </button>
                <button
                  onClick={() => onExportHistory('csv')}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-semibold text-slate-600 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-blue-900/20 border border-slate-200/40 dark:border-slate-700/50 rounded-xl transition-all cursor-pointer"
                  title="Export to CSV"
                >
                  <Download className="w-3.5 h-3.5" /> CSV
                </button>
              </div>
            )}
            <button
              onClick={onClearHistory}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-red-500 hover:text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 border border-red-200/40 dark:border-red-900/30 rounded-xl transition-all cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              <span>Clear All History</span>
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
