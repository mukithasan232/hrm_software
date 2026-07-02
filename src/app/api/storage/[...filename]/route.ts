import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string[] }> }
) {
  try {
    const resolvedParams = await params;
    const filenameParts = resolvedParams.filename || [];
    const filename = filenameParts.join('/');

    // Prevent directory traversal attacks
    if (filename.includes('..') || filename.startsWith('/')) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    // The user mounted persistent storage at /app/public/storage
    const basePath = '/app/public/storage';
    let filePath = path.join(basePath, filename);

    // Fallback for local development if the Docker path doesn't exist
    if (!fs.existsSync(filePath)) {
      const localPath = path.join(process.cwd(), 'public', 'storage', filename);
      if (fs.existsSync(localPath)) {
        filePath = localPath;
      } else {
        return new NextResponse('File not found', { status: 404 });
      }
    }

    // Read file
    const fileBuffer = fs.readFileSync(filePath);

    // Determine Content-Type based on extension
    let contentType = 'application/octet-stream';
    const ext = path.extname(filename).toLowerCase();
    
    const mimeTypes: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
      '.pdf': 'application/pdf',
      '.txt': 'text/plain',
      '.csv': 'text/csv'
    };

    if (mimeTypes[ext]) {
      contentType = mimeTypes[ext];
    }

    const uint8 = new Uint8Array(fileBuffer.buffer, fileBuffer.byteOffset, fileBuffer.byteLength);
    const fileName = path.basename(filename);

    return new NextResponse(uint8, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName}"`,
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
      },
    });

  } catch (error) {
    console.error('Error reading storage file:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
