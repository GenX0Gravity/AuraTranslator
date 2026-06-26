'use client';

import { DOMAIN_LABELS, type TranslationDomain } from '@/lib/translation/types';
import {
  Briefcase,
  Scale,
  GraduationCap,
  Landmark,
  Cpu,
  Building2,
  Globe,
  Wrench,
  Code,
  BookOpen,
  Sparkles,
} from 'lucide-react';

const DOMAIN_ICONS: Record<TranslationDomain | 'auto', typeof Globe> = {
  auto: Sparkles,
  general: Globe,
  medical: Briefcase,
  legal: Scale,
  education: GraduationCap,
  finance: Landmark,
  technology: Cpu,
  engineering: Wrench,
  software_development: Code,
  government: Building2,
  academic_research: BookOpen,
};

const ALL_DOMAIN_LABELS: Record<TranslationDomain | 'auto', string> = {
  auto: 'Auto Detect',
  ...DOMAIN_LABELS,
};

interface DomainSelectorProps {
  selected: TranslationDomain | 'auto';
  onSelect: (domain: TranslationDomain | 'auto') => void;
}

export default function DomainSelector({ selected, onSelect }: DomainSelectorProps) {
  const domains = ['auto', ...Object.keys(DOMAIN_LABELS)] as (TranslationDomain | 'auto')[];

  return (
    <div className="flex flex-wrap gap-2">
      {domains.map((domain) => {
        const Icon = DOMAIN_ICONS[domain];
        const isActive = selected === domain;
        return (
          <button
            key={domain}
            onClick={() => onSelect(domain)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${domain === 'auto' && !isActive ? 'text-blue-500' : ''}`} />
            {ALL_DOMAIN_LABELS[domain]}
          </button>
        );
      })}
    </div>
  );
}
