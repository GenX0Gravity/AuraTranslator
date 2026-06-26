'use client';

import { useState } from 'react';
import { Star, Send, Loader2, Check } from 'lucide-react';

interface TranslationFeedbackProps {
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  model?: string;
  domain?: string;
  onCorrectionApplied?: (corrected: string) => void;
}

export default function TranslationFeedback({
  sourceText,
  translatedText,
  sourceLang,
  targetLang,
  model,
  domain,
  onCorrectionApplied,
}: TranslationFeedbackProps) {
  const [rating, setRating] = useState(0);
  const [correction, setCorrection] = useState(translatedText);
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceText,
          predictedTranslation: translatedText,
          correctedTranslation: correction !== translatedText ? correction : undefined,
          rating: rating || undefined,
          sourceLang,
          targetLang,
          model,
          domain,
          saveToMemory: correction !== translatedText,
        }),
      });
      if (response.ok) {
        setSubmitted(true);
        if (correction !== translatedText && onCorrectionApplied) {
          onCorrectionApplied(correction);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!sourceText || !translatedText) return null;

  return (
    <div className="mt-3 border-t border-slate-200/30 dark:border-slate-800/30 pt-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
      >
        {isOpen ? 'Hide feedback' : 'Rate & improve translation'}
      </button>

      {isOpen && (
        <div className="mt-3 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className="p-0.5 transition-transform hover:scale-110"
                aria-label={`Rate ${star} stars`}
              >
                <Star
                  className={`w-5 h-5 ${
                    star <= rating
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300 dark:text-slate-600'
                  }`}
                />
              </button>
            ))}
          </div>

          <textarea
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="Edit translation to improve the model..."
            className="w-full min-h-[80px] text-sm rounded-xl bg-white/60 dark:bg-slate-800/40 border border-slate-200/50 dark:border-slate-700/50 p-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none"
          />

          <button
            onClick={handleSubmit}
            disabled={isSubmitting || submitted}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : submitted ? (
              <Check className="w-4 h-4" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            {submitted ? 'Feedback saved' : 'Submit feedback'}
          </button>
        </div>
      )}
    </div>
  );
}
