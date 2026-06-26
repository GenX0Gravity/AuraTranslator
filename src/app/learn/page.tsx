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
  ListTodo,
  CheckCircle2,
  XCircle,
  Award,
  ChevronRight,
  HelpCircle,
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
  { id: 'overview',        label: 'Overview',        icon: BookOpen },
  { id: 'grammar',         label: 'Grammar',         icon: Check },
  { id: 'translationDeep', label: 'Rationale & Alts', icon: Sparkles },
  { id: 'examples',        label: 'Examples',        icon: MessageSquare },
  { id: 'vocabulary',      label: 'Vocabulary',      icon: BookMarked },
  { id: 'quizzes',         label: 'Quizzes',         icon: ListTodo },
  { id: 'synonyms',        label: 'Synonyms',        icon: Repeat2 },
  { id: 'culture',         label: 'Culture',         icon: Globe },
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
  const [activeMode, setActiveMode] = useState<'analyzer' | 'daily'>('analyzer');
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

  // Daily Practice States
  const [difficulty, setDifficulty] = useState<'Beginner' | 'Intermediate' | 'Advanced' | 'Expert'>('Intermediate');
  const [dailyData, setDailyData] = useState<any | null>(null);
  const [isDailyLoading, setIsDailyLoading] = useState(false);
  const [dailyError, setDailyError] = useState<string | null>(null);
  
  // Daily Quiz Navigation States
  const [dailyQuizStep, setDailyQuizStep] = useState(0);
  const [dailyQuizAnswers, setDailyQuizAnswers] = useState<Record<number, number>>({});
  const [dailyQuizSubmitted, setDailyQuizSubmitted] = useState<Record<number, boolean>>({});
  const [dailyQuizScore, setDailyQuizScore] = useState(0);
  const [dailyQuizFinished, setDailyQuizFinished] = useState(false);

  // Word Analyzer Quiz States
  const [analyzerQuizStep, setAnalyzerQuizStep] = useState(0);
  const [analyzerQuizAnswers, setAnalyzerQuizAnswers] = useState<Record<number, number>>({});
  const [analyzerQuizSubmitted, setAnalyzerQuizSubmitted] = useState<Record<number, boolean>>({});
  const [analyzerQuizScore, setAnalyzerQuizScore] = useState(0);
  const [analyzerQuizFinished, setAnalyzerQuizFinished] = useState(false);

  // Custom Vocabulary Quiz States
  const [customQuiz, setCustomQuiz] = useState<any[] | null>(null);
  const [isCustomQuizLoading, setIsCustomQuizLoading] = useState(false);
  const [customQuizStep, setCustomQuizStep] = useState(0);
  const [customQuizAnswers, setCustomQuizAnswers] = useState<Record<number, number>>({});
  const [customQuizSubmitted, setCustomQuizSubmitted] = useState<Record<number, boolean>>({});
  const [customQuizScore, setCustomQuizScore] = useState(0);
  const [customQuizFinished, setCustomQuizFinished] = useState(false);

  // Flashcards States
  const [activeCardIdx, setActiveCardIdx] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  // Load Saved words / Favorites
  useEffect(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    setIsSpeechSupported(!!SR);
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
    setCustomQuiz(null); // clear custom quiz on new word search
    setActiveTab('overview');
    
    // Reset analyzer quiz state
    setAnalyzerQuizStep(0);
    setAnalyzerQuizAnswers({});
    setAnalyzerQuizSubmitted({});
    setAnalyzerQuizScore(0);
    setAnalyzerQuizFinished(false);

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
      const resultData = await res.json();
      setResult(resultData);
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

  const handleSaveSpecificWord = async (wordStr: string, transStr: string, langStr: string) => {
    const entry: SavedWord = {
      word: wordStr,
      translation: transStr,
      lang: langStr,
      addedAt: new Date().toISOString(),
    };
    const updated = [entry, ...savedWords.filter(w => w.word !== wordStr)].slice(0, 50);
    persistWords(updated);
    
    if (session?.user) {
      try {
        await fetch('/api/favorites', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            word: wordStr,
            translation: transStr,
            language: langStr,
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

    // Reset flashcard index if it exceeds length
    if (activeCardIdx >= updated.length && activeCardIdx > 0) {
      setActiveCardIdx(updated.length - 1);
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

  // Fetch Daily Practice Data
  const loadDailyContent = async (diff = difficulty) => {
    setIsDailyLoading(true);
    setDailyError(null);
    try {
      const res = await fetch('/api/learn/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceLang, targetLang, difficulty: diff })
      });
      if (!res.ok) throw new Error('Failed to generate daily practice.');
      const data = await res.json();
      setDailyData(data);

      // Reset daily quiz states
      setDailyQuizStep(0);
      setDailyQuizAnswers({});
      setDailyQuizSubmitted({});
      setDailyQuizScore(0);
      setDailyQuizFinished(false);
    } catch (err: any) {
      setDailyError(err.message || 'Failed to load daily content.');
    } finally {
      setIsDailyLoading(false);
    }
  };

  // Generate Custom Quiz from saved vocabulary
  const startCustomQuiz = async () => {
    if (savedWords.length === 0) return;
    setIsCustomQuizLoading(true);
    try {
      const res = await fetch('/api/learn/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ words: savedWords, sourceLang, targetLang })
      });
      if (!res.ok) throw new Error('Failed to generate quiz');
      const data = await res.json();
      if (data.success && data.quiz) {
        setCustomQuiz(data.quiz);
        setCustomQuizStep(0);
        setCustomQuizAnswers({});
        setCustomQuizSubmitted({});
        setCustomQuizScore(0);
        setCustomQuizFinished(false);
        setActiveTab('quizzes');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to start custom quiz.');
    } finally {
      setIsCustomQuizLoading(false);
    }
  };

  // Handle analyzer quiz submissions
  const handleSelectAnalyzerOption = (qIdx: number, oIdx: number) => {
    if (analyzerQuizSubmitted[qIdx] || !result) return;
    
    const correctIdx = result.quizzes[qIdx].correctOptionIndex;
    const isCorrect = oIdx === correctIdx;
    
    setAnalyzerQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
    setAnalyzerQuizSubmitted(prev => ({ ...prev, [qIdx]: true }));
    if (isCorrect) {
      setAnalyzerQuizScore(prev => prev + 1);
    }
  };

  // Handle daily quiz submissions
  const handleSelectDailyOption = (qIdx: number, oIdx: number) => {
    if (dailyQuizSubmitted[qIdx] || !dailyData) return;

    const correctIdx = dailyData.dailyQuiz[qIdx].correctOptionIndex;
    const isCorrect = oIdx === correctIdx;

    setDailyQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
    setDailyQuizSubmitted(prev => ({ ...prev, [qIdx]: true }));
    if (isCorrect) {
      setDailyQuizScore(prev => prev + 1);
    }
  };

  // Handle custom quiz submissions
  const handleSelectCustomOption = (qIdx: number, oIdx: number) => {
    if (customQuizSubmitted[qIdx] || !customQuiz) return;

    const correctIdx = customQuiz[qIdx].correctOptionIndex;
    const isCorrect = oIdx === correctIdx;

    setCustomQuizAnswers(prev => ({ ...prev, [qIdx]: oIdx }));
    setCustomQuizSubmitted(prev => ({ ...prev, [qIdx]: true }));
    if (isCorrect) {
      setCustomQuizScore(prev => prev + 1);
    }
  };

  // Flashcards navigation
  const nextFlashcard = () => {
    setIsCardFlipped(false);
    setTimeout(() => {
      setActiveCardIdx(prev => (prev + 1) % savedWords.length);
    }, 150);
  };

  const prevFlashcard = () => {
    setIsCardFlipped(false);
    setTimeout(() => {
      setActiveCardIdx(prev => (prev - 1 + savedWords.length) % savedWords.length);
    }, 150);
  };

  const diffCfg = result ? (DIFFICULTY_CONFIG[result.difficultyLevel] ?? DIFFICULTY_CONFIG.Intermediate) : null;

  return (
    <div className="min-h-screen flex flex-col">
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .transform-style-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

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
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">AI explains rationales, corrections, guides, & quizzes</p>
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

          {/* ── Segment Toggle Mode ── */}
          <div className="flex justify-center">
            <div className="flex p-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-sm">
              <button
                onClick={() => setActiveMode('analyzer')}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeMode === 'analyzer'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                Word Analyzer
              </button>
              <button
                onClick={() => {
                  setActiveMode('daily');
                  if (!dailyData) loadDailyContent();
                }}
                className={`flex items-center gap-2 px-6 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeMode === 'daily'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Daily Practice
              </button>
            </div>
          </div>

          {/* ── WORD ANALYZER MODE ── */}
          {activeMode === 'analyzer' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Search panel */}
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

              {/* Error */}
              {error && (
                <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 animate-in fade-in duration-300">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">Analysis failed</p>
                    <p className="text-xs mt-0.5 opacity-80">{error}</p>
                  </div>
                </div>
              )}

              {/* Loading skeleton */}
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

              {/* Results */}
              {result && !isLoading && (
                <div className="space-y-4 animate-in fade-in duration-400">
                  {/* Hero card */}
                  <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
                    <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-gradient-to-br from-amber-400/15 to-orange-400/10 blur-2xl pointer-events-none" />

                    <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {result.isMock && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider animate-pulse">Mock Mode</span>
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

                      <div className="flex flex-col gap-2 shrink-0 w-full sm:w-auto">
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
                      <button key={tab.id} onClick={() => { setActiveTab(tab.id); setCustomQuiz(null); }}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer shrink-0 border ${activeTab === tab.id && !customQuiz ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white border-transparent shadow-md shadow-amber-500/20' : 'bg-white/70 dark:bg-slate-800/70 border-slate-200/50 dark:border-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:text-amber-600 dark:hover:text-amber-400'}`}>
                        <tab.icon className="w-3.5 h-3.5" />
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Tab content */}
                  <div className="animate-in fade-in duration-300">

                    {/* OVERVIEW */}
                    {activeTab === 'overview' && !customQuiz && (
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
                    {activeTab === 'grammar' && !customQuiz && (
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

                    {/* TRANSLATION DEEP DIVE (Rationale & Alternatives) */}
                    {activeTab === 'translationDeep' && !customQuiz && (
                      <div className="space-y-4">
                        <SectionCard title="AI Translation Rationale" icon={Sparkles} accent="amber">
                          <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-slate-705 dark:text-slate-200 leading-relaxed text-sm">
                            <p className="font-semibold text-amber-600 dark:text-amber-400 mb-1">Why this translation was chosen:</p>
                            <p>{result.translationExplanation?.whyChosen || 'No rational explanation generated for this translation.'}</p>
                          </div>
                        </SectionCard>

                        <SectionCard title="Alternative Translations" icon={Repeat2} accent="violet">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {result.translationExplanation?.alternatives && result.translationExplanation.alternatives.length > 0 ? (
                              result.translationExplanation.alternatives.map((alt, i) => (
                                <div key={i} className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 space-y-2 flex flex-col justify-between">
                                  <div>
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{alt.word}</span>
                                      <button onClick={() => speakText(alt.word, result.targetLang)}
                                        className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors">
                                        <Volume2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-450 italic mt-0.5">{alt.meaning}</p>
                                  </div>
                                  <div className="pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center gap-1.5 text-[11px] text-violet-600 dark:text-violet-400 font-medium">
                                    <Info className="w-3 h-3 shrink-0" />
                                    <span className="truncate">{alt.usageContext}</span>
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="text-xs text-slate-400 italic py-4 col-span-2 text-center">No alternatives available.</p>
                            )}
                          </div>
                        </SectionCard>
                      </div>
                    )}

                    {/* EXAMPLES */}
                    {activeTab === 'examples' && !customQuiz && (
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
                    {activeTab === 'vocabulary' && !customQuiz && (
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
                            {savedWords.length > 0 && (
                              <button onClick={startCustomQuiz} disabled={isCustomQuizLoading}
                                className="w-full mb-3 flex items-center justify-center gap-2 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/10 hover:shadow-lg transition-all cursor-pointer">
                                {isCustomQuizLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListTodo className="w-3.5 h-3.5" />}
                                Practice Saved Vocabulary ({savedWords.length})
                              </button>
                            )}
                            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                              {savedWords.length === 0 ? (
                                <p className="text-xs text-slate-400 dark:text-slate-500 italic text-center py-4">Save words using the ★ button to build your vocabulary list.</p>
                              ) : (
                                savedWords.map((sw, i) => (
                                  <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/40">
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{sw.word}</p>
                                      <p className="text-xs italic text-amber-600 dark:text-amber-400 truncate">{sw.translation}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 shrink-0">
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
                      </div>
                    )}

                    {/* QUIZZES TAB (Word Quiz or Custom Vocabulary Quiz) */}
                    {activeTab === 'quizzes' && (
                      <div className="space-y-4">
                        {customQuiz ? (
                          /* Render Custom Quiz */
                          <SectionCard title="Saved Vocabulary Quiz" icon={ListTodo} accent="violet">
                            {customQuizFinished ? (
                              <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-300">
                                <Award className="w-16 h-16 text-amber-500 mx-auto animate-bounce" />
                                <div className="space-y-1">
                                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Quiz Completed!</h3>
                                  <p className="text-2xl font-black text-violet-600 dark:text-violet-400">Score: {customQuizScore} / {customQuiz.length}</p>
                                </div>
                                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                  {customQuizScore === customQuiz.length ? 'Perfect score! You have completely mastered these words.' : 'Great effort! Keep practicing to strengthen your memory.'}
                                </p>
                                <div className="flex justify-center gap-3">
                                  <button onClick={startCustomQuiz} className="px-5 py-2.5 rounded-xl bg-violet-600 text-white font-bold text-xs shadow-md shadow-violet-500/10 hover:bg-violet-750 transition-all cursor-pointer">
                                    Take Another Quiz
                                  </button>
                                  <button onClick={() => setCustomQuiz(null)} className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/40 dark:border-slate-700/45 font-bold text-xs transition-all cursor-pointer">
                                    Return to Word Quiz
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-5">
                                {/* Header / Progress */}
                                <div className="flex items-center justify-between text-xs text-slate-500 font-bold font-mono">
                                  <span>QUESTION {customQuizStep + 1} OF {customQuiz.length}</span>
                                  <span>{Math.round(((customQuizStep) / customQuiz.length) * 100)}% COMPLETE</span>
                                </div>
                                <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                  <div className="bg-violet-500 h-full transition-all duration-300" style={{ width: `${((customQuizStep + 1) / customQuiz.length) * 100}%` }} />
                                </div>

                                {/* Question body */}
                                <div className="space-y-4">
                                  <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100 leading-snug">{customQuiz[customQuizStep].question}</h4>
                                  
                                  <div className="grid grid-cols-1 gap-2.5">
                                    {customQuiz[customQuizStep].options.map((opt: string, oIdx: number) => {
                                      const isSubmitted = customQuizSubmitted[customQuizStep];
                                      const selectedIdx = customQuizAnswers[customQuizStep];
                                      const correctIdx = customQuiz[customQuizStep].correctOptionIndex;

                                      let optStyles = 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300';
                                      let optIcon = null;

                                      if (isSubmitted) {
                                        if (oIdx === correctIdx) {
                                          optStyles = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold';
                                          optIcon = <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
                                        } else if (oIdx === selectedIdx) {
                                          optStyles = 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-450 font-bold';
                                          optIcon = <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
                                        } else {
                                          optStyles = 'bg-slate-50 dark:bg-slate-800 border-slate-200/20 text-slate-400 opacity-60';
                                        }
                                      }

                                      return (
                                        <button
                                          key={oIdx}
                                          onClick={() => handleSelectCustomOption(customQuizStep, oIdx)}
                                          disabled={isSubmitted}
                                          className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left text-xs transition-all cursor-pointer ${optStyles}`}
                                        >
                                          <span>{opt}</span>
                                          {optIcon}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Explanation Banner */}
                                {customQuizSubmitted[customQuizStep] && (
                                  <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/10 text-xs text-slate-705 dark:text-slate-300 leading-relaxed animate-in fade-in duration-200">
                                    <p className="font-bold text-violet-600 dark:text-violet-400 mb-1 flex items-center gap-1">
                                      <Info className="w-3.5 h-3.5" /> Explanation:
                                    </p>
                                    <p>{customQuiz[customQuizStep].explanation}</p>
                                  </div>
                                )}

                                {/* Bottom navigation */}
                                {customQuizSubmitted[customQuizStep] && (
                                  <div className="flex justify-end pt-2">
                                    <button
                                      onClick={() => {
                                        if (customQuizStep + 1 < customQuiz.length) {
                                          setCustomQuizStep(prev => prev + 1);
                                        } else {
                                          setCustomQuizFinished(true);
                                        }
                                      }}
                                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/10 hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                                    >
                                      {customQuizStep + 1 < customQuiz.length ? (
                                        <>Next Question <ChevronRight className="w-3.5 h-3.5" /></>
                                      ) : (
                                        'Finish Quiz'
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </SectionCard>
                        ) : (
                          /* Render Word Quiz */
                          <SectionCard title={`Vocabulary Quiz: "${result.word}"`} icon={ListTodo} accent="amber">
                            {result.quizzes && result.quizzes.length > 0 ? (
                              analyzerQuizFinished ? (
                                <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-300">
                                  <Award className="w-16 h-16 text-amber-500 mx-auto animate-bounce" />
                                  <div className="space-y-1">
                                    <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">Quiz Finished!</h3>
                                    <p className="text-2xl font-black text-amber-600 dark:text-amber-400">Score: {analyzerQuizScore} / {result.quizzes.length}</p>
                                  </div>
                                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                                    Mastering a word requires contextual practice. Keep searching and saving words to build your custom tests!
                                  </p>
                                  <div className="flex justify-center gap-3">
                                    <button
                                      onClick={() => {
                                        setAnalyzerQuizStep(0);
                                        setAnalyzerQuizAnswers({});
                                        setAnalyzerQuizSubmitted({});
                                        setAnalyzerQuizScore(0);
                                        setAnalyzerQuizFinished(false);
                                      }}
                                      className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
                                    >
                                      Try Again
                                    </button>
                                    {savedWords.length > 0 && (
                                      <button onClick={startCustomQuiz} className="px-5 py-2.5 rounded-xl bg-violet-650 hover:bg-violet-750 text-white font-bold text-xs shadow-md transition-all cursor-pointer">
                                        Practice Vocabulary List
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-5">
                                  {/* Header / Progress */}
                                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold font-mono">
                                    <span>QUESTION {analyzerQuizStep + 1} OF {result.quizzes.length}</span>
                                    <span>{Math.round(((analyzerQuizStep) / result.quizzes.length) * 100)}% COMPLETE</span>
                                  </div>
                                  <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${((analyzerQuizStep + 1) / result.quizzes.length) * 100}%` }} />
                                  </div>

                                  {/* Question body */}
                                  <div className="space-y-4">
                                    <h4 className="text-base font-extrabold text-slate-800 dark:text-slate-100 leading-snug">{result.quizzes[analyzerQuizStep].question}</h4>

                                    <div className="grid grid-cols-1 gap-2.5">
                                      {result.quizzes[analyzerQuizStep].options.map((opt, oIdx) => {
                                        const isSubmitted = analyzerQuizSubmitted[analyzerQuizStep];
                                        const selectedIdx = analyzerQuizAnswers[analyzerQuizStep];
                                        const correctIdx = result.quizzes[analyzerQuizStep].correctOptionIndex;

                                        let optStyles = 'bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-300';
                                        let optIcon = null;

                                        if (isSubmitted) {
                                          if (oIdx === correctIdx) {
                                            optStyles = 'bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400 font-bold';
                                            optIcon = <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
                                          } else if (oIdx === selectedIdx) {
                                            optStyles = 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-450 font-bold';
                                            optIcon = <XCircle className="w-4 h-4 text-rose-500 shrink-0" />;
                                          } else {
                                            optStyles = 'bg-slate-50 dark:bg-slate-800 border-slate-200/20 text-slate-400 opacity-60';
                                          }
                                        }

                                        return (
                                          <button
                                            key={oIdx}
                                            onClick={() => handleSelectAnalyzerOption(analyzerQuizStep, oIdx)}
                                            disabled={isSubmitted}
                                            className={`w-full flex items-center justify-between p-3.5 rounded-2xl border text-left text-xs transition-all cursor-pointer ${optStyles}`}
                                          >
                                            <span>{opt}</span>
                                            {optIcon}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {/* Explanation Banner */}
                                  {analyzerQuizSubmitted[analyzerQuizStep] && (
                                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 text-xs text-slate-705 dark:text-slate-300 leading-relaxed animate-in fade-in duration-200">
                                      <p className="font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1">
                                        <Info className="w-3.5 h-3.5" /> Explanation:
                                      </p>
                                      <p>{result.quizzes[analyzerQuizStep].explanation}</p>
                                    </div>
                                  )}

                                  {/* Bottom navigation */}
                                  {analyzerQuizSubmitted[analyzerQuizStep] && (
                                    <div className="flex justify-end pt-2">
                                      <button
                                        onClick={() => {
                                          if (analyzerQuizStep + 1 < result.quizzes.length) {
                                            setAnalyzerQuizStep(prev => prev + 1);
                                          } else {
                                            setAnalyzerQuizFinished(true);
                                          }
                                        }}
                                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md shadow-amber-500/10 hover:shadow-lg transition-all cursor-pointer flex items-center gap-1.5"
                                      >
                                        {analyzerQuizStep + 1 < result.quizzes.length ? (
                                          <>Next Question <ChevronRight className="w-3.5 h-3.5" /></>
                                        ) : (
                                          'Finish Quiz'
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )
                            ) : (
                              <p className="text-xs text-slate-400 italic py-4 text-center">No quizzes generated for this word.</p>
                            )}
                          </SectionCard>
                        )}
                      </div>
                    )}

                    {/* SYNONYMS */}
                    {activeTab === 'synonyms' && !customQuiz && (
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
                    {activeTab === 'culture' && !customQuiz && (
                      <SectionCard title="Cultural Context & Usage Notes" icon={Globe} accent="emerald">
                        <div className="p-4 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/40 dark:border-emerald-800/40">
                          <p className="text-sm text-emerald-800 dark:text-emerald-300 leading-relaxed">🌍 {result.culturalNote}</p>
                        </div>
                      </SectionCard>
                    )}
                  </div>
                </div>
              )}

              {/* Saved vocabulary list (always shown below if words exist and no active result) */}
              {!result && !isLoading && savedWords.length > 0 && (
                <div className="glass-panel rounded-3xl p-5 space-y-4">
                  <div className="flex items-center gap-2 justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                      <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Your Vocabulary List ({savedWords.length})</h2>
                    </div>
                    <button onClick={startCustomQuiz} disabled={isCustomQuizLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-violet-200 hover:border-violet-300 dark:border-slate-700 dark:hover:border-slate-600 text-violet-600 dark:text-violet-400 font-bold text-[11px] hover:bg-violet-500/5 transition-all cursor-pointer">
                      {isCustomQuizLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ListTodo className="w-3.5 h-3.5" />}
                      Practice Quiz
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {savedWords.map((sw, i) => (
                      <div key={i} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/40 hover:border-amber-400 dark:hover:border-amber-600/50 transition-all text-left group">
                        <button onClick={() => { setInputWord(sw.word); handleAnalyze(sw.word); }} className="min-w-0 flex-1 text-left">
                          <p className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors truncate">{sw.word}</p>
                          <p className="text-xs italic text-amber-600 dark:text-amber-400 truncate">{sw.translation}</p>
                        </button>
                        <button onClick={() => handleRemoveWord(i)} className="text-slate-400 hover:text-red-500 text-sm font-bold px-1 rounded hover:bg-slate-200/30">
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── DAILY PRACTICE MODE ── */}
          {activeMode === 'daily' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {/* Settings segment panel */}
              <div className="glass-panel rounded-3xl p-5 flex flex-wrap gap-4 items-center justify-between">
                <div className="flex flex-wrap gap-4 items-center">
                  <MiniLangSelect value={sourceLang} onChange={setSourceLang} label="Learning From" />
                  <div className="flex items-center justify-center pt-4">
                    <ArrowUpRight className="w-4 h-4 text-slate-400" />
                  </div>
                  <MiniLangSelect value={targetLang} onChange={setTargetLang} label="Learning In" />
                  
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Difficulty Level</label>
                    <select
                      value={difficulty}
                      onChange={(e) => {
                        const newDiff = e.target.value as any;
                        setDifficulty(newDiff);
                        loadDailyContent(newDiff);
                      }}
                      className="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 text-slate-700 dark:text-slate-200 text-xs focus:outline-none focus:border-amber-400"
                    >
                      <option value="Beginner">🌱 Beginner</option>
                      <option value="Intermediate">📚 Intermediate</option>
                      <option value="Advanced">🎓 Advanced</option>
                      <option value="Expert">🏆 Expert</option>
                    </select>
                  </div>
                </div>

                <button onClick={() => loadDailyContent()} disabled={isDailyLoading}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 hover:border-amber-400 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 shadow-sm hover:shadow transition-all cursor-pointer">
                  <RefreshCw className={`w-3.5 h-3.5 ${isDailyLoading ? 'animate-spin' : ''}`} />
                  Refresh Daily Content
                </button>
              </div>

              {/* Loading State */}
              {isDailyLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="glass-panel rounded-3xl p-6 h-64 animate-pulse bg-slate-100/50 dark:bg-slate-800/40" />
                  <div className="glass-panel rounded-3xl p-6 h-64 animate-pulse bg-slate-100/50 dark:bg-slate-800/40" />
                </div>
              )}

              {/* Error State */}
              {dailyError && !isDailyLoading && (
                <div className="flex items-start gap-3 px-5 py-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold">Failed to load daily practice</p>
                    <p className="text-xs mt-0.5 opacity-80">{dailyError}</p>
                  </div>
                </div>
              )}

              {/* Daily Content Render */}
              {dailyData && !isDailyLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                  
                  {/* LEFT: Word of the Day */}
                  <div className="space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-1">Word of the Day</h3>
                    <div className="glass-panel rounded-3xl p-6 relative overflow-hidden space-y-4">
                      {/* Gradient decoration */}
                      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-gradient-to-br from-amber-500/10 to-orange-500/5 blur-2xl pointer-events-none" />
                      
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">Word of the Day</span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">{dailyData.wordOfTheDay.partOfSpeech}</span>
                        </div>
                        <div className="flex items-end gap-3 flex-wrap">
                          <h2 className="text-3xl font-black text-slate-800 dark:text-slate-100 leading-none">{dailyData.wordOfTheDay.word}</h2>
                          <div className="flex items-center gap-1.5 pb-0.5">
                            <span className="text-slate-400 text-sm">→</span>
                            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">{dailyData.wordOfTheDay.translation}</span>
                            <button onClick={() => speakText(dailyData.wordOfTheDay.translation, targetLang)}
                              className="p-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 text-amber-400 hover:text-amber-600 transition-colors">
                              <Volume2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Pronunciation */}
                        <div className="flex items-center gap-2 pt-1.5">
                          <button onClick={() => speakText(dailyData.wordOfTheDay.word, sourceLang)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-amber-50/50 transition-all text-xs font-mono font-semibold">
                            <Volume2 className="w-3 h-3" />
                            {dailyData.wordOfTheDay.ipa}
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">Meaning</p>
                          <p className="text-sm text-slate-655 dark:text-slate-200 leading-relaxed">{dailyData.wordOfTheDay.meaning}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Example Sentence</p>
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-700/50 space-y-1.5">
                            <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">{dailyData.wordOfTheDay.exampleOriginal}</p>
                            <p className="text-xs italic text-slate-500 dark:text-slate-400 border-t border-dashed border-slate-200 dark:border-slate-700/60 pt-1.5">{dailyData.wordOfTheDay.exampleTranslated}</p>
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-800 dark:text-emerald-400 leading-relaxed">
                          💡 <span className="font-bold">Mnemonic Tip:</span> {dailyData.wordOfTheDay.memoryTip}
                        </div>
                      </div>

                      <div className="flex gap-2 pt-1.5">
                        <button
                          onClick={() => {
                            setInputWord(dailyData.wordOfTheDay.word);
                            setSourceLang(sourceLang);
                            setTargetLang(targetLang);
                            setActiveMode('analyzer');
                            handleAnalyze(dailyData.wordOfTheDay.word);
                          }}
                          className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md shadow-amber-500/10 transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          Deep Analyze Word
                        </button>
                        <button
                          onClick={() => handleSaveSpecificWord(dailyData.wordOfTheDay.word, dailyData.wordOfTheDay.translation, targetLang)}
                          className="px-3.5 py-2 rounded-xl border border-slate-200 hover:border-amber-400 dark:border-slate-700 dark:hover:border-slate-600 text-slate-655 dark:text-slate-305 transition-colors cursor-pointer"
                          title="Save to vocabulary list"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* RIGHT: Daily Challenge & Flashcards */}
                  <div className="space-y-6">
                    
                    {/* Daily Challenge Quiz */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-1">Daily Challenge</h3>
                      <div className="glass-panel rounded-3xl p-5">
                        {dailyQuizFinished ? (
                          <div className="text-center py-6 space-y-4 animate-in zoom-in-95 duration-300">
                            <Award className="w-12 h-12 text-amber-500 mx-auto animate-bounce" />
                            <div>
                              <h3 className="text-base font-bold text-slate-800 dark:text-slate-100">Daily Challenge Completed!</h3>
                              <p className="text-xl font-black text-amber-600 dark:text-amber-400">Score: {dailyQuizScore} / {dailyData.dailyQuiz.length}</p>
                            </div>
                            <button
                              onClick={() => {
                                setDailyQuizStep(0);
                                setDailyQuizAnswers({});
                                setDailyQuizSubmitted({});
                                setDailyQuizScore(0);
                                setDailyQuizFinished(false);
                              }}
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs transition-all cursor-pointer"
                            >
                              Practice Again
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-4">
                            {/* Progress bar */}
                            <div className="flex items-center justify-between text-[10px] text-slate-550 font-bold font-mono">
                              <span>QUESTION {dailyQuizStep + 1} OF {dailyData.dailyQuiz.length}</span>
                              <span>{dailyQuizScore} RIGHT</span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-800 h-1 rounded-full overflow-hidden">
                              <div className="bg-amber-500 h-full transition-all duration-300" style={{ width: `${((dailyQuizStep + 1) / dailyData.dailyQuiz.length) * 100}%` }} />
                            </div>

                            {/* Question body */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 leading-snug">{dailyData.dailyQuiz[dailyQuizStep].question}</h4>

                              <div className="grid grid-cols-1 gap-2">
                                {dailyData.dailyQuiz[dailyQuizStep].options.map((opt: string, oIdx: number) => {
                                  const isSubmitted = dailyQuizSubmitted[dailyQuizStep];
                                  const selectedIdx = dailyQuizAnswers[dailyQuizStep];
                                  const correctIdx = dailyData.dailyQuiz[dailyQuizStep].correctOptionIndex;

                                  let optStyles = 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-800 border-slate-200/60 dark:border-slate-700/65 text-slate-700 dark:text-slate-300';
                                  let optIcon = null;

                                  if (isSubmitted) {
                                    if (oIdx === correctIdx) {
                                      optStyles = 'bg-emerald-550/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-450 font-bold';
                                      optIcon = <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
                                    } else if (oIdx === selectedIdx) {
                                      optStyles = 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-450 font-bold';
                                      optIcon = <XCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
                                    } else {
                                      optStyles = 'bg-slate-50 dark:bg-slate-850 border-slate-200/20 text-slate-400 opacity-60';
                                    }
                                  }

                                  return (
                                    <button
                                      key={oIdx}
                                      onClick={() => handleSelectDailyOption(dailyQuizStep, oIdx)}
                                      disabled={isSubmitted}
                                      className={`w-full flex items-center justify-between p-3 rounded-xl border text-left text-xs transition-all cursor-pointer ${optStyles}`}
                                    >
                                      <span>{opt}</span>
                                      {optIcon}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Explanation Banner */}
                            {dailyQuizSubmitted[dailyQuizStep] && (
                              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 text-[11px] text-slate-705 dark:text-slate-300 leading-relaxed animate-in fade-in duration-200">
                                <p className="font-bold text-amber-600 dark:text-amber-400 mb-0.5 flex items-center gap-1">
                                  <Info className="w-3.5 h-3.5" /> Explanation:
                                </p>
                                <p>{dailyData.dailyQuiz[dailyQuizStep].explanation}</p>
                              </div>
                            )}

                            {/* Bottom navigation */}
                            {dailyQuizSubmitted[dailyQuizStep] && (
                              <div className="flex justify-end pt-1">
                                <button
                                  onClick={() => {
                                    if (dailyQuizStep + 1 < dailyData.dailyQuiz.length) {
                                      setDailyQuizStep(prev => prev + 1);
                                    } else {
                                      setDailyQuizFinished(true);
                                    }
                                  }}
                                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-md transition-all cursor-pointer flex items-center gap-1"
                                >
                                  {dailyQuizStep + 1 < dailyData.dailyQuiz.length ? (
                                    <>Next Question <ChevronRight className="w-3 h-3" /></>
                                  ) : (
                                    'Finish Challenge'
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Vocabulary Flashcards */}
                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 pl-1">Vocab Flashcards</h3>
                      {savedWords.length === 0 ? (
                        <div className="glass-panel rounded-3xl p-5 text-center text-xs text-slate-450 italic">
                          <BookMarked className="w-8 h-8 text-slate-300 dark:text-slate-655 mx-auto mb-2" />
                          Save words in the Word Analyzer to practice flashcards here.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {/* Flashcard 3D structure */}
                          <div className="perspective-1000 w-full h-48 cursor-pointer" onClick={() => setIsCardFlipped(!isCardFlipped)}>
                            <div className={`transform-style-3d w-full h-full relative transition-transform duration-500 ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                              
                              {/* FRONT SIDE */}
                              <div className="backface-hidden w-full h-full absolute inset-0 rounded-3xl bg-gradient-to-br from-amber-50 to-amber-100/30 dark:from-slate-800 dark:to-slate-800/80 border border-amber-200/50 dark:border-slate-700/60 p-6 flex flex-col justify-between shadow-sm">
                                <div className="flex justify-between items-start">
                                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[9px] font-bold uppercase font-mono">Word {activeCardIdx + 1} of {savedWords.length}</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Click card to Flip</span>
                                </div>
                                <div className="text-center space-y-1.5">
                                  <h3 className="text-2xl font-black text-slate-805 dark:text-white truncate">{savedWords[activeCardIdx].word}</h3>
                                  <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 italic">Target language: {getLanguageByCode(savedWords[activeCardIdx].lang)?.name}</p>
                                </div>
                                <div className="flex justify-between items-center text-slate-400">
                                  <button onClick={(e) => { e.stopPropagation(); speakText(savedWords[activeCardIdx].word, 'en'); }} className="p-2 rounded-xl hover:bg-amber-500/10 hover:text-amber-500 transition-colors">
                                    <Volume2 className="w-4 h-4" />
                                  </button>
                                  <span className="text-[10px] font-semibold text-slate-400/80">Question card</span>
                                </div>
                              </div>

                              {/* BACK SIDE */}
                              <div className="backface-hidden rotate-y-180 w-full h-full absolute inset-0 rounded-3xl bg-gradient-to-br from-indigo-50 to-indigo-100/30 dark:from-slate-850 dark:to-slate-850/80 border border-indigo-200/50 dark:border-slate-700/60 p-6 flex flex-col justify-between shadow-sm">
                                <div className="flex justify-between items-start">
                                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 text-[9px] font-bold uppercase font-mono">Answer Revealed</span>
                                  <span className="text-[10px] text-slate-400 font-bold uppercase">Click to Flip Back</span>
                                </div>
                                <div className="text-center space-y-1">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Translation</p>
                                  <h3 className="text-2xl font-black text-indigo-600 dark:text-indigo-400 truncate">{savedWords[activeCardIdx].translation}</h3>
                                </div>
                                <div className="flex justify-between items-center text-slate-400">
                                  <button onClick={(e) => { e.stopPropagation(); speakText(savedWords[activeCardIdx].translation, savedWords[activeCardIdx].lang); }} className="p-2 rounded-xl hover:bg-indigo-500/10 hover:text-indigo-500 transition-colors">
                                    <Volume2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRemoveWord(activeCardIdx);
                                    }}
                                    className="px-2.5 py-1 rounded-lg hover:bg-red-500/10 text-red-505 dark:text-red-400 text-[10px] font-bold transition-all border border-red-500/20"
                                  >
                                    Mark as Learned
                                  </button>
                                </div>
                              </div>

                            </div>
                          </div>

                          {/* Navigation buttons */}
                          <div className="flex gap-2">
                            <button onClick={prevFlashcard} className="flex-1 py-2 border border-slate-200 hover:border-amber-400 dark:border-slate-700 dark:hover:border-slate-600 text-slate-655 dark:text-slate-305 font-bold text-xs rounded-xl transition-all cursor-pointer">
                              &larr; Previous
                            </button>
                            <button onClick={nextFlashcard} className="flex-1 py-2 border border-slate-200 hover:border-amber-400 dark:border-slate-700 dark:hover:border-slate-600 text-slate-655 dark:text-slate-305 font-bold text-xs rounded-xl transition-all cursor-pointer">
                              Next &rarr;
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              )}
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
