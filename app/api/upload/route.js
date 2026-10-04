import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req) {
  try {
    const data = await req.formData();
    const file = data.get('file');

    if (!file) {
      return NextResponse.json({ error: "No file received." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name.replace(/[^a-zA-Z0-9.\-_]/g, ""); // sanitize
    
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      await mkdir(dataDir, { recursive: true });
    }
    
    const filepath = path.join(dataDir, filename);
    await writeFile(filepath, buffer);

    // Run the python script
    return new Promise((resolve) => {
      exec(`python scripts/analyze.py --from-file data/${filename}`, (error, stdout, stderr) => {
        if (error) {
          console.error("Analysis error:", error);
          console.error("stderr:", stderr);
          return resolve(NextResponse.json({ error: error.message, stderr }, { status: 500 }));
        }
        
        const case_id = filename.split('.')[0];
        resolve(NextResponse.json({ success: true, case_id }));
      });
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
