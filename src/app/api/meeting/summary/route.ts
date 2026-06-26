import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

export const maxDuration = 180; // 3 minutes max duration (large transcripts can take time to summarize)

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`meeting-summary:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
  }

  try {
    const { transcript, targetLangs } = await request.json();

    if (!transcript || !Array.isArray(transcript) || transcript.length === 0) {
      return NextResponse.json({ error: 'Meeting transcript is required' }, { status: 400 });
    }

    const langsList = targetLangs && Array.isArray(targetLangs) && targetLangs.length > 0
      ? targetLangs
      : ['en'];

    const ai = new GoogleGenAI({ apiKey });

    logger.info('Generating meeting summary and action items', {
      transcriptLength: transcript.length,
      languages: langsList
    });

    // Format the transcript as a text document for the model
    const transcriptText = transcript
      .map(s => `[${s.speaker} - ${s.start.toFixed(1)}s]: ${s.text}`)
      .join('\n');

    const prompt = `You are a meeting assistant. Analyze the following meeting transcript.
    
    1. Generate an executive title, overview, and key discussion highlights.
    2. Extract action items. For each action item, identify the task, assignee (must match one of the speaker labels or names mentioned in the transcript), and priority level (High, Medium, Low).
    3. Generate comprehensive, beautifully formatted Markdown meeting notes translated separately for each of these target languages: ${JSON.stringify(langsList)}.
       Each language notes block should be a standalone markdown document, containing a title, meeting overview, key discussions, decision points, and list of action items in that language.
    
    Meeting Transcript:
    ---
    ${transcriptText}
    ---
    
    Return the response in JSON format matching this schema:
    {
      "title": string,             // Meeting title
      "overview": string,          // Executive overview/summary
      "keyPoints": [string],       // Bullet points of key discussion topics/conclusions
      "actionItems": [             // List of extracted tasks
        {
          "task": string,
          "assignee": string,      // E.g. "Speaker A" or "John Doe"
          "priority": "High" | "Medium" | "Low"
        }
      ],
      "multilingualNotes": [       // Generated meeting notes in the target languages
        {
          "langCode": string,      // E.g. "es", "hi"
          "langName": string,      // E.g. "Spanish", "Hindi"
          "notesMarkdown": string  // Comprehensive Markdown formatted meeting notes in this language
        }
      ]
    }`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const outputText = response.text || '';
    if (!outputText) {
      throw new Error('Gemini returned an empty meeting summary response');
    }

    const parsedData = JSON.parse(outputText);
    
    logger.info('Meeting notes generation complete', {
      actionItemsCount: parsedData.actionItems?.length || 0,
      notesCount: parsedData.multilingualNotes?.length || 0
    });

    return NextResponse.json({
      success: true,
      data: parsedData
    });

  } catch (error) {
    logger.error('Meeting summary service error', { error: String(error) });
    return NextResponse.json({ error: 'Failed to generate meeting notes: ' + String(error) }, { status: 500 });
  }
}
