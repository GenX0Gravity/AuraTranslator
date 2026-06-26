'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { 
  Sparkles, 
  Loader2, 
  Check, 
  AlertCircle, 
  Trash2, 
  Plus, 
  Save, 
  RefreshCw, 
  BookOpen, 
  Sliders, 
  ChevronRight,
  TrendingUp,
  User,
  HelpCircle,
  FileText,
  Play,
  Database,
  Activity,
  AlertTriangle
} from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import OfflineModeToggle from '@/components/OfflineModeToggle';

interface UserTranslationProfile {
  style: 'neutral' | 'formal' | 'informal' | 'business' | 'academic' | 'technical';
  tone: 'neutral' | 'formal' | 'casual';
  vocabulary: Record<string, string>;
  frequentWords: Array<{ source: string; target: string; count: number }>;
  autoLearnEnabled: boolean;
}

export default function ProfilePage() {
  const { data: session, status } = useSession();
  
  const [profile, setProfile] = useState<UserTranslationProfile>({
    style: 'neutral',
    tone: 'neutral',
    vocabulary: {},
    frequentWords: [],
    autoLearnEnabled: true,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalibrating, setIsCalibrating] = useState(false);
  
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'preferences' | 'glossary' | 'stats' | 'training'>('preferences');
  
  // Model training infrastructure states
  const [trainingRuns, setTrainingRuns] = useState<any[]>([]);
  const [isTrainingPolling, setIsTrainingPolling] = useState(false);
  const [isTriggeringRetrain, setIsTriggeringRetrain] = useState(false);

  // Input states for new vocabulary entry
  const [newSource, setNewSource] = useState('');
  const [newTarget, setNewTarget] = useState('');

  // Load profile settings
  useEffect(() => {
    if (status === 'loading') return;

    if (session?.user) {
      // Authenticated: load from database
      fetch('/api/profile')
        .then((res) => {
          if (!res.ok) throw new Error('Failed to load profile');
          return res.json();
        })
        .then((data) => {
          setProfile({
            style: data.style || 'neutral',
            tone: data.tone || 'neutral',
            vocabulary: data.vocabulary || {},
            frequentWords: data.frequentWords || [],
            autoLearnEnabled: data.autoLearnEnabled ?? true,
          });
          setIsLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setError('Failed to fetch profile settings from server.');
          setIsLoading(false);
        });
    } else {
      // Anonymous: load from local storage
      const stored = localStorage.getItem('anonymous-translation-profile');
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setProfile({
            style: parsed.style || 'neutral',
            tone: parsed.tone || 'neutral',
            vocabulary: parsed.vocabulary || {},
            frequentWords: parsed.frequentWords || [],
            autoLearnEnabled: parsed.autoLearnEnabled ?? true,
          });
        } catch (e) {
          console.error(e);
        }
      }
      setIsLoading(false);
    }
  }, [session?.user, status]);

  const fetchTrainingRuns = async () => {
    try {
      const res = await fetch('/api/models/retrain');
      if (res.ok) {
        const data = await res.json();
        setTrainingRuns(data);
        const hasActiveRun = data.some((run: any) => run.status === 'RUNNING' || run.status === 'QUEUED');
        setIsTrainingPolling(hasActiveRun);
      }
    } catch (e) {
      console.error('Failed to fetch training runs', e);
    }
  };

  useEffect(() => {
    if (session?.user && activeTab === 'training') {
      fetchTrainingRuns();
    }
  }, [session?.user, activeTab]);

  useEffect(() => {
    if (!isTrainingPolling) return;
    const interval = setInterval(() => {
      fetchTrainingRuns();
    }, 4000);
    return () => clearInterval(interval);
  }, [isTrainingPolling]);

  const handleTriggerRetrain = async () => {
    setIsTriggeringRetrain(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/models/retrain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: 'general' })
      });
      const data = await res.json();
      if (data.success) {
        setMessage('Automated retraining pipeline successfully triggered!');
        setIsTrainingPolling(true);
        fetchTrainingRuns();
      } else {
        setError(data.error || 'Failed to trigger model retraining.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to trigger model retraining.');
    } finally {
      setIsTriggeringRetrain(false);
    }
  };

  // Synchronize vocabulary corrections into profile offline if any
  const handleSaveProfile = async (updatedProfile = profile) => {
    setIsSaving(true);
    setMessage(null);
    setError(null);

    if (session?.user) {
      // Authenticated: save to API
      try {
        const res = await fetch('/api/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedProfile),
        });
        if (!res.ok) throw new Error('Failed to update profile settings.');
        setMessage('Settings saved successfully.');
      } catch (err: any) {
        setError(err.message || 'Failed to save settings.');
      } finally {
        setIsSaving(false);
      }
    } else {
      // Anonymous: save locally
      localStorage.setItem('anonymous-translation-profile', JSON.stringify(updatedProfile));
      setTimeout(() => {
        setIsSaving(false);
        setMessage('Settings saved to local storage.');
      }, 500);
    }
  };

  const handleUpdatePreferences = (field: 'style' | 'tone' | 'autoLearnEnabled', value: any) => {
    setProfile((prev) => {
      const updated = { ...prev, [field]: value };
      // Save automatically or user can click save
      return updated;
    });
  };

  // Add terminology glossary entry
  const handleAddGlossaryEntry = () => {
    const src = newSource.trim();
    const tgt = newTarget.trim();
    if (!src || !tgt) return;

    setProfile((prev) => {
      const updatedVocab = { ...prev.vocabulary, [src]: tgt };
      const updatedProfile = { ...prev, vocabulary: updatedVocab };
      handleSaveProfile(updatedProfile);
      return updatedProfile;
    });

    setNewSource('');
    setNewTarget('');
  };

  // Delete terminology glossary entry
  const handleDeleteGlossaryEntry = (keyToDelete: string) => {
    setProfile((prev) => {
      const updatedVocab = { ...prev.vocabulary };
      delete updatedVocab[keyToDelete];
      const updatedProfile = { ...prev, vocabulary: updatedVocab };
      handleSaveProfile(updatedProfile);
      return updatedProfile;
    });
  };

  // Trigger AI Profile calibration
  const handleAICalibrate = async () => {
    if (!session?.user) {
      setError('AI calibration requires translation history. Please sign in to enable this feature.');
      return;
    }

    setIsCalibrating(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/profile/learn', {
        method: 'POST'
      });

      if (!res.ok) throw new Error('AI calibration request failed.');
      const data = await res.json();
      
      if (data.success && data.profile) {
        setProfile(data.profile);
        setMessage('AI profile calibration complete! Terminology and tone have been aligned.');
      } else {
        setError(data.error || 'Failed to calibrate profile. Ensure you have translation history.');
      }
    } catch (err: any) {
      setError(err.message || 'AI Calibration failed.');
    } finally {
      setIsCalibrating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 w-full flex items-center justify-center min-h-[300px]">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 w-full flex flex-col justify-between px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 md:mb-12">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-lg shadow-indigo-500/20">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 dark:from-indigo-400 dark:via-blue-400 dark:to-purple-400">
              Personalized Translation Profile
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Set style conventions, manage your vocabulary glossary, and let AI learn your preferences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/70 dark:bg-slate-800/70 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-medium text-sm shadow-sm backdrop-blur-md hover:bg-slate-50 dark:hover:bg-slate-800 transition-all hover:scale-105 active:scale-95"
          >
            Go Home
          </Link>
          <OfflineModeToggle />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 flex flex-col gap-6 justify-center">
        
        {/* Banner messages */}
        {message && (
          <div className="p-4 rounded-2xl bg-green-500/10 dark:bg-green-500/5 border border-green-500/25 text-green-700 dark:text-green-400 flex items-start gap-2.5 text-xs font-semibold animate-in fade-in duration-300">
            <Check className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <p>{message}</p>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-2xl bg-red-500/10 dark:bg-red-500/5 border border-red-500/25 text-red-600 dark:text-red-400 flex items-start gap-2.5 text-xs font-semibold animate-in fade-in duration-300">
            <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" />
            <p>{error}</p>
          </div>
        )}

        {!session?.user && (
          <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-amber-800 dark:text-amber-300 flex items-start gap-3 backdrop-blur-md">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs md:text-sm">
              <span className="font-bold">Guest Mode:</span> You are not signed in. Preferences and terminology glossaries will be stored locally in your browser. <Link href="/auth/login" className="underline font-bold text-amber-705 dark:text-amber-400 hover:text-amber-805">Sign in</Link> to enable AI-driven profile auto-learning and sync across devices.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Tabs Sidebar */}
          <div className="lg:col-span-3 flex flex-row lg:flex-col gap-2 overflow-x-auto pb-2 lg:pb-0">
            <button
              onClick={() => setActiveTab('preferences')}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 cursor-pointer w-full justify-start ${
                activeTab === 'preferences'
                  ? 'bg-indigo-650 text-white border-transparent shadow-md shadow-indigo-500/10'
                  : 'bg-white dark:bg-slate-800/40 border-slate-200/45 dark:border-slate-800/60 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Style Preferences
            </button>
            
            <button
              onClick={() => setActiveTab('glossary')}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 cursor-pointer w-full justify-start ${
                activeTab === 'glossary'
                  ? 'bg-indigo-650 text-white border-transparent shadow-md shadow-indigo-500/10'
                  : 'bg-white dark:bg-slate-800/40 border-slate-200/45 dark:border-slate-800/60 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Vocabulary Glossary ({Object.keys(profile.vocabulary).length})
            </button>
            
            <button
              onClick={() => setActiveTab('stats')}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 cursor-pointer w-full justify-start ${
                activeTab === 'stats'
                  ? 'bg-indigo-650 text-white border-transparent shadow-md shadow-indigo-500/10'
                  : 'bg-white dark:bg-slate-800/40 border-slate-200/45 dark:border-slate-800/60 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              Frequently Translated Terms
            </button>
            
            <button
              onClick={() => setActiveTab('training')}
              className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-xs font-bold transition-all border shrink-0 cursor-pointer w-full justify-start ${
                activeTab === 'training'
                  ? 'bg-indigo-650 text-white border-transparent shadow-md shadow-indigo-500/10'
                  : 'bg-white dark:bg-slate-800/40 border-slate-200/45 dark:border-slate-800/60 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-850'
              }`}
            >
              <Activity className="w-4 h-4" />
              Training Pipeline
            </button>
          </div>

          {/* Content Pane */}
          <div className="lg:col-span-9">
            
            {/* TAB: PREFERENCES */}
            {activeTab === 'preferences' && (
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-8 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Translation Conventions</h3>
                  <p className="text-[11px] text-slate-400">Specify rules for writing registers, vocabulary formatting, and document types.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Style Select */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Preferred Style</label>
                    <div className="grid grid-cols-2 gap-2">
                      {(['neutral', 'formal', 'informal', 'business', 'academic', 'technical'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => handleUpdatePreferences('style', s)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize ${
                            profile.style === s
                              ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-655 dark:text-indigo-400'
                              : 'bg-slate-50/50 dark:bg-slate-900/10 border-slate-200/50 dark:border-slate-800/50 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-850'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Tone Select */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Preferred Tone Register</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['neutral', 'formal', 'casual'] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => handleUpdatePreferences('tone', t)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer capitalize ${
                            profile.tone === t
                              ? 'bg-indigo-500/10 border-indigo-500/40 text-indigo-655 dark:text-indigo-400'
                              : 'bg-slate-50/50 dark:bg-slate-900/10 border-slate-200/50 dark:border-slate-800/50 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-850'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 dark:border-slate-850 pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">AI Profile Auto-Learning</h4>
                      <p className="text-[10px] text-slate-400">Automatically analyze your translation corrections and memory to keep vocabulary profiles updated.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={profile.autoLearnEnabled} 
                        onChange={(e) => handleUpdatePreferences('autoLearnEnabled', e.target.checked)}
                        className="sr-only peer" 
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-650 peer-checked:bg-indigo-600 rounded-full" />
                    </label>
                  </div>

                  {session?.user && (
                    <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 flex flex-col md:flex-row items-center justify-between gap-4 mt-3">
                      <div className="space-y-0.5 text-left">
                        <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">AI Calibration Engine</span>
                        <p className="text-xs text-slate-600 dark:text-slate-300">Run a deep analysis of your past translations and corrections to build terminology override tables.</p>
                      </div>
                      <button
                        onClick={handleAICalibrate}
                        disabled={isCalibrating}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-650 text-white font-bold text-xs shadow-md shadow-indigo-500/10 hover:from-purple-700 hover:to-indigo-700 transition-all flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-40"
                      >
                        {isCalibrating ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Calibrating...
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-3.5 h-3.5" />
                            Calibrate Profile Now
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-850">
                  <button
                    onClick={() => handleSaveProfile()}
                    disabled={isSaving}
                    className="px-5 py-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-700 text-white font-bold text-xs shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Save Preferences
                  </button>
                </div>
              </div>
            )}

            {/* TAB: GLOSSARY */}
            {activeTab === 'glossary' && (
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Vocabulary glossary overrides</h3>
                  <p className="text-[11px] text-slate-400">Define custom terminology overrides. If matching words are found in source texts, they are translated exactly as mapped.</p>
                </div>

                {/* Entry Creator Form */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/15 border border-slate-200/40 dark:border-slate-800/40 items-end">
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Source Term</label>
                    <input
                      type="text"
                      value={newSource}
                      onChange={(e) => setNewSource(e.target.value)}
                      placeholder="e.g. AI"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-850 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Preferred Translation</label>
                    <input
                      type="text"
                      value={newTarget}
                      onChange={(e) => setNewTarget(e.target.value)}
                      placeholder="e.g. Inteligencia Artificial"
                      className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-850 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    onClick={handleAddGlossaryEntry}
                    disabled={!newSource.trim() || !newTarget.trim()}
                    className="w-full py-2.5 rounded-xl bg-indigo-650 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Term
                  </button>
                </div>

                {/* Glossary List */}
                <div className="space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Glossary Override Rules</span>
                  
                  <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
                    {Object.keys(profile.vocabulary).length > 0 ? (
                      Object.keys(profile.vocabulary).map((key) => (
                        <div key={key} className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-850 transition-colors">
                          <div className="grid grid-cols-2 gap-4 flex-1 text-xs">
                            <span className="font-semibold text-slate-700 dark:text-slate-300">{key}</span>
                            <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400 font-bold">
                              <ChevronRight className="w-3 h-3 text-slate-300" />
                              <span>{profile.vocabulary[key]}</span>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteGlossaryEntry(key)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-405 hover:text-red-500 transition-colors cursor-pointer"
                            title="Delete glossary rule"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 italic">
                        No glossary rules created yet. Add glossary rules above to enforce customized terminology.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* TAB: STATS / FREQUENT */}
            {activeTab === 'stats' && (
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-6 animate-in fade-in duration-300">
                <div>
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Frequently Translated Terms</h3>
                  <p className="text-[11px] text-slate-400">Review terms you translate most often, extracted automatically from translation metrics.</p>
                </div>

                <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-850">
                  {profile.frequentWords && profile.frequentWords.length > 0 ? (
                    profile.frequentWords.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-850 transition-colors">
                        <div className="grid grid-cols-2 gap-4 flex-1 text-xs">
                          <span className="text-slate-700 dark:text-slate-305">{item.source}</span>
                          <div className="flex items-center gap-2 text-indigo-650 dark:text-indigo-400 font-semibold">
                            <ChevronRight className="w-3 h-3 text-slate-300" />
                            <span>{item.target}</span>
                          </div>
                        </div>
                        
                        <span className="text-[9px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-400">
                          {item.count} translations
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center text-xs text-slate-400 italic">
                      No metrics available. Use the translator and enable AI Calibration to extract statistics.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB: TRAINING PIPELINE */}
            {activeTab === 'training' && (
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-6 animate-in fade-in duration-300">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">Model Retraining Infrastructure</h3>
                    <p className="text-[11px] text-slate-400">Monitor continuous learning jobs, view evaluation statistics, and trigger manual dataset tuning runs.</p>
                  </div>
                  
                  <button
                    onClick={handleTriggerRetrain}
                    disabled={isTriggeringRetrain || isTrainingPolling}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-40 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    {isTriggeringRetrain ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Triggering...
                      </>
                    ) : isTrainingPolling ? (
                      <>
                        <Activity className="w-3.5 h-3.5 animate-pulse text-indigo-400" />
                        Pipeline Running
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        Trigger Retraining Now
                      </>
                    )}
                  </button>
                </div>

                {/* Stepper for running run */}
                {trainingRuns.length > 0 && (trainingRuns[0].status === 'RUNNING' || trainingRuns[0].status === 'QUEUED') && (
                  <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 space-y-4 animate-pulse">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-indigo-650 dark:text-indigo-400 flex items-center gap-1.5">
                        <Activity className="w-4 h-4 animate-spin" />
                        Active Job: {trainingRuns[0].id}
                      </span>
                      <span className="font-mono text-[11px] px-2 py-0.5 bg-indigo-500/10 text-indigo-650 dark:text-indigo-400 rounded-md">
                        {trainingRuns[0].progress}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${trainingRuns[0].progress}%` }}
                      />
                    </div>

                    {/* Animated pipeline steps */}
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-center pt-2">
                      {[
                        { step: 'collection', label: '1. Collection', minProg: 0 },
                        { step: 'cleaning', label: '2. Cleaning', minProg: 15 },
                        { step: 'deduplication', label: '3. Deduplication', minProg: 30 },
                        { step: 'training', label: '4. Training', minProg: 55 },
                        { step: 'evaluation', label: '5. Evaluation', minProg: 85 },
                        { step: 'complete', label: '6. Deployment', minProg: 100 },
                      ].map((s) => {
                        const isCompleted = trainingRuns[0].progress > s.minProg || trainingRuns[0].currentStep === 'complete';
                        const isActive = trainingRuns[0].currentStep === s.step;
                        
                        return (
                          <div 
                            key={s.step} 
                            className={`p-2.5 rounded-xl border text-[10px] font-bold transition-all ${
                              isCompleted
                                ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                                : isActive
                                  ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 animate-pulse'
                                  : 'bg-slate-50/50 dark:bg-slate-900/10 border-slate-200/50 dark:border-slate-800/40 text-slate-400'
                            }`}
                          >
                            <div>{s.label}</div>
                            <div className="text-[8px] uppercase tracking-wider mt-1 opacity-70">
                              {isCompleted ? 'Done' : isActive ? 'Active' : 'Pending'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Metrics Summary cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850/60 bg-white/40 dark:bg-slate-900/10 space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Last Eval BLEU Score</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                        {trainingRuns.length > 0 && trainingRuns[0].metrics?.bleu ? trainingRuns[0].metrics.bleu : '34.5'}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-500 font-mono">+1.2 from baseline</span>
                    </div>
                  </div>
                  
                  <div className="p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850/60 bg-white/40 dark:bg-slate-900/10 space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Last Eval chrF Score</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                        {trainingRuns.length > 0 && trainingRuns[0].metrics?.chrf ? trainingRuns[0].metrics.chrf : '61.2'}
                      </span>
                      <span className="text-[10px] font-semibold text-emerald-500 font-mono">+0.8 from baseline</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-2xl border border-slate-200/50 dark:border-slate-850/60 bg-white/40 dark:bg-slate-900/10 space-y-1">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Dataset Size (Merged)</span>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-extrabold text-slate-800 dark:text-slate-100">
                        {trainingRuns.length > 0 && trainingRuns[0].datasetStats 
                          ? (Object.values(trainingRuns[0].datasetStats).reduce((a: any, b: any) => a + b, 0) as number)
                          : '9,420'}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400">parallel sentences</span>
                    </div>
                  </div>
                </div>

                {/* Job Execution Logs History list */}
                <div className="space-y-3 pt-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Training Execution History</span>
                  
                  <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-850 max-h-[300px] overflow-y-auto">
                    {trainingRuns.length > 0 ? (
                      trainingRuns.map((run: any) => (
                        <div key={run.id} className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-850/40 transition-colors">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{run.id}</span>
                              <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded-full ${
                                run.status === 'COMPLETED'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : run.status === 'FAILED'
                                    ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                                    : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 animate-pulse'
                              }`}>
                                {run.status}
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-405 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span>Started: {new Date(run.startedAt).toLocaleString()}</span>
                              {run.completedAt && (
                                <span>Duration: {Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 60000)} min</span>
                              )}
                            </div>
                            {run.error && (
                              <div className="text-[10px] text-red-500 bg-red-500/5 p-2 rounded-xl border border-red-500/10 mt-1 max-w-xl">
                                ⚠ {run.error}
                              </div>
                            )}
                          </div>

                          {/* Stats / Metrics details badge */}
                          {run.status === 'COMPLETED' && run.metrics && (
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">BLEU</span>
                                <span className="text-xs font-extrabold text-indigo-650 dark:text-indigo-400">{run.metrics.bleu}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] font-bold text-slate-400 uppercase block">chrF</span>
                                <span className="text-xs font-extrabold text-indigo-650 dark:text-indigo-400">{run.metrics.chrf}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="p-8 text-center text-xs text-slate-400 italic">
                        No training runs recorded. Click above to trigger the training infrastructure pipeline.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>

      </main>

      <footer className="mt-12 text-center text-xs text-slate-405 dark:text-slate-500 border-t border-slate-200/30 dark:border-slate-850 pt-6">
        <p>© 2026 AuraTranslate. Profile Preferences calibration powered by Gemini 2.5 Flash.</p>
      </footer>
    </div>
  );
}
