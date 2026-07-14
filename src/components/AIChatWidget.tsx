'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { Bot, Send, X, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/context/AuthContext';
import { usePathname } from 'next/navigation';

// ─── Quick-reply suggestions ──────────────────────────────────────────────────
const SUGGESTIONS = ["📊 Today's Dashboard", "🗓️ My Attendance", "🏖️ Pending Leaves", "❌ Who's Absent Today"] as const;

// ─── Tool Card Components ─────────────────────────────────────────────────────

function DashboardCard({ result }: { result: any }) {
  if (!result) return null;
  return (
    <div className="p-4 mt-2 bg-white rounded-xl shadow-sm border border-blue-100">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg text-base">📊</span>
        <h4 className="font-bold text-gray-800 text-sm">Today's Dashboard</h4>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
          <span className="block text-gray-500 text-xs mb-1">Total Active</span>
          <span className="font-bold text-gray-800 text-xl">{result.totalActiveEmployees ?? 0}</span>
        </div>
        <div className="bg-green-50 p-3 rounded-lg border border-green-100">
          <span className="block text-green-600 text-xs mb-1">Present Today</span>
          <span className="font-bold text-green-700 text-xl">{result.totalPresentToday ?? 0}</span>
        </div>
        <div className="bg-red-50 p-3 rounded-lg border border-red-100">
          <span className="block text-red-500 text-xs mb-1">Absent</span>
          <span className="font-bold text-red-600 text-xl">{result.totalAbsentToday ?? 0}</span>
        </div>
        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
          <span className="block text-amber-600 text-xs mb-1">On Leave</span>
          <span className="font-bold text-amber-700 text-xl">{result.totalOnLeaveToday ?? 0}</span>
        </div>
      </div>
    </div>
  );
}

function AttendanceCard({ result }: { result: any }) {
  if (!result) return null;
  return (
    <div className="p-4 mt-2 bg-white rounded-xl shadow-sm border border-emerald-100">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
        <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg text-base">📅</span>
        <h4 className="font-bold text-gray-800 text-sm">Attendance Summary</h4>
      </div>
      <div className="flex justify-between bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm mb-3">
        <div className="text-center">
          <span className="block text-gray-500 text-xs">Month</span>
          <span className="font-semibold text-gray-800">{result.month ?? 'N/A'}</span>
        </div>
        <div className="text-center">
          <span className="block text-gray-500 text-xs">Present Days</span>
          <span className="font-bold text-emerald-600">{result.uniquePresentDays ?? 0}</span>
        </div>
        <div className="text-center">
          <span className="block text-gray-500 text-xs">Total Logs</span>
          <span className="font-semibold text-gray-800">{result.totalLogsThisMonth ?? 0}</span>
        </div>
      </div>
      {result.recentLogs && result.recentLogs.length > 0 && (
        <>
          <div className="text-xs font-semibold text-gray-600 mb-1">Recent Logs:</div>
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
            {result.recentLogs.slice(0, 5).map((log: any, idx: number) => (
              <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                <span className="font-medium">{new Date(log.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                <div className="flex gap-1.5">
                  <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-md">
                    In: {new Date(log.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {log.checkOut
                    ? <span className="text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded-md">Out: {new Date(log.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    : <span className="text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-md">No Out</span>
                  }
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AbsentCard({ result }: { result: any }) {
  if (!result) return null;
  return (
    <div className="p-4 mt-2 bg-white rounded-xl shadow-sm border border-red-100">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-50">
        <span className="p-1.5 bg-red-50 text-red-500 rounded-lg text-base">❌</span>
        <h4 className="font-bold text-gray-800 text-sm">Absent Today</h4>
        <span className="ml-auto text-xs font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">{result.count ?? 0}</span>
      </div>
      {(result.employees ?? []).length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-2">🎉 Everyone is present!</p>
      ) : (
        <div className="flex flex-col gap-1 max-h-40 overflow-y-auto pr-1">
          {(result.employees ?? []).map((emp: any, i: number) => (
            <div key={i} className="flex justify-between items-center px-2 py-1.5 bg-red-50 border border-red-100 rounded-lg text-xs">
              <span className="font-semibold text-gray-800">{emp.name}</span>
              <span className="text-gray-400 text-[11px]">{emp.department ?? 'N/A'}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-gray-400 mt-2">As of {result.date ?? 'today'}</p>
    </div>
  );
}

function LeavesCard({ result }: { result: any }) {
  if (!result) return null;
  return (
    <div className="p-4 mt-2 bg-white rounded-xl shadow-sm border border-amber-100">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-50">
        <span className="p-1.5 bg-amber-50 text-amber-500 rounded-lg text-base">🌴</span>
        <h4 className="font-bold text-gray-800 text-sm">Leave Requests</h4>
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
            <span className={`ml-2 shrink-0 px-1.5 py-0.5 rounded-md font-semibold text-[11px] ${
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

// ─── Render a single tool result card ────────────────────────────────────────
function ToolResultCard({ toolName, result }: { toolName: string; result: any }) {
  if (result?.error) {
    return (
      <div className="mt-2 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-2">
        <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
        <span className="text-sm text-red-700">{result.error}</span>
      </div>
    );
  }

  switch (toolName) {
    case 'get_dashboard_stats':      return <DashboardCard result={result} />;
    case 'get_employee_attendance':  return <AttendanceCard result={result} />;
    case 'get_absent_employees':     return <AbsentCard result={result} />;
    case 'get_pending_leaves':       return <LeavesCard result={result} />;
    case 'update_leave_status':
      return (
        <div className="p-3 mt-2 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
          <span className="text-blue-500 mt-0.5">✅</span>
          <div className="text-sm text-blue-800"><strong>Done:</strong> {result?.message}</div>
        </div>
      );
    case 'post_announcement':
      return (
        <div className="p-4 mt-2 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white shadow">
          <div className="flex items-center gap-2 mb-1">
            <span>📢</span><h4 className="font-bold text-sm">Notice Published</h4>
          </div>
          <p className="text-xs text-indigo-100">{result?.title}</p>
        </div>
      );
    default:
      return (
        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 p-2 rounded-lg mt-2">
          ✅ {toolName.replace(/_/g, ' ')} completed.
        </div>
      );
  }
}

// ─── Main Widget ──────────────────────────────────────────────────────────────
export default function AIChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { user } = useAuth();
  const userName = user?.name || 'there';
  const pathname = usePathname();

  const { messages, append, isLoading, error, reload } = useChat({
    api: '/api/chat',
    body: { userName, currentRoute: pathname, systemRole: 'Admin' },
    initialMessages: [
      {
        id: 'welcome',
        role: 'assistant',
        content: `Hello **${userName}**! 👋 I'm your HRM AI Assistant. How can I help you today?`,
      },
    ],
  });


  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || isLoading) return;
    append({ role: 'user', content: trimmed });
    setInputValue('');
  };

  const handleSuggestion = (text: string) => {
    if (isLoading) return;
    append({ role: 'user', content: text });
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
          className="w-80 h-[500px] min-w-[340px] max-w-[800px] min-h-[400px] max-h-[85vh] bg-gray-50 dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
          style={{ resize: 'both', overflow: 'hidden' }}
        >
          {/* Header */}
          <div className="bg-white px-4 py-3 border-b border-gray-100 rounded-t-2xl flex items-center justify-between shrink-0 shadow-sm z-10">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600">
                <Bot size={18} />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-800 leading-tight">Virtual System Admin</h3>
                <p className="text-[10px] text-green-600 font-medium mt-0.5">Online &amp; Ready</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors" aria-label="Close chat">
              <X size={20} />
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="flex items-center justify-between gap-2 bg-red-50 text-red-600 text-xs px-3 py-2 border-b border-red-200 shrink-0">
              <div className="flex items-center gap-2">
                <AlertCircle size={14} />
                <span>Connection error. Please retry.</span>
              </div>
              <button onClick={() => reload()} className="px-2 py-1 bg-red-100 hover:bg-red-200 rounded font-semibold transition-colors">
                Retry
              </button>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {messages.map((m: any) => {
              const isAssistant = m.role === 'assistant';
              const textContent: string = m.content ?? '';
              const hasText = textContent.trim().length > 0;

              // ai@3 stable: toolInvocations lives at the top level of the message
              const toolInvocations: any[] = m.toolInvocations ?? [];
              const hasTools = toolInvocations.length > 0;

              return (
                <div key={m.id} className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'} w-full`}>
                  {/* User Bubble */}
                  {!isAssistant && (
                    <div className="bg-blue-600 text-white p-3.5 rounded-2xl rounded-br-none max-w-[85%] shadow-sm text-sm">
                      {textContent}
                    </div>
                  )}

                  {/* Assistant Response */}
                  {isAssistant && (
                    <div className="flex flex-col gap-2 w-full max-w-[92%]">
                      {/* Text */}
                      {hasText && (
                        <div className="text-sm prose prose-sm max-w-none text-gray-800 bg-white border border-gray-100 p-3.5 rounded-2xl rounded-bl-none shadow-sm">
                          <ReactMarkdown>{textContent}</ReactMarkdown>
                        </div>
                      )}

                      {/* Tool Cards */}
                      {toolInvocations.map((inv: any) => {
                        const { toolName, toolCallId, state } = inv;

                        if (state === 'call') {
                          return (
                            <div key={toolCallId} className="text-xs text-blue-600 animate-pulse bg-blue-50 p-2 rounded border border-blue-100">
                              ⚡ Loading {(toolName ?? '').replace(/_/g, ' ')}...
                            </div>
                          );
                        }

                        if (state === 'result') {
                          return (
                            <ToolResultCard key={toolCallId} toolName={toolName} result={inv.result} />
                          );
                        }

                        return null;
                      })}

                      {/* Thinking */}
                      {!hasText && !hasTools && isLoading && (
                        <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 shadow-sm w-fit">
                          <span className="text-indigo-500 animate-pulse flex items-center gap-2 text-xs font-medium">
                            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                            </svg>
                            Thinking...
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            <div ref={messagesEndRef} />
          </div>

          {/* Quick Replies */}
          <div className="flex gap-2 px-4 py-3 overflow-x-auto whitespace-nowrap border-t border-gray-100 bg-white dark:bg-gray-900 shrink-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
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

          {/* Input */}
          <form
            onSubmit={handleFormSubmit}
            className="border-t border-gray-100 px-3 py-3 flex items-center gap-2 shrink-0 bg-white dark:bg-gray-900 rounded-b-2xl"
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
