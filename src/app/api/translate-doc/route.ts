import { createRequire } from 'module';

// Polyfill browser globals expected by pdf-parse (via pdfjs-dist) in Node.js
if (typeof globalThis !== 'undefined') {
  if (!(globalThis as any).DOMMatrix) (globalThis as any).DOMMatrix = class DOMMatrix {};
  if (!(globalThis as any).ImageData) (globalThis as any).ImageData = class ImageData {};
  if (!(globalThis as any).Path2D) (globalThis as any).Path2D = class Path2D {};
}

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Split text into chunks of at most `size` characters, breaking on word boundaries. */
function chunkText(text: string, size = 1500): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + size;
    if (end < text.length) {
      // Try to break at the last whitespace within the window
      const breakAt = text.lastIndexOf(' ', end);
      if (breakAt > start) end = breakAt;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
  }
  return chunks.filter(Boolean);
}

/** Call our own /api/translate endpoint to reuse caching + API key logic. */
async function translateChunk(
  text: string,
  sourceLang: string,
  targetLang: string,
  baseUrl: string,
): Promise<string> {
  if (!text.trim()) return text;
  const res = await fetch(`${baseUrl}/api/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, sourceLang, targetLang }),
  });
  if (!res.ok) return text; // fallback: return original on error
  const json = await res.json();
  return json.translatedText ?? text;
}

/** Translate all paragraphs in batches, yielding progress events. */
async function* translateParagraphs(
  paragraphs: string[],
  sourceLang: string,
  targetLang: string,
  baseUrl: string,
): AsyncGenerator<{ type: 'progress'; percent: number; status: string } | { type: 'chunk'; index: number; translated: string }> {
  const BATCH_SIZE = 5;
  const total = paragraphs.length;

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = paragraphs.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map((p) => translateChunk(p, sourceLang, targetLang, baseUrl)),
    );

    for (let j = 0; j < results.length; j++) {
      yield { type: 'chunk', index: i + j, translated: results[j] };
    }

    const percent = Math.min(Math.round(((i + batch.length) / total) * 85) + 10, 95);
    yield { type: 'progress', percent, status: `Translating paragraph ${Math.min(i + batch.length, total)} of ${total}...` };
  }
}

// ---------------------------------------------------------------------------
// Format Handlers
// ---------------------------------------------------------------------------

async function handleTxt(
  buffer: Buffer,
  sourceLang: string,
  targetLang: string,
  baseUrl: string,
  send: (data: object) => void,
): Promise<Buffer> {
  const text = buffer.toString('utf-8');
  const lines = text.split('\n');

  send({ percent: 10, status: 'Splitting text into paragraphs...' });

  const translated: string[] = new Array(lines.length).fill('');
  let done = 0;

  for await (const event of translateParagraphs(lines, sourceLang, targetLang, baseUrl)) {
    if (event.type === 'chunk') {
      translated[event.index] = event.translated;
      done++;
    } else {
      send({ percent: event.percent, status: event.status });
    }
  }

  return Buffer.from(translated.join('\n'), 'utf-8');
}

async function handleDocx(
  buffer: Buffer,
  sourceLang: string,
  targetLang: string,
  baseUrl: string,
  send: (data: object) => void,
): Promise<Buffer> {
  const AdmZip = require('adm-zip');
  const zip = new AdmZip(buffer);
  const docXmlEntry = zip.getEntry('word/document.xml');
  if (!docXmlEntry) throw new Error('Invalid DOCX: word/document.xml not found.');

  const xmlStr = docXmlEntry.getData().toString('utf-8');

  send({ percent: 10, status: 'Parsing DOCX structure...' });

  // Extract all paragraph texts using a regex approach (avoids XML parser deps)
  // Each <w:p> contains one or more <w:t> nodes
  const paragraphRegex = /<w:p[ >][\s\S]*?<\/w:p>/g;
  const textNodeRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;

  const paragraphMatches: string[] = [];
  const paragraphTexts: string[] = [];

  let match;
  while ((match = paragraphRegex.exec(xmlStr)) !== null) {
    const pXml = match[0];
    const texts: string[] = [];
    let tMatch;
    const tRegex = /<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g;
    while ((tMatch = tRegex.exec(pXml)) !== null) {
      texts.push(tMatch[1]);
    }
    paragraphMatches.push(pXml);
    paragraphTexts.push(texts.join(''));
  }

  send({ percent: 15, status: `Found ${paragraphTexts.length} paragraphs. Starting translation...` });

  const translatedTexts: string[] = new Array(paragraphTexts.length).fill('');

  for await (const event of translateParagraphs(paragraphTexts, sourceLang, targetLang, baseUrl)) {
    if (event.type === 'chunk') {
      translatedTexts[event.index] = event.translated;
    } else {
      send({ percent: event.percent, status: event.status });
    }
  }

  // Rebuild XML: replace each paragraph's text nodes with translated content
  // Strategy: preserve the first <w:t> node attributes & structure, clear siblings
  let updatedXml = xmlStr;
  for (let i = paragraphMatches.length - 1; i >= 0; i--) {
    const original = paragraphMatches[i];
    const translated = translatedTexts[i];

    if (!translated && !paragraphTexts[i]) {
      // Keep empty paragraphs as-is (they are structural spacers)
      continue;
    }

    // Find the first <w:t> in this paragraph and replace its contents,
    // then remove all subsequent <w:t> nodes from the paragraph.
    let tCount = 0;
    const rebuilt = original.replace(/<w:t(?:(\s[^>]*)?)>([^<]*)<\/w:t>/g, (_full, attrs, _oldText) => {
      tCount++;
      if (tCount === 1) {
        // Escape XML special chars
        const safe = (translated || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        // Preserve xml:space="preserve" if the original had content with whitespace
        const preserveAttr = safe.includes(' ') ? ' xml:space="preserve"' : '';
        return `<w:t${preserveAttr}>${safe}</w:t>`;
      }
      // Remove subsequent text runs (empty them)
      return '<w:t></w:t>';
    });

    updatedXml = updatedXml.replace(original, rebuilt);
  }

  send({ percent: 97, status: 'Repackaging DOCX file...' });

  zip.updateFile('word/document.xml', Buffer.from(updatedXml, 'utf-8'));
  return zip.toBuffer();
}

async function handlePdf(
  buffer: Buffer,
  sourceLang: string,
  targetLang: string,
  baseUrl: string,
  send: (data: object) => void,
): Promise<Buffer> {
  send({ percent: 10, status: 'Extracting text from PDF...' });

  const data = await pdfParse(buffer);
  const rawText: string = data.text || '';

  const paragraphs = rawText
    .split(/\n{2,}/)
    .map((p: string) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean);

  send({ percent: 20, status: `Found ${paragraphs.length} sections. Translating...` });

  const translatedParagraphs: string[] = new Array(paragraphs.length).fill('');

  for await (const event of translateParagraphs(paragraphs, sourceLang, targetLang, baseUrl)) {
    if (event.type === 'chunk') {
      translatedParagraphs[event.index] = event.translated;
    } else {
      send({ percent: event.percent, status: event.status });
    }
  }

  send({ percent: 96, status: 'Generating translated PDF...' });

  // Build PDF with pdfkit
  const PDFDocument = require('pdfkit');
  const resultBuffer = await new Promise<Buffer>((resolve, reject) => {
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

  return resultBuffer;
}

// ---------------------------------------------------------------------------
// Route Handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        const line = JSON.stringify(data) + '\n';
        controller.enqueue(encoder.encode(line));
      }

      try {
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const sourceLang = (formData.get('sourceLang') as string) || 'auto';
        const targetLang = (formData.get('targetLang') as string) || 'en';

        if (!file) {
          send({ error: 'No file uploaded.' });
          controller.close();
          return;
        }

        if (file.size > 10 * 1024 * 1024) {
          send({ error: 'File exceeds 10MB limit.' });
          controller.close();
          return;
        }

        const fileName = file.name.toLowerCase();
        const buffer = Buffer.from(await file.arrayBuffer());

        // Determine base URL from the request for internal fetch calls
        const reqUrl = new URL(request.url);
        const baseUrl = `${reqUrl.protocol}//${reqUrl.host}`;

        send({ percent: 5, status: 'Reading document...' });

        let resultBuffer: Buffer;
        let mimeType: string;
        let outputExt: string;

        if (fileName.endsWith('.txt')) {
          resultBuffer = await handleTxt(buffer, sourceLang, targetLang, baseUrl, send);
          mimeType = 'text/plain';
          outputExt = 'txt';
        } else if (fileName.endsWith('.docx')) {
          resultBuffer = await handleDocx(buffer, sourceLang, targetLang, baseUrl, send);
          mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          outputExt = 'docx';
        } else if (fileName.endsWith('.pdf')) {
          resultBuffer = await handlePdf(buffer, sourceLang, targetLang, baseUrl, send);
          mimeType = 'application/pdf';
          outputExt = 'pdf';
        } else {
          send({ error: 'Unsupported file type. Please upload a PDF, DOCX, or TXT file.' });
          controller.close();
          return;
        }

        send({ percent: 100, status: 'Done!', complete: true, fileBuffer: resultBuffer.toString('base64'), mimeType, outputExt });
        controller.close();
      } catch (err: any) {
        console.error('Document translation error:', err);
        send({ error: err?.message || 'Failed to translate document.' });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  });
}
