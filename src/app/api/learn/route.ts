import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LearnResponse {
  word: string;
  sourceLang: string;
  targetLang: string;
  translatedWord: string;
  explanation: string;
  partOfSpeech: string;
  difficultyLevel: 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
  difficultyScore: number; // 1-10
  pronunciation: {
    ipa: string;
    phonetic: string;
    tips: string;
  };
  grammar: {
    correction: string | null;
    notes: string;
    structure: string;
  };
  synonyms: Array<{ word: string; meaning: string }>;
  antonyms: Array<{ word: string; meaning: string }>;
  exampleSentences: Array<{
    original: string;
    translated: string;
    context: string;
  }>;
  vocabulary: {
    root: string;
    relatedWords: Array<{ word: string; type: string }>;
    memoryTip: string;
  };
  culturalNote: string;
  translationExplanation: {
    whyChosen: string;
    alternatives: Array<{
      word: string;
      meaning: string;
      usageContext: string;
    }>;
  };
  quizzes: Array<{
    question: string;
    options: string[];
    correctOptionIndex: number;
    explanation: string;
  }>;
  isMock: boolean;
}

// ─── Mock fallback (no API key) ───────────────────────────────────────────────

function buildMockResponse(word: string, sourceLang: string, targetLang: string): LearnResponse {
  return {
    word,
    sourceLang,
    targetLang,
    translatedWord: `[${word}]`,
    explanation: `"${word}" is a word in ${sourceLang}. Configure GEMINI_API_KEY or GOOGLE_TRANSLATE_API_KEY to get AI-powered explanations.`,
    partOfSpeech: 'unknown',
    difficultyLevel: 'Intermediate',
    difficultyScore: 5,
    pronunciation: {
      ipa: `/${word}/`,
      phonetic: word,
      tips: 'Configure your API key to get pronunciation guidance.',
    },
    grammar: {
      correction: null,
      notes: 'No grammar analysis available in offline mode.',
      structure: word,
    },
    synonyms: [{ word: 'similar', meaning: 'A word with similar meaning' }],
    antonyms: [{ word: 'opposite', meaning: 'A word with opposite meaning' }],
    exampleSentences: [
      {
        original: `Example using "${word}".`,
        translated: `[Translated example]`,
        context: 'General usage',
      },
    ],
    vocabulary: {
      root: word,
      relatedWords: [{ word: `${word}s`, type: 'plural' }],
      memoryTip: 'Configure GEMINI_API_KEY to get AI-generated memory tips.',
    },
    culturalNote: 'Cultural notes require AI. Please configure your API key in .env.local.',
    translationExplanation: {
      whyChosen: `The translation "${word}" was chosen because it represents the most direct and common equivalent of the source word in ${targetLang} for general conversation.`,
      alternatives: [
        { word: `${word} (option 1)`, meaning: 'Similar meaning with slightly different nuance', usageContext: 'Formal contexts' },
        { word: `${word} (option 2)`, meaning: 'Colloquial variation', usageContext: 'Informal contexts' }
      ]
    },
    quizzes: [
      {
        question: `Which of the following is the correct definition of "${word}"?`,
        options: [`Matching translation in ${targetLang}`, 'An opposite concept', 'A grammatically incorrect variant', 'None of the above'],
        correctOptionIndex: 0,
        explanation: `In standard usage, "${word}" represents the correct translation provided.`
      },
      {
        question: `How is "${word}" grammatically classified here?`,
        options: ['Noun', 'Verb', 'Adjective', 'Pronoun'],
        correctOptionIndex: 0,
        explanation: `Based on the part of speech analysis, it is classified accordingly.`
      }
    ],
    isMock: true,
  };
}

// ─── Gemini AI generation ─────────────────────────────────────────────────────

async function generateWithGemini(
  word: string,
  sourceLang: string,
  targetLang: string,
  apiKey: string,
): Promise<LearnResponse> {
  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert multilingual language teacher and linguist. Analyze the following word/phrase and provide a comprehensive language learning breakdown.

Word/Phrase: "${word}"
Source Language: ${sourceLang}
Target Language (translate to): ${targetLang}

Respond with ONLY a valid JSON object (no markdown, no code fences) using this exact schema:
{
  "translatedWord": "translation of the word in ${targetLang}",
  "explanation": "2-3 sentence explanation of what this word means, its nuances, and when to use it",
  "partOfSpeech": "noun/verb/adjective/adverb/phrase/etc",
  "difficultyLevel": "Beginner|Intermediate|Advanced|Expert",
  "difficultyScore": 1-10,
  "pronunciation": {
    "ipa": "IPA phonetic notation e.g. /wɜːrd/",
    "phonetic": "simple phonetic spelling e.g. 'wurd'",
    "tips": "1-2 tips on how to pronounce this correctly"
  },
  "grammar": {
    "correction": null or "corrected version if input has grammar errors",
    "notes": "important grammar rules for this word (conjugation, declension, gender, etc.)",
    "structure": "grammatical structure breakdown e.g. 'Subject + Verb + Object'"
  },
  "synonyms": [
    {"word": "synonym1", "meaning": "brief difference in nuance"},
    {"word": "synonym2", "meaning": "brief difference in nuance"},
    {"word": "synonym3", "meaning": "brief difference in nuance"}
  ],
  "antonyms": [
    {"word": "antonym1", "meaning": "brief explanation"},
    {"word": "antonym2", "meaning": "brief explanation"}
  ],
  "exampleSentences": [
    {"original": "example sentence in ${sourceLang}", "translated": "translation in ${targetLang}", "context": "formal/informal/technical/casual"},
    {"original": "another example in ${sourceLang}", "translated": "translation in ${targetLang}", "context": "context type"},
    {"original": "third example in ${sourceLang}", "translated": "translation in ${targetLang}", "context": "context type"}
  ],
  "vocabulary": {
    "root": "word root/etymology",
    "relatedWords": [
      {"word": "related1", "type": "noun/verb/adj form"},
      {"word": "related2", "type": "noun/verb/adj form"},
      {"word": "related3", "type": "noun/verb/adj form"}
    ],
    "memoryTip": "a creative mnemonic or memory trick to remember this word"
  },
  "culturalNote": "interesting cultural context, idiom origins, or usage nuances that a language learner should know",
  "translationExplanation": {
    "whyChosen": "Detailed explanation of why this translation was chosen as the primary translation for the learner, explaining stylistic, semantic, or colloquial reasons.",
    "alternatives": [
      {
        "word": "Alternative translation 1",
        "meaning": "Meaning of this alternative translation",
        "usageContext": "When to use this alternative instead (e.g., formal/slang/particular region)"
      },
      {
        "word": "Alternative translation 2",
        "meaning": "Meaning of this alternative translation",
        "usageContext": "When to use this alternative instead"
      }
    ]
  },
  "quizzes": [
    {
      "question": "A multiple-choice question testing the user's understanding of this word, its meaning, grammar, or synonym in context.",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 0, // 0-indexed correct option
      "explanation": "Detailed explanation of why the correct option is right and others are wrong."
    },
    {
      "question": "Another multiple-choice question focusing on a different aspect (e.g. fill-in-the-blank example sentence or grammatical property).",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 1,
      "explanation": "Grammatical or vocabulary explanation."
    },
    {
      "question": "A third multiple-choice question testing spelling, pronunciation tips, or nuances.",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correctOptionIndex": 2,
      "explanation": "Explanation for the question."
    }
  ]
}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
    config: {
      responseMimeType: 'application/json',
    }
  });

  const raw = response.text ?? '';

  // Strip any accidental markdown code fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(cleaned);

  return {
    word,
    sourceLang,
    targetLang,
    translatedWord: parsed.translatedWord ?? '',
    explanation: parsed.explanation ?? '',
    partOfSpeech: parsed.partOfSpeech ?? '',
    difficultyLevel: parsed.difficultyLevel ?? 'Intermediate',
    difficultyScore: Math.min(10, Math.max(1, Number(parsed.difficultyScore) || 5)),
    pronunciation: {
      ipa: parsed.pronunciation?.ipa ?? '',
      phonetic: parsed.pronunciation?.phonetic ?? '',
      tips: parsed.pronunciation?.tips ?? '',
    },
    grammar: {
      correction: parsed.grammar?.correction ?? null,
      notes: parsed.grammar?.notes ?? '',
      structure: parsed.grammar?.structure ?? '',
    },
    synonyms: Array.isArray(parsed.synonyms) ? parsed.synonyms.slice(0, 5) : [],
    antonyms: Array.isArray(parsed.antonyms) ? parsed.antonyms.slice(0, 4) : [],
    exampleSentences: Array.isArray(parsed.exampleSentences) ? parsed.exampleSentences.slice(0, 4) : [],
    vocabulary: {
      root: parsed.vocabulary?.root ?? '',
      relatedWords: Array.isArray(parsed.vocabulary?.relatedWords) ? parsed.vocabulary.relatedWords.slice(0, 6) : [],
      memoryTip: parsed.vocabulary?.memoryTip ?? '',
    },
    culturalNote: parsed.culturalNote ?? '',
    translationExplanation: {
      whyChosen: parsed.translationExplanation?.whyChosen ?? '',
      alternatives: Array.isArray(parsed.translationExplanation?.alternatives) ? parsed.translationExplanation.alternatives : [],
    },
    quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes.slice(0, 3) : [],
    isMock: false,
  };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const { word, sourceLang, targetLang } = await request.json();

    if (!word || !sourceLang || !targetLang) {
      return NextResponse.json(
        { error: 'Missing required fields: word, sourceLang, or targetLang' },
        { status: 400 },
      );
    }

    const trimmed = word.trim();
    if (trimmed.length > 500) {
      return NextResponse.json(
        { error: 'Input text exceeds 500 character limit for language analysis.' },
        { status: 400 },
      );
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (geminiKey) {
      try {
        const result = await generateWithGemini(trimmed, sourceLang, targetLang, geminiKey);
        return NextResponse.json(result);
      } catch (geminiErr: any) {
        console.error('Gemini API error:', geminiErr?.message);
        // Fall through to mock on API error
      }
    }

    // Fallback: return mock response
    return NextResponse.json(buildMockResponse(trimmed, sourceLang, targetLang));
  } catch (error: any) {
    console.error('Learn API error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to generate language analysis.' },
      { status: 500 },
    );
  }
}
