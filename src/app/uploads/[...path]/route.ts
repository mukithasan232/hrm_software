import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const resolvedParams = await params;
  // Prevent directory traversal
  const safePathSegments = resolvedParams.path.map((segment: string) =>
    segment.replace(/(\.\.|\\/|\\)/g, '')
  );

  const relPath = safePathSegments.join('/');

  // Try multiple locations in order (Docker volume first, then local dev fallbacks)
  const candidatePaths = [
    path.join('/app/public/uploads', relPath),          // Docker persistent volume (primary)
    path.join('/app/public/storage', relPath),          // Docker storage volume (alt)
    path.join(process.cwd(), 'public', 'uploads', relPath), // Local dev
    path.join(process.cwd(), 'public', 'storage', relPath), // Local dev alt
  ];

  let resolvedFilePath: string | null = null;
  for (const candidate of candidatePaths) {
    if (fs.existsSync(candidate)) {
      resolvedFilePath = candidate;
      break;
    }
  }

  if (!resolvedFilePath) {
    console.error(`[Uploads Route] File not found in any location: ${relPath}`);
    console.error(`[Uploads Route] Tried: ${candidatePaths.join(', ')}`);
    return new NextResponse('File not found', { status: 404 });
  }

  try {
    const fileBuffer = fs.readFileSync(resolvedFilePath);
    // Convert Node.js Buffer → Uint8Array so NextResponse can serve binary correctly
    const uint8 = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);

    const ext = path.extname(resolvedFilePath).toLowerCase();
    const fileName = path.basename(resolvedFilePath);

    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
    };

    const contentType = mimeTypes[ext] || 'application/octet-stream';

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Content-Length': String(uint8.byteLength),
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    });
  } catch (error) {
    console.error('[Uploads Route] Error reading file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
