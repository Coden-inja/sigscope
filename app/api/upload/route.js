import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { processSignalToDashboardRun } from '../../../lib/dsp';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    const data = await req.formData();
    const file = data.get('file');

    if (!file) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    const filename = file.name ? file.name.replace(/[^a-zA-Z0-9.\-_]/g, "") : "uploaded_capture.wav";
    const cleanId = filename.replace(/\.[^/.]+$/, "");
    const buffer = Buffer.from(await file.arrayBuffer());

    // 1. If this matches an existing pre-computed benchmark case, read and return directly
    const precomputedPath = path.join(process.cwd(), 'public', 'runs', `${cleanId}.json`);
    if (fs.existsSync(precomputedPath)) {
      try {
        const fileContent = fs.readFileSync(precomputedPath, 'utf8');
        const precomputedRun = JSON.parse(fileContent);
        return NextResponse.json({
          success: true,
          case_id: cleanId,
          run: precomputedRun,
          isPrecomputed: true
        });
      } catch (e) {
        // Fall back to in-memory DSP if reading precomputed fails
      }
    }

    // 2. Perform high-speed in-memory DSP analysis (zero filesystem writes, zero Python)
    const run = processSignalToDashboardRun(buffer, filename);

    return NextResponse.json({
      success: true,
      case_id: cleanId,
      run
    });
  } catch (error) {
    console.error("Upload/Analysis error:", error);
    return NextResponse.json({ error: error.message || 'Signal analysis failed' }, { status: 500 });
  }
}
