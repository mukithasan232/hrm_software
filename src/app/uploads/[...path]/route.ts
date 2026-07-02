import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  // Prevent directory traversal
  const safePathSegments = resolvedParams.path.map((segment: string) => segment.replace(/(\.\.|\\/|\\)/g, ''));
  const filePath = path.join(process.cwd(), 'public', 'uploads', ...safePathSegments);

  try {
    if (!fs.existsSync(filePath)) {
      console.error(`[Uploads Route] File not found: ${filePath}`);
      return new NextResponse('File not found', { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    // Convert Node.js Buffer → Uint8Array so NextResponse can serve binary correctly
    const uint8 = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);

    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath);
    
    let contentType = 'application/octet-stream';
    if (ext === '.png') contentType = 'image/png';
    else if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.svg') contentType = 'image/svg+xml';
    else if (ext === '.ico') contentType = 'image/x-icon';
    else if (ext === '.pdf') contentType = 'application/pdf';

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        // 'inline' tells the browser to display it in-tab (not download)
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': String(uint8.byteLength),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    });
  } catch (error) {
    console.error('[Uploads Route] Error serving file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}

