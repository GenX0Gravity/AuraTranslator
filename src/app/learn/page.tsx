'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Sparkles,
  BookOpen,
  Volume2,
  Mic,
  Search,
  AlertCircle,
  Loader2,
  ChevronDown,
  Star,
  BookMarked,
  BarChart2,
  MessageSquare,
  Lightbulb,
  Repeat2,
  Globe,
  ArrowUpRight,
  Check,
  Info,
  RefreshCw,
  GraduationCap,
  User as UserIcon,
  LogOut,
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { LANGUAGES, getLanguageByCode } from '@/utils/languages';
import ThemeToggle from '@/components/ThemeToggle';
import type { LearnResponse } from '@/app/api/learn/route';
import { trackEvent } from '@/utils/analytics';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_CONFIG = {
  Beginner:     { color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', bar: 'bg-emerald-500', emoji: '🌱' },
  Intermediate: { color: 'text-blue-600 dark:text-blue-400',       bg: 'bg-blue-500/10 border-blue-500/20',       bar: 'bg-blue-500',    emoji: '📚' },
  Advanced:     { color: 'text-violet-600 dark:text-violet-400',   bg: 'bg-violet-500/10 border-violet-500/20',   bar: 'bg-violet-500',  emoji: '🎓' },
  Expert:       { color: 'text-rose-600 dark:text-rose-400',       bg: 'bg-rose-500/10 border-rose-500/20',       bar: 'bg-rose-500',    emoji: '🏆' },
};

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: BookOpen },
  { id: 'grammar',     label: 'Grammar',     icon: Check },
  { id: 'examples',   label: 'Examples',    icon: MessageSquare },
  { id: 'vocabulary', label: 'Vocabulary',  icon: BookMarked },
  { id: 'synonyms',   label: 'Synonyms',    icon: Repeat2 },
  { id: 'culture',    label: 'Culture',     icon: Globe },
] as const;

type TabId = typeof TABS[number]['id'];

// ─── Mini Language Selector ───────────────────────────────────────────────────

function MiniLangSelect({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const langs = LANGUAGES.filter(l =>
    !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.nativeName.toLowerCase().includes(q.toLowerCase())
  );
  const cur = getLanguageByCode(value);

  return (
    <div className="relative" ref={ref}>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">{label}</label>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-sm text-sm font-medium text-slate-800 dark:text-slate-200 hover:border-amber-400/50 dark:hover:border-amber-500/50 transition-all cursor-pointer w-full min-w-[160px]"
      >
        <span className="text-base">{cur?.flag ?? '🌐'}</span>
        <span className="flex-1 text-left truncate">{cur?.name ?? value}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 w-64 bg-white/97 dark:bg-slate-900/97 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 px-3 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="w-full text-sm bg-transparent text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none py-1" />
          </div>
          <ul className="max-h-52 overflow-y-auto py-1">
            {langs.map(l => (
              <li key={l.code} onClick={() => { onChange(l.code); setOpen(false); setQ(''); }}
                className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer text-sm transition-colors ${l.code === value ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                <span className="text-base">{l.flag}</span>
                <span className="truncate">{l.name}</span>
                <span className="text-xs text-slate-400 truncate">({l.nativeName})</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Difficulty Meter ─────────────────────────────────────────────────────────

function DifficultyMeter({ level, score }: { level: string; score: number }) {
  const cfg = DIFFICULTY_CONFIG[level as keyof typeof DIFFICULTY_CONFIG] ?? DIFFICULTY_CONFIG.Intermediate;
  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-2xl border ${cfg.bg}`}>
      <span className="text-2xl">{cfg.emoji}</span>
      <div className="flex-1">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-sm font-bold ${cfg.color}`}>{level}</span>
          <span className={`text-xs font-mono font-bold ${cfg.color}`}>{score}/10</span>
        </div>
        <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div className={`h-full ${cfg.bar} rounded-full transition-all duration-700`} style={{ width: `${score * 10}%` }} />
        </div>
      </div>
    </div>
  );
}

// ─── Speak helper ─────────────────────────────────────────────────────────────

function speakText(text: string, lang: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang;
  window.speechSynthesis.speak(u);
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, accent = 'blue' }: { title: string; icon: any; children: React.ReactNode; accent?: string }) {
  const colors: Record<string, string> = {
    blue:   'from-blue-500 to-indigo-500',
    amber:  'from-amber-500 to-orange-500',
    violet: 'from-violet-500 to-purple-500',
    emerald:'from-emerald-500 to-teal-500',
    rose:   'from-rose-500 to-pink-500',
    cyan:   'from-cyan-500 to-blue-500',
  };
  return (
    <div className="glass-panel rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className={`p-1.5 rounded-lg bg-gradient-to-br ${colors[accent] ?? colors.blue} text-white shadow-sm`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ─── Vocabulary Builder Saved Words ──────────────────────────────────────────

interface SavedWord {
  word: string;
  translation: string;
  lang: string;
  addedAt: string;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LearnPage() {
  const [inputWord, setInputWord] = useState('');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('es');
  const [result, setResult] = useState<LearnResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [justSaved, setJustSaved] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: session } = useSession();

  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechSupported(!!SR);
    // Load saved words from DB or localStorage
    if (session?.user) {
      fetch('/api/favorites')
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            setSavedWords(data.map(item => ({
              word: item.word,
              translation: item.translation,
              lang: item.language,
              addedAt: item.timestamp,
            })));
          }
        })
        .catch(err => console.error('Error fetching favorites:', err));
    } else {
      try {
        const stored = localStorage.getItem('learn-vocab');
        if (stored) setSavedWords(JSON.parse(stored));
      } catch {}
    }
  }, [session?.user]);

  const persistWords = (words: SavedWord[]) => {
    setSavedWords(words);
    if (!session?.user) {
      localStorage.setItem('learn-vocab', JSON.stringify(words));
    }
  };

  const handleAnalyze = async (wordOverride?: string) => {
    const word = (wordOverride ?? inputWord).trim();
    if (!word) return;
    setIsLoading(true);
    setError(null);
    setResult(null);
    setActiveTab('overview');
    try {
      const res = await fetch('/api/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word, sourceLang, targetLang }),
      });
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? 'Analysis failed');
      }
      const result = await res.json();
      setResult(result);
      // Track analytics event
      trackEvent('learn_analysis', sourceLang, targetLang, { charCount: word.length });
    } catch (e: any) {
      setError(e.message ?? 'Failed to analyze word.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAnalyze();
  };

  const handleSaveWord = async () => {
    if (!result) return;
    const entry: SavedWord = {
      word: result.word,
      translation: result.translatedWord,
      lang: result.targetLang,
      addedAt: new Date().toISOString(),
    };
    const updated = [entry, ...savedWords.filter(w => w.word !== result.word)].slice(0, 50);
    persistWords(updated);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);

    if (session?.user) {
      try {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: result.word,
            translation: result.translatedWord,
            language: result.targetLang,
          }),
        });
      } catch (err) {
        console.error('Failed to save favorite to DB', err);
      }
    }
  };

  const handleRemoveWord = async (index: number) => {
    const wordToRemove = savedWords[index];
    const updated = savedWords.filter((_, j) => j !== index);
    persistWords(updated);

    if (session?.user) {
      try {
        await fetch(`/api/favorites?word=${encodeURIComponent(wordToRemove.word)}&language=${encodeURIComponent(wordToRemove.lang)}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Failed to remove favorite from DB', err);
      }
    }
  };

  const handleMic = () => {
    if (!isSpeechSupported) return;
    if (isListening) {
      recRef.current?.stop();
      return;
    }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = sourceLang;
    rec.interimResults = false;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => setIsListening(false);
    rec.onerror = () => setIsListening(false);
    rec.onresult = (e: any) => {
      const t = e.results[0][0].transcript;
      setInputWord(t);
      handleAnalyze(t);
    };
    recRef.current = rec;
    rec.start();
  };

  const diffCfg = result ? (DIFFICULTY_CONFIG[result.difficultyLevel] ?? DIFFICULTY_CONFIG.Intermediate) : null;

  return (
    <div className="min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 px-4 sm:px-6 py-3 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/" className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5 mr-auto">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-500 text-white shadow-md shadow-amber-500/20">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 leading-tight">Language Learning</h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">AI-powered word analysis & vocabulary builder</p>
            </div>
          </div>
          {/* Vocab badge */}
          {savedWords.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs font-bold">
              <Star className="w-3 h-3 fill-current" />
              {savedWords.length} saved
            </div>
          )}
          {/* Analytics link */}
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-sm hover:shadow-md transition-all cursor-pointer"
            title="Analytics dashboard"
          >
            <BarChart2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Analytics</span>
          </Link>
          {/* Auth link */}
          {session ? (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:shadow-md transition-all cursor-pointer"
              title="Sign out"
            >
              {session.user?.image ? (
                <img src={session.user.image} alt="Avatar" className="w-3.5 h-3.5 rounded-full" />
              ) : (
                <UserIcon className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">{session.user?.name || 'Sign Out'}</span>
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shadow-sm hover:shadow-md transition-all cursor-pointer"
              title="Sign in"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 px-4 sm:px-6 py-6 md:py-8">
        <div className="max-w-5xl mx-auto space-y-6">

          {/* ── Search panel ── */}
          <div className="glass-panel rounded-3xl p-5 md:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
              <MiniLangSelect value={sourceLang} onChange={setSourceLang} label="Analyze From" />
              <div className="flex items-center justify-center pt-4 sm:pt-0">
                <ArrowUpRight className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              </div>
              <MiniLangSelect value={targetLang} onChange={setTargetLang} label="Learn In" />
            </div>

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  ref={inputRef}
                  type="text"
                  value={inputWord}
                  onChange={e => setInputWord(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter a word or phrase to analyze…"
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-400/60 text-sm transition-all shadow-sm"
                  aria-label="Word to analyze"
                />
              </div>
              {isSpeechSupported && (
                <button
                  onClick={handleMic}
                  className={`p-3.5 rounded-xl border transition-all cursor-pointer shrink-0 relative ${isListening ? 'bg-red-500 border-red-600 text-white shadow-md shadow-red-500/25' : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 text-slate-500 hover:border-amber-400/50 hover:text-amber-500'}`}
                  title="Dictate word"
                >
                  {isListening ? <><Mic className="w-4 h-4" /><span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-300 animate-ping" /></> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <button
                onClick={() => handleAnalyze()}
                disabled={isLoading || !inputWord.trim()}
                className="px-5 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold text-sm shadow-md shadow-amber-500/20 hover:shadow-lg hover:shadow-amber-500/30 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-2 shrink-0"
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Sparkles className="w-4 h-4" /> Analyze</>}
              </button>
            </div>

            {/* Suggested words */}
            {!result && !isLoading && (
              <div className="flex flex-wrap gap-2">
                {['beautiful', 'resilience', 'ephemeral', 'serendipity', 'melancholy', 'eloquent'].map(w => (
                  <button key={w} onClick={() => { setInputWord(w); handleAnalyze(w); }}
                    className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-100/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400 border border-slate-200/50 dark:border-slate-700/50 hover:border-amber-300 dark:hover:border-amber-700/50 transition-all cursor-pointer">
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 animate-in fade-in duration-300">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold">Analysis failed</p>
                <p className="text-xs mt-0.5 opacity-80">{error}</p>
              </div>
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {isLoading && (
            <div className="glass-panel rounded-3xl p-6 space-y-4 animate-pulse">
              <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded-xl w-1/3" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-3/4" />
              <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-lg w-2/3" />
              <div className="grid grid-cols-3 gap-4 pt-2">
                {[1,2,3].map(i => <div key={i} className="h-20 bg-slate-200 dark:bg-slate-700 rounded-xl" />)}
              </div>
            </div>
          )}

          {/* ── Results ── */}
          {result && !isLoading && (
            <div className="space-y-4 animate-in fade-in duration-400">

              {/* Hero card */}
              <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                {/* Background gradient orb */}
                <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br from-amber-400/15 to-orange-400/10 blur-2xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {result.isMock && (
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">Mock Mode</span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider border border-slate-200/50 dark:border-slate-700/50">{result.partOfSpeech}</span>
                    </div>
                    <div className="flex items-end gap-4 flex-wrap">
                      <h2 className="text-3xl md:text-4xl font-black text-slate-800 dark:text-slate-100 leading-none">{result.word}</h2>
                      <div className="flex items-center gap-1.5 pb-1">
                        <span className="text-slate-400 dark:text-slate-500 text-sm">→</span>
                        <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{result.translatedWord}</span>
                        <button onClick={() => speakText(result.translatedWord, result.targetLang)}
                          className="p-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-400 hover:text-amber-600 transition-colors">
                          <Volume2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* IPA pronunciation */}
                    <div className="flex items-center gap-3 mt-2">
                      <button onClick={() => speakText(result.word, result.sourceLang)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400 transition-all text-xs font-mono font-semibold border border-slate-200/50 dark:border-slate-700/50 cursor-pointer">
                        <Volume2 className="w-3 h-3" />
                        {result.pronunciation.ipa || result.pronunciation.phonetic}
                      </button>
                      <span className="text-xs text-slate-400 dark:text-slate-500 italic">{result.pronunciation.phonetic}</span>
                    </div>

                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">{result.explanation}</p>
                  </div>

                  <div className="flex flex-col gap-2 shrink-0">
                    <DifficultyMeter level={result.difficultyLevel} score={result.difficultyScore} />
                    <button onClick={handleSaveWord}
                      className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${justSaved ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-300 dark:hover:border-amber-700/50 hover:text-amber-600 dark:hover:text-amber-400'}`}>
                      {justSaved ? <><Check className="w-3.5 h-3.5" /> Saved!</> : <><Star className="w-3.5 h-3.5" /> Save Word</>}
                    </button>
                    <button onClick={() => handleAnalyze()}
                      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-amber-500 hover:border-amber-300 transition-all cursor-pointer">
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                  </div>
                </div>
              </div>

              {/* Grammar correction alert */}
              {result.grammar.correction && (
                <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 animate-in fade-in duration-300">
                  <Info className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">Grammar Suggestion</p>
                    <p className="text-sm mt-0.5">Did you mean: <span className="font-bold italic">"{result.grammar.correction}"</span>?</p>
                  </div>
                </div>
              )}

              {/* Tabs */}
              <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-thin">
                {TABS.map(tab => (
                  <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${activeTab === tab.id ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/20' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400'}`}>
                    <tab.icon className="w-3.5 h-3.5" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="animate-in fade-in duration-300">

                {/* OVERVIEW */}
                {activeTab === 'overview' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SectionCard title="Pronunciation Guide" icon={Volume2} accent="amber">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-700/40">
                          <button onClick={() => speakText(result.word, result.sourceLang)}
                            className="p-2.5 rounded-lg bg-amber-500 text-white shadow-sm hover:bg-amber-600 transition-colors cursor-pointer shrink-0">
                            <Volume2 className="w-4 h-4" />
                          </button>
                          <div>
                            <p className="text-lg font-mono font-bold text-slate-800 dark:text-slate-100">{result.pronunciation.ipa}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{result.pronunciation.phonetic}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
                          <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <p>{result.pronunciation.tips}</p>
                        </div>
                      </div>
                    </SectionCard>

                    <SectionCard title="Difficulty Assessment" icon={BarChart2} accent="violet">
                      <DifficultyMeter level={result.difficultyLevel} score={result.difficultyScore} />
                      <div className="grid grid-cols-4 gap-1 mt-2">
                        {[2, 4, 6, 8].map((v, i) => (
                          <div key={v} className={`h-6 rounded-md flex items-center justify-center text-[9px] font-bold ${result.difficultyScore >= v ? `${diffCfg?.bar} text-white` : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                            {['A1','A2','B1','B2'][i]}
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    <SectionCard title="Memory Tip" icon={Lightbulb} accent="emerald">
                      <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/40 dark:border-emerald-800/40">
                        <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed italic">💡 {result.vocabulary.memoryTip}</p>
                      </div>
                    </SectionCard>

                    <SectionCard title="Word Root & Etymology" icon={BookOpen} accent="blue">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-bold font-mono border border-blue-200/50 dark:border-blue-800/50">{result.vocabulary.root}</span>
                          <span className="text-xs text-slate-400">root</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {result.vocabulary.relatedWords.map((rw, i) => (
                            <button key={i} onClick={() => { setInputWord(rw.word); handleAnalyze(rw.word); }}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200/50 dark:border-slate-700/50 transition-all cursor-pointer">
                              {rw.word}
                              <span className="text-slate-400 dark:text-slate-500 text-[9px]">({rw.type})</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    </SectionCard>
                  </div>
                )}

                {/* GRAMMAR */}
                {activeTab === 'grammar' && (
                  <div className="space-y-4">
                    <SectionCard title="Grammar Analysis" icon={Check} accent="blue">
                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Sentence Structure</p>
                          <div className="px-4 py-3 rounded-xl bg-blue-50/80 dark:bg-blue-900/10 border border-blue-200/40 dark:border-blue-800/40 font-mono text-sm text-blue-800 dark:text-blue-300 font-semibold">
                            {result.grammar.structure}
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Grammar Notes</p>
                          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{result.grammar.notes}</p>
                        </div>
                        {result.grammar.correction && (
                          <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/40">
                            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">Suggested Correction</p>
                              <p className="text-sm font-bold italic text-amber-800 dark:text-amber-300">"{result.grammar.correction}"</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </SectionCard>
                  </div>
                )}

                {/* EXAMPLES */}
                {activeTab === 'examples' && (
                  <div className="space-y-3">
                    {result.exampleSentences.map((ex, i) => (
                      <SectionCard key={i} title={`Example ${i + 1} · ${ex.context}`} icon={MessageSquare} accent={['amber','blue','violet','emerald'][i % 4] as any}>
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-[10px] font-black shrink-0 mt-0.5">{getLanguageByCode(result.sourceLang)?.flag}</div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{ex.original}</p>
                              <button onClick={() => speakText(ex.original, result.sourceLang)} className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-500 transition-colors cursor-pointer">
                                <Volume2 className="w-3 h-3" /> Listen
                              </button>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 pl-2">
                            <div className="w-px h-full bg-slate-200 dark:bg-slate-700 shrink-0" />
                            <div className="flex-1 pl-2">
                              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-[10px] font-black shrink-0 float-left mr-3 mt-0.5">{getLanguageByCode(result.targetLang)?.flag}</div>
                              <p className="text-sm italic text-slate-600 dark:text-slate-300">{ex.translated}</p>
                              <button onClick={() => speakText(ex.translated, result.targetLang)} className="mt-1 flex items-center gap-1 text-[10px] text-slate-400 hover:text-blue-500 transition-colors cursor-pointer">
                                <Volume2 className="w-3 h-3" /> Listen
                              </button>
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    ))}
                  </div>
                )}

                {/* VOCABULARY */}
                {activeTab === 'vocabulary' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <SectionCard title="Related Words" icon={BookMarked} accent="cyan">
                        <div className="flex flex-wrap gap-2">
                          {result.vocabulary.relatedWords.map((rw, i) => (
                            <button key={i} onClick={() => { setInputWord(rw.word); handleAnalyze(rw.word); }}
                              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-cyan-50 dark:bg-cyan-900/20 text-cyan-700 dark:text-cyan-300 border border-cyan-200/50 dark:border-cyan-800/50 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 transition-all cursor-pointer">
                              {rw.word}
                              <span className="text-[9px] text-cyan-500 dark:text-cyan-500 font-bold uppercase">{rw.type}</span>
                            </button>
                          ))}
                        </div>
                      </SectionCard>

                      <SectionCard title="Vocabulary Builder" icon={Star} accent="amber">
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                          {savedWords.length === 0 ? (
                            <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Save words using the ★ button to build your vocabulary list.</p>
                          ) : (
                            savedWords.map((sw, i) => (
                              <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/40">
                                <div>
                                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{sw.word}</p>
                                  <p className="text-xs italic text-amber-600 dark:text-amber-400">{sw.translation}</p>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <button onClick={() => { setInputWord(sw.word); handleAnalyze(sw.word); }}
                                    className="p-1.5 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-500 transition-colors cursor-pointer">
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                  </button>
                                  <button onClick={() => handleRemoveWord(i)}
                                    className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors cursor-pointer">
                                    ×
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </SectionCard>
                    </div>

                    <SectionCard title="Memory Tip" icon={Lightbulb} accent="emerald">
                      <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/40 dark:border-emerald-800/40">
                        <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">💡 {result.vocabulary.memoryTip}</p>
                      </div>
                    </SectionCard>
                  </div>
                )}

                {/* SYNONYMS */}
                {activeTab === 'synonyms' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SectionCard title="Synonyms" icon={Repeat2} accent="violet">
                      <div className="space-y-2">
                        {result.synonyms.map((s, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-violet-50/80 dark:bg-violet-900/10 border border-violet-200/40 dark:border-violet-800/40">
                            <button onClick={() => speakText(s.word, result.sourceLang)} className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors cursor-pointer">
                              <Volume2 className="w-3 h-3" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <button onClick={() => { setInputWord(s.word); handleAnalyze(s.word); }}
                                className="text-sm font-bold text-violet-700 dark:text-violet-300 hover:underline cursor-pointer">{s.word}</button>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.meaning}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>

                    <SectionCard title="Antonyms" icon={Repeat2} accent="rose">
                      <div className="space-y-2">
                        {result.antonyms.map((a, i) => (
                          <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-900/10 border border-rose-200/40 dark:border-rose-800/40">
                            <button onClick={() => speakText(a.word, result.sourceLang)} className="p-1.5 rounded-lg bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 hover:bg-rose-200 dark:hover:bg-rose-900/50 transition-colors cursor-pointer">
                              <Volume2 className="w-3 h-3" />
                            </button>
                            <div className="flex-1 min-w-0">
                              <button onClick={() => { setInputWord(a.word); handleAnalyze(a.word); }}
                                className="text-sm font-bold text-rose-700 dark:text-rose-300 hover:underline cursor-pointer">{a.word}</button>
                              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{a.meaning}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  </div>
                )}

                {/* CULTURE */}
                {activeTab === 'culture' && (
                  <SectionCard title="Cultural Context & Usage Notes" icon={Globe} accent="emerald">
                    <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/40 dark:border-emerald-800/40">
                      <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">🌍 {result.culturalNote}</p>
                    </div>
                  </SectionCard>
                )}
              </div>
            </div>
          )}

          {/* ── Saved vocabulary list (always shown below if words exist and no active result) ── */}
          {!result && !isLoading && savedWords.length > 0 && (
            <div className="glass-panel rounded-3xl p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Your Vocabulary List ({savedWords.length})</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {savedWords.map((sw, i) => (
                  <button key={i} onClick={() => { setInputWord(sw.word); handleAnalyze(sw.word); }}
                    className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/40 hover:border-amber-400 dark:hover:border-amber-600/50 transition-all cursor-pointer text-left group">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors truncate">{sw.word}</p>
                      <p className="text-xs italic text-amber-600 dark:text-amber-400 truncate">{sw.translation}</p>
                    </div>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-amber-500 transition-colors shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
