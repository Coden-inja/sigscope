import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get('f');

  if (!file || !file.endsWith('.wav')) {
    return new NextResponse('Invalid or missing file', { status: 400 });
  }

  const cleanFile = file.replace(/[^a-zA-Z0-9.\-_]/g, "");
  let filepath = path.join(process.cwd(), 'data', cleanFile);

  if (!fs.existsSync(filepath)) {
    filepath = path.join(process.cwd(), 'public', cleanFile);
  }

  if (!fs.existsSync(filepath)) {
    return new NextResponse('File not found', { status: 404 });
  }

  const stat = fs.statSync(filepath);
  const stream = fs.createReadStream(filepath);

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'audio/wav',
      'Content-Length': stat.size.toString(),
      'Accept-Ranges': 'bytes'
    }
  });
}