'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useStore, type Note } from '@/lib/store/useStore';
import { API, apiFetch } from '@/lib/config';
import { buildStudyContext, buildContextMessages } from '@/lib/ai';
import { stripHtml, tutorConnectionLabel, tutorConnectionClass } from '@/lib/utils';
import { classifyAiError, aiErrorMessage } from '@/lib/aiErrors';
import { notifyError } from '@/lib/observability';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
// Day 11 Task 7 — rehype-katex emits KaTeX HTML that needs the full KaTeX
// stylesheet (fractions, radicals, scripts and the math WOFF2 fonts). Without
// it the math renders as unstyled spans. The fonts ship from our own origin,
// which the existing `font-src 'self'` CSP already allows.
import 'katex/dist/katex.min.css';
import {
  Sparkles, Send, Paperclip, Mic, Bot, User, BookOpen,
  FileText, LayoutGrid, HelpCircle, Languages, Lightbulb,
  Copy, Check, X, Loader2,
  ArrowLeft, MessageSquarePlus
} from 'lucide-react';
import SignInPrompt from '@/components/SignInPrompt';
import { useDialogFocus } from '@/lib/useDialogFocus';
import { getSpeechRecognitionCtor } from '@/lib/speech';

const QUICK_CHIPS = [
  { id: 'explain', label: 'Explain', icon: BookOpen, color: '#3B82F6', prompt: 'Explain this concept in simple terms with examples.' },
  { id: 'summarize', label: 'Summarize', icon: FileText, color: '#10B981', prompt: 'Summarize the key points concisely.' },
  { id: 'flashcards', label: 'Flashcards', icon: LayoutGrid, color: '#8B5CF6', prompt: 'Create a set of flashcards from this content.' },
  { id: 'quiz', label: 'Quiz Me', icon: HelpCircle, color: '#F59E0B', prompt: 'Quiz me with questions to test my understanding.' },
  { id: 'translate', label: 'Translate', icon: Languages, color: '#EC4899', prompt: 'Translate this content.' },
  { id: 'solve', label: 'Solve Doubts', icon: Lightbulb, color: '#06B6D4', prompt: 'Help me solve my doubts about this topic.' },
];

const GREETING_MESSAGE = '👋 Hi! I\'m your AI Tutor. Ask me anything about your studies, or try one of the quick actions below!';

/**
 * Day 10 Task 8 — the request payload carries only the LAST N conversation
 * turns. The backend caps a chat request at 100 messages, so an unbounded
 * history would eventually fail every send with a 400, and forwarding the
 * entire history every turn bloats the payload and risks overflowing the model
 * context. Older turns stay in the persisted UI history; only the request is
 * trimmed to the recent window.
 */
const MAX_CHAT_HISTORY_MESSAGES = 16;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  isStreaming?: boolean;
  isError?: boolean;
}

interface NavigatorWithVirtualKeyboard extends Navigator {
  virtualKeyboard?: { overlaysContent?: boolean };
}

type CodeLanguage = 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'c' | 'html' | 'css' | 'bash' | 'sql' | 'json' | 'xml' | 'rust' | 'go' | 'ruby' | 'php' | 'swift' | 'kotlin' | 'text';

function detectLanguage(code: string): CodeLanguage {
  const patterns: [RegExp, CodeLanguage][] = [
    [/^(import |export |function |const |let |var |interface |type |class |async |await |=>)/m, 'typescript'],
    [/^(import |def |class |> |from )/m, 'python'],
    [/^(public |private |protected |class |void |int |String |@)/m, 'java'],
    [/^(#include|int main|std::)/m, 'cpp'],
    [/^(package |import |func |go )/m, 'go'],
    [/^(use |fn |let |mut )/m, 'rust'],
    [/^(SELECT |FROM |WHERE |INSERT |UPDATE |CREATE |ALTER |DROP )/im, 'sql'],
    [/^(<!DOCTYPE|<html|<head|<body|<div)/im, 'html'],
  ];
  if (/^[@{}$]/.test(code) && /^(\.\w+|#\w+|\w+\s*\{)/m.test(code)) return 'css';
  for (const [pattern, lang] of patterns) {
    if (pattern.test(code)) return lang;
  }
  return 'text';
}

function CodeBlock({ code, language: langProp }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);
  const language = (langProp || detectLanguage(code)) as CodeLanguage;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = code;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="tutor-code-block">
      <div className="tutor-code-header">
        <span className="tutor-code-lang">{language}</span>
        <button className="tutor-code-copy" onClick={handleCopy} aria-label={copied ? 'Copied to clipboard' : 'Copy code to clipboard'}>
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre><code className={`language-${language}`}>{code}</code></pre>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className="tutor-inline-code">{children}</code>;
}

function streamText(fullText: string, onChunk: (text: string) => void, onDone: () => void) {
  let index = 0;
  const CHUNK_SIZE = 3;

  const interval = setInterval(() => {
    if (index >= fullText.length) {
      clearInterval(interval);
      onDone();
      return;
    }
    const end = Math.min(index + CHUNK_SIZE, fullText.length);
    onChunk(fullText.slice(index, end));
    index = end;
  }, 20);

  return () => clearInterval(interval);
}

const TOOL_PROMPTS: Record<string, string> = {
  summarize: 'Please summarize the key points of the following study material concisely and clearly.',
  mcq: 'Generate a set of multiple choice questions with answers to test my knowledge on this topic.',
  flashcards: 'Create a set of flashcards (question/answer pairs) from this study material for revision.',
  quiz: 'Quiz me with interactive questions to test my understanding of this subject.',
  translate: 'Translate the following content between Hindi and English as needed.',
  explain: 'Explain this concept in simple, easy-to-understand terms with examples.',
  mindmap: 'Create a mind map structure or outline that visualizes the key concepts and their relationships.',
  pdf: 'I have a PDF document. Please help me analyze, summarize, and extract key information from it.',
};

const TOOL_LABELS: Record<string, string> = {
  summarize: 'Summarize',
  mcq: 'MCQ Generator',
  flashcards: 'Flashcards',
  quiz: 'Quiz Mode',
  translate: 'Translate',
  explain: 'Explain Simply',
  mindmap: 'Mind Map',
};

function MessageMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code({ className, children }) {
          const isInline = !className;
          const codeStr = String(children).replace(/\n$/, '');
          if (isInline) return <InlineCode>{children}</InlineCode>;
          const language = className?.replace('language-', '') || '';
          return <CodeBlock code={codeStr} language={language} />;
        },
        pre({ children }) { return <>{children}</>; },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

const MessageItem = memo(function MessageItem({ msg, onRetry }: { msg: Message; onRetry?: () => void }) {
  return (
    <div className={`tutor-message tutor-message-${msg.role}`}>
      <div className="tutor-message-avatar">
        {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
      </div>
      <div className="tutor-message-bubble">
        {msg.role === 'assistant' && msg.isStreaming ? (
          <div className="tutor-streaming">
            <MessageMarkdown content={msg.content} />
            <span className="tutor-cursor" />
          </div>
        ) : (
          <MessageMarkdown content={msg.content} />
        )}
        {msg.isError && onRetry && (
          <div className="tutor-retry-row">
            <button type="button" className="tutor-retry-btn" onClick={onRetry}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default function AiTutor({ onBack }: { onBack?: () => void }) {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const activeAiTool = useStore((s) => s.activeAiTool);
  const setActiveAiTool = useStore((s) => s.setActiveAiTool);
  const notes = useStore((s) => s.notes);
  // Day 9 Task 15 — the header badge previously claimed "Online" unconditionally.
  const isOffline = useStore((s) => s.isOffline);
  // Day 10 Task 1 — request-outcome signal for the badge: navigator.onLine can
  // be true while the AI service is unreachable (no internet on Wi-Fi, backend
  // down). Reset to false on a network-layer failure and back to true on the
  // next successful response, so the badge never claims "Online" mid-outage.
  const [tutorReachable, setTutorReachable] = useState(true);
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => setAuthTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [isLoaded]);
  const [messages, setMessages] = useState<Message[]>(() => {
    // Day 9 Task 7 — resume the durable conversation on mount. A brand-new (or
    // cleared) chat falls back to the greeting; transient flags never persisted.
    const persisted = useStore.getState().aiMessages;
    if (persisted.length > 0) {
      return persisted.map((m) => ({ role: m.role, content: m.content }));
    }
    return [{ role: 'assistant', content: GREETING_MESSAGE }];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [attachError, setAttachError] = useState<string | null>(null);
  // Day 9 Task 2 — the note the AI is currently working on. Explicitly chosen by
  // the user (never silently selected) and kept for the whole mounted session so
  // follow-up chat turns keep operating on the same material.
  const [noteContext, setNoteContext] = useState<Note | null>(null);
  const [showNotePicker, setShowNotePicker] = useState(false);
  const [pendingTool, setPendingTool] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isSendingRef = useRef(false);
  // Mutable mirrors so async send paths always read the CURRENT context even
  // when a setState has not committed yet (e.g. note picked → tool sent).
  const noteContextRef = useRef<Note | null>(null);
  const attachedFileRef = useRef<{ name: string; content: string } | null>(null);
  const pendingToolRef = useRef<string | null>(null);
  // Day 10 Task 1 — stream lifecycle guard. The character-reveal interval keeps
  // ticking until it finishes, so it MUST be cancelled when the component
  // unmounts (navigation) or when a new chat replaces the in-flight turn;
  // otherwise chunks keep being appended to a dead/new conversation and the
  // answer is lost. The error-bubble timeout is tracked for the same reason.
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    noteContextRef.current = noteContext;
  }, [noteContext]);
  useEffect(() => {
    attachedFileRef.current = attachedFile;
  }, [attachedFile]);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    document.body.classList.add('ai-active');
    return () => document.body.classList.remove('ai-active');
  }, []);

  useEffect(() => {
    if (chatEndRef.current && !messages.some(m => m.isStreaming)) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Day 9 Task 7 — persist the durable conversation (role + content only) as it
  // settles. In-flight streaming chunks are skipped and transient error bubbles
  // are never written, so a reload restores the real chat, not UI noise.
  useEffect(() => {
    if (messages.some((m) => m.isStreaming)) return;
    useStore.getState().setAiMessages(
      messages.filter((m) => !m.isError).map(({ role, content }) => ({ role, content }))
    );
  }, [messages]);

  // Day 10 Task 1 — on unmount (navigation / tab switch) cancel any in-flight
  // character-reveal interval and pending error bubble, then persist whatever
  // was settled so an unanswered turn is not silently lost on return.
  useEffect(() => {
    return () => {
      streamCleanupRef.current?.();
      streamCleanupRef.current = null;
      if (errorTimerRef.current) {
        clearTimeout(errorTimerRef.current);
        errorTimerRef.current = null;
      }
      useStore.getState().setAiMessages(
        messagesRef.current.map(({ role, content }) => ({ role, content }))
      );
    };
  }, []);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const root = document.documentElement;
    let previousKb = 0;
    let initialHeight = vv.height;

    const onViewportChange = () => {
      const vpHeight = vv.height;
      const winDelta = Math.max(0, window.innerHeight - vpHeight);
      const isOpen = winDelta > 100;

      if (isOpen) {
        initialHeight = Math.max(initialHeight, vpHeight);
      } else {
        initialHeight = vpHeight;
      }

      const kbHeight = isOpen ? Math.max(0, initialHeight - vpHeight) : 0;

      root.style.setProperty('--viewport-height', `${vpHeight}px`);
      root.style.setProperty('--keyboard-h', `${kbHeight}px`);
      root.classList.toggle('keyboard-open', isOpen);
      root.style.setProperty('--chat-pb', isOpen ? `${kbHeight}px` : '0px');

      if (isOpen && kbHeight !== previousKb) {
        requestAnimationFrame(() => {
          scrollToBottom();
          if (inputRef.current) {
            inputRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        });
      }

      previousKb = kbHeight;
    };

    const onFocusIn = () => {
      requestAnimationFrame(() => {
        const kbHeight = Math.max(0, window.innerHeight - vv.height);
        if (kbHeight > 100) {
          scrollToBottom();
        }
      });
    };

    const onWindowResize = () => {
      root.style.setProperty('--viewport-height', `${vv.height}px`);
    };

    onViewportChange();
    vv.addEventListener('resize', onViewportChange);
    vv.addEventListener('scroll', onViewportChange);
    window.addEventListener('focusin', onFocusIn);
    window.addEventListener('resize', onWindowResize);

    const virtualKeyboard = (navigator as NavigatorWithVirtualKeyboard).virtualKeyboard;
    if (virtualKeyboard) {
      virtualKeyboard.overlaysContent = false;
    }

    return () => {
      vv.removeEventListener('resize', onViewportChange);
      vv.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('focusin', onFocusIn);
      window.removeEventListener('resize', onWindowResize);
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--viewport-height');
      root.style.removeProperty('--keyboard-h');
      root.style.removeProperty('--chat-pb');
    };
  }, [scrollToBottom]);

  const addStreamingMessage = useCallback((content: string) => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant' && last?.isStreaming) {
        return [...prev.slice(0, -1), { ...last, content: last.content + content }];
      }
      return [...prev, { role: 'assistant', content, isStreaming: true }];
    });
    scrollToBottom();
  }, [scrollToBottom]);

  const finalizeStreaming = useCallback(() => {
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.isStreaming) {
        return [...prev.slice(0, -1), { ...last, isStreaming: false }];
      }
      return prev;
    });
    scrollToBottom();
  }, [scrollToBottom]);

  const renderErrorBubble = useCallback((content: string) => {
    addStreamingMessage('');
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      errorTimerRef.current = null;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.isStreaming) {
          return [...prev.slice(0, -1), { role: 'assistant', content, isStreaming: false, isError: true }];
        }
        return prev;
      });
      isSendingRef.current = false;
      setIsLoading(false);
    }, 100);
  }, [addStreamingMessage]);

  const runAIChat = useCallback(async (contextMessages: { role: 'user' | 'assistant' | 'system'; content: string }[]) => {
    try {
      const data = await apiFetch(API.ai.chat, {
        method: 'POST',
        body: JSON.stringify({ messages: contextMessages }),
        token: (await getToken()) ?? undefined,
        returnTo: 'ai',
        // 60s: a free-tier backend cold boot alone takes 20-50s; the default
        // 25s aborted the first message after every app open before the
        // server even finished waking up.
        timeoutMs: 60000,
      });

      if (data.success) {
        setTutorReachable(true);
        const fullResponse = data.message?.content || data.response || data.text || JSON.stringify(data);
        // Cancel any prior stream before starting a new one so a stale interval
        // can never write into a conversation it no longer belongs to.
        streamCleanupRef.current?.();
        streamCleanupRef.current = streamText(
          fullResponse,
          (chunk) => addStreamingMessage(chunk),
          () => {
            finalizeStreaming();
            streamCleanupRef.current = null;
            isSendingRef.current = false;
            setIsLoading(false);
          }
        );
      } else if (data.sessionExpired) {
        addStreamingMessage('');
        if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
        errorTimerRef.current = setTimeout(() => {
          errorTimerRef.current = null;
          setMessages(prev => {
            const last = prev[prev.length - 1];
            if (last?.isStreaming) {
              return [...prev.slice(0, -1), { role: 'assistant', content: '🔐 **Session Expired** — Your session has ended. Please sign in again to continue chatting with SnapAI.', isStreaming: false }];
            }
            return prev;
          });
          isSendingRef.current = false;
          setIsLoading(false);
        }, 100);
      } else {
        // Day 9 Task 17 — surface a cause-specific message instead of dumping
        // whatever the backend sent. A clean 4xx message is still informative
        // (e.g. "material too long"), so it is kept only for badRequest failures.
        // Day 15 — the allow-list is tightened: no file paths, stack frames,
        // source-file names, or over-long strings reach the chat bubble.
        const cleanError =
          data.error &&
          data.error.length <= 200 &&
          !/[\\/]|node_modules|allowedOrigins|at \w+\.|\b\w+\.ts\b|\b\w+\.js\b/i.test(data.error)
            ? data.error
            : null;
        const kind = classifyAiError({
          isOffline,
          status: data.status ?? null,
          retryAfterMs: data.retryAfterMs ?? null,
          message: data.error ?? null,
          timedOut: data._timedOut,
        });
        if (kind === 'network' || kind === 'timeout' || kind === 'invalidResponse') {
          setTutorReachable(false);
        }
        renderErrorBubble(
          kind === 'badRequest' && cleanError ? cleanError : aiErrorMessage(kind, data.retryAfterMs ?? null)
        );
      }
    } catch (err) {
      const errorObj = err as { message?: string } | null;
      const rawMessage = errorObj?.message || '';
      if (errorObj && (rawMessage.includes('Authentication required') || rawMessage.includes('401') || rawMessage.includes('Invalid or expired session') || rawMessage.includes('session has expired'))) {
        isSendingRef.current = false;
        setIsLoading(false);
        return;
      }

      if (rawMessage) {
        console.warn('[AiTutor] Request failed:', rawMessage);
      }

      // Day 9 Task 17 — the catch path now classifies the same way as the
      // response path, so CORS, timeouts and plain network drops each get a
      // distinct, honest message.
      const kind = classifyAiError({ isOffline, status: null, retryAfterMs: null, message: rawMessage });
      if (kind === 'network' || kind === 'timeout' || kind === 'invalidResponse') {
        setTutorReachable(false);
      }
      renderErrorBubble(aiErrorMessage(kind));
    }
  }, [addStreamingMessage, finalizeStreaming, getToken, isOffline, renderErrorBubble]);

  // Day 9 Task 2 — the request always carries the CURRENT study context (note or
  // attached file). Material is attached to the latest user message only, so the
  // full content is never duplicated across historical turns. When no note/file
  // is selected, buildContextMessages falls back to the plain user request.
  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isSendingRef.current) return;
    isSendingRef.current = true;
    pendingToolRef.current = null;
    setPendingTool(null);
    setShowNotePicker(false);
    setAttachError(null);

    setInput('');
    inputRef.current?.focus();
    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    scrollToBottom();

    const context = buildStudyContext({
      note: noteContextRef.current,
      file: attachedFileRef.current,
    });
    const contextMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      ...messages.slice(-MAX_CHAT_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
      ...buildContextMessages(context, msg),
    ];
    runAIChat(contextMessages);
  }, [input, messages, runAIChat, scrollToBottom]);

  const retryLast = useCallback(() => {
    if (isSendingRef.current) return;
    const arr = messages;
    let idx = -1;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (arr[i].role === 'user') { idx = i; break; }
    }
    if (idx === -1 || arr[arr.length - 1]?.isError !== true) return;

    const prompt = arr[idx].content;
    isSendingRef.current = true;
    setIsLoading(true);
    scrollToBottom();
    setMessages(prev => [...prev.slice(0, idx), { role: 'user', content: prompt }]);
    const context = buildStudyContext({
      note: noteContextRef.current,
      file: attachedFileRef.current,
    });
    const historyStart = Math.max(0, idx - MAX_CHAT_HISTORY_MESSAGES);
    const ctx: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      ...arr.slice(historyStart, idx).map((m) => ({ role: m.role, content: m.content })),
      ...buildContextMessages(context, prompt),
    ];
    runAIChat(ctx);
  }, [messages, runAIChat, scrollToBottom]);

  const handleSendRef = useRef(handleSend);
  const retryLastRef = useRef(retryLast);

  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  useEffect(() => {
    retryLastRef.current = retryLast;
  }, [retryLast]);

  const handleRetry = useCallback(() => {
    retryLastRef.current();
  }, []);

  // Day 9 Task 2 — a dashboard AI Study Tool now asks the user which material to
  // use instead of firing a generic prompt into the void. Material tools open the
  // note picker; the PDF tool opens the attach menu and waits for a real file.
  // The store flag is consumed synchronously; the picker/menu UI state is
  // scheduled on the next tick so the effect only synchronizes external state.
  useEffect(() => {
    if (!activeAiTool || !TOOL_PROMPTS[activeAiTool]) return;
    const tool = activeAiTool;
    setActiveAiTool(null);
    pendingToolRef.current = tool;
    queueMicrotask(() => {
      if (tool === 'pdf') {
        setPendingTool(tool);
        setShowAttachMenu(true);
      } else {
        setPendingTool(tool);
        setShowNotePicker(true);
      }
    });
  }, [activeAiTool, setActiveAiTool]);

  const handleQuickChip = (chip: typeof QUICK_CHIPS[0]) => {
    handleSend(chip.prompt);
  };

  const selectNote = (note: Note) => {
    const tool = pendingToolRef.current;
    const snapshot: Note = { ...note };
    noteContextRef.current = snapshot;
    setNoteContext(snapshot);
    setShowNotePicker(false);
    pendingToolRef.current = null;
    setPendingTool(null);
    if (tool && TOOL_PROMPTS[tool]) {
      handleSendRef.current(TOOL_PROMPTS[tool]);
    }
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setShowAttachMenu(false);
    setAttachError(null);
    try {
      let content: string;
      if (/\.pdf$/i.test(file.name)) {
        const { extractTextFromPdf } = await import('@/lib/pdf');
        content = await extractTextFromPdf(file);
      } else {
        content = await file.text();
      }
      if (!content || !content.trim()) {
        setAttachError('No readable text was found in this file. Try a .txt or .md file, or copy-paste the text.');
        return;
      }
      const nextFile = { name: file.name, content };
      attachedFileRef.current = nextFile;
      setAttachedFile(nextFile);
      if (pendingToolRef.current === 'pdf') {
        const tool = pendingToolRef.current;
        pendingToolRef.current = null;
        setPendingTool(null);
        handleSendRef.current(TOOL_PROMPTS[tool]);
      }
    } catch (err) {
      attachedFileRef.current = null;
      setAttachedFile(null);
      // Day 10 Task 8 — a password-protected PDF now throws a fixable, friendly
      // message from lib/pdf; surface it for PDFs, otherwise keep the generic
      // guidance (raw pdf.js errors are too technical to show to a student).
      const e = err as { message?: string } | null;
      const isPdf = /\.pdf$/i.test(file.name);
      const fallback = 'Could not read this file. Try a .txt or .md file, or copy-paste the text.';
      const friendly = isPdf && e?.message?.toLowerCase().includes('password')
        ? e.message
        : fallback;
      setAttachError(friendly);
    }
  };

  const clearNoteContext = () => {
    noteContextRef.current = null;
    setNoteContext(null);
  };

  // Day 9 Task 7 — start a fresh conversation: clear the persisted history and
  // reset the in-memory chat to the greeting. Attached note/file context is
  // also dropped so the new chat does not silently operate on old material.
  // Day 10 Task 1 — a running stream (or a pending error bubble) is cancelled
  // first so the old turn can never leak into the new conversation, and the
  // sending latch is reset so the input is immediately usable again.
  const handleNewChat = () => {
    streamCleanupRef.current?.();
    streamCleanupRef.current = null;
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
    isSendingRef.current = false;
    setIsLoading(false);
    useStore.getState().clearAiMessages();
    setMessages([{ role: 'assistant', content: GREETING_MESSAGE }]);
    noteContextRef.current = null;
    setNoteContext(null);
    attachedFileRef.current = null;
    setAttachedFile(null);
    pendingToolRef.current = null;
    setPendingTool(null);
  };

  const clearFileContext = () => {
    attachedFileRef.current = null;
    setAttachedFile(null);
  };

  const closeNotePicker = () => {
    setShowNotePicker(false);
    pendingToolRef.current = null;
    setPendingTool(null);
  };

  // Day 12 Tasks 2 & 4 — the note picker traps focus, closes on Escape and
  // returns focus to the trigger that opened it.
  const notePickerRef = useRef<HTMLDivElement | null>(null);
  useDialogFocus(showNotePicker, notePickerRef, closeNotePicker);

  const handleInputFocus = () => {
    setTimeout(scrollToBottom, 350);
  };

  const hasMessages = messages.length > 1;

  return (
    <div className="tutor-container" ref={containerRef}>
      <div className="tutor-header">
        <div className="tutor-header-left">
          {onBack && (
            <button className="tutor-back-btn" onClick={onBack} aria-label="Back">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="tutor-avatar">
            <Sparkles size={18} />
          </div>
          <div>
            <div className="tutor-title">SnapAI Tutor</div>
            <div className="tutor-subtitle">Your personal AI study assistant</div>
          </div>
        </div>
        <div className="tutor-header-actions">
          <button className="tutor-new-chat-btn" onClick={handleNewChat} title="Start a new chat" aria-label="Start a new chat">
            <MessageSquarePlus size={16} />
          </button>
          <div className={`tutor-status${tutorConnectionClass(isOffline, tutorReachable)}`} title={isOffline ? 'You are offline — answers may be limited' : !tutorReachable ? 'SnapAI is unreachable right now — check your internet connection' : undefined}>
            <span className="tutor-status-dot" />
            {tutorConnectionLabel(isOffline, tutorReachable)}
          </div>
        </div>
      </div>

      {!isLoaded ? (
        <div className="signin-prompt-overlay">
          <div className="signin-prompt-card auth-loading-card">
            <div className="signin-prompt-glow" />
            <div className="auth-loading-body">
              <div className="auth-loading-spinner">
                <Loader2 size={28} className="tutor-spin" />
              </div>
              <div className="auth-loading-label">Checking authentication...</div>
            </div>
          </div>
        </div>
      ) : authTimedOut ? (
        <div className="signin-prompt-overlay">
          <div className="signin-prompt-card">
            <div className="signin-prompt-glow" />
            <div className="auth-error-body">
              <div className="auth-error-icon">⚠️</div>
              <h3 className="auth-error-title">Authentication Unavailable</h3>
              <p className="auth-error-desc">
                Unable to verify your identity. Please check your network connection and try again.
              </p>
              <button
                className="signin-prompt-btn"
                onClick={() => { setAuthTimedOut(false); window.location.reload(); }}
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      ) : isSignedIn ? (
        <>
          <div className="tutor-chat" ref={chatContainerRef} role="log" aria-live="polite" aria-busy={isLoading} aria-label="Chat with SnapAI Tutor">
            {!hasMessages && (
              <div className="tutor-chips">
                {QUICK_CHIPS.map(chip => (
                  <button
                    key={chip.id}
                    className="tutor-chip"
                    onClick={() => handleQuickChip(chip)}
                    disabled={isLoading}
                    style={{ '--chip-color': chip.color } as React.CSSProperties}
                  >
                    <chip.icon size={14} />
                    {chip.label}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, idx) => (
              <MessageItem
                key={idx}
                msg={msg}
                onRetry={msg.isError && idx === messages.length - 1 ? handleRetry : undefined}
              />
            ))}
            {isLoading && !messages[messages.length - 1]?.isStreaming && (
              <div className="tutor-message tutor-message-assistant">
                <div className="tutor-message-avatar">
                  <Bot size={16} />
                </div>
                <div className="tutor-message-bubble">
                  <div className="tutor-typing" role="status" aria-live="polite" aria-label="SnapAI is typing">
                    <span className="tutor-typing-dot" />
                    <span className="tutor-typing-dot" />
                    <span className="tutor-typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Day 9 Task 2 — always-visible context bar: tells the user exactly
              which note / file the AI is working on. */}
          {(noteContext || attachedFile) && (
            <div className="tutor-context-bar">
              {noteContext && (
                <div className="tutor-attached">
                  <BookOpen size={14} />
                  <span className="tutor-attached-name">Using note: {noteContext.title || 'Untitled note'}</span>
                  <button className="tutor-attached-remove" onClick={clearNoteContext} aria-label="Remove note context">
                    <X size={14} />
                  </button>
                </div>
              )}
              {attachedFile && (
                <div className="tutor-attached">
                  <Paperclip size={14} />
                  <span className="tutor-attached-name">Attached: {attachedFile.name}</span>
                  <button className="tutor-attached-remove" onClick={clearFileContext} aria-label="Remove attached file">
                    <X size={14} />
                  </button>
                </div>
              )}
            </div>
          )}

          {attachError && <div className="tutor-attach-error">{attachError}</div>}

          <div className="tutor-input-area">
            <form
            className="tutor-input-bar"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
          >
              <button
                type="button"
                className="tutor-input-btn"
                aria-label="Attach a note or file"
                onClick={() => setShowAttachMenu(!showAttachMenu)}
              >
                <Paperclip size={20} />
              </button>
              <div className="tutor-input-wrap">
                <input
                  ref={inputRef}
                  type="text"
                  className="tutor-input"
                  placeholder="Ask your AI tutor anything..."
                  aria-label="Message the AI tutor"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onFocus={handleInputFocus}
                  disabled={isLoading}
                  autoCapitalize="off"
                  autoCorrect="off"
                  autoComplete="off"
                />
              </div>
              <button
                type="button"
                className="tutor-input-btn"
                title="Voice input"
                aria-label="Use voice input"
                onClick={() => {
                  const SpeechRecognition = getSpeechRecognitionCtor();
                  if (SpeechRecognition) {
                    const recognition = new SpeechRecognition();
                    recognition.lang = 'en-US';
                    recognition.interimResults = false;
                    recognition.onresult = (event) => {
                      const transcript = event.results[0][0].transcript;
                      setInput(prev => prev + transcript);
                    };
                    recognition.start();
                  } else {
                    notifyError('Speech recognition is not supported in this browser.');
                  }
                }}
              >
                <Mic size={20} />
              </button>
              <button
                type="submit"
                className="tutor-send-btn"
                aria-label="Send message"
                disabled={!input.trim() || isLoading}
              >
                {isLoading ? <Loader2 size={20} className="tutor-spin" /> : <Send size={20} />}
              </button>
          </form>

            {showAttachMenu && (
              <div className="tutor-attach-menu">
                <button className="tutor-attach-option" onClick={() => { setShowAttachMenu(false); setShowNotePicker(true); }}>
                  <BookOpen size={16} />
                  Attach a note
                </button>
                <button className="tutor-attach-option" onClick={() => fileInputRef.current?.click()}>
                  <Paperclip size={16} />
                  Upload PDF or Text
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.txt,.md,.json,.csv,.py,.js,.ts,.jsx,.tsx,.html,.css"
                  style={{ display: 'none' }}
                  onChange={handleAttachFile}
                />
              </div>
            )}
          </div>

          {/* Day 9 Task 2 — explicit note selection. Never auto-picks a note. */}
          {showNotePicker && (
            <div ref={notePickerRef} className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="note-picker-title" onClick={closeNotePicker}>
              <div className="modal-content tutor-note-picker-modal" onClick={(e) => e.stopPropagation()}>
                <h3 id="note-picker-title" style={{ fontSize: '16px', fontWeight: 700 }}>
                  {pendingTool ? `Select a note for ${TOOL_LABELS[pendingTool] || 'the AI'}` : 'Attach a note'}
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', marginTop: '4px' }}>
                  Only the note you pick is sent to the AI — never your other notes.
                </p>
                {notes.length === 0 ? (
                  <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginTop: '12px' }}>
                    You don&apos;t have any notes yet. Create a note first.
                  </p>
                ) : (
                  <div className="tutor-note-picker">
                    {notes.map((note) => (
                      <button key={note.id} className="tutor-note-picker-item" onClick={() => selectNote(note)}>
                        <BookOpen size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                        <span style={{ minWidth: 0 }}>
                          <span className="tutor-note-picker-title">{note.title || 'Untitled note'}</span>
                          <span className="tutor-note-picker-snippet">{stripHtml(note.content).substring(0, 80) || 'No content yet'}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button type="button" className="md3-btn md3-btn-text" onClick={closeNotePicker}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <SignInPrompt />
      )}
    </div>
  );
}
