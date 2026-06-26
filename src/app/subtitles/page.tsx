'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Upload,
  Download,
  Sparkles,
  Loader2,
  Plus,
  Trash2,
  FileVideo,
  FileAudio,
  Tv,
  Globe,
  Check,
  Copy,
  ChevronDown
} from 'lucide-react';
import { LANGUAGES, getLanguageName } from '@/utils/languages';
import ThemeToggle from '@/components/ThemeToggle';
import { exportToSRT, exportToVTT, exportToASS, SubtitleSegment } from '@/utils/subtitle-formats';

const YoutubeIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

// Declare YT global type for YouTube Player API
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

export default function SubtitlesPage() {
  // Navigation & Page State
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('es');
  const [viewMode, setViewMode] = useState<'source' | 'translated' | 'bilingual'>('source');

  // Media States
  const [mediaType, setMediaType] = useState<'none' | 'local' | 'youtube'>('none');
  const [localFileUrl, setLocalFileUrl] = useState<string>('');
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState<string>('');
  const [youtubeId, setYoutubeId] = useState<string>('');
  
  // Subtitle States
  const [segments, setSegments] = useState<SubtitleSegment[]>([]);
  const [translatedSegments, setTranslatedSegments] = useState<Record<number, string>>({});
  
  // Loading & Error States
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isFetchingYouTube, setIsFetchingYouTube] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [youtubeLanguages, setYoutubeLanguages] = useState<{code: string, name: string}[]>([]);
  const [selectedYoutubeLang, setSelectedYoutubeLang] = useState<string>('en');

  // Playback & Timing Sync States
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [exportFormat, setExportFormat] = useState<'srt' | 'vtt' | 'ass'>('srt');
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Refs for HTML5 players
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const ytPlayerRef = useRef<any>(null);
  const pollIntervalRef = useRef<any>(null);

  // Load YouTube Player API script dynamically
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  // Setup playhead tracker for local video/audio players
  const handleTimeUpdate = (e: any) => {
    const time = e.target.currentTime;
    setCurrentTime(time);
    updateActiveSegment(time);
  };

  // Find and update currently active segment based on time
  const updateActiveSegment = (time: number) => {
    const active = segments.find(seg => time >= seg.start && time <= seg.end);
    if (active) {
      setActiveSegmentId(active.id);
      if (autoScroll) {
        const activeRow = document.getElementById(`seg-row-${active.id}`);
        if (activeRow) {
          activeRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    } else {
      setActiveSegmentId(null);
    }
  };

  // Initialize YouTube Iframe Player
  const initYoutubePlayer = (videoId: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    const setupPlayer = () => {
      ytPlayerRef.current = new window.YT.Player('yt-iframe-player', {
        videoId: videoId,
        events: {
          onStateChange: (event: any) => {
            // YT.PlayerState.PLAYING is 1
            if (event.data === 1) {
              pollIntervalRef.current = setInterval(() => {
                if (ytPlayerRef.current && ytPlayerRef.current.getCurrentTime) {
                  const time = ytPlayerRef.current.getCurrentTime();
                  setCurrentTime(time);
                  updateActiveSegment(time);
                }
              }, 250);
            } else {
              if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            }
          }
        }
      });
    };

    if (window.YT && window.YT.Player) {
      setupPlayer();
    } else {
      window.onYouTubeIframeAPIReady = setupPlayer;
    }
  };

  // Extract YouTube ID and fetch captions metadata
  const handleYoutubeFetch = async () => {
    if (!youtubeUrl.trim()) return;
    setError(null);
    setIsFetchingYouTube(true);
    setSegments([]);
    setTranslatedSegments({});

    const regExp = /^.*(?:(?:youtu.be\/|v\/|vi\/|u\/\w\/|embed\/|shorts\/)|(?:(?:watch)?\?v(?:i)?=|\&v(?:i)?=))([^#\&\?]*).*/;
    const match = youtubeUrl.match(regExp);
    const videoId = (match && match[1].length === 11) ? match[1] : null;

    if (!videoId) {
      setError('Invalid YouTube URL format.');
      setIsFetchingYouTube(false);
      return;
    }

    setYoutubeId(videoId);

    try {
      const res = await fetch('/api/subtitles/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch subtitles from YouTube');
      }

      setSegments(data.segments);
      setYoutubeLanguages(data.availableLanguages || []);
      setSelectedYoutubeLang(data.language);
      setMediaType('youtube');
      
      // Delay initialization slightly to ensure iframe container exists
      setTimeout(() => {
        initYoutubePlayer(videoId);
      }, 500);

    } catch (err: any) {
      setError(err.message || 'Error occurred while loading YouTube subtitles.');
      // Still set media type so player loads, even if transcribing is required manually
      setMediaType('youtube');
      setTimeout(() => {
        initYoutubePlayer(videoId);
      }, 500);
    } finally {
      setIsFetchingYouTube(false);
    }
  };

  // Fetch YouTube Captions in another language if requested
  const handleYoutubeLangChange = async (langCode: string) => {
    setSelectedYoutubeLang(langCode);
    setIsFetchingYouTube(true);
    setError(null);
    setSegments([]);
    setTranslatedSegments({});

    try {
      const res = await fetch('/api/subtitles/youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: youtubeUrl, lang: langCode })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setSegments(data.segments);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch subtitle language.');
    } finally {
      setIsFetchingYouTube(false);
    }
  };

  // Handle local file selection
  const handleLocalFileChange = (file: File) => {
    if (!file) return;
    setError(null);
    setLocalFile(file);
    setSegments([]);
    setTranslatedSegments({});
    
    const isVideo = file.type.startsWith('video/');
    const isAudio = file.type.startsWith('audio/');
    
    if (!isVideo && !isAudio) {
      setError('Please upload a valid video or audio file.');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setLocalFileUrl(objectUrl);
    setMediaType('local');
  };

  // Trigger ASR Audio/Video speech recognition
  const handleTranscribe = async () => {
    if (!localFile && mediaType !== 'youtube') return;
    setIsTranscribing(true);
    setError(null);
    setSegments([]);
    setTranslatedSegments({});

    try {
      const formData = new FormData();
      if (mediaType === 'local' && localFile) {
        formData.append('file', localFile);
      } else {
        setError('Direct YouTube transcription requires downloading the audio first. Please upload the media file instead.');
        setIsTranscribing(false);
        return;
      }
      
      formData.append('sourceLang', sourceLang);

      const res = await fetch('/api/subtitles/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ASR transcription failed');
      }

      setSegments(data.segments);
    } catch (err: any) {
      setError(err.message || 'An error occurred during audio transcription.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // Trigger Subtitle Translation
  const handleTranslate = async () => {
    if (segments.length === 0) return;
    setIsTranslating(true);
    setError(null);

    try {
      const res = await fetch('/api/subtitles/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          segments: segments.map(s => ({ id: s.id, text: s.text })),
          sourceLang: sourceLang === 'auto' ? '' : sourceLang,
          targetLang
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Subtitles translation failed');
      }

      const transMap: Record<number, string> = {};
      data.translatedSegments.forEach((t: any) => {
        transMap[t.id] = t.text;
      });

      setTranslatedSegments(transMap);
      setViewMode('bilingual'); // Auto switch to side-by-side view
    } catch (err: any) {
      setError(err.message || 'An error occurred during subtitle translation.');
    } finally {
      setIsTranslating(false);
    }
  };

  // Seek player to segment start time
  const handleSeek = (start: number) => {
    if (mediaType === 'local') {
      if (videoRef.current && localFile?.type.startsWith('video/')) {
        videoRef.current.currentTime = start;
        videoRef.current.play();
      } else if (audioRef.current && localFile?.type.startsWith('audio/')) {
        audioRef.current.currentTime = start;
        audioRef.current.play();
      }
    } else if (mediaType === 'youtube' && ytPlayerRef.current && ytPlayerRef.current.seekTo) {
      ytPlayerRef.current.seekTo(start, true);
      ytPlayerRef.current.playVideo();
    }
  };

  // Edit segment text box
  const handleSegmentTextChange = (id: number, text: string, type: 'source' | 'translated') => {
    if (type === 'source') {
      setSegments(prev => prev.map(s => s.id === id ? { ...s, text } : s));
    } else {
      setTranslatedSegments(prev => ({ ...prev, [id]: text }));
    }
  };

  // Edit segment timestamps
  const handleTimeChange = (id: number, val: string, field: 'start' | 'end') => {
    const num = parseFloat(val);
    if (isNaN(num)) return;
    setSegments(prev => prev.map(s => s.id === id ? { ...s, [field]: num } : s));
  };

  // Add new subtitle segment
  const handleAddSegment = () => {
    const newId = segments.length > 0 ? Math.max(...segments.map(s => s.id)) + 1 : 1;
    const start = currentTime;
    const end = currentTime + 3; // Default 3 second length
    
    const newSeg: SubtitleSegment = {
      id: newId,
      start,
      end,
      text: 'New segment text...'
    };

    // Find insertion index based on time
    const insertIdx = segments.findIndex(s => s.start > start);
    let newSegments = [];
    if (insertIdx === -1) {
      newSegments = [...segments, newSeg];
    } else {
      newSegments = [...segments.slice(0, insertIdx), newSeg, ...segments.slice(insertIdx)];
    }

    // Re-index IDs to keep them sequential
    const ordered = newSegments.map((s, idx) => ({ ...s, id: idx + 1 }));
    setSegments(ordered);
    
    // Also adjust translations map IDs if needed
    const nextTransMap: Record<number, string> = {};
    Object.keys(translatedSegments).forEach(k => {
      const keyNum = parseInt(k, 10);
      const originalSeg = segments.find(s => s.id === keyNum);
      if (originalSeg) {
        // Find where it moved to
        const newSegMatch = ordered.find(s => s.start === originalSeg.start && s.text === originalSeg.text);
        if (newSegMatch) {
          nextTransMap[newSegMatch.id] = translatedSegments[keyNum];
        }
      }
    });
    setTranslatedSegments(nextTransMap);
  };

  // Delete segment
  const handleDeleteSegment = (id: number) => {
    const filtered = segments.filter(s => s.id !== id);
    const ordered = filtered.map((s, idx) => ({ ...s, id: idx + 1 }));
    setSegments(ordered);

    // Adjust translations map IDs
    const nextTransMap: Record<number, string> = {};
    Object.keys(translatedSegments).forEach(k => {
      const keyNum = parseInt(k, 10);
      if (keyNum !== id) {
        const originalSeg = segments.find(s => s.id === keyNum);
        if (originalSeg) {
          const newSegMatch = ordered.find(s => s.start === originalSeg.start && s.text === originalSeg.text);
          if (newSegMatch) {
            nextTransMap[newSegMatch.id] = translatedSegments[keyNum];
          }
        }
      }
    });
    setTranslatedSegments(nextTransMap);
  };

  // Handle subtitle download export
  const handleExportDownload = () => {
    let output = '';
    const activeSegments = viewMode === 'translated' 
      ? segments.map(s => ({ ...s, text: translatedSegments[s.id] || '' }))
      : segments;

    switch (exportFormat) {
      case 'srt':
        output = exportToSRT(activeSegments);
        break;
      case 'vtt':
        output = exportToVTT(activeSegments);
        break;
      case 'ass':
        output = exportToASS(activeSegments);
        break;
    }

    const mimeTypes = {
      srt: 'text/srt',
      vtt: 'text/vtt',
      ass: 'text/plain'
    };

    const blob = new Blob([output], { type: mimeTypes[exportFormat] });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subtitles_${exportFormat.toUpperCase()}.${exportFormat}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setIsExportOpen(false);
  };

  // Copy subtitles text to clipboard
  const handleCopyClipboard = () => {
    const text = segments
      .map(s => {
        const transText = translatedSegments[s.id];
        return transText ? `${s.text} -> ${transText}` : s.text;
      })
      .join('\n');

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format second timestamps to MM:SS
  const formatSecs = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen flex flex-col p-4 sm:p-6 lg:p-8 animate-in fade-in duration-300">
      {/* Header */}
      <header className="shrink-0 flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800/50 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 p-2 rounded-xl bg-white/60 dark:bg-slate-800/60 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-500 via-purple-500 to-violet-500 bg-clip-text text-transparent">
              Multilingual Subtitle Generator
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Speech Recognition & Translation Workspace</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* Main Workspace Layout */}
      <div className="flex-1 flex flex-col xl:flex-row gap-6 items-stretch">
        
        {/* Left Control / Player Section */}
        <div className="w-full xl:w-5/12 flex flex-col gap-6">
          
          {/* Media Player Panel */}
          <div className="glass-panel rounded-3xl p-4 md:p-6 shadow-xl flex flex-col justify-center items-center relative overflow-hidden min-h-[350px]">
            {mediaType === 'none' && (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
                <FileVideo className="w-12 h-12 text-slate-300 dark:text-slate-700 mb-4 animate-pulse" />
                <h3 className="text-slate-700 dark:text-slate-300 font-bold mb-2">No Media Source Loaded</h3>
                <p className="text-xs text-slate-500 max-w-sm mb-6">Upload a local audio/video file, or enter a YouTube URL to get started transcribing speech.</p>
                
                {/* File Upload Button / Area */}
                <label className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer">
                  <Upload className="w-4 h-4" />
                  Upload Local File
                  <input
                    type="file"
                    accept="video/*,audio/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleLocalFileChange(e.target.files[0])}
                  />
                </label>

                <div className="flex items-center w-full max-w-sm my-5 text-slate-400 dark:text-slate-600">
                  <hr className="flex-1 border-slate-200/50 dark:border-slate-800" />
                  <span className="px-3 text-[10px] font-bold uppercase tracking-wider">or</span>
                  <hr className="flex-1 border-slate-200/50 dark:border-slate-800" />
                </div>

                {/* YouTube Link Loader */}
                <div className="w-full max-w-sm flex items-center gap-2">
                  <div className="flex-1 relative">
                    <YoutubeIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-red-500" />
                    <input
                      type="text"
                      placeholder="Enter YouTube Video URL..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-red-500/50 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleYoutubeFetch}
                    disabled={isFetchingYouTube}
                    className="px-4 py-2.5 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isFetchingYouTube ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Fetch'}
                  </button>
                </div>
              </div>
            )}

            {mediaType === 'local' && localFileUrl && (
              <div className="w-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 max-w-[80%]">
                    {localFile?.type.startsWith('video/') ? <FileVideo className="w-4 h-4 text-indigo-500" /> : <FileAudio className="w-4 h-4 text-emerald-500" />}
                    <span className="truncate">{localFile?.name}</span>
                  </span>
                  <button
                    onClick={() => { setMediaType('none'); setLocalFileUrl(''); setLocalFile(null); }}
                    className="text-xs font-bold text-red-500 hover:text-red-600 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/90 flex items-center justify-center border border-slate-200/40 dark:border-slate-800">
                  {localFile?.type.startsWith('video/') ? (
                    <video
                      ref={videoRef}
                      src={localFileUrl}
                      controls
                      onTimeUpdate={handleTimeUpdate}
                      className="max-h-full max-w-full"
                    />
                  ) : (
                    <div className="flex flex-col items-center p-6 text-center">
                      <FileAudio className="w-16 h-16 text-emerald-500 mb-4 animate-pulse" />
                      <audio
                        ref={audioRef}
                        src={localFileUrl}
                        controls
                        onTimeUpdate={handleTimeUpdate}
                        className="w-full"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {mediaType === 'youtube' && youtubeId && (
              <div className="w-full flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                    <YoutubeIcon className="w-4 h-4 text-red-500" />
                    <span>YouTube Embed Player</span>
                  </span>
                  <button
                    onClick={() => { setMediaType('none'); setYoutubeId(''); setYoutubeUrl(''); if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); }}
                    className="text-xs font-bold text-red-500 hover:text-red-600 cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
                <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black/90 border border-slate-200/40 dark:border-slate-800">
                  {/* YouTube Player Container target for dynamic library API */}
                  <div id="yt-iframe-player" className="w-full h-full"></div>
                </div>

                {/* Subtitle Selectors extracted from YouTube */}
                {youtubeLanguages.length > 0 && (
                  <div className="flex items-center justify-between gap-2 border-t border-slate-200/50 dark:border-slate-800 pt-3 text-xs">
                    <span className="font-bold text-slate-500">Caption Language:</span>
                    <select
                      value={selectedYoutubeLang}
                      onChange={(e) => handleYoutubeLangChange(e.target.value)}
                      className="px-2 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 focus:outline-none"
                    >
                      {youtubeLanguages.map(l => (
                        <option key={l.code} value={l.code}>{l.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Settings Panel */}
          {mediaType !== 'none' && (
            <div className="glass-panel rounded-3xl p-4 md:p-6 shadow-xl flex flex-col gap-5">
              
              {/* Transcription Option Card */}
              {segments.length === 0 && (
                <div className="space-y-4">
                  <div className="border-b border-slate-200/50 dark:border-slate-800 pb-2">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Speech Recognition (ASR)</h3>
                    <p className="text-[11px] text-slate-500">AI audio transcriber powered by Gemini.</p>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Audio Language</label>
                    <select
                      value={sourceLang}
                      onChange={(e) => setSourceLang(e.target.value)}
                      className="px-3 py-2.5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-indigo-500/50"
                    >
                      <option value="auto">Auto Detect Language</option>
                      {LANGUAGES.slice(0, 30).map((l) => (
                        <option key={l.code} value={l.code}>{l.name} {l.flag}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleTranscribe}
                    disabled={isTranscribing}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 hover:scale-102 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                  >
                    {isTranscribing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Transcribing Audio... (FFmpeg + Gemini)
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Subtitles
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Translation & Export Controls (Once Subtitles Are Generated) */}
              {segments.length > 0 && (
                <div className="space-y-5">
                  
                  {/* Translation section */}
                  <div className="space-y-3">
                    <div className="border-b border-slate-200/50 dark:border-slate-800 pb-2">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Subtitle Translation</h3>
                      <p className="text-[11px] text-slate-500">Translate the transcript while preserving timestamps.</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Language</label>
                      <select
                        value={targetLang}
                        onChange={(e) => setTargetLang(e.target.value)}
                        className="px-3 py-2.5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-purple-500/50"
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>{l.name} {l.flag}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-purple-500/20 hover:scale-102 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {isTranslating ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Translating with Context...
                        </>
                      ) : (
                        <>
                          <Globe className="w-4 h-4" />
                          Translate Subtitles
                        </>
                      )}
                    </button>
                  </div>

                  {/* Export / Download Section */}
                  <div className="space-y-3 pt-3 border-t border-slate-200/50 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Export Subtitles</h3>
                      <button
                        onClick={handleCopyClipboard}
                        className="flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy All'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <select
                          value={exportFormat}
                          onChange={(e) => setExportFormat(e.target.value as any)}
                          className="w-full px-3 py-2.5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
                        >
                          <option value="srt">SRT (SubRip Standard)</option>
                          <option value="vtt">VTT (Web Video Tracks)</option>
                          <option value="ass">ASS (Advanced SubStation Alpha)</option>
                        </select>
                      </div>
                      <button
                        onClick={handleExportDownload}
                        className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </button>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>

        {/* Right Interactive Subtitle List Section */}
        <div className="flex-1 flex flex-col glass-panel rounded-3xl p-4 md:p-6 shadow-xl relative min-h-[500px]">
          
          {/* Header controls for workspace */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-200/50 dark:border-slate-800 pb-4 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-300">Subtitle Workspace</h2>
              <p className="text-[10px] text-slate-500 mt-0.5">Click timestamps to jump and seek. Double-click fields to edit.</p>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Auto Scroll Toggle */}
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-500 font-semibold select-none">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Auto-scroll Sync
              </label>

              {/* View mode toggle (only if translations exist) */}
              {Object.keys(translatedSegments).length > 0 && (
                <div className="flex p-0.5 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                  {(['source', 'translated', 'bilingual'] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setViewMode(m)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all cursor-pointer ${
                        viewMode === m
                          ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Subtitle segments scrollpane */}
          <div className="flex-1 overflow-y-auto max-h-[60vh] xl:max-h-[68vh] pr-1 space-y-3.5 custom-scrollbar">
            {segments.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-600">
                <Tv className="w-12 h-12 mb-4 opacity-50" />
                <span className="text-xs font-bold">No Subtitle Segments Generated</span>
                <span className="text-[10px] mt-1">Generate subtitles or load a YouTube video to view and edit blocks.</span>
              </div>
            ) : (
              segments.map((seg) => {
                const isCurrent = activeSegmentId === seg.id;
                const translatedText = translatedSegments[seg.id] || '';

                return (
                  <div
                    key={seg.id}
                    id={`seg-row-${seg.id}`}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      isCurrent
                        ? 'bg-gradient-to-br from-indigo-500/10 to-violet-500/10 border-indigo-500/30 shadow-md ring-1 ring-indigo-500/20'
                        : 'bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800/80 hover:bg-white/70 dark:hover:bg-slate-900/70 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row gap-3 items-start">
                      
                      {/* Segment Index & Play-Jump Trigger */}
                      <div className="flex items-center sm:flex-col gap-2 shrink-0">
                        <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-500 dark:text-slate-400 shrink-0">
                          {seg.id}
                        </span>
                        
                        {/* Interactive Timestamps */}
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleSeek(seg.start)}
                            className="px-2 py-0.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold tracking-wide transition-colors cursor-pointer"
                            title="Click to seek player here"
                          >
                            {formatSecs(seg.start)}
                          </button>
                          <span className="text-[10px] text-slate-400 font-bold">→</span>
                          <button
                            onClick={() => handleSeek(seg.end)}
                            className="px-2 py-0.5 rounded-lg bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/10 text-slate-600 dark:text-slate-400 text-[10px] font-bold tracking-wide transition-colors cursor-pointer"
                            title="Click to seek player to end"
                          >
                            {formatSecs(seg.end)}
                          </button>
                        </div>
                      </div>

                      {/* Side-by-Side or Full width editable block */}
                      <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        {/* Source Text Field */}
                        {(viewMode === 'source' || viewMode === 'bilingual') && (
                          <div className="flex flex-col gap-1 w-full">
                            {viewMode === 'bilingual' && (
                              <label className="text-[8px] font-black text-indigo-500/80 uppercase tracking-widest pl-1">Source ({sourceLang === 'auto' ? 'Original' : getLanguageName(sourceLang)})</label>
                            )}
                            <textarea
                              rows={2}
                              value={seg.text}
                              onChange={(e) => handleSegmentTextChange(seg.id, e.target.value, 'source')}
                              className="w-full px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-indigo-500/40 focus:ring-1 focus:ring-indigo-500/20 resize-none font-medium"
                            />
                          </div>
                        )}

                        {/* Translated Text Field */}
                        {(viewMode === 'translated' || viewMode === 'bilingual') && (
                          <div className="flex flex-col gap-1 w-full">
                            {viewMode === 'bilingual' && (
                              <label className="text-[8px] font-black text-purple-500/80 uppercase tracking-widest pl-1">Translated ({getLanguageName(targetLang)})</label>
                            )}
                            <textarea
                              rows={2}
                              value={translatedText}
                              onChange={(e) => handleSegmentTextChange(seg.id, e.target.value, 'translated')}
                              placeholder="Translation box..."
                              className="w-full px-3 py-2 rounded-xl bg-white/70 dark:bg-slate-900/70 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 resize-none font-medium"
                            />
                          </div>
                        )}
                      </div>

                      {/* Delete Trigger */}
                      <button
                        onClick={() => handleDeleteSegment(seg.id)}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-red-50 dark:bg-slate-800/80 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 dark:hover:text-red-400 border border-transparent hover:border-red-200/30 shrink-0 cursor-pointer self-center"
                        title="Delete segment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Action Footer for Workspace */}
          {segments.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-200/50 dark:border-slate-800 pt-4 mt-4">
              <button
                onClick={handleAddSegment}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-indigo-500" />
                Add Segment at Playhead
              </button>
              
              <span className="text-[10px] text-slate-400 font-bold">
                Total Segments: {segments.length}
              </span>
            </div>
          )}

          {/* Loading Error Banner */}
          {error && (
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-between shadow-lg backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-300">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-[10px] text-red-500 hover:underline cursor-pointer pl-4 uppercase">Dismiss</button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
