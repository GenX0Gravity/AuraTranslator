import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { words, sourceLang, targetLang } = await request.json().catch(() => ({}));

    if (!words || !Array.isArray(words) || words.length === 0) {
      return NextResponse.json({ error: 'Saved words list is required' }, { status: 400 });
    }

    const sLang = sourceLang || 'en';
    const tLang = targetLang || 'es';

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const wordsJson = JSON.stringify(words.map(w => ({ word: w.word, translation: w.translation })));

      const prompt = `You are an expert language teacher. Take the user's personal saved vocabulary words list:
      ${wordsJson}
      
      Generate a 5-question multiple-choice vocabulary quiz testing their memory and understanding of these specific words.
      The quiz questions must be written in the target language (${tLang}) to test the user's understanding of the source language (${sLang}) words, or test synonyms, definition matching, or fill-in-the-blank contexts using these words.
      Make sure the options are plausible but have exactly one clear correct answer.
      
      Respond with ONLY a valid JSON object matching this schema:
      {
        "quiz": [
          {
            "question": "The multiple choice question testing one of the saved words.",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctOptionIndex": 0, // 0-indexed correct option
            "explanation": "Detailed explanation of why the correct option is right and how it matches the saved word definition."
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

      const raw = response.text || '';
      const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const parsed = JSON.parse(cleaned);

      return NextResponse.json({ success: true, ...parsed });
    }

    // Mock response fallback
    const mockQuiz = words.slice(0, 5).map((w: any, index: number) => {
      const shuffledOptions = [
        w.translation,
        `Traducción alternativa de ${w.word} A`,
        `Traducción alternativa de ${w.word} B`,
        `Traducción alternativa de ${w.word} C`
      ];
      return {
        question: `Cuál es la traducción correcta de la palabra guardada "${w.word}"?`,
        options: shuffledOptions,
        correctOptionIndex: 0,
        explanation: `La palabra "${w.word}" se traduce correctamente como "${w.translation}".`
      };
    });

    return NextResponse.json({
      success: true,
      quiz: mockQuiz
    });

  } catch (error: any) {
    console.error('Quiz API error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate custom vocabulary quiz' }, { status: 500 });
  }
}
