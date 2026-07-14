'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Bot, Sparkles, Send, X, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

// ─── Quick-reply suggestions ──────────────────────────────────────────────────
const SUGGESTIONS = ["📊 Today's Dashboard", "🗓️ My Attendance", "🏖️ Pending Leaves", "❌ Who's Absent Today"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract all text parts from a UIMessage's parts array. */
function getMessageText(msg: UIMessage): string {
  if (!msg.parts) return (msg as any).content ?? '';
  return msg.parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map((p) => p.text)
    .join('');
}

/** Extract tool-invocation parts that are still pending (no result yet). */
function getPendingToolInvocations(msg: UIMessage) {
  if (!msg.parts) return [];
  return msg.parts.filter(
    (p) =>
      p.type === 'tool-invocation' &&
      (p as any).toolInvocation?.state !== 'result'
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Resolve logged-in user's name from the app's custom AuthContext
  const { user } = useAuth();
  const userName = user?.name || 'there';
  const pathname = usePathname();

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // Passes userName, route, and role in every request body so the server personalises the system prompt
      body: { 
        userName, 
        currentRoute: pathname, 
        systemRole: 'Admin' 
      },
    }),
    messages: [
      {
        id: 'welcome',
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: `Hello **${userName}**! 👋 I'm your HRM AI Assistant. How can I help you today?`,
          },
        ],
      },
    ],
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // Retry: re-send the last user message
  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find((m) => (m.role as string) === 'user') as any;
    if (lastUserMsg) {
      const text: string =
        lastUserMsg.parts?.find((p: any) => p.type === 'text')?.text ||
        '';
      if (text) sendMessage({ text });
    }
  };

  // Auto-scroll to the latest message
  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    sendMessage({ text: trimmed });
    setInputValue('');
  };

  const handleSuggestion = (text: string) => {
    if (isLoading) return;
    sendMessage({ text });
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Toggle Button */}
      <button
        id="ai-chat-toggle"
        onClick={() => setIsOpen((o) => !o)}
        className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white p-3 rounded-full shadow-lg transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        aria-label={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
      >
        {isOpen ? <X size={24} /> : <Bot size={24} />}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          className={[
            'w-80 h-[500px]',
            'resize overflow-hidden',
            'min-w-[340px] max-w-[800px] min-h-[400px] max-h-[85vh]',
            'bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl',
            'border border-gray-200 dark:border-gray-700',
            'flex flex-col',
          ].join(' ')}
        >
          {/* ── Header — premium corporate ── */}
          <div className="bg-white px-4 py-3 border-b border-gray-100 rounded-t-2xl flex items-center justify-between shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600">
                <Bot size={18} />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 leading-tight">Virtual System Admin</h3>
                <p className="text-[10px] text-green-600 font-medium flex items-center gap-1 mt-0.5">
                  Online & Ready
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="flex items-center justify-between gap-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-3 py-2 border-b border-red-200 dark:border-red-800 shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} />
                <span>Connection error. Please try again.</span>
              </div>
              <button 
                                  onClick={() => handleRetry()}
                className="px-2 py-1 bg-red-100 hover:bg-red-200 rounded font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {/* ── Message Area ── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {messages.map((m: any) => {
              const isAssistant = m.role === 'assistant';

              // ── ai@7 UIMessage format: text content lives in parts[].text
              const textContent: string = m.content || getMessageText(m);
              const hasText = textContent.trim().length > 0;

              // ── CONFIRMED from console log:
              // ai@7 ToolUIPart format: { type: 'tool-{toolName}', state: 'output-available', output: {...}, toolCallId: '...' }
              // type encodes toolName — e.g., 'tool-get_dashboard_stats' → toolName = 'get_dashboard_stats'
              const toolInvocations: any[] = (() => {
                if (!m.parts || !Array.isArray(m.parts)) return [];
                return m.parts
                  .filter((p: any) => typeof p.type === 'string' && p.type.startsWith('tool-'))
                  .map((p: any) => ({
                    toolName: p.toolName ?? p.type.slice(5),
                    toolCallId: p.toolCallId ?? p.id,
                    state: p.state === 'output-available' ? 'result' : 'loading',
                    args: p.input ?? p.args,
                    result: p.output ?? p.result,
                  }));
              })();

              const hasTools = toolInvocations.length > 0;

              return (
                <div key={m.id} className={`flex flex-col ${ isAssistant ? 'items-start' : 'items-end'} mb-4 w-full`}>

                  {/* ── User Bubble ── */}
                  {!isAssistant && (
                    <div className="bg-blue-600 text-white p-3.5 rounded-2xl rounded-br-none max-w-[85%] shadow-sm text-sm">
                      {textContent}
                    </div>
                  )}

                  {/* ── Assistant Bubble ── */}
                  {isAssistant && (
                    <div className="flex flex-col gap-2 w-full max-w-[92%]">

                      {/* 1. Text content */}
                      {hasText && (
                        <div className="text-sm prose prose-sm max-w-none text-gray-800 bg-white border border-gray-100 p-3.5 rounded-2xl rounded-bl-none shadow-sm">
                          <ReactMarkdown>{textContent}</ReactMarkdown>
                        </div>
                      )}

                      {/* 2. Tool Cards */}
                      {toolInvocations.map((tool: any) => {
                        const { toolName, toolCallId, state, result } = tool;

                        // Loading
                        if (state !== 'result') {
                          return (
                            <div key={toolCallId ?? Math.random()} className="text-xs text-blue-600 animate-pulse bg-blue-50 p-2 rounded border border-blue-100">
                              ⚡ Loading {(toolName ?? '').replace(/_/g, ' ')}...
                            </div>
                          );
                        }

                        // Backend error
                        if (result?.error) {
                          return (
                            <div key={toolCallId} className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg flex flex-col gap-2 shadow-sm">
                              <div className="flex items-start gap-2 text-red-700">
                                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                                <div className="text-sm">
                                  <strong>Task Failed:</strong> {result.error === 'Employee not found. Please provide a valid Name or ID.' ? result.error : 'I encountered an issue while performing this task.'}
                                </div>
                              </div>
                              <div className="flex justify-end">
                                <button
                                  onClick={() => handleRetry()}
                                  className="px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors"
                                >
                                  Retry
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // 1. DASHBOARD UPGRADE
                        if (toolName === 'get_dashboard_stats' && result && !result.error) {
                          return (
                            <div key={toolCallId} className="p-4 mt-2 bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 transition-all hover:shadow-md">
                               <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-50">
                                 <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">📊</span>
                                 <h4 className="font-bold text-gray-800">Today's Dashboard</h4>
                               </div>
                               <div className="grid grid-cols-2 gap-3 text-sm">
                                 <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-3 rounded-lg border border-gray-200">
                                   <span className="block text-gray-500 text-xs mb-1">Active</span>
                                   <span className="font-semibold text-gray-800 text-lg">{result.totalActiveEmployees || 0}</span>
                                 </div>
                                 <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200">
                                   <span className="block text-green-600 text-xs mb-1">Present</span>
                                   <span className="font-semibold text-green-700 text-lg">{result.totalPresentToday || 0}</span>
                                 </div>
                               </div>
                            </div>
                          );
                        }

                        // 2. ATTENDANCE UPGRADE
                        if (toolName === 'get_employee_attendance' && result && !result.error) {
                          return (
                            <div key={toolCallId} className="p-4 mt-2 bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100">
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-50">
                                 <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">📅</span>
                                 <h4 className="font-bold text-gray-800">Attendance Summary</h4>
                              </div>
                              <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm mb-3">
                                <div className="text-center"><span className="block text-gray-500 text-xs">Month</span><span className="font-semibold">{result.month || 'N/A'}</span></div>
                                <div className="text-center"><span className="block text-gray-500 text-xs">Present</span><span className="font-bold text-emerald-600">{result.uniquePresentDays || 0} Days</span></div>
                                <div className="text-center"><span className="block text-gray-500 text-xs">Logs</span><span className="font-semibold">{result.totalLogsThisMonth || 0}</span></div>
                              </div>
                              <div className="text-xs font-semibold text-gray-600 mb-1">Recent Logs:</div>
                              <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                                {(result.recentLogs ?? []).slice(0, 5).map((log: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                                    <span className="font-medium">{new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                                    <div className="flex gap-1.5">
                                      <span className="text-emerald-700 bg-emerald-100/50 border border-emerald-200 px-1.5 py-0.5 rounded-md">In: {new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                      {log.checkOut
                                        ? <span className="text-rose-700 bg-rose-100/50 border border-rose-200 px-1.5 py-0.5 rounded-md">Out: {new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        : <span className="text-amber-700 bg-amber-100/50 border border-amber-200 px-1.5 py-0.5 rounded-md">No Out</span>
                                      }
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        // 3. NEW: LEAVE ACTION CONFIRMATION
                        if (toolName === 'update_leave_status' && result) {
                          return (
                            <div key={toolCallId} className="p-3 mt-2 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">✅</span>
                              <div className="text-sm text-blue-800">
                                <strong>Action Successful:</strong> {result.message}
                              </div>
                            </div>
                          );
                        }
                        
                        // 4. NEW: ANNOUNCEMENT CONFIRMATION
                        if (toolName === 'post_announcement' && result) {
                          return (
                            <div key={toolCallId} className="p-4 mt-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg">
                              <div className="flex items-center gap-2 mb-1">
                                <span>📢</span><h4 className="font-bold">Notice Published</h4>
                              </div>
                              <p className="text-xs text-indigo-100 opacity-90">{result.title}</p>
                            </div>
                          );
                        }

                        // 5. ABSENT EMPLOYEES CARD
                        if (toolName === 'get_absent_employees' && result && !result.error) {
                          return (
                            <div key={toolCallId} className="p-4 mt-2 bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(239,68,68,0.15)] border border-red-100">
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-50">
                                <span className="p-1.5 bg-red-50 text-red-500 rounded-lg">❌</span>
                                <h4 className="font-bold text-gray-800">Absent Today</h4>
                                <span className="ml-auto text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">{result.count ?? 0}</span>
                              </div>
                              {(result.employees ?? []).length === 0 ? (
                                <p className="text-sm text-gray-500 text-center py-2">🎉 Everyone is present today!</p>
                              ) : (
                                <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
                                  {(result.employees ?? []).map((emp: any, i: number) => (
                                    <div key={i} className="flex justify-between items-center px-2 py-1.5 bg-red-50/50 border border-red-100 rounded-lg text-xs">
                                      <span className="font-semibold text-gray-800">{emp.name}</span>
                                      <span className="text-gray-400 text-[11px]">{emp.department || 'N/A'}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                              <p className="text-[10px] text-gray-400 mt-2">As of {result.date ?? 'today'}</p>
                            </div>
                          );
                        }

                        // 6. PENDING LEAVES CARD (upgraded)
                        if (toolName === 'get_pending_leaves' && result && !result.error) {
                          return (
                            <div key={toolCallId} className="p-4 mt-2 bg-white rounded-xl shadow-[0_2px_10px_-3px_rgba(245,158,11,0.15)] border border-amber-100">
                              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-50">
                                <span className="p-1.5 bg-amber-50 text-amber-500 rounded-lg">🌴</span>
                                <h4 className="font-bold text-gray-800">Leave Requests</h4>
                                <span className="ml-auto text-xs font-bold text-white bg-amber-500 px-2 py-0.5 rounded-full">{result.totalFound ?? 0}</span>
                              </div>
                              <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
                                {(result.leaves ?? []).slice(0, 5).map((leave: any, idx: number) => (
                                  <div key={idx} className="flex justify-between items-start p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                                    <div>
                                      <span className="font-semibold text-gray-800">{leave.employee}</span>
                                      <span className="text-gray-400 ml-1">— {leave.type}</span>
                                      <p className="text-gray-400 text-[11px] mt-0.5">{leave.startDate} → {leave.endDate} ({leave.totalDays}d)</p>
                                    </div>
                                    <span className={`ml-2 shrink-0 px-1.5 py-0.5 rounded-md font-semibold ${
                                      leave.status === 'Pending' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                                      leave.status === 'Approved' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                                      'bg-red-100 text-red-700 border border-red-200'
                                    }`}>{leave.status}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }

                        // Generic fallback — never blank
                        return (
                          <div key={toolCallId} className="text-xs text-gray-600 bg-gray-100 p-2 rounded border border-gray-200">
                            ✅ Action completed: {toolName}
                          </div>
                        );
                      })}

                      {/* 3. Thinking indicator — only when truly nothing to show yet */}
                      {!hasText && !hasTools && isLoading && (
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 shadow-sm w-fit">
                          <span className="text-indigo-500 animate-pulse flex items-center gap-2 text-xs font-medium">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/></svg>
                            Thinking...
                          </span>
                        </div>
                      )}

                      {/* 4. Failsafe — completed message but nothing rendered */}
                      {!hasText && !hasTools && !isLoading && (
                        <div className="text-xs text-gray-400 italic p-2">Processing complete.</div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* --- API ERROR BOUNDARY --- */}
            {error && (
              <div className="flex flex-col items-start mb-4 w-full mt-2 animate-in fade-in slide-in-from-bottom-2">
                <div className="p-4 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30 shadow-sm max-w-[90%]">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-1 text-sm">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    System Alert
                  </div>
                  <div className="text-red-600 dark:text-red-300 text-xs leading-relaxed font-medium">
                    {error.message?.toLowerCase().includes('quota') || error.message?.includes('429') 
                      ? "API Rate Limit Exceeded. The AI provider is temporarily blocking requests due to high traffic. Please wait 1 minute and try again, or update your API key in Settings."
                      : `Connection Error: ${error.message}`
                    }
                  </div>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Quick-reply Suggestions ── */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto whitespace-nowrap border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestion(suggestion)}
                disabled={isLoading}
                className="text-xs font-medium px-4 py-2 bg-gray-50 border border-gray-100 text-gray-700 rounded-full hover:bg-blue-50 hover:text-blue-600 hover:border-blue-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
              >
                {suggestion}
              </button>
            ))}
          </div>

          {/* ── Input Area ── */}
          <form
            onSubmit={handleFormSubmit}
            className="border-t border-gray-100 dark:border-gray-800 px-3 py-3 flex items-center gap-2 shrink-0 bg-white dark:bg-gray-900 rounded-b-2xl"
          >
            <input
              id="ai-chat-input"
              type="text"
              className="flex-1 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:bg-gray-800 dark:text-gray-100 transition-colors placeholder:text-gray-400"
              placeholder="Ask about attendance, leaves…"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={isLoading}
              autoComplete="off"
            />
            <button
              id="ai-chat-send"
              type="submit"
              disabled={isLoading || !inputValue.trim()}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-40 disabled:cursor-not-allowed text-white p-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-all shrink-0"
              aria-label="Send message"
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
