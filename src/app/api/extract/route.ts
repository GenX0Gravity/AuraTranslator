import { NextResponse } from 'next/server';
import Tesseract from 'tesseract.js';
import { createRequire } from 'module';

// Polyfill browser canvas globals expected by pdf-parse (via pdfjs-dist) during Node.js bundle evaluation
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).DOMMatrix) {
    (globalThis as any).DOMMatrix = class DOMMatrix {};
  }
  if (!(globalThis as any).ImageData) {
    (globalThis as any).ImageData = class ImageData {};
  }
  if (!(globalThis as any).Path2D) {
    (globalThis as any).Path2D = class Path2D {};
  }
}

const require = createRequire(import.meta.url);
const pdf = require('pdf-parse');

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    let extractedText = '';

    if (fileType.startsWith('image/') || fileName.endsWith('.png') || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) {
      // Extract text from image via Tesseract OCR
      const result = await Tesseract.recognize(buffer, 'eng');
      extractedText = result.data.text;
    } else if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
      // Extract text from PDF via pdf-parse loaded through CommonJS require
      const data = await pdf(buffer);
      extractedText = data.text;
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Only PNG, JPG, JPEG, and PDF are supported.' },
        { status: 400 }
      );
    }

    const cleanText = extractedText.trim();
    if (!cleanText) {
      return NextResponse.json({
        error: 'No readable text could be extracted. Please make sure the image or PDF contains clear printed text.',
        text: ''
      }, { status: 200 });
    }

    // Cap at 10000 characters to prevent excessive translator load
    const cappedText = cleanText.substring(0, 10000);

    return NextResponse.json({
      text: cappedText,
      originalLength: cleanText.length,
      isCapped: cleanText.length > 10000
    });
  } catch (error: any) {
    console.error('File extraction error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to extract text from the file.' },
      { status: 500 }
    );
  }
}
