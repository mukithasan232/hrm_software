import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET(
  request: Request,
  context: any
) {
  try {
    const params = await context.params;
    const filename = params.filename;
    
    // Define the actual path where avatars are uploaded on the server
    const filePath = path.join(process.cwd(), 'public', 'uploads', 'avatars', filename);

    // If file doesn't exist on disk, serve a default image with a 200 status
    if (!fs.existsSync(filePath)) {
      const defaultPath = path.join(process.cwd(), 'public', 'default-logo-placeholder.png'); 
      if (fs.existsSync(defaultPath)) {
        const fallbackBuffer = fs.readFileSync(defaultPath);
        return new NextResponse(fallbackBuffer, {
          headers: {
            'Content-Type': 'image/png',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }
      // Absolute worst-case scenario
      return new NextResponse('Not found', { status: 404 });
    }

    // Read the file buffer
    const fileBuffer = fs.readFileSync(filePath);
    const extension = path.extname(filename).toLowerCase();
    
    let contentType = 'image/jpeg';
    if (extension === '.png') contentType = 'image/png';
    if (extension === '.webp') contentType = 'image/webp';
    if (extension === '.svg') contentType = 'image/svg+xml';

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
