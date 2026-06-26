'use client';

import { Cpu, Zap, Globe2, Tag } from 'lucide-react';
import { DOMAIN_LABELS } from '@/lib/translation/types';

interface ModelInfoBadgeProps {
  model?: string;
  confidence?: number;
  latencyMs?: number;
  routingReason?: string;
  detectedDomain?: string;
}

const MODEL_LABELS: Record<string, string> = {
  'indictrans2': 'IndicTrans2',
  'nllb-200': 'NLLB-200',
  'm2m100': 'M2M100',
  'seamless-m4t': 'SeamlessM4T',
  'marianmt': 'MarianMT',
  'opus-mt': 'OPUS-MT',
  'domain-finetuned': 'Domain Model',
  'translation-memory': 'Memory',
  'google-translate': 'Google API',
  'libretranslate': 'LibreTranslate',
  'free-translate': 'Free API',
  'browser-offline': 'Offline',
  'gemini': 'Gemini',
};

export default function ModelInfoBadge({
  model,
  confidence,
  latencyMs,
  routingReason,
  detectedDomain,
}: ModelInfoBadgeProps) {
  if (!model) return null;

  const label = MODEL_LABELS[model] ?? model;
  const isOpenSource = ['indictrans2', 'nllb-200', 'm2m100', 'seamless-m4t', 'marianmt', 'opus-mt', 'domain-finetuned'].includes(model);
  const confPercent = confidence != null ? Math.round(confidence * 100) : null;

  return (
    <div
      className="flex flex-wrap items-center gap-2 text-[10px] font-semibold"
      title={routingReason}
    >
      {detectedDomain && (
        <span
          className="flex items-center gap-1 px-2 py-1 rounded-lg border bg-indigo-500/10 border-indigo-500/20 text-indigo-700 dark:text-indigo-400"
          title="Automatically detected subject matter domain"
        >
          <Tag className="w-3 h-3" />
          Domain: {DOMAIN_LABELS[detectedDomain as keyof typeof DOMAIN_LABELS] ?? detectedDomain}
        </span>
      )}

      <span
        className={`flex items-center gap-1 px-2 py-1 rounded-lg border ${
          isOpenSource
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
            : 'bg-slate-500/10 border-slate-500/20 text-slate-600 dark:text-slate-400'
        }`}
      >
        {isOpenSource ? <Cpu className="w-3 h-3" /> : <Globe2 className="w-3 h-3" />}
        {label}
      </span>

      {confPercent != null && (
        <span
          className={`px-2 py-1 rounded-lg border ${
            confPercent >= 85
              ? 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400'
              : confPercent >= 70
                ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400'
                : 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400'
          }`}
        >
          {confPercent}% confidence
        </span>
      )}

      {latencyMs != null && (
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-500/10 border border-slate-500/20 text-slate-600 dark:text-slate-400">
          <Zap className="w-3 h-3" />
          {latencyMs}ms
        </span>
      )}
    </div>
  );
}
