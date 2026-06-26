import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(request: Request) {
  try {
    const { sourceLang, targetLang, difficulty } = await request.json().catch(() => ({}));

    const sLang = sourceLang || 'en';
    const tLang = targetLang || 'es';
    const diff = difficulty || 'Intermediate';

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are an expert language teacher. Generate a 'Word of the Day' to learn, translating from ${sLang} to ${tLang} at difficulty level ${diff}.
      Also generate a 3-question multiple-choice quiz related to vocabulary or grammar in ${sLang} for learners speaking ${tLang}.
      
      Respond with ONLY a valid JSON object matching this schema:
      {
        "wordOfTheDay": {
          "word": "a characteristic vocabulary word in ${sLang}",
          "translation": "translation of that word in ${tLang}",
          "ipa": "IPA phonetic notation",
          "partOfSpeech": "noun/verb/adjective/etc",
          "meaning": "clear definition of the word in ${tLang}",
          "exampleOriginal": "a natural example sentence in ${sLang}",
          "exampleTranslated": "translation of example in ${tLang}",
          "memoryTip": "a creative memory trick or mnemonic to remember this word"
        },
        "dailyQuiz": [
          {
            "question": "A multiple choice question in the target language (${tLang}) asking about vocabulary or grammar in ${sLang}.",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctOptionIndex": 0, // 0-indexed correct option
            "explanation": "Detailed explanation of why the correct option is right."
          },
          {
            "question": "Another multiple choice question in ${tLang} testing ${sLang} vocabulary.",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctOptionIndex": 1,
            "explanation": "Detailed explanation."
          },
          {
            "question": "A third multiple choice question in ${tLang} testing ${sLang} grammar/usage.",
            "options": ["Option A", "Option B", "Option C", "Option D"],
            "correctOptionIndex": 2,
            "explanation": "Detailed explanation."
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
    return NextResponse.json({
      success: true,
      wordOfTheDay: {
        word: 'serendipity',
        translation: 'serendipia',
        ipa: '/ˌser.ənˈdɪp.ə.tɪ/',
        partOfSpeech: 'noun',
        meaning: 'El hecho de encontrar cosas valiosas o agradables por casualidad.',
        exampleOriginal: 'We found the charming little restaurant by pure serendipity.',
        exampleTranslated: 'Encontramos el pequeño y encantador restaurante por pura serendipia.',
        memoryTip: 'Think of "Serena" finding something pleasant on her "trip" (serena-trip-ity).'
      },
      dailyQuiz: [
        {
          question: "Qué significa la palabra 'serendipity' en español?",
          options: ["Tristeza profunda", "Un hallazgo afortunado e inesperado", "Habilidad para tejer", "Miedo a las alturas"],
          correctOptionIndex: 1,
          explanation: "'Serendipity' se traduce como serendipia, un hallazgo afortunado y accidental."
        },
        {
          question: "Cuál es el sinónimo de 'serendipity'?",
          options: ["Misfortune", "Fluke / Happy accident", "Design", "Catastrophe"],
          correctOptionIndex: 1,
          explanation: "Un sinónimo común es 'fluke' o un accidente feliz."
        },
        {
          question: "Selecciona la frase que usa correctamente 'serendipity':",
          options: ["She fell down and broke her leg by serendipity.", "Winning the lottery was a moment of pure serendipity.", "He was angry and shouted with serendipity.", "The weather was stormy with serendipity."],
          correctOptionIndex: 1,
          explanation: "Ganar la lotería es un evento afortunado y sorprendente, por lo que representa serendipia."
        }
      ]
    });

  } catch (error: any) {
    console.error('Daily API error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to generate daily learning data' }, { status: 500 });
  }
}
