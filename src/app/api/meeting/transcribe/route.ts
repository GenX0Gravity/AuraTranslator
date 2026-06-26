import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';

const execPromise = promisify(exec);

export const maxDuration = 120; // 2 minutes max duration

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`meeting-transcribe:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
  }

  let inputPath = '';
  let outputPath = '';
  let uploadResult: any = null;
  const ai = new GoogleGenAI({ apiKey });

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const sourceLang = formData.get('sourceLang') as string || 'auto';
    const targetLang = formData.get('targetLang') as string || 'es';
    const historyJson = formData.get('history') as string || '[]';

    if (!file) {
      return NextResponse.json({ error: 'Audio file chunk is required' }, { status: 400 });
    }

    const tempDir = os.tmpdir();
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const originalExt = path.extname(file.name) || '.webm';
    inputPath = path.join(tempDir, `meet_input_${uniqueId}${originalExt}`);
    outputPath = path.join(tempDir, `meet_audio_${uniqueId}.mp3`);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    logger.info('Extracting and compressing audio chunk with ffmpeg', { inputPath, outputPath });
    try {
      await execPromise(`ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k "${outputPath}"`);
    } catch (ffmpegError) {
      logger.error('ffmpeg processing failed', { error: String(ffmpegError) });
      return NextResponse.json({ error: 'Failed to process audio chunk' }, { status: 422 });
    }

    logger.info('Uploading meeting audio chunk to Gemini Files API', { outputPath });
    try {
      uploadResult = await ai.files.upload({
        file: outputPath,
        config: {
          mimeType: 'audio/mp3',
        }
      });
    } catch (uploadError) {
      logger.error('Gemini upload failed', { error: String(uploadError) });
      return NextResponse.json({ error: 'Failed to upload audio chunk to server' }, { status: 502 });
    }

    logger.info('Transcribing meeting chunk with speaker diarization and translation');
    
    let prompt = `You are a meeting assistant. Transcribe the provided audio chunk.
    Distinguish between different speakers based on their voice characteristics and speech patterns.
    Label speakers as "Speaker A", "Speaker B", "Speaker C", etc.
    
    To maintain speaker label consistency across the meeting, here is the recent transcript history:
    ${historyJson}
    Analyze who was speaking in the history and try to map the voices in this new audio to those same speaker labels (e.g. if the voice matches the last speaker in the history, use the same speaker label).
    
    For each segment of speech, translate the text to the target language: "${targetLang}".
    
    Return the response in JSON format matching this schema:
    {
      "segments": [
        {
          "speaker": string,       // The speaker label (e.g. "Speaker A")
          "start": number,         // Start time in seconds relative to this chunk (e.g. 1.5)
          "end": number,           // End time in seconds relative to this chunk (e.g. 5.2)
          "text": string,          // Original transcription text
          "translation": string    // Translation to "${targetLang}"
        }
      ]
    }`;

    if (sourceLang && sourceLang !== 'auto') {
      prompt += `\nThe audio is spoken in: "${sourceLang}". Please transcribe it in this language.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          fileData: {
            fileUri: uploadResult.uri,
            mimeType: uploadResult.mimeType || 'audio/mp3'
          }
        },
        { text: prompt }
      ],
      config: {
        responseMimeType: 'application/json',
      }
    });

    const outputText = response.text || '';
    if (!outputText) {
      throw new Error('Gemini returned an empty meeting transcription response');
    }

    const parsedData = JSON.parse(outputText);
    if (!parsedData.segments || !Array.isArray(parsedData.segments)) {
      throw new Error('Invalid JSON format: missing segments array');
    }

    // Clean up
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    await ai.files.delete({ name: uploadResult.name }).catch(() => {});

    return NextResponse.json({
      success: true,
      segments: parsedData.segments
    });

  } catch (error) {
    logger.error('Meeting transcription API error', { error: String(error) });
    
    // Clean up files in case of error
    if (inputPath) await fs.unlink(inputPath).catch(() => {});
    if (outputPath) await fs.unlink(outputPath).catch(() => {});
    if (uploadResult && uploadResult.name) {
      try {
        await ai.files.delete({ name: uploadResult.name });
      } catch (e) {}
    }

    return NextResponse.json({ error: 'Diarization failed: ' + String(error) }, { status: 500 });
  }
}
