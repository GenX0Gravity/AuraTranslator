import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import Tesseract from 'tesseract.js';
import { createRequire } from 'module';

// Polyfill browser globals expected by pdf-parse (via pdfjs-dist) in Node.js
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).DOMMatrix) (globalThis as any).DOMMatrix = class DOMMatrix {};
  if (!(globalThis as any).ImageData) (globalThis as any).ImageData = class ImageData {};
  if (!(globalThis as any).Path2D) (globalThis as any).Path2D = class Path2D {};
}

const execPromise = promisify(exec);
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const PDFDocument = require('pdfkit');
const AdmZip = require('adm-zip');


export const maxDuration = 300; // 5 minutes max duration for large media files

// Helper to chunk text
function chunkText(text: string, size = 1500): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      const breakAt = text.lastIndexOf(' ', end);
      if (breakAt > start) end = breakAt;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

// Call Gemini to translate a text chunk
async function translateTextChunk(
  text: string,
  sourceLang: string,
  targetLang: string,
  ai: GoogleGenAI
): Promise<string> {
  if (!text.trim()) return text;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are an expert translator. Translate this text from "${sourceLang}" to "${targetLang}". Do not add notes or comments, return only the translation:\n\n${text}`,
    });
    return response.text?.trim() || text;
  } catch (err) {
    logger.error('Failed to translate chunk via Gemini, returning original', { error: String(err) });
    return text;
  }
}

// Translate document paragraphs batch by batch
async function translateParagraphsList(
  paragraphs: string[],
  sourceLang: string,
  targetLang: string,
  ai: GoogleGenAI
): Promise<string[]> {
  const BATCH_SIZE = 5;
  const results: string[] = [];
  for (let i = 0; i < paragraphs.length; i += BATCH_SIZE) {
    const batch = paragraphs.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map((p) => translateTextChunk(p, sourceLang, targetLang, ai))
    );
    results.push(...batchResults);
  }
  return results;
}

// Document rebuilding handlers (similar to translate-doc but adapted for direct use)
async function rebuildDocx(buffer: Buffer, sourceLang: string, targetLang: string, ai: GoogleGenAI): Promise<Buffer> {
  const zip = new AdmZip(buffer);
  const docXmlEntry = zip.getEntry('word/document.xml');
  if (!docXmlEntry) throw new Error('Invalid DOCX: word/document.xml not found.');

  const xmlStr = docXmlEntry.getData().toString('utf-8');
  const paragraphRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;

  const paragraphMatches: string[] = [];
  const paragraphTexts: string[] = [];

  let match;
  while ((match = paragraphRegex.exec(xmlStr)) !== null) {
    const pXml = match[0];
    const texts: string[] = [];
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    let tMatch;
    while ((tMatch = tRegex.exec(pXml)) !== null) {
      texts.push(tMatch[1]);
    }
    paragraphMatches.push(pXml);
    paragraphTexts.push(texts.join(''));
  }

  const translatedTexts = await translateParagraphsList(paragraphTexts, sourceLang, targetLang, ai);

  let updatedXml = xmlStr;
  for (let i = paragraphMatches.length - 1; i >= 0; i--) {
    const original = paragraphMatches[i];
    const translated = translatedTexts[i];

    if (!translated && !paragraphTexts[i]) continue;

    let tCount = 0;
    const rebuilt = original.replace(/<w:t(?:(\s[^>]*)?)>([^<]*)<\/w:t>/g, (_full, attrs, _oldText) => {
      tCount++;
      if (tCount === 1) {
        const safe = (translated || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        const preserveAttr = safe.includes(' ') ? ' xml:space="preserve"' : '';
        return `<w:t${preserveAttr}>${safe}</w:t>`;
      }
      return '<w:t></w:t>';
    });

    updatedXml = updatedXml.replace(original, rebuilt);
  }

  zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf-8'));
  return zip.toBuffer();
}

async function rebuildPptx(buffer: Buffer, sourceLang: string, targetLang: string, ai: GoogleGenAI): Promise<Buffer> {
  const zip = new AdmZip(buffer);
  const zipEntries = zip.getEntries();
  const slideEntries = zipEntries.filter((entry: any) =>
    entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')
  );

  const paragraphRegex = /<a:p[ >][\s\S]*?<\/a:p>/g;

  for (let sIdx = 0; sIdx < slideEntries.length; sIdx++) {
    const entry = slideEntries[sIdx];
    const xmlStr = entry.getData().toString('utf-8');

    const paragraphMatches: string[] = [];
    const paragraphTexts: string[] = [];

    let match;
    while ((match = paragraphRegex.exec(xmlStr)) !== null) {
      const pXml = match[0];
      const texts: string[] = [];
      const tRegex = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
      let tMatch;
      while ((tMatch = tRegex.exec(pXml)) !== null) {
        texts.push(tMatch[1]);
      }
      paragraphMatches.push(pXml);
      paragraphTexts.push(texts.join(''));
    }

    const translatedTexts = await translateParagraphsList(paragraphTexts, sourceLang, targetLang, ai);

    let updatedXml = xmlStr;
    for (let i = paragraphMatches.length - 1; i >= 0; i--) {
      const original = paragraphMatches[i];
      const translated = translatedTexts[i];

      if (!translated && !paragraphTexts[i]) continue;

      let tCount = 0;
      const rebuilt = original.replace(/<a:t(?:(\s[^>]?)?)>([^<]*)<\/a:t>/g, (_full, attrs, _oldText) => {
        tCount++;
        if (tCount === 1) {
          const safe = (translated || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
          const preserveAttr = safe.includes(' ') ? ' xml:space="preserve"' : '';
          return `<a:t${preserveAttr}>${safe}</a:t>`;
        }
        return '<a:t></a:t>';
      });

      updatedXml = updatedXml.replace(original, rebuilt);
    }

    zip.updateFile(entry.entryName, Buffer.from(updatedXml, 'utf-8'));
  }

  return zip.toBuffer();
}

async function rebuildPdf(paragraphs: string[], sourceLang: string, targetLang: string, ai: GoogleGenAI): Promise<Buffer> {
  const translatedParagraphs = await translateParagraphsList(paragraphs, sourceLang, targetLang, ai);
  
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];

    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(12).fillColor('#111111');

    translatedParagraphs.forEach((para, idx) => {
      if (para.trim()) {
        doc.text(para, { align: 'left', lineGap: 4 });
        if (idx < translatedParagraphs.length - 1) {
          doc.moveDown(0.8);
        }
      }
    });

    doc.end();
  });
}

export async function POST(request: Request): Promise<Response> {
  const ip = getClientIp(request);
  const rateCheck = checkRateLimit(`multimodal:${ip}`, RATE_LIMITS.translate);
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key is not configured.' }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });
  let tempInputPath = '';
  let tempOutputPath = '';
  let uploadResult: any = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string || '';
    const sourceLang = formData.get('sourceLang') as string || 'auto';
    const targetLang = formData.get('targetLang') as string || 'es';
    let requestedPipeline = formData.get('pipeline') as string || 'auto';

    if (!file && !text.trim()) {
      return NextResponse.json({ error: 'No file or text content provided for translation.' }, { status: 400 });
    }

    // Determine processing pipeline
    let detectedPipeline = 'text';
    let fileName = '';
    let fileType = '';
    let fileBuffer: Buffer = Buffer.alloc(0);

    if (file) {
      fileName = file.name.toLowerCase();
      fileType = file.type;
      fileBuffer = Buffer.from(await file.arrayBuffer());

      if (
        fileType.startsWith('video/') || 
        fileName.endsWith('.mp4') || 
        fileName.endsWith('.webm') || 
        fileName.endsWith('.mkv') || 
        fileName.endsWith('.avi') || 
        fileName.endsWith('.mov')
      ) {
        detectedPipeline = 'video';
      } else if (
        fileType.startsWith('audio/') || 
        fileName.endsWith('.mp3') || 
        fileName.endsWith('.wav') || 
        fileName.endsWith('.m4a') || 
        fileName.endsWith('.aac') || 
        fileName.endsWith('.ogg') || 
        fileName.endsWith('.flac')
      ) {
        detectedPipeline = 'audio';
      } else if (
        fileType.startsWith('image/') || 
        fileName.endsWith('.png') || 
        fileName.endsWith('.jpg') || 
        fileName.endsWith('.jpeg') || 
        fileName.endsWith('.webp') || 
        fileName.endsWith('.bmp') || 
        fileName.endsWith('.gif')
      ) {
        detectedPipeline = 'image';
      } else if (
        fileType === 'application/pdf' || 
        fileName.endsWith('.pdf') || 
        fileName.endsWith('.docx') || 
        fileName.endsWith('.pptx') || 
        fileName.endsWith('.txt')
      ) {
        detectedPipeline = 'document';
      } else {
        return NextResponse.json({ error: 'Unsupported file format. Please upload text, audio, video, image, or office documents.' }, { status: 400 });
      }
    }

    const activePipeline = requestedPipeline === 'auto' ? detectedPipeline : requestedPipeline;
    logger.info(`Multimodal Translation Pipeline Active: ${activePipeline}`, { fileName, fileType });

    // ---------------------------------------------------------------------------
    // PIPELINE: TEXT
    // ---------------------------------------------------------------------------
    if (activePipeline === 'text') {
      const inputText = text || fileBuffer.toString('utf-8');
      if (!inputText.trim()) {
        return NextResponse.json({ error: 'Empty text provided.' }, { status: 400 });
      }

      const prompt = `You are an expert translator. Translate the following text from "${sourceLang}" to "${targetLang}". Return the translation in a JSON object matching this schema:
      {
        "translatedText": "the translated text"
      }
      
      Text:\n${inputText}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return NextResponse.json({
        pipeline: 'text',
        translatedText: parsed.translatedText || '',
        extractedText: inputText,
        model: 'gemini-2.5-flash',
        success: true
      });
    }

    // ---------------------------------------------------------------------------
    // PIPELINE: AUDIO / VIDEO (Speech Models)
    // ---------------------------------------------------------------------------
    if (activePipeline === 'audio' || activePipeline === 'video') {
      const tempDir = os.tmpdir();
      const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const originalExt = path.extname(fileName) || (activePipeline === 'video' ? '.mp4' : '.mp3');
      
      tempInputPath = path.join(tempDir, `input_${uniqueId}${originalExt}`);
      tempOutputPath = path.join(tempDir, `audio_${uniqueId}.mp3`);

      // Write uploaded buffer to disk
      await fs.writeFile(tempInputPath, fileBuffer);

      // Run ffmpeg to extract/normalize mono 16kHz MP3 audio track
      logger.info('Compressing/extracting audio track via ffmpeg', { tempInputPath, tempOutputPath });
      try {
        await execPromise(`ffmpeg -y -i "${tempInputPath}" -vn -acodec libmp3lame -ar 16000 -ac 1 -b:a 64k "${tempOutputPath}"`);
      } catch (ffmpegErr) {
        logger.error('ffmpeg extraction failed', { error: String(ffmpegErr) });
        return NextResponse.json({ error: 'Failed to process media file. Ensure it is a valid audio or video file.' }, { status: 422 });
      }

      // Upload to Gemini Files API
      logger.info('Uploading media audio track to Gemini Files API');
      uploadResult = await ai.files.upload({
        file: tempOutputPath,
        config: { mimeType: 'audio/mp3' }
      });

      const prompt = `Analyze this audio track.
      1. Transcribe the spoken text in the original language.
      2. Translate the text into "${targetLang}".
      3. Segment the transcription and translation into detailed subtitle segments with precise start and end timestamps (in seconds).
      Return the response in JSON format matching this schema:
      {
        "transcription": "the full transcription in the source language",
        "translation": "the full translation in the target language",
        "segments": [
          {
            "start": number,        // segment start time in seconds (e.g. 1.25)
            "end": number,          // segment end time in seconds (e.g. 4.60)
            "sourceText": "string", // transcription text for this segment
            "translatedText": "string" // translation text for this segment
          }
        ]
      }`;

      logger.info('Sending media request to Gemini');
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
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');

      // Cleanup
      await fs.unlink(tempInputPath).catch(() => {});
      await fs.unlink(tempOutputPath).catch(() => {});
      await ai.files.delete({ name: uploadResult.name }).catch(() => {});

      return NextResponse.json({
        pipeline: activePipeline,
        extractedText: parsed.transcription || '',
        translatedText: parsed.translation || '',
        segments: parsed.segments || [],
        model: 'gemini-2.5-flash',
        success: true
      });
    }

    // ---------------------------------------------------------------------------
    // PIPELINE: IMAGE (Vision Transformers / OCR)
    // ---------------------------------------------------------------------------
    if (activePipeline === 'image') {
      logger.info('Processing image inline base64');
      const prompt = `Analyze this image.
      1. Perform OCR to extract all readable text in the image in its original language.
      2. Translate the extracted text to "${targetLang}".
      3. Provide a detailed, professional visual description of the scene, objects, people, colors, text placement, and setting.
      Return the response in JSON format matching this schema:
      {
        "extractedText": "all extracted text from the image",
        "translatedText": "translated text in ${targetLang}",
        "visualDescription": "contextual description of the image visual scene"
      }`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              data: fileBuffer.toString('base64'),
              mimeType: fileType || 'image/jpeg'
            }
          },
          { text: prompt }
        ],
        config: { responseMimeType: 'application/json' }
      });

      const parsed = JSON.parse(response.text?.trim() || '{}');
      return NextResponse.json({
        pipeline: 'image',
        extractedText: parsed.extractedText || '',
        translatedText: parsed.translatedText || '',
        visualDescription: parsed.visualDescription || '',
        model: 'gemini-2.5-flash',
        success: true
      });
    }

    // ---------------------------------------------------------------------------
    // PIPELINE: DOCUMENT
    // ---------------------------------------------------------------------------
    if (activePipeline === 'document') {
      let extractedText = '';
      let translatedText = '';
      let rebuiltBuffer: Buffer | null = null;
      let outputMime = 'text/plain';
      let outputExt = 'txt';

      if (fileName.endsWith('.pdf')) {
        // Direct PDF upload to Gemini Files API (better layout/spacing analysis)
        const tempDir = os.tmpdir();
        const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        tempInputPath = path.join(tempDir, `doc_${uniqueId}.pdf`);
        await fs.writeFile(tempInputPath, fileBuffer);

        logger.info('Uploading PDF to Gemini Files API');
        uploadResult = await ai.files.upload({
          file: tempInputPath,
          config: { mimeType: 'application/pdf' }
        });

        const prompt = `Analyze this PDF document.
        1. Extract all readable text from the document.
        2. Translate the extracted text into "${targetLang}".
        Return JSON matching this schema:
        {
          "extractedText": "all extracted text from the document",
          "translatedText": "translated text in ${targetLang}"
        }`;

        logger.info('Sending PDF request to Gemini');
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              fileData: {
                fileUri: uploadResult.uri,
                mimeType: 'application/pdf'
              }
            },
            { text: prompt }
          ],
          config: { responseMimeType: 'application/json' }
        });

        const parsed = JSON.parse(response.text?.trim() || '{}');
        extractedText = parsed.extractedText || '';
        translatedText = parsed.translatedText || '';

        // Cleanup
        await fs.unlink(tempInputPath).catch(() => {});
        await ai.files.delete({ name: uploadResult.name }).catch(() => {});

        // Rebuild simple PDF layout using PDFKit for download
        logger.info('Rebuilding translated PDF document');
        const pdfParagraphs = extractedText.split(/\n+/).filter(Boolean);
        rebuiltBuffer = await rebuildPdf(pdfParagraphs, sourceLang, targetLang, ai);
        outputMime = 'application/pdf';
        outputExt = 'pdf';

      } else if (fileName.endsWith('.docx')) {
        logger.info('Parsing DOCX and rebuilding');
        // Extract paragraph texts to return preview
        const zip = new AdmZip(fileBuffer);
        const docXmlEntry = zip.getEntry('word/document.xml');
        if (docXmlEntry) {
          const xmlStr = docXmlEntry.getData().toString('utf-8');
          const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
          let tMatch;
          const paragraphs: string[] = [];
          while ((tMatch = tRegex.exec(xmlStr)) !== null) {
            paragraphs.push(tMatch[1]);
          }
          extractedText = paragraphs.join(' ');
        }
        
        rebuiltBuffer = await rebuildDocx(fileBuffer, sourceLang, targetLang, ai);
        
        // Translate text for preview
        translatedText = await translateTextChunk(extractedText, sourceLang, targetLang, ai);
        outputMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        outputExt = 'docx';

      } else if (fileName.endsWith('.pptx')) {
        logger.info('Parsing PPTX and rebuilding');
        const zip = new AdmZip(fileBuffer);
        const zipEntries = zip.getEntries();
        const slideEntries = zipEntries.filter((entry: any) =>
          entry.entryName.startsWith('ppt/slides/slide') && entry.entryName.endsWith('.xml')
        );
        const allTexts: string[] = [];
        for (const entry of slideEntries) {
          const xmlStr = entry.getData().toString('utf-8');
          const tRegex = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
          let tMatch;
          while ((tMatch = tRegex.exec(xmlStr)) !== null) {
            allTexts.push(tMatch[1]);
          }
        }
        extractedText = allTexts.join(' ');
        
        rebuiltBuffer = await rebuildPptx(fileBuffer, sourceLang, targetLang, ai);
        translatedText = await translateTextChunk(extractedText, sourceLang, targetLang, ai);
        outputMime = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        outputExt = 'pptx';

      } else {
        // Plain text (.txt)
        logger.info('Translating TXT document');
        extractedText = fileBuffer.toString('utf-8');
        translatedText = await translateTextChunk(extractedText, sourceLang, targetLang, ai);
        rebuiltBuffer = Buffer.from(translatedText, 'utf-8');
        outputMime = 'text/plain';
        outputExt = 'txt';
      }

      return NextResponse.json({
        pipeline: 'document',
        extractedText,
        translatedText,
        fileBuffer: rebuiltBuffer ? rebuiltBuffer.toString('base64') : null,
        mimeType: outputMime,
        outputExt,
        model: 'gemini-2.5-flash',
        success: true
      });
    }

    return NextResponse.json({ error: 'Pipeline execution failed.' }, { status: 500 });

  } catch (error: any) {
    logger.error('Multimodal pipeline service error', { error: String(error) });
    
    // Cleanup files in case of error
    if (tempInputPath) await fs.unlink(tempInputPath).catch(() => {});
    if (tempOutputPath) await fs.unlink(tempOutputPath).catch(() => {});
    if (uploadResult && uploadResult.name) {
      try {
        await ai.files.delete({ name: uploadResult.name });
      } catch (e) {}
    }

    return NextResponse.json({ error: 'Multimodal translation failed: ' + (error?.message || String(error)) }, { status: 500 });
  }
}
