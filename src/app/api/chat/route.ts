export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// ── POST /api/chat ────────────────────────────────────────────────────────────
// Consumed by the useChat hook in AIChatWidget.tsx via the Vercel AI SDK.

export async function POST(req: NextRequest) {
  try {
    const { messages, userName } = await req.json();

    // ── FIX: Normalize messages from Frontend format to Vercel AI format ──────
    const normalizedMessages = messages.map((msg: any) => {
      // If the message has 'parts' instead of 'content' (Google's local format), convert it
      if (!msg.content && msg.parts && Array.isArray(msg.parts)) {
        return {
          id: msg.id || Math.random().toString(),
          role: msg.role,
          content: msg.parts.map((p: any) => p.text || '').join(''),
        };
      }
      return msg;
    });
    // ─────────────────────────────────────────────────────────────────────────

    // ── Step 1: Fetch AI settings from DB ────────────────────────────────────
    let dbApiKey: string | null = null;
    let dbProvider = 'google';

    try {
      const settings = await prisma.tenantSettings.findFirst({
        select: { aiProvider: true, aiApiKey: true },
      });
      dbApiKey = settings?.aiApiKey ?? null;
      dbProvider = settings?.aiProvider ?? 'google';
    } catch (dbErr) {
      console.warn('[Chat API] Could not read TenantSettings, falling back to env:', dbErr);
    }

    // ── Step 2: Resolve API key — DB first, then env fallback ────────────────
    const resolvedApiKey =
      dbProvider === 'openai'
        ? dbApiKey || process.env.OPENAI_API_KEY || null
        : dbApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;

    // ── Step 3: Guard — no key configured ───────────────────────────────────
    if (!resolvedApiKey) {
      const providerLabel = dbProvider === 'openai' ? 'OpenAI' : 'Google Gemini';
      const errorMsg = `⚠️ No AI API key is configured. Please ask your admin to go to **Settings → AI Assistant** and add a ${providerLabel} API key to enable the AI chat assistant.`;

      // Return in the Vercel AI data-stream format so the widget renders it cleanly
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode(`0:${JSON.stringify(errorMsg)}\n`)
          );
          controller.close();
        },
      });

      return new NextResponse(stream, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'x-vercel-ai-data-stream': 'v1',
        },
      });
    }

    // ── Step 4: Initialize LLM provider ──────────────────────────────────────
    let model;
    try {
      if (dbProvider === 'openai') {
        const openai = createOpenAI({ apiKey: resolvedApiKey });
        model = openai('gpt-4o-mini');
      } else {
        const google = createGoogleGenerativeAI({ apiKey: resolvedApiKey });
        // 👇 ঠিক এই লাইনটা পরিবর্তন করে gemini-flash-latest করে দিন 👇
        model = google('gemini-flash-latest');
      }
    } catch (providerError: any) {
      console.error('[Chat API] Failed to initialize provider:', providerError);
      return NextResponse.json(
        { error: 'Failed to initialize AI provider.', details: providerError.message },
        { status: 500 }
      );
    }

    // ── Step 5: Define HR tools (matches server.ts MCP tool definitions) ─────
    const result = streamText({
      model,
      system: `You are an intelligent HR Management Assistant for a company's HRM portal.
You are currently assisting: ${userName || 'an employee'}. Address them professionally by name when relevant.
You have direct access to real-time HR data through tools.

Guidelines:
- Always use tools when asked about employees, attendance, leaves, or statistics.
- Present data in a clear, concise, human-friendly format.
- Use bullet points or short paragraphs — avoid overly long responses.
- Be professional yet friendly.
- Never fabricate data — always fetch it from tools.
- Today's date is: ${new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}.`,
      messages: normalizedMessages, // ✅ Fixed: Using the sanitized messages array
      // @ts-ignore
      maxSteps: 5,
      onError: (error) => {
        console.error('\n🔴 [Vercel AI SDK Real Error]:', error);
      },
      tools: {
        // ── Tool: get_dashboard_stats ──────────────────────────────────────
        get_dashboard_stats: tool({
          description:
            'Fetches high-level dashboard metrics for the current day: total active employees, total present today, total absent today, and total on approved leave today.',
          parameters: z.object({}),
          execute: async (_args: any) => {
            try {
              const start = new Date();
              if (isNaN(start.getTime())) throw new Error("Invalid start date");
              start.setHours(0, 0, 0, 0);

              const end = new Date();
              if (isNaN(end.getTime())) throw new Error("Invalid end date");
              end.setHours(23, 59, 59, 999);

              const [totalEmployees, todaysLogs, leavesToday] = await Promise.all([
                prisma.user.count({ where: { isActive: true } }),
                prisma.attendanceLog.findMany({
                  where: {
                    timestamp: { gte: start, lte: end },
                    user: { isActive: true },
                  },
                  select: { employeeId: true },
                  distinct: ['employeeId'],
                }),
                prisma.leave.count({
                  where: {
                    status: 'Approved',
                    startDate: { lte: end },
                    endDate: { gte: start },
                  },
                }),
              ]);

              const presentToday = todaysLogs.length;
              const absentToday = Math.max(
                0,
                totalEmployees - presentToday - leavesToday
              );

              return {
                totalActiveEmployees: totalEmployees,
                totalPresentToday: presentToday,
                totalAbsentToday: absentToday,
                totalOnLeaveToday: leavesToday,
                generatedAt: new Date().toISOString(),
              };
            } catch (error: any) {
              console.error('[Tool Error - get_dashboard_stats]:', error);
              return { error: 'Failed to fetch dashboard stats', details: error.message };
            }
          },
        } as any),

        // ── Tool: get_employee_attendance ──────────────────────────────────
        get_employee_attendance: tool({
          description:
            'Fetches attendance records for a specific employee for the current month. Accepts employee UUID, employee ID (e.g. EMP-1001), or email.',
          parameters: z.object({
            employeeIdentifier: z
              .string()
              .describe(
                'The database UUID, employee ID (e.g. "EMP-1001"), or email of the employee.'
              ),
          }),
          execute: async ({ employeeIdentifier }: any) => {
            try {
              if (!employeeIdentifier || typeof employeeIdentifier !== 'string') {
                return { error: 'Invalid employee identifier provided.' };
              }

              const user = await prisma.user.findFirst({
                where: {
                  OR: [
                    { id: employeeIdentifier },
                    { employeeId: employeeIdentifier },
                    { email: employeeIdentifier },
                    { name: { contains: employeeIdentifier } },
                  ],
                },
                select: {
                  id: true,
                  name: true,
                  employeeId: true,
                  email: true,
                  isActive: true,
                },
              });

              if (!user) {
                return {
                  error: `No employee found with identifier "${employeeIdentifier}". Try using their full email, employee ID (e.g. EMP-1001), or database ID.`,
                };
              }

              const now = new Date();
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              const endOfMonth = new Date(
                now.getFullYear(),
                now.getMonth() + 1,
                0,
                23,
                59,
                59,
                999
              );

              const logs = await prisma.attendanceLog.findMany({
                where: {
                  employeeId: user.id,
                  timestamp: { gte: startOfMonth, lte: endOfMonth },
                },
                select: {
                  timestamp: true,
                  checkOut: true,
                  punchType: true,
                  workMode: true,
                  isMissingOut: true,
                },
                orderBy: { timestamp: 'asc' },
              });

              const presentDays = new Set(
                logs.map((l) => l.timestamp.toISOString().split('T')[0])
              ).size;

              return {
                employee: {
                  name: user.name,
                  employeeId: user.employeeId,
                  email: user.email,
                  isActive: user.isActive,
                },
                month: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
                totalLogsThisMonth: logs.length,
                uniquePresentDays: presentDays,
                recentLogs: logs.slice(-10).map((l) => ({
                  date: l.timestamp.toISOString().split('T')[0],
                  checkIn: l.timestamp.toISOString(),
                  checkOut: l.checkOut?.toISOString() ?? null,
                  workMode: l.workMode ?? 'IN_HOUSE',
                  isMissingOut: l.isMissingOut,
                })),
              };
            } catch (error: any) {
              console.error('[Tool Error - get_employee_attendance]:', error);
              return { error: `Failed to fetch attendance for ${employeeIdentifier}`, details: error.message };
            }
          },
        } as any),

        // ── Tool: get_pending_leaves ───────────────────────────────────────
        get_pending_leaves: tool({
          description:
            'Fetches leave requests filtered by status. Use this to review pending approvals, approved leaves, or rejected applications.',
          parameters: z.object({
            status: z
              .enum(['Pending', 'Approved', 'Rejected'])
              .optional()
              .describe('Filter by leave status. Omit to get all leaves.'),
            limit: z
              .number()
              .int()
              .min(1)
              .max(50)
              .optional()
              .describe('Max records to return (default: 10).'),
          }),
          execute: async ({ status, limit = 10 }: any) => {
            try {
              const leaves = await prisma.leave.findMany({
                where: status ? { status } : undefined,
                take: limit,
                orderBy: { createdAt: 'desc' },
                select: {
                  id: true,
                  type: true,
                  status: true,
                  startDate: true,
                  endDate: true,
                  totalDays: true,
                  reason: true,
                  user: {
                    select: { name: true, employeeId: true, email: true },
                  },
                },
              });

              return {
                filter: status ?? 'all',
                totalFound: leaves.length,
                leaves: leaves.map((l) => ({
                  id: l.id,
                  employee: l.user.name,
                  employeeId: l.user.employeeId,
                  type: l.type,
                  status: l.status,
                  startDate: l.startDate.toISOString().split('T')[0],
                  endDate: l.endDate.toISOString().split('T')[0],
                  totalDays: l.totalDays,
                  reason: l.reason,
                })),
              };
            } catch (error: any) {
              console.error('[Tool Error - get_pending_leaves]:', error);
              return { error: 'Failed to fetch leaves', details: error.message };
            }
          },
        } as any),
      } as any,
    });

    // ── Step 6: Return as a streaming data response ───────────────────────────
    // @ts-ignore
    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    console.error('[Chat API] Unhandled error:', error);
    return NextResponse.json(
      {
        error: 'Chat service encountered an error.',
        details: error?.message ?? 'Unknown error',
      },
      { status: 500 }
    );
  }
}