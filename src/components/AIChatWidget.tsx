'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { Bot, Sparkles, Send, X, Loader2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useAuth } from '@/context/AuthContext';

// ─── Quick-reply suggestions ──────────────────────────────────────────────────
const SUGGESTIONS = ["📊 Today's Dashboard", "🗓️ My Attendance", "🏖️ Pending Leaves"] as const;

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

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: '/api/chat',
      // Passes userName in every request body so the server personalises the system prompt
      body: { userName },
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
            'w-80 h-[420px]',
            'resize overflow-hidden',
            'min-w-[320px] max-w-[800px] min-h-[400px] max-h-[85vh]',
            'bg-white dark:bg-gray-900 rounded-2xl shadow-2xl',
            'border border-gray-200 dark:border-gray-700',
            'flex flex-col',
          ].join(' ')}
        >
          {/* ── Header — premium gradient ── */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 rounded-t-2xl flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-indigo-200" />
              <div>
                <h3 className="text-sm font-semibold text-white leading-tight">HRM AI Assistant</h3>
                <p className="text-[10px] text-indigo-200 leading-tight">Powered by Gemini</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white/70 hover:text-white transition-colors focus:outline-none"
              aria-label="Close chat"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── Error Banner ── */}
          {error && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs px-3 py-2 border-b border-red-200 dark:border-red-800 shrink-0">
              <AlertCircle size={14} />
              <span>Connection error. Please try again.</span>
            </div>
          )}

          {/* ── Message Area ── */}
          <div className="flex-1 px-4 py-3 overflow-y-auto space-y-3 min-h-0 bg-gray-50/40 dark:bg-gray-900">
            {messages.map((msg: UIMessage) => {
              const text = getMessageText(msg);
              const pendingTools = getPendingToolInvocations(msg);

              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {/* User bubble */}
                  {msg.role === 'user' && (
                    <div className="max-w-[80%] bg-gradient-to-br from-indigo-500 to-purple-500 text-white px-4 py-2.5 rounded-2xl rounded-br-sm text-sm leading-relaxed shadow-sm">
                      {text}
                    </div>
                  )}

                  {/* Assistant bubble */}
                  {msg.role === 'assistant' && (
                    <div className="bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 px-4 py-2.5 rounded-2xl rounded-bl-sm w-full max-w-[92%] shadow-sm border border-gray-100 dark:border-gray-700">

                      {/* 1. Text content → rendered as Markdown */}
                      {text && (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-p:my-1 prose-a:text-indigo-600 prose-ul:pl-4 prose-li:my-0.5 prose-pre:bg-gray-800 prose-pre:text-white prose-pre:p-3 prose-pre:rounded-md prose-headings:font-semibold">
                          <ReactMarkdown>{text}</ReactMarkdown>
                        </div>
                      )}

                      {/* 2. No text yet — tool(s) still executing */}
                      {!text && pendingTools.length > 0 && (
                        <div className="flex flex-col gap-1.5">
                          {pendingTools.map((p, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 italic">
                              <Loader2 size={13} className="animate-spin shrink-0 text-indigo-500" />
                              <span>
                                Fetching via{' '}
                                <span className="font-medium not-italic text-indigo-600 dark:text-indigo-400">
                                  {(p as any).toolInvocation?.toolName ?? 'tool'}
                                </span>
                                …
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 3. Edge-case fallback — empty with no tools */}
                      {!text && pendingTools.length === 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-400 italic">
                          <Loader2 size={13} className="animate-spin text-indigo-400" />
                          <span>Thinking…</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Global spinner — shown before the first token of the latest turn arrives */}
            {isLoading && (messages[messages.length - 1] as any)?.role === 'user' && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-800 text-gray-400 px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-2 text-sm shadow-sm border border-gray-100 dark:border-gray-700">
                  <Loader2 size={13} className="animate-spin text-indigo-400" />
                  <span>Thinking…</span>
                </div>
              </div>
            )}

            {/* Scroll anchor */}
            <div ref={messagesEndRef} />
          </div>

          {/* ── Quick-reply Suggestions ── */}
          <div className="flex gap-2 px-3 py-2 overflow-x-auto whitespace-nowrap border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 shrink-0">
            {SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSuggestion(suggestion)}
                disabled={isLoading}
                className="text-xs font-medium px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-full hover:bg-indigo-50 dark:hover:bg-indigo-900/30 hover:text-indigo-600 hover:border-indigo-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shrink-0"
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
