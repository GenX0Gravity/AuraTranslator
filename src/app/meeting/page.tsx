'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Mic,
  MicOff,
  Play,
  Square,
  Loader2,
  Sparkles,
  Globe,
  Check,
  Copy,
  Activity,
  Clock,
  Laptop,
  ListTodo,
  BookOpen,
  HelpCircle,
  Video,
  ChevronDown
} from 'lucide-react';
import { LANGUAGES, getLanguageName } from '@/utils/languages';
import ThemeToggle from '@/components/ThemeToggle';

interface TranscriptSegment {
  speaker: string;
  start: number;
  end: number;
  text: string;
  translation: string;
}

interface ActionItem {
  task: string;
  assignee: string;
  priority: 'High' | 'Medium' | 'Low';
}

interface MultilingualNote {
  langCode: string;
  langName: string;
  notesMarkdown: string;
}

interface MeetingNotesData {
  title: string;
  overview: string;
  keyPoints: string[];
  actionItems: ActionItem[];
  multilingualNotes: MultilingualNote[];
}

export default function MeetingAssistantPage() {
  // Setup & Configuration States
  const [platform, setPlatform] = useState<'meet' | 'zoom' | 'teams'>('meet');
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLangs, setTargetLangs] = useState<string[]>(['es']);
  const [isLangOpen, setIsLangOpen] = useState(false);

  // Active Meeting States
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [meetingTimer, setMeetingTimer] = useState(0);
  
  // Real-time streams & recording refs
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  
  // Transcript & Summary States
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [notesData, setNotesData] = useState<MeetingNotesData | null>(null);
  
  // Translation display target selection
  const [activeTransLang, setActiveTransLang] = useState<string>('es');

  // Loading & Error States
  const [isProcessingChunk, setIsProcessingChunk] = useState(false);
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedNoteIdx, setCopiedNoteIdx] = useState<number | null>(null);

  // Tab selections in summary workspace
  const [activeTab, setActiveTab] = useState<'summary' | 'actions' | 'transcript' | 'notes'>('summary');
  const [selectedNotesLang, setSelectedNotesLang] = useState<string>('');

  // Audio Processing Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mixedStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<any>(null);
  
  // To accumulate timestamps correctly
  const timeOffsetRef = useRef<number>(0);
  const transcriptHistoryRef = useRef<TranscriptSegment[]>([]);

  // Load Audio Input Devices
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.enumerateDevices().then(devices => {
        const inputs = devices.filter(d => d.kind === 'audioinput');
        setAudioDevices(inputs);
        if (inputs.length > 0) {
          setSelectedDevice(inputs[0].deviceId);
        }
      });
    }
  }, []);

  // Update default active display translation when target languages list changes
  useEffect(() => {
    if (targetLangs.length > 0 && !targetLangs.includes(activeTransLang)) {
      setActiveTransLang(targetLangs[0]);
    }
  }, [targetLangs, activeTransLang]);

  // Keep track of transcripts in a ref for backend context history feeding
  useEffect(() => {
    transcriptHistoryRef.current = transcript;
  }, [transcript]);

  // Visualizer Animation Loop
  const drawWave = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const width = canvas.width;
    const height = canvas.height;

    const draw = () => {
      animationFrameRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray);

      ctx.clearRect(0, 0, width, height);

      // Gradient color configuration matching premium dark/light mode
      const isDark = document.documentElement.classList.contains('dark');
      const grad = ctx.createLinearGradient(0, 0, width, 0);
      grad.addColorStop(0, '#6366f1'); // Indigo
      grad.addColorStop(0.5, '#a855f7'); // Purple
      grad.addColorStop(1, '#ec4899'); // Pink

      ctx.lineWidth = 3;
      ctx.strokeStyle = grad;
      ctx.shadowBlur = 12;
      ctx.shadowColor = '#818cf8';

      ctx.beginPath();
      const sliceWidth = width / bufferLength;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      ctx.lineTo(width, height / 2);
      ctx.stroke();
    };

    draw();
  };

  // Start Meeting Recording and mixing
  const handleStartMeeting = async () => {
    setError(null);
    setTranscript([]);
    setNotesData(null);
    timeOffsetRef.current = 0;

    try {
      console.log('Prompting for mic and tab audio streams');
      
      // 1. Microphone Audio Capture
      const micConstraints = selectedDevice 
        ? { audio: { deviceId: { exact: selectedDevice } } } 
        : { audio: true };
      
      const micStream = await navigator.mediaDevices.getUserMedia(micConstraints);
      micStreamRef.current = micStream;

      // 2. Share Tab Audio Capture (Google Meet / Zoom tab)
      // Displays Chrome window selector. Instruct users to select meeting tab + share tab audio
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser', // Prioritize tab selection
          width: { ideal: 640 },
          height: { ideal: 360 }
        },
        audio: true
      });
      screenStreamRef.current = screenStream;

      const screenAudioTracks = screenStream.getAudioTracks();
      if (screenAudioTracks.length === 0) {
        // Stop streams and throw warning
        micStream.getTracks().forEach(t => t.stop());
        screenStream.getTracks().forEach(t => t.stop());
        throw new Error('Tab audio sharing was not enabled. You must check the "Share tab audio" box when sharing your tab.');
      }

      // 3. Web Audio Mixer
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioContextRef.current = audioCtx;

      const destination = audioCtx.createMediaStreamDestination();

      // Connect Mic Node
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSource.connect(destination);

      // Connect Screen/Tab Audio Node
      const screenAudioStream = new MediaStream(screenAudioTracks);
      const screenSource = audioCtx.createMediaStreamSource(screenAudioStream);
      screenSource.connect(destination);

      // 4. Connect Analyser Node for Visualizer
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const mixedSource = audioCtx.createMediaStreamSource(destination.stream);
      mixedSource.connect(analyser);

      mixedStreamRef.current = destination.stream;

      // Start canvas waves
      setTimeout(() => drawWave(), 100);

      // 5. MediaRecorder Setup
      // Record in 10-second chunks
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/wav'];
      let chosenMime = 'audio/webm';
      for (const m of mimeTypes) {
        if (MediaRecorder.isTypeSupported(m)) {
          chosenMime = m;
          break;
        }
      }

      const mediaRecorder = new MediaRecorder(destination.stream, { mimeType: chosenMime });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = async (e) => {
        if (e.data && e.data.size > 0) {
          sendAudioChunk(e.data);
        }
      };

      // Start recording and prompt data available every 10 seconds (10000ms)
      mediaRecorder.start(10000);
      
      setIsMeetingActive(true);
      setIsRecording(true);

      // Start timer tick
      setMeetingTimer(0);
      timerIntervalRef.current = setInterval(() => {
        setMeetingTimer(prev => prev + 1);
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Permissions denied or failed to capture mixed meeting audio.');
    }
  };

  // Stop Recording and Meeting streams
  const handleStopMeeting = () => {
    setIsRecording(false);
    
    // Stop timer
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop all media tracks
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }

    console.log('Stopped meeting audio capture');
  };

  // Upload an audio chunk and transcribe it
  const sendAudioChunk = async (audioBlob: Blob) => {
    setIsProcessingChunk(true);
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'chunk.webm');
    formData.append('sourceLang', sourceLang);
    formData.append('targetLang', activeTransLang);
    
    // Send previous 5 segments for speaker and narrative context continuity
    const recentHistory = transcriptHistoryRef.current.slice(-5).map(s => ({
      speaker: s.speaker,
      text: s.text
    }));
    formData.append('history', JSON.stringify(recentHistory));

    try {
      const res = await fetch('/api/meeting/transcribe', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Offset start/end times relative to our accumulated timeline
      const chunkOffset = timeOffsetRef.current;
      const newSegments = data.segments.map((seg: any) => ({
        speaker: seg.speaker || 'Unknown Speaker',
        start: chunkOffset + (seg.start || 0),
        end: chunkOffset + (seg.end || 0),
        text: seg.text || '',
        translation: seg.translation || ''
      }));

      setTranscript(prev => [...prev, ...newSegments]);
      timeOffsetRef.current += 10; // Chunk duration is 10 seconds

    } catch (err: any) {
      console.error('Audio chunk transcription error:', err);
    } finally {
      setIsProcessingChunk(false);
    }
  };

  // Compile full transcript and generate Notes / Action Items
  const handleGenerateSummary = async () => {
    if (transcript.length === 0) return;
    setIsGeneratingNotes(true);
    setError(null);

    try {
      const res = await fetch('/api/meeting/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: transcript,
          targetLangs: targetLangs
        })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Summary generation failed');

      setNotesData(json.data);
      setIsMeetingActive(false); // Move to Notes view mode
      setActiveTab('summary');
      if (json.data.multilingualNotes && json.data.multilingualNotes.length > 0) {
        setSelectedNotesLang(json.data.multilingualNotes[0].langCode);
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while compiling meeting notes.');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // Language multi-selection toggles
  const toggleTargetLang = (code: string) => {
    if (targetLangs.includes(code)) {
      if (targetLangs.length > 1) {
        setTargetLangs(prev => prev.filter(c => c !== code));
      }
    } else {
      setTargetLangs(prev => [...prev, code]);
    }
  };

  // Format seconds to HH:MM:SS
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Format short timestamp seconds to MM:SS
  const formatShortTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Copy Markdown notes to clipboard
  const handleCopyNotes = (notesText: string, idx: number) => {
    navigator.clipboard.writeText(notesText);
    setCopiedNoteIdx(idx);
    setTimeout(() => setCopiedNoteIdx(null), 2000);
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
              Multilingual Meeting Assistant
            </h1>
            <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">Live Captions, Speaker Diarization & Action Items</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
        </div>
      </header>

      {/* ── Setup configuration view ── */}
      {!isMeetingActive && !notesData && (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 max-w-5xl mx-auto w-full items-stretch justify-center py-6">
          
          {/* Settings Panel */}
          <div className="w-full lg:w-1/2 glass-panel rounded-3xl p-6 shadow-xl flex flex-col gap-6">
            <div>
              <h2 className="text-base font-bold text-slate-700 dark:text-slate-300">Meeting Setup</h2>
              <p className="text-xs text-slate-400 mt-0.5">Select your meeting client and configure translation target languages.</p>
            </div>

            {/* Platform Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Select Platform</label>
              <div className="grid grid-cols-3 gap-3">
                {([
                  { id: 'meet', label: 'Google Meet', color: 'from-blue-500/20 to-emerald-500/20 border-blue-500/30' },
                  { id: 'zoom', label: 'Zoom Video', color: 'from-sky-500/20 to-blue-500/20 border-sky-500/30' },
                  { id: 'teams', label: 'MS Teams', color: 'from-indigo-500/20 to-purple-500/20 border-indigo-500/30' }
                ] as const).map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPlatform(p.id)}
                    className={`p-3 rounded-2xl border text-center transition-all hover:scale-103 active:scale-97 cursor-pointer flex flex-col items-center justify-center gap-1.5 ${
                      platform === p.id
                        ? `bg-gradient-to-br ${p.color} text-slate-800 dark:text-white shadow-md ring-2 ring-indigo-500/20 font-semibold`
                        : 'bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800 text-slate-500 hover:bg-white/80 dark:hover:bg-slate-900/80'
                    }`}
                  >
                    <Video className="w-5 h-5 opacity-80" />
                    <span className="text-[10px]">{p.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Input Device Selection */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Your Microphone Input</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none focus:border-indigo-500/50"
              >
                {audioDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Device ${d.deviceId.substring(0, 5)}...`}</option>
                ))}
                {audioDevices.length === 0 && <option value="">Default Microphone</option>}
              </select>
            </div>

            {/* Spoken Language (ASR Source) */}
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Spoken Meeting Language</label>
              <select
                value={sourceLang}
                onChange={(e) => setSourceLang(e.target.value)}
                className="px-3 py-2.5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs focus:outline-none"
              >
                <option value="auto">Auto Detect Spoken Language</option>
                {LANGUAGES.slice(0, 30).map((l) => (
                  <option key={l.code} value={l.code}>{l.name} {l.flag}</option>
                ))}
              </select>
            </div>

            {/* Target Translation Languages (Multi-Select dropdown) */}
            <div className="flex flex-col gap-2 relative">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target Translation Languages</label>
              <button
                onClick={() => setIsLangOpen(!isLangOpen)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/50 dark:bg-slate-900/50 border border-slate-200/50 dark:border-slate-800 text-slate-700 dark:text-slate-300 text-xs text-left"
              >
                <span className="truncate">
                  {targetLangs.map(code => getLanguageName(code)).join(', ') || 'Select target languages...'}
                </span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {isLangOpen && (
                <div className="absolute z-50 left-0 right-0 top-[100%] mt-2 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-2.5 space-y-1">
                  {LANGUAGES.slice(0, 25).map((l) => {
                    const isSelected = targetLangs.includes(l.code);
                    return (
                      <button
                        key={l.code}
                        onClick={() => toggleTargetLang(l.code)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                      >
                        <span>{l.flag} {l.name} ({l.nativeName})</span>
                        {isSelected && <Check className="w-4 h-4 text-indigo-500" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Trigger Button */}
            <button
              onClick={handleStartMeeting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 text-white font-bold text-sm shadow-lg shadow-indigo-500/20 hover:scale-102 active:scale-98 transition-all cursor-pointer mt-2"
            >
              <Play className="w-4 h-4" />
              Start Meeting Assistant
            </button>
          </div>

          {/* Guide / Instruction Panel */}
          <div className="w-full lg:w-1/2 glass-panel rounded-3xl p-6 shadow-xl flex flex-col gap-5 justify-between">
            <div className="space-y-4">
              <h2 className="text-base font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-indigo-500" />
                Connection Guide
              </h2>
              
              <div className="space-y-3.5 text-xs text-slate-600 dark:text-slate-400">
                <p>To record participants' audio from your virtual meeting software, follow these steps:</p>
                
                <div className="flex gap-3 items-start p-3 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <Laptop className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">1. Select Meeting Tab:</span>
                    <p className="mt-0.5">When the browser asks to share your screen, choose the **Chrome Tab** where your Google Meet, Zoom Web, or Teams Web session is open.</p>
                  </div>
                </div>

                <div className="flex gap-3 items-start p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                  <Activity className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-700 dark:text-slate-300">2. Share Tab Audio:</span>
                    <p className="mt-0.5">Crucial: Make sure the **"Share tab audio"** checkbox in the bottom left of the selection window is checked before clicking share.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Platform specific tips */}
            <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-800 text-[11px] text-slate-500 space-y-1">
              <span className="font-bold uppercase tracking-wider text-[9px] text-slate-400">Platform Tip</span>
              {platform === 'meet' && <p>For Google Meet, opening Meet in a Chrome tab and sharing that tab audio guarantees crystal clear dual-track transcription.</p>}
              {platform === 'zoom' && <p>For Zoom, join the meeting via the Web Browser Client, then select and share the Zoom Web Client tab with audio enabled.</p>}
              {platform === 'teams' && <p>For Microsoft Teams, join through the Web version in Chrome/Edge, and share that specific Teams tab with audio enabled.</p>}
            </div>
          </div>

        </div>
      )}

      {/* ── Active recording meeting view ── */}
      {isMeetingActive && (
        <div className="flex-1 flex flex-col xl:flex-row gap-6 max-w-5xl mx-auto w-full items-stretch">
          
          {/* Left Visualizer & Control Column */}
          <div className="w-full xl:w-5/12 flex flex-col gap-6">
            
            {/* Visualizer & Recording status */}
            <div className="glass-panel rounded-3xl p-6 shadow-xl flex flex-col items-center justify-center text-center gap-5 min-h-[300px]">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 animate-pulse text-[10px] font-black uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-red-500"></span>
                Meeting Active
              </div>

              {/* Glowing Canvas Wave */}
              <div className="w-full relative rounded-2xl overflow-hidden bg-slate-900 border border-slate-950 flex items-center justify-center p-2 shadow-inner aspect-[2/1]">
                <canvas ref={canvasRef} width={400} height={180} className="w-full h-full" />
              </div>

              {/* Timer & Indicators */}
              <div className="flex items-center gap-6 justify-center">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs font-semibold mb-1">
                    <Clock className="w-4 h-4" />
                    Duration
                  </div>
                  <span className="text-xl font-black text-slate-700 dark:text-slate-300 font-mono">
                    {formatTime(meetingTimer)}
                  </span>
                </div>

                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-500 text-xs font-semibold mb-1">
                    <Activity className="w-4 h-4" />
                    Diarizer Chunk
                  </div>
                  <span className="text-xl font-black text-slate-700 dark:text-slate-300 font-mono">
                    10s
                  </span>
                </div>
              </div>

              {/* Stop & Generate Notes Buttons */}
              <div className="w-full flex gap-3 mt-2">
                <button
                  onClick={handleStopMeeting}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-md shadow-red-500/20 hover:scale-102 active:scale-98 transition-all cursor-pointer"
                >
                  <Square className="w-4 h-4" />
                  Stop Recording
                </button>
                <button
                  onClick={handleGenerateSummary}
                  disabled={transcript.length === 0 || isRecording}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 hover:scale-102 active:scale-98 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  Generate Notes
                </button>
              </div>
            </div>

            {/* Quick Stats Panel */}
            <div className="glass-panel rounded-3xl p-5 shadow-xl text-xs space-y-3.5">
              <span className="font-bold text-slate-400 uppercase tracking-widest text-[9px]">Meeting Context</span>
              <div className="flex justify-between border-b border-slate-200/50 dark:border-slate-800 pb-2.5">
                <span className="text-slate-500">Audio Client:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{platform === 'meet' ? 'Google Meet' : platform}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/50 dark:border-slate-800 pb-2.5">
                <span className="text-slate-500">Translation Targets:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                  {targetLangs.map(code => getLanguageName(code)).join(', ')}
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span className="text-slate-500">Status:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  {isRecording ? (
                    <>
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-ping"></span>
                      Listening & Recording...
                    </>
                  ) : (
                    'Stopped. Ready for notes generation.'
                  )}
                </span>
              </div>
            </div>

          </div>

          {/* Right Live Scrolling Transcript Column */}
          <div className="flex-1 glass-panel rounded-3xl p-6 shadow-xl flex flex-col relative min-h-[450px]">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200/50 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Live Transcript</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">Speaker labels and translations are updated every 10 seconds.</p>
              </div>

              {/* Select target translation for live preview */}
              {targetLangs.length > 1 && (
                <div className="flex items-center gap-1 text-[10px]">
                  <span className="font-bold text-slate-400 uppercase tracking-wider pl-1">Live Translation Language:</span>
                  <select
                    value={activeTransLang}
                    onChange={(e) => setActiveTransLang(e.target.value)}
                    className="px-2 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 focus:outline-none"
                  >
                    {targetLangs.map(c => (
                      <option key={c} value={c}>{getLanguageName(c)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Scrollable feed */}
            <div className="flex-1 overflow-y-auto max-h-[60vh] xl:max-h-[65vh] pr-1 space-y-4 custom-scrollbar">
              {transcript.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 dark:text-slate-600">
                  <Activity className="w-12 h-12 mb-4 opacity-40 animate-pulse text-indigo-500" />
                  <span className="text-xs font-bold">Waiting for speech...</span>
                  <span className="text-[10px] mt-1 max-w-xs">Once you select a tab and speak, transcribed chunks will display here automatically.</span>
                </div>
              ) : (
                transcript.map((seg, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800/80 animate-in fade-in slide-in-from-bottom-2 duration-300"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-black text-[9px] uppercase tracking-wider shrink-0">
                          {seg.speaker}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold font-mono">
                          {formatShortTime(seg.start)}
                        </span>
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <p className="text-slate-700 dark:text-slate-300 font-medium">{seg.text}</p>
                      {seg.translation && (
                        <p className="text-slate-500 dark:text-slate-400 border-l-2 border-indigo-500/30 pl-2.5 italic">
                          {seg.translation}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Processing Spinner Chunk Indicator */}
              {isProcessingChunk && (
                <div className="flex items-center gap-2 p-3 text-[10px] text-slate-400 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                  <span>Processing last 10s audio block...</span>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* ── Summary & Notes Display Workspace ── */}
      {notesData && (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full glass-panel rounded-3xl p-6 shadow-xl relative min-h-[600px] animate-in fade-in duration-300">
          
          {/* Title & Info Header */}
          <div className="border-b border-slate-200/50 dark:border-slate-800 pb-4 mb-4 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                {notesData.title || 'Meeting Summary Notes'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Meeting analysis and action items completed by Gemini AI.</p>
            </div>
            
            <button
              onClick={() => { setNotesData(null); setTranscript([]); }}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700/50 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              New Meeting
            </button>
          </div>

          {/* Tab selector bar */}
          <div className="flex border-b border-slate-100 dark:border-slate-800 mb-6 overflow-x-auto shrink-0 scrollbar-none">
            {[
              { id: 'summary', label: 'Executive Summary', icon: BookOpen },
              { id: 'actions', label: 'Action Items', icon: ListTodo },
              { id: 'transcript', label: 'Searchable Transcript', icon: Activity },
              { id: 'notes', label: 'Multilingual Notes', icon: Globe }
            ].map((t) => {
              const Icon = t.icon;
              const isActive = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  className={`flex items-center gap-2 px-5 py-3 border-b-2 font-bold text-xs shrink-0 cursor-pointer transition-colors ${
                    isActive
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                      : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content Panels */}
          <div className="flex-1 overflow-y-auto max-h-[60vh] xl:max-h-[65vh] pr-1 custom-scrollbar">
            
            {/* 1. Summary Tab */}
            {activeTab === 'summary' && (
              <div className="space-y-6 text-slate-700 dark:text-slate-300 animate-in fade-in duration-300">
                <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10">
                  <h3 className="font-bold text-slate-800 dark:text-white mb-2 text-sm">Meeting Overview</h3>
                  <p className="text-xs leading-relaxed">{notesData.overview}</p>
                </div>

                <div className="space-y-3">
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Key Topics & Discussions</h3>
                  <ul className="list-disc list-inside space-y-2 text-xs pl-2">
                    {notesData.keyPoints?.map((pt, idx) => (
                      <li key={idx} className="leading-relaxed">{pt}</li>
                    ))}
                    {(!notesData.keyPoints || notesData.keyPoints.length === 0) && (
                      <li className="text-slate-400 italic">No key points extracted.</li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {/* 2. Action Items Tab */}
            {activeTab === 'actions' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3">Extracted Tasks & Ownership</h3>
                
                <div className="space-y-3">
                  {notesData.actionItems?.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/40 dark:bg-slate-900/40 border border-slate-200/50 dark:border-slate-800"
                    >
                      <div className="flex items-start gap-3.5">
                        <input
                          type="checkbox"
                          className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 w-4 h-4 mt-0.5 cursor-pointer"
                        />
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.task}</p>
                          <span className="inline-block mt-1 px-2.5 py-0.5 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-[9px] font-black uppercase">
                            Assignee: {item.assignee}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-1 rounded-xl text-[9px] font-black uppercase shrink-0 ${
                        item.priority === 'High' 
                          ? 'bg-red-500/10 text-red-500 border border-red-500/10' 
                          : item.priority === 'Medium' 
                            ? 'bg-amber-500/10 text-amber-500 border border-amber-500/10' 
                            : 'bg-green-500/10 text-green-500 border border-green-500/10'
                      }`}>
                        {item.priority} Priority
                      </span>
                    </div>
                  ))}

                  {(!notesData.actionItems || notesData.actionItems.length === 0) && (
                    <div className="text-center p-8 text-slate-400 italic">
                      No action items found in the meeting conversation.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 3. Searchable Transcript Tab */}
            {activeTab === 'transcript' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <h3 className="font-bold text-slate-800 dark:text-white text-sm mb-3">Diarized Transcript</h3>
                <div className="space-y-3.5">
                  {transcript.map((seg, idx) => (
                    <div
                      key={idx}
                      className="p-3 border-l-2 border-indigo-500/30 pl-3.5 bg-slate-50/50 dark:bg-slate-900/10 rounded-r-xl"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase text-indigo-500 tracking-wider">
                          {seg.speaker}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">
                          {formatShortTime(seg.start)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">{seg.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 4. Multilingual Notes Tab */}
            {activeTab === 'notes' && notesData.multilingualNotes && (
              <div className="space-y-5 animate-in fade-in duration-300">
                
                {/* Language tab selector */}
                <div className="flex gap-2">
                  {notesData.multilingualNotes.map((note) => (
                    <button
                      key={note.langCode}
                      onClick={() => setSelectedNotesLang(note.langCode)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                        selectedNotesLang === note.langCode
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                          : 'bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-white/80 dark:hover:bg-slate-900/80'
                      }`}
                    >
                      {note.langName}
                    </button>
                  ))}
                </div>

                {/* Markdown Display */}
                {notesData.multilingualNotes
                  .filter(note => note.langCode === selectedNotesLang)
                  .map((note, idx) => (
                    <div key={idx} className="space-y-4">
                      
                      {/* Copy header */}
                      <div className="flex justify-end pr-1">
                        <button
                          onClick={() => handleCopyNotes(note.notesMarkdown, idx)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors cursor-pointer border border-slate-200/50 dark:border-slate-800"
                        >
                          {copiedNoteIdx === idx ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                          {copiedNoteIdx === idx ? 'Copied' : 'Copy Markdown Notes'}
                        </button>
                      </div>

                      {/* Notes Body (in styled text area for copying, or parsed) */}
                      <div className="p-5 rounded-3xl bg-white/45 dark:bg-slate-900/45 border border-slate-200/50 dark:border-slate-800 font-mono text-xs leading-relaxed whitespace-pre-wrap select-text">
                        {note.notesMarkdown}
                      </div>

                    </div>
                  ))}

              </div>
            )}

          </div>

          {/* Loading Generator Spinner */}
          {isGeneratingNotes && (
            <div className="absolute inset-0 bg-white/70 dark:bg-slate-950/70 flex flex-col items-center justify-center text-center gap-3 backdrop-blur-md rounded-3xl">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">Compiling Meeting Notes...</span>
              <span className="text-xs text-slate-500 max-w-xs">Gemini is extracting action items, summarizing discussion points, and writing multilingual documents.</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="absolute bottom-6 left-6 right-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-between shadow-lg backdrop-blur-xl animate-in slide-in-from-bottom-2 duration-300">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="text-[10px] text-red-500 hover:underline cursor-pointer pl-4 uppercase">Dismiss</button>
            </div>
          )}

        </div>
      )}

      {/* Floating Processing Loader for Live chunk uploads */}
      {isProcessingChunk && isRecording && (
        <div className="fixed bottom-6 right-6 p-3.5 rounded-2xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800 shadow-xl backdrop-blur-xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-350 z-50 text-xs text-slate-600 dark:text-slate-400 font-semibold select-none">
          <Loader2 className="w-4.5 h-4.5 animate-spin text-indigo-500 shrink-0" />
          <span>Processing audio chunk...</span>
        </div>
      )}

    </div>
  );
}
