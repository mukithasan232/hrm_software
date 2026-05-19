import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

export interface MockRequest {
  body: any;
  query: Record<string, string>;
  params: Record<string, string>;
  headers: Record<string, string>;
  method: string;
  url: string;
  user?: {
    id: string;
    role: string;
  };
  file?: {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    path: string;
  };
}

export interface MockResponse {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  send(data: any): MockResponse;
}

export async function parseRequest(
  req: NextRequest,
  params: Record<string, string> = {}
): Promise<MockRequest> {
  const query: Record<string, string> = {};
  req.nextUrl.searchParams.forEach((val, key) => {
    query[key] = val;
  });

  const headers: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    headers[key] = val.toLowerCase();
  });

  let body: any = {};
  let fileObj: any = undefined;

  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    try {
      const formData = await req.formData();
      for (const [key, val] of Array.from(formData.entries())) {
        if (key === 'attachment' || key === 'avatar') {
          if (val && typeof val !== 'string') {
            const fileEntry = val as unknown as File;
            const uploadSubdir = key === 'avatar' ? 'avatars' : 'leaves';
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', uploadSubdir);
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }

            const ext = path.extname(fileEntry.name);
            const prefix = key === 'avatar' ? 'avatar' : 'leave';
            const filename = `${prefix}-${Date.now()}${ext}`;
            const filepath = path.join(uploadDir, filename);

            const bytes = await fileEntry.arrayBuffer();
            fs.writeFileSync(filepath, Buffer.from(bytes));

            fileObj = {
              filename,
              originalname: fileEntry.name,
              mimetype: fileEntry.type,
              size: fileEntry.size,
              path: filepath,
            };
          }
        } else {
          body[key] = val;
        }
      }
    } catch (e) {
      console.error('Error parsing multipart form:', e);
    }
  } else if (req.method !== 'GET' && req.method !== 'HEAD') {
    try {
      body = await req.json();
    } catch (_) {}
  }

  // Extract authorization token from headers
  let user: any = undefined;
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
      user = {
        id: decoded.id,
        role: decoded.role,
      };
    } catch (_) {}
  }

  return {
    body,
    query,
    params,
    headers,
    method: req.method,
    url: req.url,
    user,
    file: fileObj,
  };
}

export function createMockResponse(): { res: MockResponse; responsePromise: Promise<Response> } {
  let resolveResponse: (res: Response) => void;
  const responsePromise = new Promise<Response>((resolve) => {
    resolveResponse = resolve;
  });

  const res: MockResponse = {
    _statusCode: 200,
    _headers: {},
    _body: null,
    status(code: number) {
      this._statusCode = code;
      return this;
    },
    json(data: any) {
      this._body = data;
      this._headers['content-type'] = 'application/json';
      resolveResponse(
        NextResponse.json(data, {
          status: this._statusCode,
          headers: this._headers,
        })
      );
      return this;
    },
    send(data: any) {
      this._body = data;
      resolveResponse(
        new Response(data, {
          status: this._statusCode,
          headers: this._headers,
        })
      );
      return this;
    },
  };

  return { res, responsePromise };
}

export function wrapHandler(
  handler: (req: any, res: any) => any,
  options: {
    protect?: boolean;
    allowedRoles?: string[];
    adminOnly?: boolean;
  } = {}
) {
  return async (req: NextRequest, { params }: { params?: any } = {}) => {
    try {
      const resolvedParams = params ? await params : {};
      const mockReq = await parseRequest(req, resolvedParams);
      const { res, responsePromise } = createMockResponse();

      // Middleware simulation
      if (options.protect) {
        if (!mockReq.user) {
          return NextResponse.json({ message: 'Not authorized, token failed' }, { status: 401 });
        }

        if (options.adminOnly && mockReq.user.role !== 'Admin') {
          return NextResponse.json({ message: 'Not authorized as an admin' }, { status: 403 });
        }

        if (options.allowedRoles && !options.allowedRoles.includes(mockReq.user.role)) {
          return NextResponse.json(
            { message: `Role (${mockReq.user.role}) is not allowed to access this resource.` },
            { status: 403 }
          );
        }
      }

      // Execute controller handler
      await handler(mockReq as any, res as any);
      return await responsePromise;
    } catch (error: any) {
      console.error('Error in route handler:', error);
      return NextResponse.json({ message: 'Internal Server Error', error: error.message }, { status: 500 });
    }
  };
}
