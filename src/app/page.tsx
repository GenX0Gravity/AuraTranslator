'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowLeftRight, 
  Copy, 
  Check, 
  Volume2, 
  Loader2, 
  Sparkles, 
  Clock, 
  X, 
  AlertCircle,
  Globe,
  Mic,
  MicOff,
  Sliders,
  Play,
  Pause,
  Square,
  Upload,
  Download,
  MessageCircle,
  GraduationCap,
  BarChart2,
  User as UserIcon,
  LogOut,
  Layers,
  Users,
  Tv,
  Video
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import { LANGUAGES, getLanguageName } from '@/utils/languages';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeToggle from '@/components/ThemeToggle';
import HistorySidebar, { HistoryItem } from '@/components/HistorySidebar';
import DomainSelector from '@/components/DomainSelector';
import ModelInfoBadge from '@/components/ModelInfoBadge';
import TranslationFeedback from '@/components/TranslationFeedback';
import OfflineModeToggle from '@/components/OfflineModeToggle';
import { trackEvent } from '@/utils/analytics';
import { get, set } from 'idb-keyval';
import type { TranslationDomain, QualityScore } from '@/lib/translation/types';
import { getOfflineTranslation, saveOfflineTranslation, isOfflineModeEnabled } from '@/lib/offline/browser-translator';

interface Entity {
  id: string;
  name: string;
  translatedName: string;
  category: 'Person' | 'Place' | 'Organization' | 'Technical Term';
  description: string;
  preservationReason: string;
}

interface Relationship {
  source: string;
  target: string;
  type: string;
}

function KnowledgeGraphView({ entities, relationships }: { entities: Entity[], relationships: Relationship[] }) {
  const [selectedEntity, setSelectedEntity] = useState<Entity | null>(null);

  useEffect(() => {
    if (entities.length > 0) {
      setSelectedEntity(entities[0]);
    } else {
      setSelectedEntity(null);
    }
  }, [entities]);

  if (entities.length === 0) return null;

  const width = 480;
  const height = 320;
  const cx = width / 2;
  const cy = height / 2;
  const r = 95;

  const nodeMap = new Map<string, { x: number; y: number; name: string; category: string }>();
  entities.forEach((entity, idx) => {
    const angle = (idx * 2 * Math.PI) / entities.length;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    nodeMap.set(entity.id, { x, y, name: entity.translatedName || entity.name, category: entity.category });
  });

  const categoryColors: Record<string, string> = {
    'Person': '#3b82f6', 
    'Place': '#ef4444', 
    'Organization': '#10b981', 
    'Technical Term': '#f59e0b', 
  };

  const getEmoji = (cat: string) => {
    switch (cat) {
      case 'Person': return '👤';
      case 'Place': return '📍';
      case 'Organization': return '🏢';
      case 'Technical Term': return '⚙️';
      default: return '🔍';
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div className="relative border border-slate-200/50 dark:border-slate-800 rounded-3xl overflow-hidden bg-slate-50/50 dark:bg-slate-900/30 p-2 shadow-inner">
        <svg width="100%" height="320" viewBox={`0 0 ${width} ${height}`} className="mx-auto select-none">
          {relationships.map((rel, idx) => {
            const start = nodeMap.get(rel.source);
            const end = nodeMap.get(rel.target);
            if (!start || !end) return null;
            
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;

            return (
              <g key={idx}>
                <line
                  x1={start.x}
                  y1={start.y}
                  x2={end.x}
                  y2={end.y}
                  stroke="#cbd5e1"
                  strokeWidth="1.5"
                  className="stroke-slate-305 dark:stroke-slate-700"
                  strokeDasharray="4 3"
                />
                <rect
                  x={midX - 35}
                  y={midY - 7}
                  width="70"
                  height="14"
                  rx="4"
                  className="fill-white dark:fill-slate-900 stroke-slate-200/60 dark:stroke-slate-800"
                  strokeWidth="0.5"
                />
                <text
                  x={midX}
                  y={midY + 3}
                  fontSize="7"
                  fontWeight="bold"
                  textAnchor="middle"
                  className="fill-slate-400 dark:fill-slate-500"
                >
                  {rel.type}
                </text>
              </g>
            );
          })}

          {entities.map((node) => {
            const pos = nodeMap.get(node.id);
            if (!pos) return null;
            const color = categoryColors[node.category] || '#64748b';
            const isSelected = selectedEntity?.id === node.id;

            return (
              <g
                key={node.id}
                className="cursor-pointer group"
                onClick={() => setSelectedEntity(node)}
              >
                {isSelected && (
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r="19"
                    fill="none"
                    stroke={color}
                    strokeWidth="1.5"
                    className="animate-ping opacity-25"
                  />
                )}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSelected ? 14 : 11}
                  fill={color}
                  stroke={isSelected ? '#ffffff' : 'none'}
                  strokeWidth="2.5"
                  className="transition-all duration-300 group-hover:scale-115"
                />
                <text
                  x={pos.x}
                  y={pos.y + 3}
                  fontSize="8"
                  textAnchor="middle"
                >
                  {getEmoji(node.category)}
                </text>
                <text
                  x={pos.x}
                  y={pos.y + 22}
                  fontSize="8.5"
                  fontWeight="bold"
                  textAnchor="middle"
                  className={`${isSelected ? 'fill-blue-600 dark:fill-blue-400 font-extrabold' : 'fill-slate-700 dark:fill-slate-300'} transition-all`}
                >
                  {pos.name}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute bottom-2 left-2 flex gap-2 flex-wrap max-w-[90%] p-1.5 bg-white/90 dark:bg-slate-900/90 rounded-xl text-[8.5px] font-bold border border-slate-200/50 dark:border-slate-800/50 backdrop-blur">
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-blue-500" /> Person</div>
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-red-500" /> Place</div>
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Org</div>
          <div className="flex items-center gap-1"><div className="w-1.5 h-1.5 rounded-full bg-amber-500" /> Tech Term</div>
        </div>
      </div>

      <div className="space-y-4">
        {selectedEntity ? (
          <div className="glass-panel p-5 rounded-3xl border border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{getEmoji(selectedEntity.category)}</span>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">{selectedEntity.name}</h4>
                  <p className="text-[10px] text-slate-405 uppercase tracking-widest font-bold">{selectedEntity.category}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-xl text-xs font-bold border border-blue-500/20">
                <span>{selectedEntity.translatedName}</span>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-850">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Contextual Context</span>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed mt-0.5">{selectedEntity.description}</p>
              </div>

              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-[11px] text-slate-700 dark:text-amber-400 leading-relaxed">
                💡 <span className="font-bold">Proper Name Preservation Logic:</span> {selectedEntity.preservationReason}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl text-xs text-slate-400 italic">
            Select any entity in the network graph on the left to inspect its semantics.
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: session } = useSession();

  const [sourceText, setSourceText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('es');
  const [detectedLang, setDetectedLang] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  
  const [copied, setCopied] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const CHAR_LIMIT = 5000;

  // Speech-to-Text (STT) States
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);
  const preSpeechTextRef = useRef('');

  // Voice Synthesis (TTS) States
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedGender, setSelectedGender] = useState<'male' | 'female'>('female');
  const [speechRate, setSpeechRate] = useState<number>(1.0); // 0.5x to 2.0x
  const [speechVolume, setSpeechVolume] = useState<number>(1.0); // 0.0 to 1.0
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const currentUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Document Translation States
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const [docProgress, setDocProgress] = useState<number>(0);
  const [docStatus, setDocStatus] = useState<string>('');
  const [isTranslatingDoc, setIsTranslatingDoc] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Local storage for history
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('translation-history', []);

  // Ref to tracking swapping animation
  const [isSwapping, setIsSwapping] = useState(false);

  // Check if API key alert needs to be dismissed
  const [dismissedAlert, setDismissedAlert] = useLocalStorage<boolean>('dismissed-api-alert', false);

  // Quality Score State
  const [qualityScore, setQualityScore] = useState<QualityScore | null>(null);
  const [isScoring, setIsScoring] = useState(false);

  // Document Translation Custom Options
  const [ocrEngine, setOcrEngine] = useState<'tesseract' | 'paddleocr'>('tesseract');
  const [preserveLayout, setPreserveLayout] = useState<boolean>(true);
  const [exportFormat, setExportFormat] = useState<string>('pdf');

  // Hybrid translation options
  const [domain, setDomain] = useState<TranslationDomain | 'auto'>('auto');
  const [tone, setTone] = useState<'formal' | 'casual' | 'neutral'>('neutral');
  const [isSemantic, setIsSemantic] = useState(false);
  const [semanticGraph, setSemanticGraph] = useState<{ entities: any[]; relationships: any[] } | null>(null);
  const [translationModel, setTranslationModel] = useState<string | undefined>();
  const [translationConfidence, setTranslationConfidence] = useState<number | undefined>();
  const [translationLatency, setTranslationLatency] = useState<number | undefined>();
  const [routingReason, setRoutingReason] = useState<string | undefined>();
  const [detectedDomain, setDetectedDomain] = useState<string | undefined>();

  // Fetch history from DB if logged in
  useEffect(() => {
    if (session?.user) {
      fetch('/api/history')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setHistory(data.map(item => ({
              id: item._id,
              sourceText: item.sourceText,
              translatedText: item.translatedText,
              sourceLang: item.sourceLang,
              targetLang: item.targetLang,
              detectedLang: item.detectedLang,
              timestamp: new Date(item.timestamp).getTime(),
            })));
          }
        })
        .catch((err) => console.error('Failed to fetch history:', err));
    }
  }, [session?.user]);

  // Initialize Speech Recognition (STT)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        setIsSpeechSupported(true);
        const rec = new SpeechRecognition();
        rec.continuous = true;
        rec.interimResults = true;

        rec.onstart = () => {
          setIsListening(true);
        };

        rec.onend = () => {
          setIsListening(false);
        };

        rec.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            setError(`Speech recognition error: ${event.error}`);
            setIsListening(false);
          }
        };

        setRecognition(rec);
      }
    }
  }, []);

  // Update transcription results
  useEffect(() => {
    if (recognition) {
      recognition.onresult = (event: any) => {
        let accumulatedTranscript = '';
        for (let i = 0; i < event.results.length; ++i) {
          accumulatedTranscript += event.results[i][0].transcript;
        }

        const cleanTranscript = accumulatedTranscript.trim();
        if (cleanTranscript) {
          setSourceText(preSpeechTextRef.current + (preSpeechTextRef.current ? ' ' : '') + cleanTranscript);
        }
      };
    }
  }, [recognition]);

  // Load and update browser TTS voices
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const updateVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      updateVoices();
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }, []);

  // Cancel speech synthesis on text/language changes
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [translatedText, targetLang]);

  // Handle translation
  const handleTranslate = async (textToTranslate = sourceText, sLang = sourceLang, tLang = targetLang) => {
    const trimmed = textToTranslate.trim();
    if (!trimmed) {
      setTranslatedText('');
      setDetectedLang(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setQualityScore(null);
    setTranslationModel(undefined);
    setTranslationConfidence(undefined);
    setTranslationLatency(undefined);
    setRoutingReason(undefined);
    setDetectedDomain(undefined);

    try {
      let translatedResult = '';
      let detectedResult: string | null = null;
      let mockModeResult = false;
      
      const cacheKey = `translation_${sLang}_${tLang}_${trimmed}`;

      const offlineMode = await isOfflineModeEnabled();
      if (offlineMode && !navigator.onLine) {
        const offline = await getOfflineTranslation(sLang, tLang, trimmed);
        if (offline) {
          setTranslatedText(offline.translatedText);
          setTranslationModel('browser-offline');
          setTranslationConfidence(0.75);
          setIsLoading(false);
          return;
        }
      }

      try {
        const response = await fetch('/api/translate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: trimmed,
            sourceLang: sLang,
            targetLang: tLang,
            domain,
            tone,
            semantic: isSemantic,
          }),
        });

        if (!response.ok) {
          throw new Error('Translation failed. Please try again.');
        }

        const data = await response.json();
        translatedResult = data.translatedText;
        mockModeResult = data.isMock;
        detectedResult = data.detectedSourceLanguage || null;
        setTranslationModel(data.model);
        setTranslationConfidence(data.confidence);
        setTranslationLatency(data.latencyMs);
        setRoutingReason(data.routingReason);
        setDetectedDomain(data.detectedDomain);
        
        if (data.entities) {
          setSemanticGraph({
            entities: data.entities,
            relationships: data.relationships || []
          });
        } else {
          setSemanticGraph(null);
        }
        
        // Save to offline cache
        await set(cacheKey, { translatedText: translatedResult, detectedSourceLanguage: detectedResult, isMock: mockModeResult, model: data.model });
        await saveOfflineTranslation(sLang, tLang, trimmed, translatedResult, { model: data.model, confidence: data.confidence });
      } catch (fetchErr: any) {
        // If offline or network error, fallback to IndexedDB cache
        const cached = await get(cacheKey);
        if (cached) {
          translatedResult = cached.translatedText;
          mockModeResult = cached.isMock;
          detectedResult = cached.detectedSourceLanguage || null;
        } else {
          throw fetchErr; // Re-throw if not in cache
        }
      }

      setTranslatedText(translatedResult);
      setIsMockMode(mockModeResult);
      setDetectedLang(detectedResult);

      // Track analytics event
      trackEvent('translation', sLang === 'auto' ? (detectedResult ?? 'en') : sLang, tLang, { charCount: trimmed.length });

      // Save to history (if it's not a duplicate of the last search)
      const lastItem = history[0];
      if (!lastItem || lastItem.sourceText !== trimmed || lastItem.sourceLang !== sLang || lastItem.targetLang !== tLang) {
        
        if (session?.user) {
          // Save to DB
          try {
            const res = await fetch('/api/history', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                sourceText: trimmed,
                translatedText: translatedResult,
                sourceLang: sLang,
                targetLang: tLang,
                detectedLang: detectedResult || undefined,
              }),
            });
            const result = await res.json();
            if (res.ok && result.item) {
               const dbItem: HistoryItem = {
                  id: result.item._id,
                  sourceText: result.item.sourceText,
                  translatedText: result.item.translatedText,
                  sourceLang: result.item.sourceLang,
                  targetLang: result.item.targetLang,
                  detectedLang: result.item.detectedLang,
                  timestamp: new Date(result.item.timestamp).getTime(),
               };
               setHistory((prev) => [dbItem, ...prev.filter(i => i.id !== dbItem.id).slice(0, 49)]);
            }
          } catch (err) {
            console.error('Failed to save history to DB', err);
          }
        } else {
          // Save locally
          const newItem: HistoryItem = {
            id: Math.random().toString(36).substring(2, 11),
            sourceText: trimmed,
            translatedText: translatedResult,
            sourceLang: sLang,
            targetLang: tLang,
            timestamp: Date.now(),
            detectedLang: detectedResult || undefined,
          };
          setHistory((prev) => [newItem, ...prev.slice(0, 49)]);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during translation.');
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced translation effect
  useEffect(() => {
    if (!sourceText.trim()) {
      setTranslatedText('');
      setCharCount(0);
      setDetectedLang(null);
      return;
    }
    
    setCharCount(sourceText.length);

    const timer = setTimeout(() => {
      handleTranslate(sourceText, sourceLang, targetLang);
    }, 850); // 850ms debounce

    return () => clearTimeout(timer);
  }, [sourceText, sourceLang, targetLang, domain, tone, isSemantic]);

  // Handle manual translation trigger
  const handleManualTranslate = () => {
    handleTranslate(sourceText, sourceLang, targetLang);
  };

  // Swap Languages logic
  const handleSwapLanguages = () => {
    if (isListening && recognition) {
      recognition.stop();
    }
    setIsSwapping(true);
    setTimeout(() => setIsSwapping(false), 500);

    const nextSource = targetLang;
    let nextTarget = sourceLang === 'auto' ? (detectedLang || 'en') : sourceLang;

    if (nextSource === nextTarget) {
      nextTarget = nextSource === 'en' ? 'es' : 'en';
    }

    setSourceLang(nextSource);
    setTargetLang(nextTarget);
    setDetectedLang(null);

    if (translatedText && !isLoading) {
      const tempText = sourceText;
      setSourceText(translatedText);
      setTranslatedText(tempText);
    }
  };

  // Toggle Microphone / Speech-to-Text (STT)
  const handleToggleMic = () => {
    if (!recognition) return;

    if (isListening) {
      recognition.stop();
    } else {
      setError(null);
      preSpeechTextRef.current = sourceText.trim();
      
      const langLocaleMap: Record<string, string> = {
        'auto': 'en-US',
        'en': 'en-US',
        'es': 'es-ES',
        'fr': 'fr-FR',
        'de': 'de-DE',
        'it': 'it-IT',
        'pt': 'pt-PT',
        'hi': 'hi-IN',
        'zh': 'zh-CN',
        'zh-TW': 'zh-TW',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
        'ru': 'ru-RU',
        'ar': 'ar-SA',
        'tr': 'tr-TR',
        'nl': 'nl-NL',
        'pl': 'pl-PL',
        'vi': 'vi-VN'
      };

      recognition.lang = langLocaleMap[sourceLang] || sourceLang;
      
      try {
        recognition.start();
      } catch (err: any) {
        console.error('Speech recognition start error:', err);
        setError('Failed to start speech recognition. Please check microphone permissions.');
      }
    }
  };

  // Classify TTS Voice Gender based on name triggers
  const getCategorizedGender = (voice: SpeechSynthesisVoice): 'male' | 'female' | 'neutral' => {
    const name = voice.name.toLowerCase();
    if (/\b(david|ravi|sean|guy|man|andrew|brian|george|mark|microsoft david|google uk english male|male)\b/.test(name)) {
      return 'male';
    }
    if (/\b(zira|hazel|heera|female|woman|susan|microsoft zira|google uk english female|jessa|elena|female)\b/.test(name)) {
      return 'female';
    }
    return 'neutral';
  };

  // Search best matching system voice based on Target Language and Gender
  const selectVoiceForLanguage = (langCode: string, gender: 'male' | 'female'): SpeechSynthesisVoice | null => {
    const langPrefix = langCode.split('-')[0].toLowerCase();
    const candidateVoices = voices.filter(v => 
      v.lang.toLowerCase() === langCode.toLowerCase() ||
      v.lang.toLowerCase().replace('_', '-').startsWith(langPrefix)
    );

    if (candidateVoices.length === 0) return null;

    // Filter by gender match
    const genderMatched = candidateVoices.find(v => getCategorizedGender(v) === gender);
    if (genderMatched) return genderMatched;

    // Fallback to neutral or first voice in language set
    return candidateVoices.find(v => getCategorizedGender(v) === 'neutral') || candidateVoices[0];
  };

  // Advanced Voice Output controls (TTS)
  const handlePlaySpeak = () => {
    if (!translatedText) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      alert('Speech synthesis is not supported in your browser.');
      return;
    }

    // Cancel any current playbacks
    window.speechSynthesis.cancel();
    setIsPlaying(false);
    setIsPaused(false);

    const utterance = new SpeechSynthesisUtterance(translatedText);
    
    // Select the categorized voice
    const selectedVoice = selectVoiceForLanguage(targetLang, selectedGender);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    } else {
      utterance.lang = targetLang;
    }

    utterance.rate = speechRate;
    utterance.volume = speechVolume;

    // Hook listeners
    utterance.onstart = () => {
      setIsPlaying(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      currentUtteranceRef.current = null;
    };

    utterance.onerror = (e) => {
      console.error('TTS execution error:', e);
      setIsPlaying(false);
      setIsPaused(false);
      currentUtteranceRef.current = null;
    };

    currentUtteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handlePauseSpeak = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isPlaying && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const handleResumeSpeak = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && isPlaying && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  };

  const handleStopSpeak = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      setIsPaused(false);
      currentUtteranceRef.current = null;
    }
  };

  // Basic speak wrapper for source box
  const handleSpeakSource = (textToSpeak: string, langCode: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const spokenLang = langCode === 'auto' ? (detectedLang || 'en') : langCode;
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = spokenLang;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Text-to-speech is not supported in your browser.');
    }
  };

  // Copy to clipboard
  const handleCopyText = () => {
    if (!translatedText) return;
    navigator.clipboard.writeText(translatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Restore history item
  const handleSelectHistory = (item: HistoryItem) => {
    if (isListening && recognition) {
      recognition.stop();
    }
    handleStopSpeak();
    setSourceText(item.sourceText);
    setSourceLang(item.sourceLang);
    setTargetLang(item.targetLang);
    setTranslatedText(item.translatedText);
    setDetectedLang(item.detectedLang || null);
    setIsSidebarOpen(false);
  };

  // Clear source text
  const handleClearText = () => {
    if (isListening && recognition) {
      recognition.stop();
    }
    handleStopSpeak();
    setSourceText('');
    setTranslatedText('');
    setCharCount(0);
    setError(null);
    setDetectedLang(null);
    setQualityScore(null);
    setDetectedDomain(undefined);
    setSemanticGraph(null);
  };

  const handleQualityScore = async () => {
    if (!translatedText || !sourceText) return;
    setIsScoring(true);
    try {
      const response = await fetch('/api/translate/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceText,
          translatedText,
          sourceLang,
          targetLang,
          domain,
          tone,
        }),
      });
      if (!response.ok) throw new Error('Failed to get score');
      const data = await response.json();
      setQualityScore(data);
    } catch (err) {
      console.error(err);
      alert('Could not evaluate translation quality.');
    } finally {
      setIsScoring(false);
    }
  };

  const handleExportHistory = async (format: 'pdf' | 'csv' | 'docx') => {
    if (history.length === 0) return;
    try {
      // Only export items saved to DB if logged in, or fallback for offline?
      // Since API needs DB ids, filter valid ObjectIds
      const itemIds = history.map(h => h.id).filter(id => id.length > 20);
      if (itemIds.length === 0) {
        alert('Please log in to export history.');
        return;
      }
      const response = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds, format }),
      });
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `translations.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Failed to export history.');
    }
  };

  // Document Drag-and-drop Validations
  const validateAndSetFile = (file: File) => {
    const name = file.name.toLowerCase();
    const isImageOrPdf = name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.pdf');
    const isDocument = name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.pptx');
    
    if (!isImageOrPdf && !isDocument) {
      setExtractionError('Unsupported file type. Please upload a PNG, JPG, JPEG, PDF, DOCX, PPTX, or TXT file.');
      setSelectedFile(null);
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setExtractionError('File size exceeds the 10MB limit.');
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
    setExtractionError(null);

    const ext = name.split('.').pop() || 'pdf';
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') {
      setExportFormat('pdf');
    } else {
      setExportFormat(ext);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndSetFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  // Upload FormData and call backend extraction endpoint
  const handleExtractText = async () => {
    if (!selectedFile) return;

    setIsExtracting(true);
    setExtractionError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData?.error || 'Extraction failed. Make sure your file is readable.');
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      if (data.text) {
        setSourceText(data.text);
        setIsUploadModalOpen(false);
        setSelectedFile(null);
        // Track OCR analytics event
        const ext = selectedFile?.name.split('.').pop()?.toLowerCase() ?? 'image';
        trackEvent('ocr_translation', sourceLang === 'auto' ? 'en' : sourceLang, targetLang, { charCount: data.text.length, fileType: ext });
      } else {
        throw new Error('No readable text could be extracted from this document.');
      }
    } catch (err: any) {
      setExtractionError(err.message || 'Failed to process document.');
    } finally {
      setIsExtracting(false);
    }
  };

  // Download translated result as .txt file
  const handleDownloadResult = () => {
    if (!translatedText) return;
    const blob = new Blob([translatedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const filePrefix = `translation_${sourceLang}_to_${targetLang}`;
    link.download = `${filePrefix}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Full-document translation with streaming progress
  const handleTranslateDocument = async () => {
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    const isDocFile = name.endsWith('.docx') || name.endsWith('.txt') || name.endsWith('.pdf') || name.endsWith('.pptx');

    // Image/OCR files still go through extract flow unless preserveLayout is true
    if (!isDocFile && !preserveLayout) {
      handleExtractText();
      return;
    }

    setIsTranslatingDoc(true);
    setDocProgress(0);
    setDocStatus('Uploading document...');
    setExtractionError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('sourceLang', sourceLang);
      formData.append('targetLang', targetLang);
      formData.append('ocrEngine', ocrEngine);
      formData.append('preserveLayout', preserveLayout ? 'true' : 'false');
      formData.append('exportFormat', exportFormat);

      const response = await fetch('/api/translate-doc', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok || !response.body) {
        throw new Error('Document translation request failed. Please try again.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      // Read the streaming newline-delimited JSON
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const packet = JSON.parse(trimmed);

            if (packet.error) {
              throw new Error(packet.error);
            }

            if (typeof packet.percent === 'number') {
              setDocProgress(packet.percent);
            }
            if (packet.status) {
              setDocStatus(packet.status);
            }

            if (packet.complete && packet.fileBuffer) {
              // Decode base64 and trigger download
              const binaryStr = atob(packet.fileBuffer);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const blob = new Blob([bytes], { type: packet.mimeType || 'application/octet-stream' });
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              const baseName = selectedFile.name.replace(/\.[^.]+$/, '');
              link.download = `${baseName}_translated_${targetLang}.${packet.outputExt}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);

              // Track document translation analytics event
              const ext2 = selectedFile?.name.split('.').pop()?.toLowerCase() ?? 'doc';
              trackEvent('document_translation', sourceLang === 'auto' ? 'en' : sourceLang, targetLang, { fileType: ext2 });

              // Close modal after slight delay so user sees 100%
              setTimeout(() => {
                setIsUploadModalOpen(false);
                setSelectedFile(null);
                setDocProgress(0);
                setDocStatus('');
                setIsTranslatingDoc(false);
              }, 1200);
              return;
            }
          } catch (parseErr: any) {
            if (parseErr?.message && !parseErr.message.includes('JSON')) {
              throw parseErr;
            }
          }
        }
      }
    } catch (err: any) {
      setExtractionError(err.message || 'Failed to translate document.');
    } finally {
      setIsTranslatingDoc(false);
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col justify-between px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 md:mb-12">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 dark:from-blue-400 dark:via-indigo-400 dark:to-purple-400">
              AuraTranslate
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Hybrid AI — Open-source models + continuous learning
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Auth Button */}
          {session ? (
            <button
              onClick={() => signOut()}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-medium text-sm shadow-sm backdrop-blur-md hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-200 dark:hover:border-red-800/30 transition-all cursor-pointer hover:scale-105 active:scale-95"
              aria-label="Sign out"
            >
              {session.user?.image ? (
                <img src={session.user.image} alt="Avatar" className="w-5 h-5 rounded-full" />
              ) : (
                <UserIcon className="w-4 h-4" />
              )}
              <span className="hidden md:inline">{session.user?.name || 'Sign Out'}</span>
            </button>
          ) : (
            <Link
              href="/auth/login"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-medium text-sm shadow-sm backdrop-blur-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer hover:scale-105 active:scale-95"
              aria-label="Sign in"
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden md:inline">Sign In</span>
            </Link>
          )}

          {/* Analytics Dashboard Link */}
          <Link
            href="/analytics"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600/90 to-violet-600/90 text-white font-medium text-sm shadow-md shadow-indigo-500/20 backdrop-blur-md hover:shadow-lg hover:shadow-indigo-500/30 hover:from-indigo-700/90 hover:to-violet-700/90 transition-all hover:scale-105 active:scale-95"
            aria-label="Open analytics dashboard"
          >
            <BarChart2 className="w-4 h-4" />
            <span className="hidden md:inline">Analytics</span>
          </Link>

          {/* Language Learning Link */}
          <Link
            href="/learn"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500/90 to-orange-500/90 text-white font-medium text-sm shadow-md shadow-amber-500/20 backdrop-blur-md hover:shadow-lg hover:shadow-amber-500/30 hover:from-amber-600/90 hover:to-orange-600/90 transition-all hover:scale-105 active:scale-95"
            aria-label="Open language learning module"
          >
            <GraduationCap className="w-4 h-4" />
            <span className="hidden md:inline">Learn</span>
          </Link>

          {/* Live Conversation Link */}
          <Link
            href="/conversation"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600/90 to-indigo-600/90 text-white font-medium text-sm shadow-md shadow-violet-500/20 backdrop-blur-md hover:shadow-lg hover:shadow-violet-500/30 hover:from-violet-700/90 hover:to-indigo-700/90 transition-all hover:scale-105 active:scale-95"
            aria-label="Open live conversation translator"
          >
            <MessageCircle className="w-4 h-4" />
            <span className="hidden md:inline">Live Conversation</span>
          </Link>

          {/* Batch Translation Link */}
          <Link
            href="/batch"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500/90 to-emerald-500/90 text-white font-medium text-sm shadow-md shadow-teal-500/20 backdrop-blur-md hover:shadow-lg hover:shadow-teal-500/30 hover:from-teal-600/90 hover:to-emerald-600/90 transition-all hover:scale-105 active:scale-95"
            aria-label="Batch Translation"
          >
            <Layers className="w-4 h-4" />
            <span className="hidden md:inline">Batch</span>
          </Link>

          {/* Workspaces Link */}
          <Link
            href="/workspace"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-sky-500/90 to-blue-500/90 text-white font-medium text-sm shadow-md shadow-sky-500/20 backdrop-blur-md hover:shadow-lg hover:shadow-sky-500/30 hover:from-sky-600/90 hover:to-blue-600/90 transition-all hover:scale-105 active:scale-95"
            aria-label="Workspaces"
          >
            <Users className="w-4 h-4" />
            <span className="hidden md:inline">Workspaces</span>
          </Link>

          {/* Subtitles Link */}
          <Link
            href="/subtitles"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-pink-500/90 to-rose-500/90 text-white font-medium text-sm shadow-md shadow-pink-500/20 backdrop-blur-md hover:shadow-lg hover:shadow-pink-500/30 hover:from-pink-600/90 hover:to-rose-600/90 transition-all hover:scale-105 active:scale-95"
            aria-label="Subtitles"
          >
            <Tv className="w-4 h-4" />
            <span className="hidden md:inline">Subtitles</span>
          </Link>

          {/* Meeting Assistant Link */}
          <Link
            href="/meeting"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600/90 to-teal-600/90 text-white font-medium text-sm shadow-md shadow-emerald-500/20 backdrop-blur-md hover:shadow-lg hover:shadow-emerald-500/30 hover:from-emerald-700/90 hover:to-teal-700/90 transition-all hover:scale-105 active:scale-95"
            aria-label="Meeting Assistant"
          >
            <Video className="w-4 h-4" />
            <span className="hidden md:inline">Meeting</span>
          </Link>

          {/* Multimodal Studio Link */}
          <Link
            href="/multimodal"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/90 to-indigo-650/90 text-white font-medium text-sm shadow-md shadow-indigo-500/20 backdrop-blur-md hover:shadow-lg hover:shadow-indigo-500/30 hover:from-purple-700/90 hover:to-indigo-700/90 transition-all hover:scale-105 active:scale-95"
            aria-label="Multimodal Studio"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden md:inline">Multimodal</span>
          </Link>

          {/* Profile Link */}
          <Link
            href="/profile"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-medium text-sm shadow-sm backdrop-blur-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Profile Settings"
          >
            <UserIcon className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="hidden md:inline">Profile</span>
          </Link>



          {/* Document Upload Trigger Button */}
          <button
            onClick={() => setIsUploadModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-medium text-sm shadow-sm backdrop-blur-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="Upload document/image"
          >
            <Upload className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="hidden md:inline">Translate Document</span>
          </button>

          {/* History Toggle Button */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-medium text-sm shadow-sm backdrop-blur-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
            aria-label="View history"
          >
            <Clock className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span className="hidden md:inline">History</span>
            {history && history.length > 0 && (
              <span className="flex items-center justify-center w-5 h-5 text-[11px] font-bold text-white bg-blue-600 rounded-full shrink-0">
                {history.length}
              </span>
            )}
          </button>
          
          <OfflineModeToggle />
          <ThemeToggle />
        </div>
      </header>

      {/* Main Area */}
      <main className="flex-1 flex flex-col justify-center">
        {/* Banner Alert for API Key Mock Mode */}
        {isMockMode && !dismissedAlert && (
          <div className="mb-6 p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start gap-3 backdrop-blur-md animate-in fade-in duration-300">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs md:text-sm">
              <span className="font-bold">Fallback Mode:</span> Start the ML service (`ML_SERVICE_URL`) or configure API keys. The hybrid router will prefer open-source models when available.
            </div>
            <button 
              onClick={() => setDismissedAlert(true)}
              className="p-1 rounded-lg hover:bg-amber-500/10 text-amber-600 dark:text-amber-500 hover:text-amber-800 dark:hover:text-amber-305 transition-colors shrink-0 cursor-pointer"
              aria-label="Dismiss banner"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="glass-panel rounded-3xl p-4 md:p-6 shadow-xl w-full flex flex-col gap-6">
          {/* Domain & Tone Selection */}
          <div className="space-y-3 border-b border-slate-200/50 dark:border-slate-800/50 pb-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">Translation Domain</p>
              <DomainSelector selected={domain} onSelect={setDomain} />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 pt-1.5 border-t border-dashed border-slate-200/30 dark:border-slate-800/30 mt-2">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Tone:</p>
                {(['neutral', 'formal', 'casual'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTone(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                      tone === t
                        ? 'bg-indigo-650 text-white'
                        : 'bg-slate-100 dark:bg-slate-850 text-slate-555 hover:bg-slate-200 dark:hover:bg-slate-755'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Semantic Translation Toggle */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setIsSemantic(!isSemantic);
                    if (isSemantic) setSemanticGraph(null);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                    isSemantic
                      ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-transparent shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-850 border-slate-200/50 dark:border-slate-700/50 text-slate-555 hover:bg-slate-200 dark:hover:bg-slate-755'
                  }`}
                  title="Enable Semantic Mode to recognize proper nouns/technical terms and view the Knowledge Graph"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Semantic Mode: {isSemantic ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          </div>

          {/* Controls Bar: Selectors & Swap Button */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800/50 pb-6">
            <div className="flex-1 w-full flex flex-col md:flex-row md:items-end gap-3">
              <LanguageSelector
                label="Translate From"
                selectedLanguage={sourceLang}
                onSelectLanguage={(code) => {
                  setSourceLang(code);
                  setDetectedLang(null);
                }}
                excludeLanguage={targetLang}
                isSource={true}
              />
              {sourceLang === 'auto' && detectedLang && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-655 dark:text-blue-400 text-xs font-semibold self-start md:mb-1 shrink-0 animate-in slide-in-from-left-2 duration-300">
                  <Globe className="w-3.5 h-3.5 animate-pulse" />
                  <span>Detected: {getLanguageName(detectedLang)}</span>
                </div>
              )}
            </div>
            
            {/* Swap Button */}
            <button
              onClick={handleSwapLanguages}
              className={`p-3 rounded-2xl bg-white/95 dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700/60 shadow-md hover:shadow-lg hover:border-blue-500/40 dark:hover:border-blue-400/40 text-slate-600 dark:text-slate-300 transition-all cursor-pointer hover:scale-110 active:scale-95 z-10 shrink-0 ${
                isSwapping ? 'rotate-180 duration-500' : 'rotate-0'
              }`}
              aria-label="Swap languages"
            >
              <ArrowLeftRight className="w-5 h-5" />
            </button>

            <div className="flex-1 w-full flex justify-end">
              <LanguageSelector
                label="Translate To"
                selectedLanguage={targetLang}
                onSelectLanguage={(code) => setTargetLang(code)}
                excludeLanguage={sourceLang === 'auto' ? undefined : sourceLang}
                isSource={false}
              />
            </div>
          </div>

          {/* Textareas Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 min-h-[300px]">
            {/* Source Box */}
            <div className="flex flex-col justify-between bg-slate-50/50 dark:bg-slate-800/20 border border-slate-200/40 dark:border-slate-800/40 rounded-2xl p-4 relative focus-within:border-blue-500/30 dark:focus-within:border-blue-400/30 transition-all">
              <div className="flex-1">
                <textarea
                  value={sourceText}
                  onChange={(e) => {
                    if (isListening && recognition) {
                      recognition.stop();
                    }
                    setSourceText(e.target.value);
                  }}
                  placeholder={sourceLang === 'auto' ? 'Type or paste text here (auto-detect language)...' : `Type or paste text in ${getLanguageName(sourceLang)} here...`}
                  maxLength={CHAR_LIMIT}
                  className="w-full min-h-[200px] lg:min-h-[250px] bg-transparent border-0 p-0 text-base md:text-lg text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-0 focus:outline-none resize-none font-normal leading-relaxed"
                  aria-label="Source text input"
                />
              </div>

              {sourceText && (
                <button
                  onClick={handleClearText}
                  className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/80 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-705 text-slate-405 dark:text-slate-505 hover:text-slate-655 dark:hover:text-slate-300 transition-colors shadow-sm cursor-pointer"
                  aria-label="Clear source text"
                >
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Source Actions */}
              <div className="flex items-center justify-between border-t border-slate-200/30 dark:border-slate-800/30 pt-3 mt-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleSpeakSource(sourceText, sourceLang)}
                    disabled={!sourceText.trim() || isListening}
                    className="p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200/30 dark:hover:border-slate-705 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Listen source text"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>

                  {/* Microphone dictation button */}
                  {isSpeechSupported ? (
                    <button
                      onClick={handleToggleMic}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer relative flex items-center justify-center hover:scale-105 active:scale-95 ${
                        isListening
                          ? 'bg-red-500/10 dark:bg-red-500/25 border-red-500/30 text-red-655 dark:text-red-400 hover:bg-red-500/20 shadow-sm shadow-red-500/10'
                          : 'hover:bg-white dark:hover:bg-slate-800 border-transparent hover:border-slate-200/30 dark:hover:border-slate-700/30 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200'
                      }`}
                      title={isListening ? 'Stop recording' : 'Start speech-to-text dictation'}
                    >
                      {isListening ? (
                        <>
                          <MicOff className="w-5 h-5" />
                          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        </>
                      ) : (
                        <Mic className="w-5 h-5" />
                      )}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="p-2.5 rounded-xl border border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed"
                      title="Speech-to-text is not supported in this browser. Try Chrome, Edge, or Safari."
                    >
                      <Mic className="w-5 h-5 opacity-40" />
                    </button>
                  )}
                </div>
                
                <span className={`text-[11px] font-semibold tracking-wide ${
                  charCount >= CHAR_LIMIT ? 'text-red-550' : 'text-slate-400 dark:text-slate-500'
                }`}>
                  {charCount} / {CHAR_LIMIT}
                </span>
              </div>
            </div>

            {/* Target Box */}
            <div className="flex flex-col justify-between bg-slate-50/30 dark:bg-slate-900/10 border border-slate-200/30 dark:border-slate-800/30 rounded-2xl p-4 relative overflow-hidden">
              <div className="flex-1">
                {isLoading ? (
                  // Skeleton loader
                  <div className="space-y-3 py-1.5 animate-pulse">
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-[90%]" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-[85%]" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-[60%]" />
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-[40%]" />
                  </div>
                ) : error ? (
                  <div className="flex items-center gap-2 text-red-500 text-sm font-medium py-1.5">
                    <AlertCircle className="w-4 h-4 animate-bounce" />
                    <p>{error}</p>
                  </div>
                ) : (
                  <div className={`w-full min-h-[170px] lg:min-h-[220px] p-0 text-base md:text-lg font-normal leading-relaxed whitespace-pre-wrap ${
                    translatedText ? 'text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                  }`}>
                    {translatedText || `Translation in ${getLanguageName(targetLang)} will appear here...`}
                  </div>
                )}
              </div>

              {/* Advanced Voice Controls Drawer/Shelf */}
              {showVoiceSettings && (
                <div className="mt-3 py-3.5 px-4 bg-white/60 dark:bg-slate-800/50 border border-slate-200/40 dark:border-slate-700/40 rounded-xl space-y-3 animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-md">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    {/* Gender Segmented Selection */}
                    <div className="flex items-center justify-between sm:justify-start gap-2">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">Voice Profile:</span>
                      <div className="flex rounded-lg bg-slate-100 dark:bg-slate-900/80 p-0.5 border border-slate-200/30 dark:border-slate-850">
                        <button
                          onClick={() => setSelectedGender('female')}
                          className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            selectedGender === 'female'
                              ? 'bg-white dark:bg-slate-800 text-blue-650 dark:text-blue-400 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-705 dark:hover:text-slate-200'
                          }`}
                        >
                          Female
                        </button>
                        <button
                          onClick={() => setSelectedGender('male')}
                          className={`px-3 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                            selectedGender === 'male'
                              ? 'bg-white dark:bg-slate-800 text-blue-655 dark:text-blue-400 shadow-sm'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-705 dark:hover:text-slate-200'
                          }`}
                        >
                          Male
                        </button>
                      </div>
                    </div>

                    {/* Speed Indicator */}
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500">
                      <span>Rate:</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-slate-600 dark:text-slate-305">
                        {speechRate.toFixed(1)}x
                      </span>
                      <span className="ml-2">Volume:</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-900 font-mono text-slate-600 dark:text-slate-305">
                        {Math.round(speechVolume * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Sliders Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Rate/Speed Slider */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <span>Speed</span>
                        <span>0.5x - 2.0x</span>
                      </div>
                      <input
                        type="range"
                        min="0.5"
                        max="2.0"
                        step="0.1"
                        value={speechRate}
                        onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400"
                        aria-label="Adjust speed rate"
                      />
                    </div>

                    {/* Volume Slider */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        <span>Volume</span>
                        <span>0% - 100%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={speechVolume}
                        onChange={(e) => setSpeechVolume(parseFloat(e.target.value))}
                        className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-400"
                        aria-label="Adjust volume"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Target Actions */}
              <div className="flex items-center justify-between border-t border-slate-200/30 dark:border-slate-800/30 pt-3 mt-3">
                <div className="flex items-center gap-1.5">
                  {/* Speech Playback Controls */}
                  {isPlaying ? (
                    <>
                      {/* Pause / Resume Button */}
                      {isPaused ? (
                        <button
                          onClick={handleResumeSpeak}
                          className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
                          title="Resume speech playback"
                        >
                          <Play className="w-5 h-5 fill-current" />
                        </button>
                      ) : (
                        <button
                          onClick={handlePauseSpeak}
                          className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
                          title="Pause speech playback"
                        >
                          <Pause className="w-5 h-5 fill-current" />
                        </button>
                      )}

                      {/* Stop Button */}
                      <button
                        onClick={handleStopSpeak}
                        className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-605 dark:text-red-400 hover:bg-red-500/20 transition-all cursor-pointer hover:scale-105 active:scale-95 flex items-center justify-center"
                        title="Stop speech playback"
                      >
                        <Square className="w-5 h-5 fill-current" />
                      </button>
                    </>
                  ) : (
                    // Play Button (when idle)
                    <button
                      onClick={handlePlaySpeak}
                      disabled={!translatedText || isListening}
                      className="p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200/30 dark:hover:border-slate-705 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer"
                      title="Speak translation aloud"
                    >
                      <Volume2 className="w-5 h-5" />
                    </button>
                  )}

                  {/* Sliders toggle trigger */}
                  <button
                    onClick={() => setShowVoiceSettings(!showVoiceSettings)}
                    disabled={!translatedText}
                    className={`p-2.5 rounded-xl border transition-all cursor-pointer relative flex items-center justify-center hover:scale-105 active:scale-95 ${
                      showVoiceSettings
                        ? 'bg-blue-500/10 border-blue-500/25 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 shadow-sm shadow-blue-500/5'
                        : 'hover:bg-white dark:hover:bg-slate-800 border-transparent hover:border-slate-200/30 dark:hover:border-slate-707 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200'
                    } disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed`}
                    title="Audio output settings"
                  >
                    <Sliders className="w-5 h-5" />
                  </button>

                  {/* Copy Button */}
                  <button
                    onClick={handleCopyText}
                    disabled={!translatedText}
                    className="p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200/30 dark:hover:border-slate-700/30 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all relative flex items-center justify-center cursor-pointer"
                    title="Copy translation"
                  >
                    {copied ? (
                      <Check className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5" />
                    )}
                  </button>

                  {/* Download Button */}
                  <button
                    onClick={handleDownloadResult}
                    disabled={!translatedText}
                    className="p-2.5 rounded-xl hover:bg-white dark:hover:bg-slate-800 border border-transparent hover:border-slate-200/30 dark:hover:border-slate-700/30 text-slate-500 hover:text-slate-705 dark:text-slate-400 dark:hover:text-slate-200 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer"
                    title="Download translated text"
                  >
                    <Download className="w-5 h-5" />
                  </button>

                  {/* Quality Score Button */}
                  <button
                    onClick={handleQualityScore}
                    disabled={!translatedText || isScoring}
                    className="p-2.5 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/20 border border-transparent hover:border-indigo-200/50 dark:hover:border-indigo-700/50 text-indigo-500 dark:text-indigo-400 disabled:opacity-40 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-1"
                    title="Evaluate Translation Quality"
                  >
                    {isScoring ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                  </button>
                </div>

                {/* Score Display / Indicators */}
                <div className="flex flex-col items-end gap-2">
                  <ModelInfoBadge
                    model={translationModel}
                    confidence={translationConfidence}
                    latencyMs={translationLatency}
                    routingReason={routingReason}
                    detectedDomain={detectedDomain}
                  />
                  {qualityScore && qualityScore.confidenceScore !== undefined && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 cursor-help" title={qualityScore.feedback}>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                        Score
                      </span>
                      <span className={`text-xs font-bold ${qualityScore.confidenceScore >= 85 ? 'text-green-600 dark:text-green-400' : qualityScore.confidenceScore >= 70 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                        {qualityScore.confidenceScore}/100
                      </span>
                    </div>
                  )}

                  {/* Show indicator if text is translated via Mock Mode */}
                  {translatedText && isMockMode && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20">
                      Mock Mode
                    </span>
                  )}
                </div>
              </div>

              {/* Semantic Knowledge Graph Panel */}
              {semanticGraph && (
                <div className="mt-4 p-5 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40 space-y-5 animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-700/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-blue-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-805 dark:text-slate-100">Semantic Knowledge Graph</h3>
                    </div>
                    <button 
                      onClick={() => setSemanticGraph(null)} 
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <KnowledgeGraphView
                    entities={semanticGraph.entities}
                    relationships={semanticGraph.relationships}
                  />
                </div>
              )}

              {/* Quality details panel */}
              {qualityScore && (
                <div className="mt-4 p-5 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-slate-200/40 dark:border-slate-700/40 space-y-5 animate-in slide-in-from-bottom-2 duration-300 backdrop-blur-md">
                  <div className="flex items-center justify-between border-b border-slate-200/40 dark:border-slate-700/40 pb-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100">Translation Quality Estimation</h3>
                    </div>
                    <button 
                      onClick={() => setQualityScore(null)} 
                      className="p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Gauge indicator for Confidence */}
                    <div className="flex flex-col items-center justify-center p-4 bg-white/60 dark:bg-slate-900/40 border border-slate-200/30 dark:border-slate-800/30 rounded-xl space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Overall Confidence</span>
                      <div className="relative w-24 h-24 flex items-center justify-center">
                        <svg className="w-full h-full transform -rotate-90">
                          <circle
                            cx="48"
                            cy="48"
                            r="38"
                            className="text-slate-100 dark:text-slate-800"
                            strokeWidth="8"
                            stroke="currentColor"
                            fill="transparent"
                          />
                          <circle
                            cx="48"
                            cy="48"
                            r="38"
                            strokeDasharray={2 * Math.PI * 38}
                            strokeDashoffset={2 * Math.PI * 38 * (1 - qualityScore.confidenceScore / 100)}
                            strokeWidth="8"
                            strokeLinecap="round"
                            className={`transition-all duration-1000 ${
                              qualityScore.confidenceScore >= 85
                                ? 'text-emerald-500'
                                : qualityScore.confidenceScore >= 70
                                  ? 'text-amber-500'
                                  : 'text-red-500'
                            }`}
                            fill="transparent"
                          />
                        </svg>
                        <div className="absolute flex flex-col items-center">
                          <span className="text-xl font-bold text-slate-800 dark:text-slate-100">{qualityScore.confidenceScore}%</span>
                          <span className="text-[8px] font-bold uppercase text-slate-400 dark:text-slate-500">
                            {qualityScore.confidenceScore >= 85 ? 'High' : qualityScore.confidenceScore >= 70 ? 'Medium' : 'Low'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Progress bars for key linguistic dimensions */}
                    <div className="md:col-span-2 space-y-3 p-4 bg-white/60 dark:bg-slate-900/40 border border-slate-200/30 dark:border-slate-800/30 rounded-xl">
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>Accuracy</span>
                          <span>{qualityScore.accuracyScore}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-650 rounded-full transition-all duration-1000"
                            style={{ width: `${qualityScore.accuracyScore}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>Fluency</span>
                          <span>{qualityScore.fluencyScore}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-indigo-650 rounded-full transition-all duration-1000"
                            style={{ width: `${qualityScore.fluencyScore}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>Grammar & Spelling</span>
                          <span>{qualityScore.grammarScore}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full transition-all duration-1000"
                            style={{ width: `${qualityScore.grammarScore}%` }}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                          <span>Domain Vocabulary Matching</span>
                          <span>{qualityScore.domainAccuracyScore}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-teal-600 rounded-full transition-all duration-1000"
                            style={{ width: `${qualityScore.domainAccuracyScore}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* NLP Metrics Chips */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/20 dark:border-slate-800/20 flex flex-col items-center" title="Estimated Bilingual Evaluation Understudy score (lexical overlap)">
                      <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Estimated BLEU</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-350">{qualityScore.bleuScore}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/20 dark:border-slate-800/20 flex flex-col items-center" title="Estimated Crosslingual Optimized Metric for Evaluation of Translation score">
                      <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Estimated COMET</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-355">{(qualityScore.cometScore / 100).toFixed(2)}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-100/50 dark:bg-slate-900/50 border border-slate-200/20 dark:border-slate-800/20 flex flex-col items-center" title="Estimated BERTScore semantic contextual similarity">
                      <span className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase">Estimated BERTScore</span>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-356">{(qualityScore.bertScore / 100).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Feedback Comment */}
                  <div className="p-3 bg-indigo-50/20 dark:bg-indigo-900/10 border border-indigo-200/30 dark:border-indigo-800/30 rounded-xl text-xs text-slate-650 dark:text-slate-300">
                    <span className="font-bold text-indigo-650 dark:text-indigo-400">Evaluation: </span>
                    {qualityScore.feedback}
                  </div>

                  {/* Alternative Translations */}
                  {qualityScore.alternativeTranslations && qualityScore.alternativeTranslations.length > 0 && (
                    <div className="space-y-2 border-t border-slate-200/30 dark:border-slate-800/30 pt-3.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                        Alternative Translations {qualityScore.confidenceScore < 80 ? ' (Recommended due to lower confidence)' : ''}
                      </span>
                      <div className="space-y-1.5">
                        {qualityScore.alternativeTranslations.map((alt, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setTranslatedText(alt);
                              setTranslationConfidence(0.95);
                            }}
                            className="w-full text-left p-2.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-650 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-850 hover:border-slate-400 dark:hover:border-slate-600 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer transition-all duration-200 flex justify-between items-center group"
                          >
                            <span className="flex-1 mr-2">{alt}</span>
                            <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                              Use Alternative &rarr;
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <TranslationFeedback
                sourceText={sourceText}
                translatedText={translatedText}
                sourceLang={sourceLang}
                targetLang={targetLang}
                model={translationModel}
                domain={domain}
                onCorrectionApplied={setTranslatedText}
              />
            </div>
          </div>
          
          {/* Translate Button for Desktop */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleManualTranslate}
              disabled={isLoading || !sourceText.trim() || isListening}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold text-sm shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 hover:from-blue-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2 hover:scale-102 active:scale-98"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Translating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Translate Now</span>
                </>
              )}
            </button>
          </div>
        </div>
      </main>

      {/* Footer Details */}
      <footer className="mt-8 md:mt-12 text-center text-xs text-slate-400 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 border-t border-slate-200/30 dark:border-slate-800/30 pt-6">
        <p>© 2026 AuraTranslate. Designed with Google DeepMind.</p>
        <span className="hidden sm:inline">•</span>
        <div className="flex items-center gap-2">
          <span>NLLB · IndicTrans2 · MarianMT · M2M100 · OPUS-MT</span>
          <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-medium font-mono border border-slate-200/30 dark:border-slate-700/30">v2.0.0</span>
        </div>
      </footer>

      {/* Drag-and-drop Image/PDF Upload Modal Overlay */}
      {isUploadModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800/80 rounded-3xl w-full max-w-lg shadow-2xl p-6 relative backdrop-blur-2xl flex flex-col gap-4 animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-150 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-blue-500" />
                <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-slate-100">
                  Document / Image Translation
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFile(null);
                  setExtractionError(null);
                }}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-550 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drop Zone */}
            {!selectedFile ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[220px] ${
                  dragActive
                    ? 'border-blue-500 bg-blue-500/5 scale-98 shadow-inner'
                    : 'border-slate-200 dark:border-slate-800 hover:border-blue-400/60 dark:hover:border-blue-500/30 bg-slate-55/20 dark:bg-slate-900/20 hover:bg-white dark:hover:bg-slate-900/40'
                }`}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept=".png,.jpg,.jpeg,.pdf,.docx,.txt,.pptx"
                  className="hidden"
                />
                <Upload className={`w-12 h-12 text-slate-350 dark:text-slate-600 stroke-[1.5] mb-4 transition-transform ${dragActive ? 'scale-110' : ''}`} />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Drag and drop your file here, or <span className="text-blue-500 hover:underline">browse</span>
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Supports PNG, JPG, PDF, DOCX, PPTX, TXT (up to 10MB)
                </p>
              </div>
            ) : (
              // Selected File Preview Pane
              <div className="p-4 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-800/60 rounded-2xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 truncate">
                    <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                      <Globe className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="truncate">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 truncate">
                        {selectedFile.name}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedFile(null);
                      setExtractionError(null);
                    }}
                    disabled={isExtracting}
                    className="p-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 text-slate-400 dark:text-slate-500 hover:text-slate-655 dark:hover:text-slate-355 transition-colors shrink-0 disabled:opacity-40 cursor-pointer"
                    title="Remove file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Document Translation Options */}
                {selectedFile && !isExtracting && !isTranslatingDoc && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800/60 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          OCR Engine
                        </label>
                        <select
                          value={ocrEngine}
                          onChange={(e) => setOcrEngine(e.target.value as 'tesseract' | 'paddleocr')}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="tesseract">Tesseract (Fast / Wasm)</option>
                          <option value="paddleocr">PaddleOCR (High Accuracy)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          Export Format
                        </label>
                        <select
                          value={exportFormat}
                          onChange={(e) => setExportFormat(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-xl bg-slate-55 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
                        >
                          <option value="pdf">PDF Document</option>
                          <option value="docx">Word (DOCX)</option>
                          <option value="txt">Plain Text (TXT)</option>
                          <option value="pptx">PowerPoint (PPTX)</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="preserve-layout-check"
                        checked={preserveLayout}
                        onChange={(e) => setPreserveLayout(e.target.checked)}
                        className="rounded border-slate-200 dark:border-slate-800 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                      />
                      <label htmlFor="preserve-layout-check" className="text-xs font-semibold text-slate-600 dark:text-slate-400 cursor-pointer">
                        Preserve Original Layout & Placement
                      </label>
                    </div>
                  </div>
                )}

                {/* Loading / Progress Indicator for image/OCR extraction */}
                {isExtracting && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400 font-semibold animate-pulse">
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Processing document & extracting text...
                      </span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-1 rounded-full overflow-hidden">
                      <div className="bg-blue-500 h-full animate-pulse w-1/2 rounded-full" />
                    </div>
                  </div>
                )}

                {/* Streaming Progress Bar for full document translation */}
                {isTranslatingDoc && (
                  <div className="space-y-2 animate-in fade-in duration-300">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        {docStatus || 'Translating...'}
                      </span>
                      <span className="text-slate-500 dark:text-slate-400 font-mono">{docProgress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                        style={{ width: `${docProgress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {extractionError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-555 text-xs font-semibold flex items-start gap-2 animate-in fade-in duration-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{extractionError}</span>
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 mt-1">
              <button
                type="button"
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFile(null);
                  setExtractionError(null);
                  setDocProgress(0);
                  setDocStatus('');
                }}
                disabled={isExtracting || isTranslatingDoc}
                className="px-4 py-2 rounded-xl text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTranslateDocument}
                disabled={!selectedFile || isExtracting || isTranslatingDoc}
                className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 hover:bg-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Extracting...</span>
                  </>
                ) : isTranslatingDoc ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Translating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{
                      selectedFile && (
                        selectedFile.name.toLowerCase().endsWith('.docx') ||
                        selectedFile.name.toLowerCase().endsWith('.txt') ||
                        selectedFile.name.toLowerCase().endsWith('.pptx') ||
                        selectedFile.name.toLowerCase().endsWith('.pdf') ||
                        preserveLayout
                      )
                        ? 'Translate Document'
                        : 'Extract & Translate'
                    }</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Sidebar Panel */}
      <HistorySidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        history={history || []}
        onSelectHistory={handleSelectHistory}
        onDeleteHistory={(id) => setHistory((prev) => prev.filter((item) => item.id !== id))}
        onClearHistory={() => setHistory([])}
        onExportHistory={handleExportHistory}
      />
    </div>
  );
}
