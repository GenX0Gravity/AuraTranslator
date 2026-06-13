import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { texts, sourceLang, targetLang, workspaceId } = await request.json();

    if (!Array.isArray(texts) || !sourceLang || !targetLang) {
      return NextResponse.json(
        { error: 'Missing required fields: texts array, sourceLang, or targetLang' },
        { status: 400 }
      );
    }

    if (texts.length > 50) {
      return NextResponse.json({ error: 'Max 50 texts per batch' }, { status: 400 });
    }

    // Call the single translation endpoint for each text
    // Note: In a real app, you'd extract the core logic to a function to avoid HTTP overhead
    // or use a bulk API from Google/Libre if available. We'll do it sequentially/concurrently.
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.headers.get('origin') || 'http://localhost:3000';
    
    const results = await Promise.all(
      texts.map(async (text) => {
        try {
          const res = await fetch(`${baseUrl}/api/translate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              // Forward cookie for session context
              cookie: request.headers.get('cookie') || '',
            },
            body: JSON.stringify({ text, sourceLang, targetLang, workspaceId }),
          });
          
          if (!res.ok) {
            return { text, error: 'Translation failed' };
          }
          const data = await res.json();
          return { text, translatedText: data.translatedText, source: data.source };
        } catch (err: any) {
          return { text, error: err.message };
        }
      })
    );

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Batch translation error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process batch translation.' },
      { status: 500 }
    );
  }
}
