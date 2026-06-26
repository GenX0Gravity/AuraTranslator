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

export const maxDuration = 300; // 5 minutes max duration (ASR processing can take time)

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`subtitles-transcribe:${ip}`, RATE_LIMITS.translate);
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

    if (!file) {
      return NextResponse.json({ error: 'Video or audio file is required' }, { status: 400 });
    }

    const tempDir = os.tmpdir();
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    // Extract file extension or default to video/audio
    const originalExt = path.extname(file.name) || '.mp4';
    inputPath = path.join(tempDir, `input_${uniqueId}${originalExt}`);
    outputPath = path.join(tempDir, `audio_${uniqueId}.mp3`);

    logger.info('Saving uploaded file to temp disk', { fileName: file.name, inputPath });
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(inputPath, buffer);

    logger.info('Running ffmpeg to extract audio track', { inputPath, outputPath });
    try {
      // Normalizes input audio/video to 16kHz mono MP3 at 64kbps
      await execPromise(`ffmpeg -y -i "${inputPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k "${outputPath}"`);
    } catch (ffmpegError) {
      logger.error('ffmpeg audio extraction failed', { error: String(ffmpegError) });
      return NextResponse.json({ error: 'Failed to process media file. Make sure the file format is valid.' }, { status: 422 });
    }

    logger.info('Uploading audio file to Gemini Files API', { outputPath });
    try {
      uploadResult = await ai.files.upload({
        file: outputPath,
        config: {
          mimeType: 'audio/mp3',
        }
      });
    } catch (uploadError) {
      logger.error('Gemini Files API upload failed', { error: String(uploadError) });
      return NextResponse.json({ error: 'Failed to upload audio to transcription service.' }, { status: 502 });
    }

    logger.info('Requesting transcript from Gemini model', { fileUri: uploadResult.uri });
    
    let prompt = `Transcribe the audio accurately. You must segment the transcription into detailed subtitle segments with precise timestamps (in seconds).
    Each segment should correspond to a short spoken phrase or natural sentence (typically 2 to 6 seconds each). Do not combine large paragraphs of text into a single segment.
    Ensure you capture every word and do not skip any speech.`;

    if (sourceLang && sourceLang !== 'auto') {
      prompt += `\nThe audio is spoken in the language: "${sourceLang}". Please transcribe it in this language.`;
    } else {
      prompt += `\nAutomatically detect the spoken language.`;
    }

    prompt += `\nReturn the response in JSON format matching this schema:
    {
      "segments": [
        {
          "start": number,  // Start time in seconds relative to the audio start (e.g. 1.25)
          "end": number,    // End time in seconds relative to the audio start (e.g. 4.5)
          "text": string    // Transcribed speech for this segment
        }
      ]
    }`;

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
      throw new Error('Gemini returned an empty transcript response');
    }

    const parsedData = JSON.parse(outputText);
    if (!parsedData.segments || !Array.isArray(parsedData.segments)) {
      throw new Error('Invalid JSON format returned from Gemini: missing segments array');
    }

    logger.info('ASR Transcription complete', { segmentsCount: parsedData.segments.length });

    // Clean up
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
    await ai.files.delete({ name: uploadResult.name }).catch((err) => {
      logger.warn('Failed to delete Gemini temporary file', { name: uploadResult.name, error: String(err) });
    });

    return NextResponse.json({
      success: true,
      segments: parsedData.segments
    });

  } catch (error) {
    logger.error('Audio transcription service error', { error: String(error) });
    
    // Clean up files in case of error
    if (inputPath) await fs.unlink(inputPath).catch(() => {});
    if (outputPath) await fs.unlink(outputPath).catch(() => {});
    if (uploadResult && uploadResult.name) {
      try {
        await ai.files.delete({ name: uploadResult.name });
      } catch (e) {}
    }

    return NextResponse.json({ error: 'Transcription failed: ' + String(error) }, { status: 500 });
  }
}
