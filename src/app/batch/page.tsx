'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Layers, Loader2, Sparkles } from 'lucide-react';
import LanguageSelector from '@/components/LanguageSelector';

export default function BatchTranslationPage() {
  const [inputText, setInputText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('es');
  const [results, setResults] = useState<any[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  const handleBatchTranslate = async () => {
    const lines = inputText.split('\n').filter(line => line.trim() !== '');
    if (lines.length === 0) return;
    
    setIsTranslating(true);
    setResults([]);

    try {
      const response = await fetch('/api/translate/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts: lines, sourceLang, targetLang }),
      });

      if (!response.ok) throw new Error('Batch translation failed');
      const data = await response.json();
      setResults(data.results);
    } catch (err) {
      console.error(err);
      alert('Failed to process batch translation');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <div className="flex-1 w-full max-w-5xl mx-auto px-4 py-8 flex flex-col h-[calc(100vh-80px)]">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mb-6 shrink-0">
        <ChevronLeft className="w-4 h-4" /> Back to Translator
      </Link>

      <div className="flex items-center gap-2 mb-6 shrink-0">
        <Layers className="w-6 h-6 text-indigo-500" />
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Batch Translation</h1>
      </div>

      <div className="flex items-center gap-4 mb-4 shrink-0">
        <LanguageSelector label="From" selectedLanguage={sourceLang} onSelectLanguage={setSourceLang} isSource={true} />
        <LanguageSelector label="To" selectedLanguage={targetLang} onSelectLanguage={setTargetLang} isSource={false} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 min-h-0">
        <div className="flex flex-col bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4">
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-2">Enter text (one phrase per line)</label>
          <textarea
            className="flex-1 w-full bg-transparent border-0 p-0 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:ring-0 resize-none font-medium"
            placeholder="Line 1\nLine 2\nLine 3"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <div className="mt-4 flex justify-end">
            <button
              onClick={handleBatchTranslate}
              disabled={isTranslating || !inputText.trim()}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Translate Batch
            </button>
          </div>
        </div>

        <div className="flex flex-col bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 overflow-y-auto">
          <label className="text-sm font-semibold text-slate-600 dark:text-slate-400 mb-4">Results</label>
          <div className="flex flex-col gap-3">
            {results.map((res, i) => (
              <div key={i} className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">
                <p className="text-xs text-slate-500 mb-1">{res.text}</p>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  {res.error ? <span className="text-red-500">{res.error}</span> : res.translatedText}
                </p>
              </div>
            ))}
            {results.length === 0 && !isTranslating && (
              <p className="text-slate-400 text-center py-10 text-sm">Results will appear here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
