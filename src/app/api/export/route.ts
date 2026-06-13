import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { checkRateLimit, RATE_LIMITS, getClientIp } from '@/lib/rateLimit';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import PDFDocument from 'pdfkit';
import { Document, Packer, Paragraph, TextRun } from 'docx';

const exportSchema = z.object({
  itemIds: z.array(z.string().min(1)).min(1).max(50),
  format: z.enum(['csv', 'pdf', 'docx']),
});

export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rateCheck = checkRateLimit(`export:${ip}`, { maxRequests: 10, windowMs: 60_000 });
  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    const session = await getServerSession(authOptions);
    const userId = (session?.user as { id?: string })?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const parsed = exportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request: ' + parsed.error.issues.map((i) => i.message).join(', ') },
        { status: 400 }
      );
    }

    const { itemIds, format } = parsed.data;

    const db = getAdminDb();
    const historyRef = db.collection('history');

    // Fetch all requested items, verify they belong to the current user
    const docPromises = itemIds.map((id) => historyRef.doc(id).get());
    const docSnapshots = await Promise.all(docPromises);

    const items = docSnapshots
      .filter((snap) => snap.exists && snap.data()?.userId === userId)
      .map((snap) => ({ id: snap.id, ...snap.data()! })) as Array<{
      id: string;
      sourceText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
      timestamp: FirebaseFirestore.Timestamp;
    }>;

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid items found' }, { status: 404 });
    }

    if (format === 'csv') {
      const header = 'Source Text,Translated Text,Source Language,Target Language,Timestamp\n';
      const rows = items
        .map((i) => {
          const source = `"${i.sourceText.replace(/"/g, '""')}"`;
          const trans = `"${i.translatedText.replace(/"/g, '""')}"`;
          const ts = i.timestamp?.toDate ? i.timestamp.toDate().toISOString() : '';
          return `${source},${trans},${i.sourceLang},${i.targetLang},${ts}`;
        })
        .join('\n');

      return new NextResponse(header + rows, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="translations.csv"',
        },
      });
    }

    if (format === 'pdf') {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));

      doc.fontSize(22).font('Helvetica-Bold').text('AuraTranslator — Export', { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').fillColor('#666').text(`Generated: ${new Date().toUTCString()}`, { align: 'center' });
      doc.moveDown(1.5);

      items.forEach((item, index) => {
        doc
          .fontSize(13).font('Helvetica-Bold').fillColor('#1a1a1a')
          .text(`#${index + 1} — ${item.sourceLang.toUpperCase()} → ${item.targetLang.toUpperCase()}`);
        doc.fontSize(11).font('Helvetica').fillColor('#333');
        doc.text(`Source:   ${item.sourceText}`, { indent: 10 });
        doc.text(`Translated: ${item.translatedText}`, { indent: 10 });
        if (item.timestamp?.toDate) {
          doc.fontSize(9).fillColor('#888').text(item.timestamp.toDate().toLocaleString(), { indent: 10 });
        }
        doc.moveDown(1);
      });

      doc.end();

      const buffer = await new Promise<Buffer>((resolve) => {
        doc.on('end', () => resolve(Buffer.concat(chunks)));
      });

      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="translations.pdf"',
        },
      });
    }

    if (format === 'docx') {
      const children = [
        new Paragraph({
          children: [new TextRun({ text: 'AuraTranslator — Export', bold: true, size: 36 })],
          spacing: { after: 300 },
        }),
      ];

      items.forEach((item, index) => {
        children.push(
          new Paragraph({ children: [new TextRun({ text: `#${index + 1} — ${item.sourceLang.toUpperCase()} → ${item.targetLang.toUpperCase()}`, bold: true, size: 26 })] }),
          new Paragraph({ text: `Source: ${item.sourceText}` }),
          new Paragraph({ text: `Translated: ${item.translatedText}` }),
          new Paragraph({ text: '' })
        );
      });

      const document = new Document({ sections: [{ properties: {}, children }] });
      const buffer = await Packer.toBuffer(document);

      return new NextResponse(buffer as unknown as BodyInit, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': 'attachment; filename="translations.docx"',
        },
      });
    }

    return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
  } catch (error: unknown) {
    logger.error('Export error', { error: String(error) });
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
