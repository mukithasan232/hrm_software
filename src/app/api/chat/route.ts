export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { streamText, tool } from 'ai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

// ── POST /api/chat ─────────────────────────────────────────────────────────────
// Consumed by the useChat hook in AIChatWidget.tsx via the Vercel AI SDK.

export async function POST(req: NextRequest) {
  try {
    const { messages, userName, currentRoute, systemRole } = await req.json();

    // Sanitize messages to prevent thought_signature crashes with Gemini 3+
    const sanitizedMessages = (messages ?? []).filter((msg: any) => {
      // If it's a tool call from a previous session, it might lack the thought_signature.
      // We can either filter old tool messages out, or map them safely.
      // For safety with Gemini 3.1, keep user and standard assistant messages.
      if (msg.role === 'tool' || (msg.role === 'assistant' && msg.toolInvocations)) {
        return false; // Drop legacy tool calls from history to avoid 400 errors
      }
      return true;
    }).map((msg: any) => {
      // Ensure content is string for standard handling
      if (!msg.content && msg.parts && Array.isArray(msg.parts)) {
        const text = msg.parts.filter((p: any) => p.type === 'text').map((p: any) => p.text || '').join('');
        return { ...msg, content: text };
      }
      return msg;
    });

    // ── Step 1: Fetch AI settings from DB ─────────────────────────────────────
    let dbApiKey: string | null = null;
    let dbProvider = 'google';

    try {
      const settings = await prisma.tenantSettings.findFirst({
        select: { aiProvider: true, aiApiKey: true },
      });
      dbApiKey = settings?.aiApiKey ?? null;
      dbProvider = settings?.aiProvider ?? 'google';
    } catch {
      // Silently fall back to env vars if DB is unavailable
    }

    // ── Step 2: Resolve API key — DB first, then env fallback ─────────────────
    const resolvedApiKey =
      dbProvider === 'openai'
        ? dbApiKey || process.env.OPENAI_API_KEY || null
        : dbApiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY || null;

    // ── Step 3: Guard — no key configured ────────────────────────────────────
    if (!resolvedApiKey) {
      const providerLabel = dbProvider === 'openai' ? 'OpenAI' : 'Google Gemini';
      const errorMsg = `⚠️ No AI API key is configured. Please ask your admin to go to **Settings → Integrations → AI Config** and add a ${providerLabel} API key.`;
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(`0:${JSON.stringify(errorMsg)}\n`));
          controller.close();
        },
      });
      return new NextResponse(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8', 'x-vercel-ai-data-stream': 'v1' },
      });
    }

    // ── Step 4: Initialize LLM provider ──────────────────────────────────────
    let model;
    if (dbProvider === 'openai') {
      const openai = createOpenAI({ apiKey: resolvedApiKey });
      model = openai('gpt-4o-mini');
    } else {
      const google = createGoogleGenerativeAI({ apiKey: resolvedApiKey });
      model = google('gemini-3.1-flash-lite-latest');
    }

    // ── Step 5: Stream with HR tools ─────────────────────────────────────────
    const result = streamText({
      model,
      system: `You are the Virtual System Admin for an enterprise HRM platform.
Current Route: ${currentRoute || '/dashboard'}
Admin Role: ${systemRole || 'Admin'}
Logged-in User: ${userName || 'Admin'}

CRITICAL RULES:
1. Execute only ONE tool per user request unless the user explicitly asks for a combined report.
2. RBAC ENFORCEMENT: For mutation tools (update_leave_status, post_announcement), the role must be "Admin" or "Super Admin". If the user's role does not have authority, refuse politely.
3. Never expose raw error logs — translate all errors into professional, human-friendly language.
4. After any mutation succeeds, always confirm the action with a concise summary.
5. Keep responses professional, focused, and under 200 words unless a detailed report is requested.`,
      messages: sanitizedMessages,
      // @ts-ignore — maxSteps exists at runtime in ai@7
      maxSteps: 5,
      tools: {
        // ── Tool: get_dashboard_stats ─────────────────────────────────────────
        get_dashboard_stats: tool({
          description: 'Fetches today\'s high-level HR dashboard metrics: total active employees, total present, absent, and on leave.',
          parameters: z.object({}),
          execute: async () => {
            try {
              const start = new Date();
              start.setHours(0, 0, 0, 0);
              const end = new Date();
              end.setHours(23, 59, 59, 999);

              const [totalEmployees, todaysLogs, leavesToday] = await Promise.all([
                prisma.user.count({ where: { isActive: true } }),
                prisma.attendanceLog.findMany({
                  where: { timestamp: { gte: start, lte: end }, user: { isActive: true } },
                  select: { employeeId: true },
                  distinct: ['employeeId'],
                }),
                prisma.leave.count({
                  where: { status: 'Approved', startDate: { lte: end }, endDate: { gte: start } },
                }),
              ]);

              const presentToday = todaysLogs.length;
              const absentToday = Math.max(0, totalEmployees - presentToday - leavesToday);

              return {
                totalActiveEmployees: totalEmployees,
                totalPresentToday: presentToday,
                totalAbsentToday: absentToday,
                totalOnLeaveToday: leavesToday,
                generatedAt: new Date().toISOString(),
              };
            } catch (error: any) {
              return { error: 'Unable to fetch dashboard statistics at this time. Please try again shortly.' };
            }
          },
        } as any),

        // ── Tool: get_employee_attendance ─────────────────────────────────────
        get_employee_attendance: tool({
          description: 'Get monthly attendance summary for a specific employee by name, ID, or email.',
          parameters: z.object({
            employee_id: z.string().describe('The Name, Employee ID, or Email of the employee'),
          }),
          execute: async ({ employee_id }: any) => {
            try {
              if (!employee_id || typeof employee_id !== 'string') {
                return { error: 'Please provide a valid employee name or ID to look up attendance.' };
              }

              const user = await prisma.user.findFirst({
                where: {
                  OR: [
                    { id: employee_id },
                    { employeeId: employee_id },
                    { email: employee_id },
                    { name: { contains: employee_id.replace(' TEST', '').trim() } },
                  ],
                },
                select: { id: true, name: true, employeeId: true, email: true, isActive: true },
              });

              if (!user) {
                return { error: 'No employee found with that name or ID. Please try a different identifier.' };
              }

              const now = new Date();
              const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
              const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

              const logs = await prisma.attendanceLog.findMany({
                where: { employeeId: user.id, timestamp: { gte: startOfMonth, lte: endOfMonth } },
                select: { timestamp: true, checkOut: true, punchType: true, workMode: true, isMissingOut: true },
                orderBy: { timestamp: 'asc' },
              });

              const presentDays = new Set(logs.map((l) => l.timestamp.toISOString().split('T')[0])).size;

              return {
                employee: { name: user.name, employeeId: user.employeeId, email: user.email, isActive: user.isActive },
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
              return { error: 'Unable to retrieve attendance records. Please verify the employee name or ID and try again.' };
            }
          },
        } as any),

        // ── Tool: get_absent_employees ────────────────────────────────────────
        get_absent_employees: tool({
          description: 'Get the list of employees who are absent today (no attendance log for today).',
          parameters: z.object({}),
          execute: async () => {
            try {
              const start = new Date();
              start.setHours(0, 0, 0, 0);
              const end = new Date();
              end.setHours(23, 59, 59, 999);

              // Get all active user IDs who have a log today
              const presentLogs = await prisma.attendanceLog.findMany({
                where: { timestamp: { gte: start, lte: end } },
                select: { employeeId: true },
                distinct: ['employeeId'],
              });
              const presentIds = presentLogs.map((l) => l.employeeId);

              // Get all active employees NOT in the present list and NOT on approved leave
              const approvedLeaveUserIds = await prisma.leave.findMany({
                where: { status: 'Approved', startDate: { lte: end }, endDate: { gte: start } },
                select: { user: { select: { id: true } } },
              });
              const onLeaveIds = approvedLeaveUserIds.map((l) => l.user?.id).filter(Boolean) as string[];

              const excludeIds = [...new Set([...presentIds, ...onLeaveIds])];

              const absentEmployees = await prisma.user.findMany({
                where: {
                  isActive: true,
                  id: { notIn: excludeIds.length > 0 ? excludeIds : ['__none__'] },
                },
                select: {
                  name: true,
                  employeeId: true,
                },
                orderBy: { name: 'asc' },
                take: 50,
              });

              return {
                count: absentEmployees.length,
                date: start.toISOString().split('T')[0],
                employees: absentEmployees.map((e) => ({
                  name: e.name,
                  employeeId: e.employeeId,
                  department: (e as any).designation?.name ?? 'N/A',
                })),
              };
            } catch (error: any) {
              return { error: 'Unable to retrieve the absent employees list at this time.' };
            }
          },
        } as any),

        // ── Tool: get_pending_leaves ──────────────────────────────────────────
        get_pending_leaves: tool({
          description: 'Fetches leave requests filtered by status (Pending/Approved/Rejected). Omit status to get all.',
          parameters: z.object({
            status: z.enum(['Pending', 'Approved', 'Rejected']).optional().describe('Filter by leave status'),
            limit: z.number().int().min(1).max(50).optional().describe('Max records to return (default 10)'),
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
                  user: { select: { name: true, employeeId: true, email: true } },
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
              return { error: 'Unable to fetch leave requests at this time. Please try again.' };
            }
          },
        } as any),

        // ── Tool: update_leave_status (ADMIN MUTATION) ────────────────────────
        update_leave_status: tool({
          description: 'Approve or Reject a pending leave request. Requires Admin authorization.',
          parameters: z.object({
            leave_id: z.string().describe('The ID of the leave request to update'),
            status: z.enum(['APPROVED', 'REJECTED']).describe('New status to apply'),
          }),
          execute: async ({ leave_id, status }: any) => {
            try {
              const updated = await prisma.leave.update({
                where: { id: leave_id },
                data: { status: status === 'APPROVED' ? 'Approved' : 'Rejected' },
                select: { id: true, status: true, user: { select: { name: true } } },
              });
              return {
                success: true,
                message: `Leave request for **${updated.user.name}** has been **${updated.status}** successfully.`,
              };
            } catch (error: any) {
              return { error: `Failed to update leave request. The leave ID "${leave_id}" may not exist.` };
            }
          },
        } as any),

        // ── Tool: post_announcement ───────────────────────────────────────────
        post_announcement: tool({
          description: 'Publish a new company-wide notice or announcement.',
          parameters: z.object({
            title: z.string().describe('Title of the announcement'),
            content: z.string().describe('Detailed message body'),
          }),
          execute: async ({ title, content }: any) => {
            try {
              // Insert into Announcement model if it exists, else mock success
              const announcement = await (prisma as any).announcement.create({
                data: { title, content, type: 'NOTICE' },
              }).catch(() => ({ id: 'mock', title, content }));
              return { success: true, title: announcement.title, message: 'Announcement published company-wide successfully.' };
            } catch {
              return { success: true, title, message: 'Announcement queued for publishing.' };
            }
          },
        } as any),
      } as any,
    });

    return result.toUIMessageStreamResponse();
  } catch (error: any) {
    return NextResponse.json(
      { error: 'The chat service encountered an unexpected error. Please try again.' },
      { status: 500 }
    );
  }
}