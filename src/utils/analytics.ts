// ─── Analytics Event Types ────────────────────────────────────────────────────

export type EventType =
  | 'translation'
  | 'voice_translation'
  | 'ocr_translation'
  | 'document_translation'
  | 'conversation_message'
  | 'learn_analysis';

export interface AnalyticsEvent {
  id: string;
  type: EventType;
  timestamp: number; // Unix ms
  sourceLang: string;
  targetLang: string;
  charCount?: number;
  fileType?: string; // for document/OCR events
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  translations: number;
  voiceTranslations: number;
  ocrTranslations: number;
  documentTranslations: number;
  conversationMessages: number;
  learnAnalyses: number;
  totalChars: number;
}

export interface AnalyticsStore {
  events: AnalyticsEvent[];
  lastUpdated: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STORAGE_KEY = 'aura-analytics';
const MAX_EVENTS = 5000; // Cap to avoid localStorage bloat

// ─── Core helpers ─────────────────────────────────────────────────────────────

function dateKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10); // YYYY-MM-DD
}

function loadStore(): AnalyticsStore {
  if (typeof window === 'undefined') return { events: [], lastUpdated: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AnalyticsStore;
  } catch {}
  return { events: [], lastUpdated: 0 };
}

function saveStore(store: AnalyticsStore): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep only most recent MAX_EVENTS
    if (store.events.length > MAX_EVENTS) {
      store.events = store.events.slice(-MAX_EVENTS);
    }
    store.lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function trackEvent(
  type: EventType,
  sourceLang: string,
  targetLang: string,
  opts?: { charCount?: number; fileType?: string },
): void {
  if (typeof window === 'undefined') return;
  const store = loadStore();
  const event: AnalyticsEvent = {
    id: Math.random().toString(36).slice(2, 11),
    type,
    timestamp: Date.now(),
    sourceLang,
    targetLang,
    charCount: opts?.charCount,
    fileType: opts?.fileType,
  };
  store.events.push(event);
  saveStore(store);
}

export function getAnalyticsData() {
  const store = loadStore();
  const events = store.events;

  if (events.length === 0) {
    return buildEmptyData();
  }

  // ── Totals ──────────────────────────────────────────────────────────────────
  const totals = {
    translations: 0,
    voiceTranslations: 0,
    ocrTranslations: 0,
    documentTranslations: 0,
    conversationMessages: 0,
    learnAnalyses: 0,
    totalChars: 0,
  };

  events.forEach(e => {
    totals.totalChars += e.charCount ?? 0;
    switch (e.type) {
      case 'translation': totals.translations++; break;
      case 'voice_translation': totals.voiceTranslations++; totals.translations++; break;
      case 'ocr_translation': totals.ocrTranslations++; totals.translations++; break;
      case 'document_translation': totals.documentTranslations++; break;
      case 'conversation_message': totals.conversationMessages++; break;
      case 'learn_analysis': totals.learnAnalyses++; break;
    }
  });

  // ── Daily activity (last 14 days) ───────────────────────────────────────────
  const last14 = getLast14Days();
  const dailyMap = new Map<string, DailyStats>();
  last14.forEach(d => {
    dailyMap.set(d, {
      date: d, translations: 0, voiceTranslations: 0, ocrTranslations: 0,
      documentTranslations: 0, conversationMessages: 0, learnAnalyses: 0, totalChars: 0,
    });
  });

  events.forEach(e => {
    const d = dateKey(e.timestamp);
    if (!dailyMap.has(d)) return;
    const day = dailyMap.get(d)!;
    day.totalChars += e.charCount ?? 0;
    switch (e.type) {
      case 'translation': day.translations++; break;
      case 'voice_translation': day.voiceTranslations++; day.translations++; break;
      case 'ocr_translation': day.ocrTranslations++; day.translations++; break;
      case 'document_translation': day.documentTranslations++; break;
      case 'conversation_message': day.conversationMessages++; break;
      case 'learn_analysis': day.learnAnalyses++; break;
    }
  });

  const dailyActivity = last14.map(d => {
    const s = dailyMap.get(d)!;
    return {
      date: formatShortDate(d),
      fullDate: d,
      translations: s.translations,
      voice: s.voiceTranslations,
      ocr: s.ocrTranslations,
      docs: s.documentTranslations,
      convo: s.conversationMessages,
      learn: s.learnAnalyses,
      chars: s.totalChars,
    };
  });

  // ── Language pairs ───────────────────────────────────────────────────────────
  const pairMap = new Map<string, { source: string; target: string; count: number }>();
  events.forEach(e => {
    const key = `${e.sourceLang}→${e.targetLang}`;
    if (pairMap.has(key)) {
      pairMap.get(key)!.count++;
    } else {
      pairMap.set(key, { source: e.sourceLang, target: e.targetLang, count: 1 });
    }
  });
  const topPairs = Array.from(pairMap.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // ── Languages used ────────────────────────────────────────────────────────────
  const langMap = new Map<string, number>();
  events.forEach(e => {
    langMap.set(e.sourceLang, (langMap.get(e.sourceLang) ?? 0) + 1);
    langMap.set(e.targetLang, (langMap.get(e.targetLang) ?? 0) + 1);
  });
  const topLanguages = Array.from(langMap.entries())
    .filter(([lang]) => lang !== 'auto')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([lang, count]) => ({ lang, count }));

  // ── Feature usage pie ─────────────────────────────────────────────────────────
  const featureUsage = [
    { name: 'Text Translation', value: totals.translations, color: '#6366f1' },
    { name: 'Voice Translation', value: totals.voiceTranslations, color: '#8b5cf6' },
    { name: 'OCR / Image', value: totals.ocrTranslations, color: '#06b6d4' },
    { name: 'Document', value: totals.documentTranslations, color: '#10b981' },
    { name: 'Conversation', value: totals.conversationMessages, color: '#f59e0b' },
    { name: 'Learning', value: totals.learnAnalyses, color: '#f43f5e' },
  ].filter(f => f.value > 0);

  // ── Weekly trend (last 7 days vs previous 7) ───────────────────────────────
  const now = Date.now();
  const day7 = 7 * 24 * 60 * 60 * 1000;
  const thisWeekCount = events.filter(e => now - e.timestamp < day7).length;
  const lastWeekCount = events.filter(e => now - e.timestamp >= day7 && now - e.timestamp < 2 * day7).length;
  const trendPct = lastWeekCount === 0
    ? (thisWeekCount > 0 ? 100 : 0)
    : Math.round(((thisWeekCount - lastWeekCount) / lastWeekCount) * 100);

  return {
    totals,
    totalEvents: events.length,
    dailyActivity,
    topPairs,
    topLanguages,
    featureUsage,
    trend: { thisWeek: thisWeekCount, lastWeek: lastWeekCount, pct: trendPct },
    firstEventDate: events[0] ? new Date(events[0].timestamp).toLocaleDateString() : null,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getLast14Days(): string[] {
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildEmptyData() {
  const last14 = getLast14Days();
  return {
    totals: {
      translations: 0, voiceTranslations: 0, ocrTranslations: 0,
      documentTranslations: 0, conversationMessages: 0, learnAnalyses: 0, totalChars: 0,
    },
    totalEvents: 0,
    dailyActivity: last14.map(d => ({
      date: formatShortDate(d), fullDate: d,
      translations: 0, voice: 0, ocr: 0, docs: 0, convo: 0, learn: 0, chars: 0,
    })),
    topPairs: [] as { source: string; target: string; count: number }[],
    topLanguages: [] as { lang: string; count: number }[],
    featureUsage: [] as { name: string; value: number; color: string }[],
    trend: { thisWeek: 0, lastWeek: 0, pct: 0 },
    firstEventDate: null as string | null,
  };
}

export function clearAnalytics(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY);
  }
}

// Seed with demo data for first-time visitors so the charts aren't empty
export function seedDemoData(): void {
  const store = loadStore();
  if (store.events.length > 0) return; // Only seed if empty

  const langs = [
    ['en', 'es'], ['en', 'fr'], ['en', 'de'], ['en', 'ja'], ['en', 'zh'],
    ['es', 'en'], ['fr', 'en'], ['de', 'en'], ['pt', 'en'], ['hi', 'en'],
    ['en', 'ar'], ['en', 'ko'], ['zh', 'en'], ['en', 'ru'], ['it', 'en'],
  ];
  const types: EventType[] = [
    'translation', 'translation', 'translation', 'translation', 'translation',
    'voice_translation', 'voice_translation',
    'ocr_translation',
    'document_translation',
    'conversation_message', 'conversation_message',
    'learn_analysis',
  ];

  const now = Date.now();
  const events: AnalyticsEvent[] = [];

  // Generate ~150 events spread over 14 days with realistic distribution
  for (let i = 0; i < 150; i++) {
    const daysAgo = Math.floor(Math.random() * 14);
    const hoursAgo = Math.floor(Math.random() * 24);
    const ts = now - (daysAgo * 24 * 60 * 60 * 1000) - (hoursAgo * 60 * 60 * 1000);
    const pair = langs[Math.floor(Math.random() * langs.length)];
    const type = types[Math.floor(Math.random() * types.length)];
    events.push({
      id: Math.random().toString(36).slice(2, 11),
      type,
      timestamp: ts,
      sourceLang: pair[0],
      targetLang: pair[1],
      charCount: Math.floor(Math.random() * 300) + 20,
    });
  }

  events.sort((a, b) => a.timestamp - b.timestamp);
  store.events = events;
  saveStore(store);
}
