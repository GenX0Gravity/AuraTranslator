'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Send,
  Trash2,
  ArrowLeft,
  Volume2,
  Sparkles,
  MessageCircle,
  Languages,
  Loader2,
  AlertCircle,
  User,
  Users,
  GraduationCap,
  BarChart2,
} from 'lucide-react';
import Link from 'next/link';
import { LANGUAGES, getLanguageName, getLanguageByCode } from '@/utils/languages';
import ThemeToggle from '@/components/ThemeToggle';
import { trackEvent } from '@/utils/analytics';

// ─── Types ────────────────────────────────────────────────────────────────────

type Speaker = 'A' | 'B';

interface ConversationMessage {
  id: string;
  speaker: Speaker;
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: Date;
  isTranslating?: boolean;
}

// ─── Compact inline language picker ──────────────────────────────────────────

interface LangPickerProps {
  value: string;
  onChange: (code: string) => void;
  side: 'A' | 'B';
  disabled?: boolean;
}

function LangPicker({ value, onChange, side, disabled }: LangPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const filtered = LANGUAGES.filter((l) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return l.name.toLowerCase().includes(q) || l.nativeName.toLowerCase().includes(q) || l.code === q;
  });

  const current = getLanguageByCode(value);
  const accentA = 'from-blue-500 to-indigo-600';
  const accentB = 'from-emerald-500 to-teal-600';
  const accent = side === 'A' ? accentA : accentB;
  const ringA = 'ring-blue-500/30 focus:ring-blue-500/40';
  const ringB = 'ring-emerald-500/30 focus:ring-emerald-500/40';
  const ring = side === 'A' ? ringA : ringB;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 shadow-sm backdrop-blur-md hover:shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ring-2 ${ring} text-slate-800 dark:text-slate-200 font-medium text-sm`}
        aria-label={`Select language for Person ${side}`}
      >
        <span className="text-lg leading-none">{current?.flag ?? '🌐'}</span>
        <span className="truncate max-w-[110px] hidden sm:inline">{current?.name ?? value}</span>
        <span className={`w-5 h-5 rounded-full bg-gradient-to-br ${accent} flex items-center justify-center text-white text-[10px] font-black shrink-0`}>
          {side}
        </span>
      </button>

      {open && (
        <div className={`absolute z-50 mt-2 w-64 bg-white/97 dark:bg-slate-900/97 border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 ${side === 'B' ? 'right-0' : 'left-0'}`}>
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2 px-3">
            <span className="text-slate-400 text-sm">🔍</span>
            <input
              autoFocus
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search language…"
              className="w-full bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none py-1"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.map((lang) => (
              <li
                key={lang.code}
                onClick={() => { onChange(lang.code); setOpen(false); setQuery(''); }}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors text-sm ${lang.code === value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-semibold' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
              >
                <span className="text-lg shrink-0">{lang.flag}</span>
                <span className="truncate">{lang.name}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 truncate">({lang.nativeName})</span>
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="px-4 py-3 text-xs text-center text-slate-400">No languages found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  msg: ConversationMessage;
  onSpeak: (msg: ConversationMessage) => void;
}

function MessageBubble({ msg, onSpeak }: BubbleProps) {
  const isA = msg.speaker === 'A';

  const time = msg.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  return (
    <div className={`flex gap-2.5 items-end ${isA ? 'flex-row' : 'flex-row-reverse'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-black shadow-md mb-0.5 ${isA ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'}`}>
        {isA ? 'A' : 'B'}
      </div>

      {/* Bubble group */}
      <div className={`flex flex-col gap-1 max-w-[75%] ${isA ? 'items-start' : 'items-end'}`}>
        {/* Original text */}
        <div className={`px-4 py-3 rounded-2xl ${isA ? 'rounded-bl-sm bg-gradient-to-br from-blue-500 to-indigo-600 text-white' : 'rounded-br-sm bg-gradient-to-br from-emerald-500 to-teal-600 text-white'} shadow-md`}>
          <p className="text-sm font-medium leading-relaxed">{msg.originalText}</p>
          <div className={`mt-0.5 text-[10px] font-semibold opacity-70 uppercase tracking-wide ${isA ? 'text-blue-100' : 'text-emerald-100'}`}>
            {getLanguageName(msg.sourceLang)}
          </div>
        </div>

        {/* Translated text */}
        <div className={`px-4 py-3 rounded-2xl ${isA ? 'rounded-tl-sm bg-white/90 dark:bg-slate-800/90 border border-blue-100 dark:border-slate-700/60' : 'rounded-tr-sm bg-white/90 dark:bg-slate-800/90 border border-emerald-100 dark:border-slate-700/60'} shadow-sm backdrop-blur-sm`}>
          {msg.isTranslating ? (
            <div className="flex items-center gap-2 text-slate-400 dark:text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span className="text-xs italic">Translating…</span>
            </div>
          ) : (
            <>
              <p className={`text-sm leading-relaxed italic ${isA ? 'text-blue-700 dark:text-blue-300' : 'text-emerald-700 dark:text-emerald-300'}`}>
                {msg.translatedText}
              </p>
              <div className={`mt-0.5 text-[10px] font-semibold opacity-60 uppercase tracking-wide ${isA ? 'text-blue-500 dark:text-blue-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                {getLanguageName(msg.targetLang)}
              </div>
            </>
          )}
        </div>

        {/* Actions + Time */}
        <div className={`flex items-center gap-2 px-1 ${isA ? '' : 'flex-row-reverse'}`}>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">{time}</span>
          {!msg.isTranslating && msg.translatedText && (
            <button
              onClick={() => onSpeak(msg)}
              className={`p-1 rounded-full transition-colors ${isA ? 'hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-400 hover:text-blue-600' : 'hover:bg-emerald-50 dark:hover:bg-emerald-900/20 text-emerald-400 hover:text-emerald-600'}`}
              title="Speak translation aloud"
            >
              <Volume2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Conversation Page ───────────────────────────────────────────────────

export default function ConversationPage() {
  // Language state
  const [langA, setLangA] = useState('en');
  const [langB, setLangB] = useState('es');

  // Messages
  const [messages, setMessages] = useState<ConversationMessage[]>([]);

  // Speech recognition
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<Speaker | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');
  const recognitionRef = useRef<any>(null);

  // Manual input
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');

  // Misc
  const [isAutoSpeak, setIsAutoSpeak] = useState(true);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputARef = useRef<HTMLInputElement>(null);
  const inputBRef = useRef<HTMLInputElement>(null);

  // ── Init speech recognition ────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      setIsSpeechSupported(!!SR);
    }
  }, []);

  // ── Auto-scroll to bottom ──────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, interimTranscript]);

  // ── Core: translate + add message ─────────────────────────────────────────
  const addMessage = useCallback(async (speaker: Speaker, originalText: string) => {
    if (!originalText.trim()) return;

    const sourceLang = speaker === 'A' ? langA : langB;
    const targetLang = speaker === 'A' ? langB : langA;

    const id = Math.random().toString(36).slice(2, 11);
    const msg: ConversationMessage = {
      id,
      speaker,
      originalText: originalText.trim(),
      translatedText: '',
      sourceLang,
      targetLang,
      timestamp: new Date(),
      isTranslating: true,
    };

    setMessages((prev) => [...prev, msg]);

    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: originalText.trim(), sourceLang, targetLang }),
      });
      const data = await res.json();
      const translated = data.translatedText ?? originalText;

      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, translatedText: translated, isTranslating: false } : m)),
      );

      // Track analytics event
      trackEvent('conversation_message', sourceLang, targetLang, { charCount: originalText.trim().length });

      // Auto-speak translated text
      if (isAutoSpeak && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const utter = new SpeechSynthesisUtterance(translated);
        utter.lang = targetLang;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utter);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, translatedText: '[Translation failed]', isTranslating: false } : m)),
      );
    }
  }, [langA, langB, isAutoSpeak]);

  // ── Speech-to-Text control ─────────────────────────────────────────────────
  const startListening = useCallback((speaker: Speaker) => {
    if (!isSpeechSupported) return;

    // Stop any current session
    if (recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
    }
    window.speechSynthesis?.cancel();

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = speaker === 'A' ? langA : langB;
    rec.continuous = false;
    rec.interimResults = true;

    rec.onstart = () => {
      setActiveSpeaker(speaker);
      setInterimTranscript('');
    };

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setInterimTranscript(interim || final);
      if (final) {
        setInterimTranscript('');
        addMessage(speaker, final);
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech' && e.error !== 'aborted') {
        console.error('STT error:', e.error);
      }
      setActiveSpeaker(null);
      setInterimTranscript('');
    };

    rec.onend = () => {
      setActiveSpeaker(null);
      setInterimTranscript('');
      recognitionRef.current = null;
    };

    recognitionRef.current = rec;
    rec.start();
  }, [isSpeechSupported, langA, langB, addMessage]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const handleMicClick = (speaker: Speaker) => {
    if (activeSpeaker === speaker) {
      stopListening();
    } else {
      startListening(speaker);
    }
  };

  // ── Speak translated message ───────────────────────────────────────────────
  const handleSpeak = (msg: ConversationMessage) => {
    if (!msg.translatedText || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(msg.translatedText);
    utter.lang = msg.targetLang;
    window.speechSynthesis.speak(utter);
  };

  // ── Manual send ───────────────────────────────────────────────────────────
  const handleSend = (speaker: Speaker) => {
    const text = speaker === 'A' ? inputA : inputB;
    if (!text.trim()) return;
    addMessage(speaker, text);
    if (speaker === 'A') setInputA('');
    else setInputB('');
  };

  const handleKeyDown = (e: React.KeyboardEvent, speaker: Speaker) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(speaker);
    }
  };

  // ── Clear conversation ─────────────────────────────────────────────────────
  const handleClear = () => {
    stopListening();
    window.speechSynthesis?.cancel();
    setMessages([]);
    setInterimTranscript('');
  };

  const langAInfo = getLanguageByCode(langA);
  const langBInfo = getLanguageByCode(langB);

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header ── */}
      <header className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200/50 dark:border-slate-800/50 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl z-10">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          {/* Back */}
          <Link
            href="/"
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-all shrink-0"
            aria-label="Back to translator"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          {/* Title */}
          <div className="flex items-center gap-2 mr-auto">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-violet-600 to-indigo-600 text-white shadow-md">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-400 dark:to-indigo-400 leading-tight">
                Live Conversation
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-tight">Real-time speech-to-speech translation</p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Analytics link */}
            <Link
              href="/analytics"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white shadow-sm hover:shadow-md transition-all border border-transparent cursor-pointer"
              title="Analytics dashboard"
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Analytics</span>
            </Link>

            {/* Learn link */}
            <Link
              href="/learn"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white shadow-sm hover:shadow-md transition-all border border-transparent cursor-pointer"
              title="Language learning module"
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Learn</span>
            </Link>

            {/* Auto-speak toggle */}
            <button
              onClick={() => setIsAutoSpeak(!isAutoSpeak)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${isAutoSpeak ? 'bg-violet-500/10 border-violet-500/25 text-violet-600 dark:text-violet-400' : 'bg-transparent border-slate-200/50 dark:border-slate-700/50 text-slate-500 dark:text-slate-400'}`}
              title="Toggle auto-speak translated text"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Auto-Speak</span>
            </button>

            {/* Clear */}
            {messages.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-all border border-slate-200/50 dark:border-slate-700/50 cursor-pointer"
                aria-label="Clear conversation"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* ── Language selectors bar ── */}
      <div className="shrink-0 px-4 sm:px-6 py-3 border-b border-slate-200/40 dark:border-slate-800/40 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          {/* Person A */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-sm shrink-0">A</div>
            <LangPicker value={langA} onChange={setLangA} side="A" disabled={activeSpeaker !== null} />
          </div>

          {/* Swap indicator */}
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            <Languages className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-400 dark:text-slate-500">vs</span>
          </div>

          {/* Person B */}
          <div className="flex items-center gap-2 flex-row-reverse">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-xs font-black shadow-sm shrink-0">B</div>
            <LangPicker value={langB} onChange={setLangB} side="B" disabled={activeSpeaker !== null} />
          </div>
        </div>
      </div>

      {/* ── Chat feed ── */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
        <div className="max-w-4xl mx-auto flex flex-col gap-4">
          {/* Empty state */}
          {messages.length === 0 && !interimTranscript && (
            <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center gap-4 py-12">
              <div className="p-5 rounded-3xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 dark:from-violet-500/5 dark:to-indigo-500/5 border border-violet-200/30 dark:border-violet-800/30">
                <Users className="w-10 h-10 text-violet-400 dark:text-violet-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1">Start the conversation</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs">
                  Person <span className="font-bold text-blue-500">A</span> speaks {langAInfo?.name ?? langA} · Person <span className="font-bold text-emerald-500">B</span> speaks {langBInfo?.name ?? langB}.<br />
                  Tap the mic or type a message below.
                </p>
              </div>

              {!isSpeechSupported && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-semibold max-w-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  Speech recognition not available. Use text input below.
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <MessageBubble key={msg.id} msg={msg} onSpeak={handleSpeak} />
          ))}

          {/* Interim live transcript */}
          {interimTranscript && (
            <div className={`flex gap-2.5 items-end ${activeSpeaker === 'A' ? 'flex-row' : 'flex-row-reverse'} animate-in fade-in duration-150`}>
              <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-black shadow-md mb-0.5 ${activeSpeaker === 'A' ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gradient-to-br from-emerald-500 to-teal-600'} animate-pulse`}>
                {activeSpeaker}
              </div>
              <div className={`px-4 py-3 rounded-2xl max-w-[75%] opacity-70 border-2 border-dashed ${activeSpeaker === 'A' ? 'rounded-bl-sm border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 bg-blue-50/80 dark:bg-blue-900/20' : 'rounded-br-sm border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 bg-emerald-50/80 dark:bg-emerald-900/20'}`}>
                <p className="text-sm italic leading-relaxed">{interimTranscript}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </main>

      {/* ── Input bars ── */}
      <div className="shrink-0 border-t border-slate-200/50 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto grid grid-cols-2 divide-x divide-slate-200/50 dark:divide-slate-800/50">
          {/* ─ Person A input ─ */}
          <div className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">A</div>
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                {langAInfo?.flag} {langAInfo?.name}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Mic A */}
              {isSpeechSupported && (
                <button
                  onClick={() => handleMicClick('A')}
                  disabled={activeSpeaker === 'B'}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 flex items-center justify-center relative disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeSpeaker === 'A'
                      ? 'bg-blue-500 border-blue-600 text-white shadow-md shadow-blue-500/30 scale-105'
                      : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:border-blue-400/50 hover:text-blue-500'
                  }`}
                  aria-label={activeSpeaker === 'A' ? 'Stop recording Person A' : 'Start recording Person A'}
                >
                  {activeSpeaker === 'A' ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500" />
                    </>
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              )}
              {/* Text input A */}
              <input
                ref={inputARef}
                type="text"
                value={inputA}
                onChange={(e) => setInputA(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'A')}
                placeholder={`Type in ${langAInfo?.name ?? 'your language'}…`}
                disabled={activeSpeaker !== null}
                className="flex-1 min-w-0 bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-400/50 transition-all disabled:opacity-50"
              />
              <button
                onClick={() => handleSend('A')}
                disabled={!inputA.trim() || activeSpeaker !== null}
                className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md hover:shadow-lg hover:shadow-blue-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                aria-label="Send Person A message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ─ Person B input ─ */}
          <div className="p-3 sm:p-4">
            <div className="flex items-center gap-2 mb-2 justify-end">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                {langBInfo?.name} {langBInfo?.flag}
              </span>
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-[9px] font-black shrink-0">B</div>
            </div>
            <div className="flex items-center gap-2 flex-row-reverse">
              {/* Mic B */}
              {isSpeechSupported && (
                <button
                  onClick={() => handleMicClick('B')}
                  disabled={activeSpeaker === 'A'}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer shrink-0 flex items-center justify-center relative disabled:opacity-40 disabled:cursor-not-allowed ${
                    activeSpeaker === 'B'
                      ? 'bg-emerald-500 border-emerald-600 text-white shadow-md shadow-emerald-500/30 scale-105'
                      : 'bg-white/80 dark:bg-slate-800/80 border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:border-emerald-400/50 hover:text-emerald-500'
                  }`}
                  aria-label={activeSpeaker === 'B' ? 'Stop recording Person B' : 'Start recording Person B'}
                >
                  {activeSpeaker === 'B' ? (
                    <>
                      <MicOff className="w-4 h-4" />
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-red-500" />
                    </>
                  ) : (
                    <Mic className="w-4 h-4" />
                  )}
                </button>
              )}
              {/* Text input B */}
              <input
                ref={inputBRef}
                type="text"
                value={inputB}
                onChange={(e) => setInputB(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, 'B')}
                placeholder={`Type in ${langBInfo?.name ?? 'your language'}…`}
                disabled={activeSpeaker !== null}
                className="flex-1 min-w-0 bg-white/80 dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60 rounded-xl px-3 py-2.5 text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/25 focus:border-emerald-400/50 transition-all disabled:opacity-50"
              />
              <button
                onClick={() => handleSend('B')}
                disabled={!inputB.trim() || activeSpeaker !== null}
                className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md hover:shadow-lg hover:shadow-emerald-500/25 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                aria-label="Send Person B message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Active speaker status bar */}
        {activeSpeaker && (
          <div className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold animate-in fade-in duration-200 ${activeSpeaker === 'A' ? 'bg-blue-500/8 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-emerald-500/8 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Person {activeSpeaker} is speaking in {activeSpeaker === 'A' ? langAInfo?.name : langBInfo?.name}… Tap mic to stop.
          </div>
        )}
      </div>
    </div>
  );
}
