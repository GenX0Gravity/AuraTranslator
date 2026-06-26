'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { 
  ArrowLeftRight, 
  Upload, 
  X, 
  Sparkles, 
  Volume2, 
  Loader2, 
  Play, 
  Pause, 
  Square,
  FileText, 
  Image as ImageIcon, 
  Tv, 
  VolumeX, 
  Download, 
  Globe, 
  Check, 
  AlertCircle,
  HelpCircle,
  PlayCircle,
  ArrowRight,
  Database
} from 'lucide-react';
import { LANGUAGES, getLanguageName } from '@/utils/languages';
import LanguageSelector from '@/components/LanguageSelector';
import ThemeToggle from '@/components/ThemeToggle';
import OfflineModeToggle from '@/components/OfflineModeToggle';

interface SubtitleSegment {
  start: number;
  end: number;
  sourceText: string;
  translatedText: string;
}

interface MultimodalResult {
  pipeline: 'text' | 'audio' | 'video' | 'image' | 'document';
  extractedText: string;
  translatedText: string;
  segments?: SubtitleSegment[];
  visualDescription?: string;
  fileBuffer?: string | null;
  mimeType?: string;
  outputExt?: string;
  model: string;
  success: boolean;
}

export default function MultimodalPage() {
  const [sourceLang, setSourceLang] = useState('auto');
  const [targetLang, setTargetLang] = useState('es');
  const [inputText, setInputText] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  
  const [isLoading, setIsLoading] = useState(false);
  const [progressStatus, setProgressStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Pipeline state
  const [detectedPipeline, setDetectedPipeline] = useState<'text' | 'audio' | 'video' | 'image' | 'document'>('text');
  const [result, setResult] = useState<MultimodalResult | null>(null);
  
  // Audio/Video player sync states
  const mediaRef = useRef<HTMLMediaElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const segmentRefs = useRef<(HTMLDivElement | null)[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect pipeline based on selected file
  useEffect(() => {
    if (!file) {
      setDetectedPipeline('text');
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
        setFileUrl(null);
      }
      return;
    }

    const name = file.name.toLowerCase();
    const type = file.type;
    const url = URL.createObjectURL(file);
    setFileUrl(url);

    if (
      type.startsWith('video/') || 
      name.endsWith('.mp4') || 
      name.endsWith('.webm') || 
      name.endsWith('.mkv') || 
      name.endsWith('.avi') || 
      name.endsWith('.mov')
    ) {
      setDetectedPipeline('video');
    } else if (
      type.startsWith('audio/') || 
      name.endsWith('.mp3') || 
      name.endsWith('.wav') || 
      name.endsWith('.m4a') || 
      name.endsWith('.aac') || 
      name.endsWith('.ogg') || 
      name.endsWith('.flac')
    ) {
      setDetectedPipeline('audio');
    } else if (
      type.startsWith('image/') || 
      name.endsWith('.png') || 
      name.endsWith('.jpg') || 
      name.endsWith('.jpeg') || 
      name.endsWith('.webp') || 
      name.endsWith('.bmp') || 
      name.endsWith('.gif')
    ) {
      setDetectedPipeline('image');
    } else if (
      type === 'application/pdf' || 
      name.endsWith('.pdf') || 
      name.endsWith('.docx') || 
      name.endsWith('.pptx') || 
      name.endsWith('.txt')
    ) {
      setDetectedPipeline('document');
    } else {
      setDetectedPipeline('text');
    }
    
    // Clear previous results on new file upload
    setResult(null);
  }, [file]);

  // Audio/Video synchronized captions highlighting
  useEffect(() => {
    if (result && result.segments && (result.pipeline === 'audio' || result.pipeline === 'video')) {
      const idx = result.segments.findIndex(
        (seg) => currentTime >= seg.start && currentTime <= seg.end
      );
      setActiveSegmentIndex(idx);
      
      if (idx !== -1 && segmentRefs.current[idx]) {
        segmentRefs.current[idx]?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest'
        });
      }
    }
  }, [currentTime, result]);

  // Cleanup Object URL on unmount
  useEffect(() => {
    return () => {
      if (fileUrl) {
        URL.revokeObjectURL(fileUrl);
      }
    };
  }, [fileUrl]);

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
      setFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const handleTimeUpdate = () => {
    if (mediaRef.current) {
      setCurrentTime(mediaRef.current.currentTime);
    }
  };

  const handleSeek = (time: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = time;
      mediaRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const togglePlayback = () => {
    if (mediaRef.current) {
      if (isPlaying) {
        mediaRef.current.pause();
      } else {
        mediaRef.current.play().catch(() => {});
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleSwapLanguages = () => {
    const temp = sourceLang;
    setSourceLang(targetLang);
    setTargetLang(temp === 'auto' ? 'en' : temp);
    setResult(null);
  };

  const handleTranslate = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    setCurrentTime(0);

    const pipelineName = file ? detectedPipeline : 'text';

    if (pipelineName === 'text') {
      setProgressStatus('Translating text inputs...');
    } else if (pipelineName === 'audio') {
      setProgressStatus('Extracting audio waves & transcribing...');
    } else if (pipelineName === 'video') {
      setProgressStatus('Processing video stream & generating subtitles...');
    } else if (pipelineName === 'image') {
      setProgressStatus('Applying Vision OCR & scanning image visual layout...');
    } else if (pipelineName === 'document') {
      setProgressStatus('Reading document layouts & translating structural text...');
    }

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      } else {
        formData.append('text', inputText);
      }
      formData.append('sourceLang', sourceLang);
      formData.append('targetLang', targetLang);
      formData.append('pipeline', 'auto');

      const res = await fetch('/api/multimodal', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Server error during multimodal translation.');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred during translation.');
    } finally {
      setIsLoading(false);
      setProgressStatus('');
    }
  };

  const handleDownloadDoc = () => {
    if (!result || !result.fileBuffer) return;
    const binaryStr = atob(result.fileBuffer);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: result.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = file ? file.name.replace(/\.[^.]+$/, '') : 'translated_doc';
    a.download = `${baseName}_translated_${targetLang}.${result.outputExt || 'txt'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Helper to choose file drag icons
  const getPipelineIcon = (pipeline: string) => {
    switch (pipeline) {
      case 'audio':
        return <Volume2 className="w-12 h-12 text-emerald-500 animate-pulse" />;
      case 'video':
        return <Tv className="w-12 h-12 text-pink-500 animate-bounce" />;
      case 'image':
        return <ImageIcon className="w-12 h-12 text-amber-500" />;
      case 'document':
        return <FileText className="w-12 h-12 text-blue-500" />;
      default:
        return <Upload className="w-12 h-12 text-indigo-505" />;
    }
  };

  return (
    <div className="flex-1 w-full flex flex-col justify-between px-4 sm:px-6 lg:px-8 py-8 md:py-12 max-w-7xl mx-auto">
      {/* Header */}
      <header className="flex items-center justify-between mb-8 md:mb-12">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-650 text-white shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 dark:from-purple-400 dark:via-indigo-400 dark:to-blue-400">
              Multimodal Studio
            </h1>
            <p className="text-xs text-slate-505 dark:text-slate-400">
              One Uploader — Auto-routing Text, Audio, Video, Images, and Documents
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

      <main className="flex-1 flex flex-col gap-8 justify-center">
        
        {/* Visual Stepper / Pipeline Routing Graph */}
        <div className="glass-panel p-5 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              Pipeline Auto-Routing Visualizer
            </h2>
            {file && (
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                detectedPipeline === 'audio' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                detectedPipeline === 'video' ? 'bg-pink-500/10 border-pink-500/20 text-pink-600 dark:text-pink-400' :
                detectedPipeline === 'image' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
                'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
              }`}>
                Detected: {detectedPipeline} Pipeline
              </span>
            )}
          </div>

          <div className="grid grid-cols-5 items-center text-center gap-2 pt-2 relative overflow-hidden">
            
            {/* Step 1: Input Source */}
            <div className="flex flex-col items-center gap-1.5 z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${
                file || inputText.trim() 
                  ? 'bg-indigo-600 border-indigo-650 text-white shadow-md shadow-indigo-500/20' 
                  : 'bg-slate-100 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}>
                {file ? '📄' : '✍️'}
              </div>
              <span className="text-[10px] font-bold text-slate-650 dark:text-slate-450">1. Content Loaded</span>
            </div>

            {/* Path 1 */}
            <div className="h-0.5 bg-slate-250 dark:bg-slate-800 relative w-full">
              {(file || inputText.trim()) && (
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 animate-pulse h-full w-full" />
              )}
            </div>

            {/* Step 2: Routing Engine */}
            <div className="flex flex-col items-center gap-1.5 z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${
                file || inputText.trim() 
                  ? 'bg-purple-650 border-purple-700 text-white shadow-md shadow-purple-500/20' 
                  : 'bg-slate-100 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}>
                🤖
              </div>
              <span className="text-[10px] font-bold text-slate-650 dark:text-slate-450">2. Classifier Router</span>
            </div>

            {/* Path 2 */}
            <div className="h-0.5 bg-slate-250 dark:bg-slate-800 relative w-full">
              {isLoading && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 h-full animate-ping" />
              )}
              {result && (
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-blue-500 h-full w-full" />
              )}
            </div>

            {/* Step 3: Synthesis Engine */}
            <div className="flex flex-col items-center gap-1.5 z-10">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center border font-bold text-xs transition-all ${
                result 
                  ? 'bg-blue-600 border-blue-650 text-white shadow-md shadow-blue-500/20' 
                  : isLoading 
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-600 animate-pulse'
                    : 'bg-slate-100 dark:bg-slate-850 border-slate-200 dark:border-slate-800 text-slate-400'
              }`}>
                ⚡
              </div>
              <span className="text-[10px] font-bold text-slate-650 dark:text-slate-450">
                {isLoading ? 'Processing Pipeline...' : result ? '3. Gemini Synthesis' : '3. Processing'}
              </span>
            </div>

          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Upload and Setup */}
          <div className="lg:col-span-5 space-y-6">
            
            <div className="glass-panel p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-6">
              
              {/* Language Selection */}
              <div className="flex items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-850 pb-4">
                <LanguageSelector
                  label="From"
                  selectedLanguage={sourceLang}
                  onSelectLanguage={setSourceLang}
                  excludeLanguage={targetLang}
                  isSource={true}
                />
                
                <button
                  onClick={handleSwapLanguages}
                  className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:scale-105 active:scale-95 transition-all mt-6"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </button>

                <LanguageSelector
                  label="To"
                  selectedLanguage={targetLang}
                  onSelectLanguage={setTargetLang}
                  excludeLanguage={sourceLang === 'auto' ? undefined : sourceLang}
                  isSource={false}
                />
              </div>

              {/* Upload Drop Zone */}
              <div className="space-y-4">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                  Source Content Upload
                </label>

                {!file ? (
                  <div
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all min-h-[180px] ${
                      dragActive
                        ? 'border-indigo-500 bg-indigo-500/5'
                        : 'border-slate-200 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-indigo-800 bg-slate-50/20 dark:bg-slate-900/10'
                    }`}
                  >
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Upload className="w-10 h-10 text-slate-400 mb-3" />
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                      Drag & drop any file here, or <span className="text-indigo-550 underline">browse</span>
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px]">
                      Audio, Video, Images, PDFs, DOCX, PPTX, or Text (up to 20MB)
                    </p>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 truncate">
                      <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 shrink-0">
                        {getPipelineIcon(detectedPipeline)}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-semibold text-slate-750 dark:text-slate-200 truncate">
                          {file.name}
                        </p>
                        <p className="text-[10px] text-slate-400">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB · {detectedPipeline.toUpperCase()}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveFile}
                      className="p-1.5 rounded-lg hover:bg-slate-250 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 transition-all cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Text Input area (enabled if no file uploaded) */}
              {!file && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 block">
                    Or Type Text Directly
                  </label>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter text to translate..."
                    className="w-full min-h-[100px] p-3 rounded-2xl bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200/60 dark:border-slate-800/60 focus:outline-none focus:border-indigo-500 text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 resize-none font-normal leading-relaxed"
                  />
                </div>
              )}

              {/* Action Button */}
              <button
                onClick={handleTranslate}
                disabled={isLoading || (!file && !inputText.trim())}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-650 text-white font-semibold text-sm shadow-md shadow-indigo-550/20 hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{progressStatus || 'Running pipeline...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Route & Translate</span>
                  </>
                )}
              </button>

            </div>

            {error && (
              <div className="p-4 rounded-2xl bg-red-500/10 dark:bg-red-500/5 border border-red-500/20 text-red-600 dark:text-red-400 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
          </div>

          {/* Right Column: Dynamic Results Viewport */}
          <div className="lg:col-span-7">
            
            {result ? (
              <div className="glass-panel p-6 rounded-3xl border border-slate-200/50 dark:border-slate-800/50 space-y-6 animate-in fade-in duration-500">
                
                {/* Header info */}
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-850 pb-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Pipeline Output: <span className="capitalize text-indigo-500">{result.pipeline}</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 mt-0.5">Processed using {result.model}</p>
                  </div>
                  
                  {result.pipeline === 'document' && result.fileBuffer && (
                    <button
                      onClick={handleDownloadDoc}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-650 dark:text-indigo-400 text-xs font-bold transition-all border border-indigo-500/20 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Translated Document
                    </button>
                  )}
                </div>

                {/* ----------------------------------------------------------- */}
                {/* PIPELINE RENDER: IMAGE */}
                {/* ----------------------------------------------------------- */}
                {result.pipeline === 'image' && (
                  <div className="space-y-6">
                    {/* Scene description */}
                    {result.visualDescription && (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-slate-700 dark:text-amber-400 leading-relaxed">
                        <span className="font-bold">👁️ AI Visual scene description:</span> {result.visualDescription}
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Extracted Text (OCR)</span>
                        <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/40 dark:border-slate-800/40 text-xs text-slate-700 dark:text-slate-300 min-h-[120px] whitespace-pre-wrap">
                          {result.extractedText || <span className="italic text-slate-400">No text detected in image.</span>}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Translated Text</span>
                        <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/40 dark:border-slate-800/40 text-xs text-slate-800 dark:text-slate-100 min-h-[120px] whitespace-pre-wrap font-medium">
                          {result.translatedText || <span className="italic text-slate-400">No translation.</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ----------------------------------------------------------- */}
                {/* PIPELINE RENDER: TEXT or DOCUMENT */}
                {/* ----------------------------------------------------------- */}
                {(result.pipeline === 'text' || result.pipeline === 'document') && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Source Text</span>
                      <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/40 dark:border-slate-800/40 text-xs text-slate-700 dark:text-slate-300 min-h-[220px] max-h-[350px] overflow-y-auto whitespace-pre-wrap">
                        {result.extractedText}
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">Translation</span>
                      <div className="p-4 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-slate-200/40 dark:border-slate-800/40 text-xs text-slate-805 dark:text-slate-100 min-h-[220px] max-h-[350px] overflow-y-auto whitespace-pre-wrap font-medium leading-relaxed">
                        {result.translatedText}
                      </div>
                    </div>
                  </div>
                )}

                {/* ----------------------------------------------------------- */}
                {/* PIPELINE RENDER: AUDIO or VIDEO */}
                {/* ----------------------------------------------------------- */}
                {(result.pipeline === 'audio' || result.pipeline === 'video') && (
                  <div className="space-y-6">
                    {/* Embedded Media Player */}
                    {fileUrl && (
                      <div className="relative border border-slate-200/50 dark:border-slate-800 rounded-2xl overflow-hidden bg-black/90 aspect-video md:max-h-[280px] mx-auto flex items-center justify-center">
                        {result.pipeline === 'video' ? (
                          <video
                            ref={(el) => { mediaRef.current = el; }}
                            src={fileUrl}
                            onTimeUpdate={handleTimeUpdate}
                            className="w-full h-full object-contain"
                            controls
                          />
                        ) : (
                          <div className="w-full p-6 flex flex-col items-center gap-4">
                            <audio
                              ref={(el) => { mediaRef.current = el; }}
                              src={fileUrl}
                              onTimeUpdate={handleTimeUpdate}
                              className="w-full"
                              controls
                            />
                            <div className="flex items-center gap-2">
                              <Volume2 className="w-8 h-8 text-indigo-500 animate-pulse" />
                              <span className="text-xs font-semibold text-slate-300">Synchronized Audio Workspace</span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Scrolling Interactive Caption Segments */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Synchronized Bilingual Transcript (Click to seek)
                      </span>
                      
                      <div className="border border-slate-200/60 dark:border-slate-800/60 rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-850">
                        {result.segments && result.segments.length > 0 ? (
                          result.segments.map((seg, idx) => {
                            const isActive = activeSegmentIndex === idx;
                            return (
                              <div
                                key={idx}
                                ref={(el) => { segmentRefs.current[idx] = el; }}
                                onClick={() => handleSeek(seg.start)}
                                className={`p-3.5 text-xs transition-all cursor-pointer hover:bg-slate-50/50 dark:hover:bg-slate-850 flex items-start gap-4 ${
                                  isActive 
                                    ? 'bg-indigo-500/5 border-l-4 border-indigo-550 dark:bg-indigo-950/20' 
                                    : ''
                                }`}
                              >
                                <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                  isActive ? 'bg-indigo-550 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                                }`}>
                                  {seg.start.toFixed(1)}s
                                </span>
                                
                                <div className="grid grid-cols-2 gap-4 flex-1">
                                  <p className="text-slate-500 dark:text-slate-400">{seg.sourceText}</p>
                                  <p className={`font-medium ${isActive ? 'text-indigo-650 dark:text-indigo-400 font-bold' : 'text-slate-800 dark:text-slate-105'}`}>
                                    {seg.translatedText}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <div className="p-6 text-center text-xs text-slate-405 italic">
                            No timed speech segments found.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ) : (
              // Empty State Placeholder
              <div className="p-12 text-center border-2 border-dashed border-slate-205 dark:border-slate-800 rounded-3xl text-slate-400 flex flex-col items-center justify-center min-h-[300px] gap-3">
                <HelpCircle className="w-12 h-12 text-slate-300 stroke-[1.5]" />
                <h3 className="text-sm font-semibold">Ready for Upload</h3>
                <p className="text-xs max-w-[320px] mx-auto text-slate-405">
                  Select a language pair, upload your file (text, audio, image, document, video), and click translate to trigger the routing engine.
                </p>
              </div>
            )}

          </div>

        </div>

      </main>

      <footer className="mt-12 text-center text-xs text-slate-400 dark:text-slate-500 border-t border-slate-200/30 dark:border-slate-850 pt-6">
        <p>© 2026 AuraTranslate. Multimodal Translation Pipeline Powered by Gemini 2.5 Flash.</p>
      </footer>
    </div>
  );
}
