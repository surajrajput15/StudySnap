'use client';

import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useStore } from '@/lib/store/useStore';
import { API, apiFetch } from '@/lib/config';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  Sparkles, Send, Paperclip, Mic, Bot, User, BookOpen,
  FileText, LayoutGrid, HelpCircle, Languages, Lightbulb,
  Copy, Check, X, Loader2,
  ArrowLeft
} from 'lucide-react';
import SignInPrompt from '@/components/SignInPrompt';
import { getSpeechRecognitionCtor } from '@/lib/speech';

const QUICK_CHIPS = [
  { id: 'explain', label: 'Explain', icon: BookOpen, color: '#3B82F6', prompt: 'Explain this concept in simple terms with examples.' },
  { id: 'summarize', label: 'Summarize', icon: FileText, color: '#10B981', prompt: 'Summarize the key points concisely.' },
  { id: 'flashcards', label: 'Flashcards', icon: LayoutGrid, color: '#8B5CF6', prompt: 'Create a set of flashcards from this content.' },
  { id: 'quiz', label: 'Quiz Me', icon: HelpCircle, color: '#F59E0B', prompt: 'Quiz me with questions to test my understanding.' },
  { id: 'translate', label: 'Translate', icon: Languages, color: '#EC4899', prompt: 'Translate this content.' },
  { id: 'solve', label: 'Solve Doubts', icon: Lightbulb, color: '#06B6D4', prompt: 'Help me solve my doubts about this topic.' },
];

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
  const [authTimedOut, setAuthTimedOut] = useState(false);

  useEffect(() => {
    if (isLoaded) return;
    const timer = setTimeout(() => setAuthTimedOut(true), 10000);
    return () => clearTimeout(timer);
  }, [isLoaded]);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: '👋 Hi! I\'m your AI Tutor. Ask me anything about your studies, or try one of the quick actions below!' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isSendingRef = useRef(false);

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
    setTimeout(() => {
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

  const runAIChat = useCallback(async (contextMessages: { role: 'user' | 'assistant'; content: string }[]) => {
    try {
      const data = await apiFetch(API.ai.chat, {
        method: 'POST',
        body: JSON.stringify({ messages: contextMessages }),
        token: (await getToken()) ?? undefined,
        returnTo: 'ai',
      });

      if (data.success) {
        const fullResponse = data.message?.content || data.response || data.text || JSON.stringify(data);
        streamText(
          fullResponse,
          (chunk) => addStreamingMessage(chunk),
          () => {
            finalizeStreaming();
            isSendingRef.current = false;
            setIsLoading(false);
          }
        );
      } else if (data.sessionExpired) {
        addStreamingMessage('');
        setTimeout(() => {
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
        renderErrorBubble(data.error && !/BACKEND|node_modules|allowedOrigins/i.test(data.error) ? data.error : 'Failed to get a response. Please try again.');
      }
    } catch (err) {
      const errorObj = err as { message?: string } | null;
      const rawMessage = errorObj?.message || '';
      if (errorObj && (rawMessage.includes('Authentication required') || rawMessage.includes('401') || rawMessage.includes('Invalid or expired session') || rawMessage.includes('session has expired'))) {
        isSendingRef.current = false;
        setIsLoading(false);
        return;
      }

      const msg = rawMessage || 'The AI could not respond. Please try again.';
      const isCorsError = msg.includes('CORS') || msg.includes('cross-origin');
      const isTimeout = msg.includes('timeout') || msg.includes('timed out');

      if (msg) {
        console.warn('[AiTutor] Request failed:', msg);
      }

      let userMessage: string;
      if (isCorsError) {
        userMessage = `🔴 **Connection issue** — We couldn't reach the AI service securely.\n\n` +
          `Please try again in a moment. If the problem persists, contact support.`;
      } else if (isTimeout) {
        userMessage = `⏱️ **Request Timeout** — The AI took too long to respond.\n\n` +
          `Try asking a shorter or simpler question. The AI model may be under load.`;
      } else {
        userMessage = `⚠️ **Something went wrong** — We couldn't generate an AI response.\n\nPlease try again or rephrase your question.`;
      }
      renderErrorBubble(userMessage);
    }
  }, [addStreamingMessage, finalizeStreaming, getToken, renderErrorBubble]);

  const handleSend = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || isSendingRef.current) return;
    isSendingRef.current = true;

    setInput('');
    setAttachedFile(null);
    inputRef.current?.focus();
    const userMsg: Message = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);
    scrollToBottom();

    const contextMessages = [...messages, userMsg].map(m => ({
      role: m.role,
      content: m.content
    }));
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
    const ctx = arr.slice(0, idx).map(m => ({ role: m.role, content: m.content })).concat([{ role: 'user' as const, content: prompt }]);
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

  useEffect(() => {
    if (activeAiTool && TOOL_PROMPTS[activeAiTool]) {
      handleSendRef.current(TOOL_PROMPTS[activeAiTool]);
      setActiveAiTool(null);
    }
  }, [activeAiTool, setActiveAiTool]);

  const handleQuickChip = (chip: typeof QUICK_CHIPS[0]) => {
    handleSend(chip.prompt);
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setAttachedFile({ name: file.name, content: text.slice(0, 5000) });
    setShowAttachMenu(false);
  };

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
        <div className="tutor-status">
          <span className="tutor-status-dot" />
          Online
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

          {hasMessages && attachedFile && (
            <div className="tutor-attached">
              <Paperclip size={14} />
              <span className="tutor-attached-name">{attachedFile.name}</span>
              <button className="tutor-attached-remove" onClick={() => setAttachedFile(null)} aria-label="Remove attached file">
                <X size={14} />
              </button>
            </div>
          )}

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
                aria-label="Attach a file"
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
                    alert('Speech recognition is not supported in this browser.');
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
        </>
      ) : (
        <SignInPrompt />
      )}
    </div>
  );
}
