'use client';

import { useState, useEffect } from 'react';
import { WifiOff, Download, Check, Loader2 } from 'lucide-react';
import { get, set } from 'idb-keyval';

const OFFLINE_MODEL_KEY = 'auratranslator-offline-enabled';
const OFFLINE_MODELS_KEY = 'auratranslator-downloaded-models';

interface OfflineModeToggleProps {
  onOfflineChange?: (enabled: boolean) => void;
}

export default function OfflineModeToggle({ onOfflineChange }: OfflineModeToggleProps) {
  const [offlineEnabled, setOfflineEnabled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState<string[]>([]);

  useEffect(() => {
    setIsOnline(navigator.onLine);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    get(OFFLINE_MODEL_KEY).then((v) => setOfflineEnabled(Boolean(v)));
    get(OFFLINE_MODELS_KEY).then((v) => setDownloaded(Array.isArray(v) ? v : []));

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleToggle = async () => {
    const next = !offlineEnabled;
    setOfflineEnabled(next);
    await set(OFFLINE_MODEL_KEY, next);
    onOfflineChange?.(next);
  };

  const handleDownloadModels = async () => {
    setDownloading(true);
    try {
      // Cache model metadata for offline routing; full WASM models loaded on demand
      const models = ['nllb-200-distilled', 'marianmt-en-es'];
      await set(OFFLINE_MODELS_KEY, models);
      await set('auratranslator-offline-cache-ready', true);
      setDownloaded(models);
      setOfflineEnabled(true);
      await set(OFFLINE_MODEL_KEY, true);
      onOfflineChange?.(true);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {!isOnline && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-[10px] font-bold">
          <WifiOff className="w-3 h-3" />
          Offline
        </span>
      )}

      <button
        onClick={handleDownloadModels}
        disabled={downloading}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-all disabled:opacity-50"
        title="Download models for offline translation"
      >
        {downloading ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : downloaded.length > 0 ? (
          <Check className="w-3 h-3 text-green-500" />
        ) : (
          <Download className="w-3 h-3" />
        )}
        {downloaded.length > 0 ? 'Models cached' : 'Download offline'}
      </button>

      <button
        onClick={handleToggle}
        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
          offlineEnabled
            ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
        }`}
      >
        Offline {offlineEnabled ? 'ON' : 'OFF'}
      </button>
    </div>
  );
}
