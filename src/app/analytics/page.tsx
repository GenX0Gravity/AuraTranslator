'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Languages,
  Mic,
  ScanText,
  FileText,
  MessageCircle,
  GraduationCap,
  RefreshCw,
  Trash2,
  Calendar,
  Zap,
  Globe,
  Activity,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { getAnalyticsData, seedDemoData, clearAnalytics } from '@/utils/analytics';
import { getLanguageByCode } from '@/utils/languages';
import ThemeToggle from '@/components/ThemeToggle';

// ─── Chart theme helpers ───────────────────────────────────────────────────────

const CHART_COLORS = {
  indigo:  '#6366f1',
  violet:  '#8b5cf6',
  cyan:    '#06b6d4',
  emerald: '#10b981',
  amber:   '#f59e0b',
  rose:    '#f43f5e',
  blue:    '#3b82f6',
  pink:    '#ec4899',
};

const COLOR_LIST = Object.values(CHART_COLORS);

// Custom tooltip wrapper
function ChartTooltip({ active, payload, label, dark }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 backdrop-blur-xl text-xs min-w-[120px]">
      {label && <p className="font-bold text-slate-600 dark:text-slate-300 mb-1.5">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full inline-block" style={{ background: entry.color }} />
            <span className="text-slate-500 dark:text-slate-400">{entry.name}</span>
          </span>
          <span className="font-bold text-slate-800 dark:text-slate-100">{entry.value?.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number | string;
  icon: any;
  gradient: string;
  sub?: string;
  trend?: number;
}

function StatCard({ label, value, icon: Icon, gradient, sub, trend }: StatCardProps) {
  return (
    <div className="glass-panel rounded-2xl p-5 flex items-start gap-4 relative overflow-hidden group hover:shadow-lg transition-all duration-300">
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full opacity-10 group-hover:opacity-15 transition-opacity blur-xl" style={{ background: gradient }} />
      <div className={`p-3 rounded-xl text-white shadow-md shrink-0`} style={{ background: gradient }}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
        <p className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{sub}</p>}
        {trend !== undefined && (
          <div className={`flex items-center gap-1 mt-1 text-xs font-bold ${trend >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(trend)}% vs last week
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function ChartSection({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-2xl p-5 md:p-6">
      <div className="flex items-start justify-between gap-2 mb-5">
        <div>
          <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

// ─── Language pair label helper ────────────────────────────────────────────────

function pairLabel(source: string, target: string): string {
  const s = getLanguageByCode(source);
  const t = getLanguageByCode(target);
  return `${s?.flag ?? ''}${s?.name?.slice(0, 3) ?? source} → ${t?.flag ?? ''}${t?.name?.slice(0, 3) ?? target}`;
}

// ─── Custom Pie label ─────────────────────────────────────────────────────────

const RADIAN = Math.PI / 180;
function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) {
  if (percent < 0.07) return null;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" className="text-[10px] font-bold" style={{ fontSize: 10, fontWeight: 700 }}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function AnalyticsDashboard() {
  const [data, setData] = useState<ReturnType<typeof getAnalyticsData> | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeChartLine, setActiveChartLine] = useState<string | null>(null);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains('dark'));
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const refresh = () => {
    seedDemoData(); // no-op if data exists
    setData(getAnalyticsData());
  };

  useEffect(() => { refresh(); }, []);

  const handleClear = () => {
    clearAnalytics();
    setShowClearConfirm(false);
    setData(getAnalyticsData());
  };

  const axisColor = isDark ? '#475569' : '#cbd5e1';
  const gridColor = isDark ? 'rgba(51,65,85,0.4)' : 'rgba(226,232,240,0.6)';
  const textColor = isDark ? '#94a3b8' : '#64748b';

  const radarData = useMemo(() => {
    if (!data) return [];
    const t = data.totals;
    const max = Math.max(t.translations, t.voiceTranslations, t.ocrTranslations, t.documentTranslations, t.conversationMessages, t.learnAnalyses, 1);
    return [
      { subject: 'Text', value: Math.round((t.translations / max) * 100) },
      { subject: 'Voice', value: Math.round((t.voiceTranslations / max) * 100) },
      { subject: 'OCR', value: Math.round((t.ocrTranslations / max) * 100) },
      { subject: 'Docs', value: Math.round((t.documentTranslations / max) * 100) },
      { subject: 'Chat', value: Math.round((t.conversationMessages / max) * 100) },
      { subject: 'Learn', value: Math.round((t.learnAnalyses / max) * 100) },
    ];
  }, [data]);

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Activity className="w-8 h-8 animate-pulse" />
          <p className="text-sm font-semibold">Loading analytics…</p>
        </div>
      </div>
    );
  }

  const { totals, dailyActivity, topPairs, topLanguages, featureUsage, trend, firstEventDate } = data;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 px-4 sm:px-6 py-3 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25">
              <BarChart2 className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600 dark:from-indigo-400 dark:to-violet-400 leading-tight">Analytics Dashboard</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">
                {firstEventDate ? `Tracking since ${firstEventDate}` : 'Your translation insights'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refresh}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 hover:border-indigo-300 dark:hover:border-indigo-700/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer">
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            {showClearConfirm ? (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                <span className="text-[11px] font-bold text-rose-600 dark:text-rose-400">Sure?</span>
                <button onClick={handleClear} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold bg-rose-500 text-white cursor-pointer hover:bg-rose-600 transition-colors">Yes, clear</button>
                <button onClick={() => setShowClearConfirm(false)} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold border border-slate-200/50 dark:border-slate-700/50 text-slate-500 cursor-pointer">No</button>
              </div>
            ) : (
              <button onClick={() => setShowClearConfirm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-slate-700/50 hover:border-rose-300 dark:hover:border-rose-700/50 hover:text-rose-500 dark:hover:text-rose-400 transition-all cursor-pointer">
                <Trash2 className="w-3.5 h-3.5" /> Reset
              </button>
            )}
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6 md:py-8">
        <div className="max-w-7xl mx-auto space-y-6">

          {/* ── Demo data notice ── */}
          {data.totalEvents > 0 && data.totalEvents <= 150 && (
            <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-indigo-500/8 dark:bg-indigo-500/10 border border-indigo-500/15 dark:border-indigo-500/20 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
              <Zap className="w-4 h-4 shrink-0" />
              <span>Showing <strong>demo data</strong> — start translating to see your real analytics!</span>
            </div>
          )}

          {/* ── KPI Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <StatCard label="Total Translations" value={totals.translations} icon={Languages}
              gradient="linear-gradient(135deg, #6366f1, #8b5cf6)"
              trend={trend.pct} sub={`${trend.thisWeek} this week`} />
            <StatCard label="Voice Translations" value={totals.voiceTranslations} icon={Mic}
              gradient="linear-gradient(135deg, #8b5cf6, #a855f7)" />
            <StatCard label="OCR / Image" value={totals.ocrTranslations} icon={ScanText}
              gradient="linear-gradient(135deg, #06b6d4, #3b82f6)" />
            <StatCard label="Documents" value={totals.documentTranslations} icon={FileText}
              gradient="linear-gradient(135deg, #10b981, #059669)" />
            <StatCard label="Conversations" value={totals.conversationMessages} icon={MessageCircle}
              gradient="linear-gradient(135deg, #f59e0b, #f97316)" />
            <StatCard label="Words Learned" value={totals.learnAnalyses} icon={GraduationCap}
              gradient="linear-gradient(135deg, #f43f5e, #ec4899)" />
          </div>

          {/* ── Daily Activity Chart ── */}
          <ChartSection
            title="Daily Activity — Last 14 Days"
            subtitle="All events recorded per day"
            action={
              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                <Calendar className="w-3 h-3" /> 14-day view
              </div>
            }
          >
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={dailyActivity} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  {[
                    ['gradTranslations', '#6366f1'],
                    ['gradVoice', '#8b5cf6'],
                    ['gradOcr', '#06b6d4'],
                    ['gradDocs', '#10b981'],
                    ['gradConvo', '#f59e0b'],
                    ['gradLearn', '#f43f5e'],
                  ].map(([id, color]) => (
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 10 }} axisLine={{ stroke: axisColor }} tickLine={false} interval={1} />
                <YAxis tick={{ fill: textColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip dark={isDark} />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
                <Area type="monotone" dataKey="translations" name="Translations" stroke="#6366f1" strokeWidth={2} fill="url(#gradTranslations)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="voice" name="Voice" stroke="#8b5cf6" strokeWidth={2} fill="url(#gradVoice)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="ocr" name="OCR" stroke="#06b6d4" strokeWidth={2} fill="url(#gradOcr)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="convo" name="Conversation" stroke="#f59e0b" strokeWidth={2} fill="url(#gradConvo)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="learn" name="Learning" stroke="#f43f5e" strokeWidth={2} fill="url(#gradLearn)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartSection>

          {/* ── Row 2: Language Pairs + Feature Pie ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Language Pairs Bar */}
            <ChartSection title="Most Translated Language Pairs" subtitle="Top 8 source → target combinations">
              {topPairs.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">No data yet — start translating!</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topPairs.map(p => ({ name: pairLabel(p.source, p.target), count: p.count }))}
                    layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} horizontal={false} />
                    <XAxis type="number" tick={{ fill: textColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: textColor, fontSize: 10 }} width={105} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip dark={isDark} />} />
                    <Bar dataKey="count" name="Translations" radius={[0, 6, 6, 0]}>
                      {topPairs.map((_, i) => (
                        <Cell key={i} fill={COLOR_LIST[i % COLOR_LIST.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartSection>

            {/* Feature Usage Pie */}
            <ChartSection title="Feature Usage Breakdown" subtitle="How you use AuraTranslate">
              {featureUsage.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">No data yet</div>
              ) : (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={featureUsage}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={3}
                        dataKey="value"
                        labelLine={false}
                        label={<PieLabel />}
                      >
                        {featureUsage.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip dark={isDark} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2 shrink-0 sm:pr-2">
                    {featureUsage.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-3 h-3 rounded-sm shrink-0" style={{ background: f.color }} />
                        <span className="text-slate-600 dark:text-slate-300 font-medium">{f.name}</span>
                        <span className="font-black text-slate-800 dark:text-slate-100 ml-auto pl-4">{f.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </ChartSection>
          </div>

          {/* ── Row 3: Languages Used + Radar ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Top Languages Bar */}
            <ChartSection title="Languages Used" subtitle="Top 8 most active languages (source + target)">
              {topLanguages.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-slate-400 text-sm italic">No data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topLanguages.map(l => ({
                    name: `${getLanguageByCode(l.lang)?.flag ?? ''} ${getLanguageByCode(l.lang)?.name ?? l.lang}`,
                    count: l.count,
                  }))} margin={{ top: 0, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 9 }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fill: textColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip dark={isDark} />} />
                    <Bar dataKey="count" name="Events" radius={[6, 6, 0, 0]}>
                      {topLanguages.map((_, i) => (
                        <Cell key={i} fill={COLOR_LIST[i % COLOR_LIST.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartSection>

            {/* Radar: Feature coverage */}
            <ChartSection title="Feature Usage Radar" subtitle="Relative usage intensity across all features">
              <ResponsiveContainer width="100%" height={260}>
                <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={90}>
                  <PolarGrid stroke={gridColor} />
                  <PolarAngleAxis dataKey="subject" tick={{ fill: textColor, fontSize: 11, fontWeight: 600 }} />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: textColor, fontSize: 9 }} axisLine={false} />
                  <Radar name="Usage" dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} dot={{ fill: '#6366f1', r: 3 }} />
                  <Tooltip content={<ChartTooltip dark={isDark} />} formatter={(v: any) => [`${v}%`, 'Relative usage']} />
                </RadarChart>
              </ResponsiveContainer>
            </ChartSection>
          </div>

          {/* ── Row 4: Weekly Trend + Characters Translated ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Weekly comparison */}
            <ChartSection title="Weekly Comparison" subtitle="This week vs last week">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div className="text-center flex-1">
                    <p className="text-3xl font-black text-slate-800 dark:text-slate-100">{trend.thisWeek}</p>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">This Week</p>
                  </div>
                  <div className={`flex flex-col items-center px-4 ${trend.pct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                    {trend.pct >= 0 ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                    <span className="text-lg font-black">{trend.pct >= 0 ? '+' : ''}{trend.pct}%</span>
                  </div>
                  <div className="text-center flex-1">
                    <p className="text-3xl font-black text-slate-500 dark:text-slate-400">{trend.lastWeek}</p>
                    <p className="text-xs text-slate-400 mt-1 font-semibold">Last Week</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={150}>
                  <BarChart data={[
                    { name: 'Last Week', count: trend.lastWeek, fill: '#94a3b8' },
                    { name: 'This Week', count: trend.thisWeek, fill: '#6366f1' },
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: textColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: textColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip dark={isDark} />} />
                    <Bar dataKey="count" name="Translations" radius={[6, 6, 0, 0]}>
                      <Cell fill="#94a3b8" />
                      <Cell fill="#6366f1" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartSection>

            {/* Characters translated per day */}
            <div className="lg:col-span-2">
              <ChartSection title="Characters Translated — Daily Volume" subtitle="Text volume processed per day">
                <ResponsiveContainer width="100%" height={210}>
                  <AreaChart data={dailyActivity} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradChars" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                    <XAxis dataKey="date" tick={{ fill: textColor, fontSize: 10 }} axisLine={{ stroke: axisColor }} tickLine={false} interval={1} />
                    <YAxis tick={{ fill: textColor, fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip dark={isDark} />} />
                    <Area type="monotone" dataKey="chars" name="Characters" stroke="#06b6d4" strokeWidth={2.5} fill="url(#gradChars)" dot={false} activeDot={{ r: 5, fill: '#06b6d4', stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartSection>
            </div>
          </div>

          {/* ── Summary footer ── */}
          <div className="glass-panel rounded-2xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              { label: 'Total Events', value: data.totalEvents.toLocaleString(), icon: '📊' },
              { label: 'Characters Processed', value: totals.totalChars.toLocaleString(), icon: '✍️' },
              { label: 'Languages in Use', value: (new Set(topLanguages.map(l => l.lang))).size, icon: '🌍' },
              { label: 'Avg/Day (14d)', value: Math.round(dailyActivity.reduce((s, d) => s + d.translations, 0) / 14).toLocaleString(), icon: '📅' },
            ].map((item, i) => (
              <div key={i}>
                <span className="text-2xl">{item.icon}</span>
                <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-1">{item.value}</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 font-semibold mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>

        </div>
      </main>
    </div>
  );
}
