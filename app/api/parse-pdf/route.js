export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file) return Response.json({ error: 'file required' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());

    // Use lib path to avoid Next.js test-file loading issue with pdf-parse
    const pdfParse = require('pdf-parse/lib/pdf-parse');
    const data = await pdfParse(buffer);
    return Response.json({ text: data.text });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
