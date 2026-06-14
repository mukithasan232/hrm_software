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
    designation: string;
  };
  file?: {
    filename: string;
    originalname: string;
    mimetype: string;
    size: number;
    path: string;
  };
  isApiSecretBypass?: boolean;
}

export interface MockResponse {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  send(data: any): MockResponse;
}

export function getCorsHeaders(): Record<string, string> {
  return {
    'access-control-allow-origin': process.env.ALLOWED_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
  };
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(),
  });
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
    headers[key.toLowerCase()] = val;
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
            try {
              await fs.promises.mkdir(uploadDir, { recursive: true });
            } catch (err: any) {
              if (err.code !== 'EEXIST') {
                console.error('[Profile Update Error]: Directory creation failed', err);
                throw err;
              }
            }

            const ext = path.extname(fileEntry.name || '').toLowerCase() || '.png';
            const prefix = key === 'avatar' ? 'avatar' : 'leave';
            // Sanitize filename to prevent directory traversal
            const safeName = (fileEntry.name || 'file').replace(/[^a-zA-Z0-9.\-_]/g, '');
            const filename = `${prefix}-${Date.now()}-${safeName}`;
            const filepath = path.join(uploadDir, filename);

            try {
              const bytes = await fileEntry.arrayBuffer();
              await fs.promises.writeFile(filepath, Buffer.from(bytes));
            } catch (err) {
              console.error('[Profile Update Error]: File system error', err);
              throw err;
            }

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
  let isApiSecretBypass = false;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    // Allow cron/backend jobs to bypass standard JWT using the API_SECRET_TOKEN
    if (process.env.API_SECRET_TOKEN && token === process.env.API_SECRET_TOKEN) {
      isApiSecretBypass = true;
    } else {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret') as any;
        user = {
          id: decoded.id,
          designation: decoded.designation,
        };
      } catch (_) {}
    }
  }

  return {
    body,
    query,
    params,
    headers,
    method: req.method,
    url: req.url,
    user,
    isApiSecretBypass,
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
    _headers: getCorsHeaders(),
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
    allowedDesignations?: string[];
    adminOnly?: boolean;
    requiredPermissions?: { moduleName: string; action: 'canRead' | 'canCreate' | 'canEdit' | 'canDelete' }[];
  } = {}
) {
  return async (req: NextRequest, { params }: { params?: any } = {}) => {
    try {
      if (req.method === 'OPTIONS') {
        return corsPreflight();
      }

      const resolvedParams = params ? await params : {};
      const mockReq = await parseRequest(req, resolvedParams);
      const { res, responsePromise } = createMockResponse();

      // Middleware simulation
      if (options.protect) {
        if (!mockReq.user && !(mockReq as any).isApiSecretBypass) {
          return NextResponse.json(
            { message: 'Not authorized, token failed' },
            { status: 401, headers: getCorsHeaders() }
          );
        }

        const ADMIN_DESIGNATIONS = ['admin', 'super admin', 'system administrator', 'superadmin', 'ultra admin'];
        const userDesig = (mockReq.user?.designation || '').toLowerCase().trim();

        if (options.adminOnly && !(mockReq as any).isApiSecretBypass && !ADMIN_DESIGNATIONS.includes(userDesig)) {
          console.error(`[Auth Adapter] Admin access denied. Required admin, got: "${mockReq.user?.designation}"`);
          return NextResponse.json(
            { message: 'Not authorized as an admin' },
            { status: 403, headers: getCorsHeaders() }
          );
        }

        if (options.allowedDesignations && !(mockReq as any).isApiSecretBypass) {
          const allowedLower = options.allowedDesignations.map((d: string) => d.toLowerCase().trim());
          // Allow any ultra admin or any admin designation to bypass specific designation restrictions just in case
          if (!allowedLower.includes(userDesig) && !ADMIN_DESIGNATIONS.includes(userDesig)) {
            console.error(`[Auth Adapter] Access denied. Allowed: ${allowedLower.join(', ')}, got: "${mockReq.user?.designation}"`);
            return NextResponse.json(
              { message: `Designation (${mockReq.user?.designation}) is not allowed to access this resource.` },
              { status: 403, headers: getCorsHeaders() }
            );
          }
        }

        if (options.requiredPermissions && options.requiredPermissions.length > 0 && !(mockReq as any).isApiSecretBypass) {
          const { hasPermission } = await import('@/lib/permissions');
          for (const reqPerm of options.requiredPermissions) {
            const hasAccess = await hasPermission(mockReq.user?.id, reqPerm.moduleName, reqPerm.action);
            if (!hasAccess) {
              console.error(`[Auth Adapter] Access denied. Lacks ${reqPerm.action} on ${reqPerm.moduleName}.`);
              return NextResponse.json(
                { message: `Permission denied for module: ${reqPerm.moduleName} action: ${reqPerm.action}` },
                { status: 403, headers: getCorsHeaders() }
              );
            }
          }
        }
      }

      // Execute controller handler
      const result = await handler(mockReq as any, res as any);
      if (result instanceof Response) {
        return result;
      }
      return await responsePromise;
    } catch (error: any) {
      console.error('Error in route handler:', error);
      return NextResponse.json(
        { message: 'Internal Server Error', error: error.message },
        { status: 500, headers: getCorsHeaders() }
      );
    }
  };
}
