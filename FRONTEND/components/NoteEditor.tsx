'use client';

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { useStore, getStoreScopeKey } from '@/lib/store/useStore';
import DOMPurify from 'dompurify';
import {
  ArrowLeft, Pin, Star, Lock, Unlock, Download, Upload,
  Volume2, VolumeX, Mic, MicOff, Tag, FolderOpen, RefreshCw,
  Bold, Italic, Underline, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Code, Table2, Image, Sigma,
  Undo2, Redo2, Sparkles, Send, X
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import confetti from 'canvas-confetti';
import { SpeechRecognition, SpeechRecognitionEvent, SpeechRecognitionErrorEvent } from '@/lib/speech';
import { PIN_LENGTH } from '@/lib/constants';
import { stripHtml } from '@/lib/utils';
import { buildStudyContext, buildContextMessages } from '@/lib/ai';
import { API, apiFetch } from '@/lib/config';
import { useAuth } from '@clerk/nextjs';
import { hashPinClient } from '@/lib/pin';
import { upsertRemoteNote } from '@/lib/sync/notesSync';

interface NoteEditorProps {
  noteId: string | null;
  onBack: () => void;
}

const TABLE_SIZES = [3, 4, 5, 6, 7, 8];

function generateTableHtml(rows: number, cols: number): string {
  let html = '<div class="editor-table-wrapper"><table class="editor-table"><thead><tr>';
  for (let c = 0; c < cols; c++) html += '<th></th>';
  html += '</tr></thead><tbody>';
  for (let r = 0; r < rows; r++) {
    html += '<tr>';
    for (let c = 0; c < cols; c++) html += '<td></td>';
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

function insertAtCursor(html: string) {
  const sel = window.getSelection();
  if (sel && sel.rangeCount > 0) {
    const range = sel.getRangeAt(0);
    const fragment = range.createContextualFragment(html);
    range.deleteContents();
    range.insertNode(fragment);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function execFormat(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

// The contentEditable host lives here, memoized so React never re-renders it
// during ordinary typing. Its props are stable callbacks that read refs, so
// the browser owns the DOM and caret; React only updates this subtree for
// programmatic operations (initial load, note switch, undo/redo, inserts).
interface EditorAreaProps {
  onInput: (e: React.FormEvent<HTMLDivElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onCompositionStart: () => void;
  onCompositionEnd: () => void;
}

const EditorArea = React.memo(
  React.forwardRef<HTMLDivElement, EditorAreaProps>(function EditorArea(
    { onInput, onKeyDown, onCompositionStart, onCompositionEnd },
    ref
  ) {
    return (
      <div
        ref={ref}
        className="editor-content"
        contentEditable
        suppressContentEditableWarning
        onInput={onInput}
        onKeyDown={onKeyDown}
        onCompositionStart={onCompositionStart}
        onCompositionEnd={onCompositionEnd}
      />
    );
  })
);

interface ToolbarItem {
  type?: 'divider';
  icon?: LucideIcon;
  label?: string;
  shortcut?: string;
  action?: () => void;
}

function EditorToolbarItems({ items }: { items: ToolbarItem[] }) {
  return (
    <>
      {items.map((item, i) => {
        if (item.type === 'divider') {
          return <span key={i} className="editor-toolbar-divider" />;
        }
        if (item.icon && item.action) {
          const Icon = item.icon;
          return (
            <button key={i} onClick={item.action} className="editor-toolbar-btn" title={item.label} aria-label={item.label}>
              <Icon size={15} />
            </button>
          );
        }
        return null;
      })}
    </>
  );
}

export default function NoteEditor({ noteId, onBack }: NoteEditorProps) {
  return <NoteEditorInner key={noteId ?? 'new'} noteId={noteId} onBack={onBack} />;
}

function NoteEditorInner({ noteId, onBack }: NoteEditorProps) {
  const { getToken } = useAuth();
  const notes = useStore((s) => s.notes);
  const categories = useStore((s) => s.categories);
  const folders = useStore((s) => s.folders);
  const addNote = useStore((s) => s.addNote);
  const updateNote = useStore((s) => s.updateNote);

  const isNew = !noteId;
  const activeNote = notes.find(n => n.id === noteId);

  const [title, setTitle] = useState(activeNote ? activeNote.title : '');
  const [content, setContent] = useState(activeNote ? activeNote.content : '');
  const [tags, setTags] = useState<string[]>(activeNote ? activeNote.tags : []);
  const [tagInput, setTagInput] = useState('');
  const [categoryId, setCategoryId] = useState<string>(activeNote?.categoryId || '');
  const [folderId, setFolderId] = useState<string>(activeNote?.folderId || '');
  const [isPinned, setIsPinned] = useState(activeNote ? activeNote.isPinned : false);
  const [isFavorite, setIsFavorite] = useState(activeNote ? activeNote.isFavorite : false);
  const [pinLock, setPinLock] = useState<string | null>(activeNote?.pinLock ?? null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [isPinSetting, setIsPinSetting] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Identity/scope of the active dictation session. onresult only mutates the
  // note while the session is active, still mounted, and still in the same
  // account/store scope — a stale session is stopped and dropped instead of
  // writing into another note or another account.
  const dictationRef = useRef<{ active: boolean; noteId: string | null; scopeKey: string }>({
    active: false,
    noteId,
    scopeKey: getStoreScopeKey(),
  });

  const editorRef = useRef<HTMLDivElement>(null);
  const initialContentRef = useRef<string>(activeNote?.content ?? '');

  // Day 7 — Account-scope guard. Captured once when this editor instance is
  // mounted: this editor may ONLY persist into the store scope that existed at
  // mount time. It is intentionally immutable — an account/store-scope change
  // under this editor (or its unmount/pagehide/beforeunload cleanup) must never
  // rewrite the captured scope, or a stale draft could leak across accounts.
  const scopeGuardRef = useRef<string>(getStoreScopeKey());

  // Mutable editor state lives behind refs so a keystroke never schedules a
  // render. Access is limited to event handlers and effects; the React Compiler
  // mutability rule is disabled above for this file because the editor must own
  // its DOM caret and content while typing.
  const historyStore = useRef<{ stack: string[]; index: number }>({ stack: [], index: -1 });
  const contentStore = useRef<{ html: string }>({ html: activeNote?.content ?? '' });
  const composingState = useRef<{ on: boolean }>({ on: false });
  const saveStatusState = useRef<{ s: 'saved' | 'saving' | 'unsaved' }>({ s: 'saved' });
  // Stable handler reference for the speech effect, which is registered before
  // the input handler is (re)declared further down in this render body.
  const editorChangeRef = useRef<() => void>(() => {});

  // Initialize the contentEditable DOM once when the note/draft is opened. The
  // element is DOM-owned while typing afterwards, so state is never pushed back
  // into it. This is the ONLY non-programmatic innerHTML write.
  useLayoutEffect(() => {
    if (!editorRef.current) return;
    const initial = DOMPurify.sanitize(initialContentRef.current) || '<p><br></p>';
    editorRef.current.innerHTML = initial;
    contentStore.current.html = initial;
    historyStore.current.stack = [initial];
    historyStore.current.index = 0;
  }, [noteId, contentStore, historyStore]);

  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  // Day 9 Task 2 — any text the user had selected inside the editor when they
  // opened the AI assistant becomes the primary AI context (full note otherwise).
  const [selectedText, setSelectedText] = useState('');

  // Capture the editor selection before the FAB click moves focus away. The
  // selection is only used when it lives inside the editor; otherwise SnapAI
  // falls back to the full note content.
  const captureSelection = useCallback(() => {
    const sel = window.getSelection();
    if (
      sel &&
      sel.rangeCount > 0 &&
      sel.anchorNode &&
      editorRef.current &&
      editorRef.current.contains(sel.anchorNode)
    ) {
      setSelectedText(sel.toString().trim());
    } else {
      setSelectedText('');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      synthRef.current = window.speechSynthesis;
    }
    return () => { if (synthRef.current) synthRef.current.cancel(); };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const speechCtor = window as unknown as {
        SpeechRecognition?: new () => SpeechRecognition;
        webkitSpeechRecognition?: new () => SpeechRecognition;
      };
      const SpeechRecognitionCtor = speechCtor.SpeechRecognition || speechCtor.webkitSpeechRecognition;
      if (SpeechRecognitionCtor) {
        const rec = new SpeechRecognitionCtor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = 'en-US';
        rec.onstart = () => setIsListening(true);
        rec.onresult = (event: SpeechRecognitionEvent) => {
          const session = dictationRef.current;
          if (!session.active) return;
          // Account/store scope check — never insert stale dictation into a
          // note that now belongs to another account (or the guest scope).
          if (session.scopeKey !== getStoreScopeKey()) {
            session.active = false;
            try { rec.stop(); } catch { /* ignore */ }
            try { rec.abort?.(); } catch { /* ignore */ }
            setIsListening(false);
            return;
          }
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i][0].transcript) finalTranscript += event.results[i][0].transcript;
          }
          // Editor must still be mounted. The same-note guarantee is structural:
          // NoteEditorInner is remounted per noteId (React key), so this session's
          // recognition instance can only ever target this note.
          if (!finalTranscript || !editorRef.current) return;
          editorRef.current.focus();
          insertAtCursor(finalTranscript + ' ');
          editorChangeRef.current();
        };
        rec.onerror = (e: SpeechRecognitionErrorEvent) => {
          console.error("STT Error:", e.error);
          dictationRef.current.active = false;
          setIsListening(false);
        };
        rec.onend = () => { dictationRef.current.active = false; setIsListening(false); };
        recognitionRef.current = rec;
        return () => {
          // Deterministic teardown on unmount: never let a live recognition
          // session keep mutating a note after the editor leaves the screen.
          dictationRef.current.active = false;
          const instance = recognitionRef.current;
          recognitionRef.current = null;
          if (instance) {
            try { instance.stop(); } catch { /* ignore */ }
            try { instance.abort?.(); } catch { /* ignore */ }
          }
        };
      }
    }
  }, []);

  // Stable identity for an unsaved draft so the debounced autosave can never
  // create a second copy of the same note (it only ever fires once per draft).
  const draftIdRef = useRef<string | null>(null);

  // Latest editor values accessible from cleanup/leave handlers.
  const editorStateRef = useRef<{ title: string; content: string; tags: string[]; categoryId: string; folderId: string; isPinned: boolean; isFavorite: boolean; pinLock: string | null; isNew: boolean; noteId: string | null }>({
    title, content, tags, categoryId, folderId, isPinned, isFavorite, pinLock, isNew, noteId,
  });

  // Persist the latest editor state immediately (used by the debounce and by
  // leave/reload handlers so no edits are ever silently dropped).
  const persistNow = useCallback(() => {
    // Day 7 — Account-scope guard: an editor instance may only persist into the
    // account store scope that existed when it was mounted. When the current
    // scope differs (an account switch changed the store while this editor was
    // alive, or its unmount/pagehide/beforeunload cleanup fires after the scope
    // already moved to another account), abort BEFORE any persistence: no
    // Zustand mutation, no localStorage write, and no remote upsert — a stale
    // draft from Account A must never land in Account B's store/storage or be
    // sent with Account B's authentication.
    if (getStoreScopeKey() !== scopeGuardRef.current) return false;
    const s = editorStateRef.current;
    if (s.isNew && !s.title.trim() && !s.content.trim() && s.tags.length === 0) {
      return; // empty draft — do not create a note
    }
    const payload = {
      title: s.title || 'Untitled Note',
      content: s.content,
      tags: s.tags,
      categoryId: s.categoryId || null,
      folderId: s.folderId || null,
      isPinned: s.isPinned,
      isFavorite: s.isFavorite,
      pinLock: s.pinLock,
    };
    let savedId: string;
    if (s.isNew) {
      if (!draftIdRef.current) {
        draftIdRef.current = crypto.randomUUID();
        addNote({ id: draftIdRef.current, ...payload });
      } else {
        updateNote(draftIdRef.current, payload);
      }
      savedId = draftIdRef.current;
    } else if (s.noteId) {
      updateNote(s.noteId, payload);
      savedId = s.noteId;
    } else {
      return;
    }
    // Day 5 — fire-and-forget remote upsert. Local saving never depends on the
    // network; the sync layer ignores failures and keeps local data intact.
    const savedNote = useStore.getState().notes.find((n) => n.id === savedId);
    if (savedNote) {
      void upsertRemoteNote(savedNote, () => getToken());
    }
    return true;
  }, [addNote, updateNote, getToken]);

  const persistNowRef = useRef(persistNow);

  // Keep leave/flush handlers in sync with the latest editor values after every
  // commit (refs are not written during render).
  useEffect(() => {
    editorStateRef.current = { title, content, tags, categoryId, folderId, isPinned, isFavorite, pinLock, isNew, noteId };
    persistNowRef.current = persistNow;
  });

  // Flush pending edits when this editor is unmounted (navigating away, or
  // switching to a different note).
  useEffect(() => {
    return () => { persistNowRef.current(); };
  }, []);

  // Flush pending edits on page hide/unload too — React unmount does not run
  // during a full browser reload or tab close.
  useEffect(() => {
    const flushOnHide = () => persistNowRef.current();
    window.addEventListener('pagehide', flushOnHide);
    window.addEventListener('beforeunload', flushOnHide);
    return () => {
      window.removeEventListener('pagehide', flushOnHide);
      window.removeEventListener('beforeunload', flushOnHide);
    };
  }, []);

  // Debounced autosave
  useEffect(() => {
    if (isNew && !title.trim() && !content.trim()) return;
    const timer = setTimeout(() => {
      if (saveStatusState.current.s !== 'unsaved') return;
      saveStatusState.current.s = 'saving';
      setSaveStatus('saving');
      persistNow();
      saveStatusState.current.s = 'saved';
      setSaveStatus('saved');
    }, 1500);
    return () => clearTimeout(timer);
  }, [title, content, tags, categoryId, folderId, isPinned, isFavorite, pinLock, isNew, persistNow, saveStatusState]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (showTablePicker) setShowTablePicker(false);
      if (showAiAssistant) setShowAiAssistant(false);
      if (showPinModal) setShowPinModal(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showTablePicker, showAiAssistant, showPinModal]);

  const recordSnapshot = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const stack = historyStore.current.stack;
    stack.length = historyStore.current.index + 1;
    stack.push(el.innerHTML);
    if (stack.length > 50) stack.shift();
    historyStore.current.index = stack.length - 1;
  }, [historyStore]);

  const markDirty = useCallback(() => {
    if (saveStatusState.current.s === 'unsaved') return;
    saveStatusState.current.s = 'unsaved';
    setSaveStatus('unsaved');
  }, [saveStatusState]);

  // Programmatic write (undo/redo/import/inserts). Rare and intentional:
  // rewrites innerHTML, then restores focus + caret so typing can continue.
  const applyEditorHtml = useCallback((html: string) => {
    const el = editorRef.current;
    if (!el) return;
    const safe = DOMPurify.sanitize(html);
    el.innerHTML = safe;
    placeCaretAtEnd(el);
    contentStore.current.html = safe;
    setContent(safe);
  }, [contentStore]);

  const handleUndo = useCallback(() => {
    const stack = historyStore.current.stack;
    if (historyStore.current.index <= 0) return;
    historyStore.current.index -= 1;
    applyEditorHtml(stack[historyStore.current.index]);
    markDirty();
  }, [applyEditorHtml, markDirty, historyStore]);

  const handleRedo = useCallback(() => {
    const stack = historyStore.current.stack;
    if (historyStore.current.index >= stack.length - 1) return;
    historyStore.current.index += 1;
    applyEditorHtml(stack[historyStore.current.index]);
    markDirty();
  }, [applyEditorHtml, markDirty, historyStore]);

  // Ordinary typing path. The browser has already committed the mutation; we
  // only mirror the authoritative DOM into state/refs for autosave and undo.
  // Nothing here writes back to the editor (EditorArea is memoized off).
  const handleEditorInputChange = useCallback((e?: React.FormEvent<HTMLDivElement>) => {
    const native = e?.nativeEvent as InputEvent | undefined;
    if (composingState.current.on || (native && 'isComposing' in native && native.isComposing)) {
      return; // flush once at composition end so we never mirror a half-typed glyph
    }
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    if (html !== contentStore.current.html) {
      contentStore.current.html = html;
      setContent(html);
    }
    markDirty();
    recordSnapshot();
  }, [markDirty, recordSnapshot, composingState, contentStore]);

  const handleEditorCompositionStart = useCallback(() => {
    composingState.current.on = true;
  }, [composingState]);

  const handleEditorCompositionEnd = useCallback(() => {
    composingState.current.on = false;
    handleEditorInputChange();
  }, [handleEditorInputChange, composingState]);

  const insertCodeBlock = useCallback((lang: string) => {
    const html = `<div class="editor-code-block"><div class="editor-code-header"><span>${lang}</span><button class="editor-code-copy" onclick="(function(btn){var code=btn.parentElement.nextElementSibling.textContent;navigator.clipboard.writeText(code);btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},2000);})(this)">Copy</button></div><pre><code class="language-${lang}"> </code></pre></div>`;
    insertAtCursor(html);
    handleEditorInputChange();
  }, [handleEditorInputChange]);

  useEffect(() => {
    editorChangeRef.current = handleEditorInputChange;
  }, [handleEditorInputChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing) return; // never run markdown shortcuts mid-composition
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z')) {
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
      return;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      execFormat('insertHTML', '    ');
    }
    if (e.key === 'Enter') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer;
        if (node.parentElement?.closest('li')) return;
        if (node.parentElement?.closest('pre')) return;
        const parentBlock = node.parentElement?.closest('p,h1,h2,h3,h4,blockquote') as HTMLElement;
        if (parentBlock) {
          const text = parentBlock.textContent || '';
          if (text === '') {
            e.preventDefault();
            execFormat('formatBlock', '<p>');
            return;
          }
        }
      }
    }
    if (e.key === ' ') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const node = sel.getRangeAt(0).startContainer;
        const text = node.textContent || '';
        const beforeCaret = text.substring(0, sel.getRangeAt(0).startOffset);
        if (beforeCaret.trim() === '#') {
          e.preventDefault();
          execFormat('formatBlock', '<h1>');
          if (editorRef.current) {
            const textNode = editorRef.current.querySelector('h1');
            if (textNode) textNode.textContent = '';
          }
        } else if (beforeCaret.trim() === '##') {
          e.preventDefault();
          execFormat('formatBlock', '<h2>');
          if (editorRef.current) {
            const textNode = editorRef.current.querySelector('h2');
            if (textNode) textNode.textContent = '';
          }
        } else if (beforeCaret.trim() === '###') {
          e.preventDefault();
          execFormat('formatBlock', '<h3>');
          if (editorRef.current) {
            const textNode = editorRef.current.querySelector('h3');
            if (textNode) textNode.textContent = '';
          }
        } else if (beforeCaret.trim() === '>') {
          e.preventDefault();
          execFormat('formatBlock', '<blockquote>');
          if (editorRef.current) {
            const blockq = editorRef.current.querySelector('blockquote');
            if (blockq) blockq.textContent = '';
          }
        } else if (beforeCaret.trim() === '- ' || beforeCaret.trim() === '* ') {
          e.preventDefault();
          execFormat('insertUnorderedList');
          if (editorRef.current) {
            const li = editorRef.current.querySelector('li:last-child');
            if (li) li.textContent = '';
          }
        } else if (beforeCaret.trim() === '1. ') {
          e.preventDefault();
          execFormat('insertOrderedList');
          if (editorRef.current) {
            const li = editorRef.current.querySelector('li:last-child');
            if (li) li.textContent = '';
          }
        } else if (beforeCaret.endsWith('```')) {
          e.preventDefault();
          insertCodeBlock('javascript');
        }
      }
    }
  }, [handleRedo, handleUndo, insertCodeBlock]);

  const insertTable = () => {
    const html = generateTableHtml(tableRows, tableCols);
    insertAtCursor(html);
    setShowTablePicker(false);
    handleEditorInputChange();
  };

  const insertImage = () => {
    const url = prompt('Paste image URL:');
    if (url) {
      const sanitizedUrl = url.replace(/^javascript:/i, '').replace(/<[^>]*>/g, '');
      const fileName = sanitizedUrl.split('/').pop()?.replace(/[?#].*$/, '').split('.')[0] || '';
      const html = `<figure class="editor-image-block"><img src="${sanitizedUrl}" alt="${fileName}" loading="lazy" /><figcaption>Image</figcaption></figure>`;
      insertAtCursor(html);
      handleEditorInputChange();
    }
  };

  const insertMath = () => {
    const expr = prompt('Enter math expression (e.g., E = mc²):');
    if (expr) {
      const html = `<span class="editor-math-inline" contenteditable="false">📐 ${expr}</span>`;
      insertAtCursor(html + ' ');
      handleEditorInputChange();
    }
  };

  const handleListenNote = () => {
    if (!synthRef.current) return;
    if (isSpeaking) {
      if (isPaused) { synthRef.current.resume(); setIsPaused(false); }
      else { synthRef.current.pause(); setIsPaused(true); }
      return;
    }
    const textToRead = stripHtml(content);
    if (!textToRead.trim()) return;
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); };
    utterance.onerror = () => { setIsSpeaking(false); setIsPaused(false); };
    utteranceRef.current = utterance;
    setIsSpeaking(true); setIsPaused(false);
    synthRef.current.speak(utterance);
  };

  const handleStopListeningVoice = () => {
    if (synthRef.current) synthRef.current.cancel();
    setIsSpeaking(false); setIsPaused(false);
  };

  const handleDictateSpeech = () => {
    if (!recognitionRef.current) {
      alert("Speech Recognition API is not supported in this browser. Try Chrome/Safari.");
      return;
    }
    if (isListening) {
      dictationRef.current.active = false;
      try { recognitionRef.current.stop(); } catch { /* ignore */ }
      try { recognitionRef.current.abort?.(); } catch { /* ignore */ }
    } else {
      // Pin the session to this note and store scope so late recognition
      // results can be verified before any edit is inserted.
      dictationRef.current = { active: true, noteId, scopeKey: getStoreScopeKey() };
      recognitionRef.current.start();
    }
  };

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim().toLowerCase())) {
        setTags([...tags, tagInput.trim().toLowerCase()]);
        setSaveStatus('unsaved');
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
    setSaveStatus('unsaved');
  };

  const handleLockToggle = () => {
    if (pinLock) { setPinLock(null); confetti({ particleCount: 30, colors: ['#a0c9ff'] }); }
    else { setShowPinModal(true); setPinCode(''); }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode.length !== PIN_LENGTH || isPinSetting) return;
    // Store a salted hash (never the raw PIN) so a leaked localStorage dump
    // cannot expose the PIN in plaintext.
    setIsPinSetting(true);
    try {
      const storedPin = await hashPinClient(pinCode);
      setPinLock(storedPin);
      setShowPinModal(false);
      confetti({ particleCount: 50, colors: ['#0061A4'] });
    } finally {
      setIsPinSetting(false);
    }
  };

  const handleExportPDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(0, 97, 164);
    doc.text(title || "Untitled Note", 20, 20);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const catName = categories.find(c => c.id === categoryId)?.name || 'General';
    const folderName = folders.find(f => f.id === folderId)?.name || 'Root';
    doc.text(`Subject: ${catName}   |   Folder: ${folderName}`, 20, 28);
    doc.text(`Tags: ${tags.length > 0 ? tags.map(t => `#${t}`).join(', ') : 'None'}`, 20, 33);
    doc.setDrawColor(0, 97, 164);
    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    const textContent = content.replace(/<[^>]*>/g, '\n').replace(/\n\s*\n/g, '\n');
    const splitText = doc.splitTextToSize(textContent || "No text content.", 170);
    doc.text(splitText, 20, 48);
    doc.save(`${title || 'study-note'}.pdf`);
    confetti({ particleCount: 40, colors: ['#10B981'] });
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const fileTitle = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
      setTitle(fileTitle);
      const escaped = text.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>').replace(/`(.+?)`/g, '<code>$1</code>');
      const html = `<p>${escaped}</p>`;
      const safeHtml = DOMPurify.sanitize(html);
      setContent(safeHtml);
      if (editorRef.current) {
        editorRef.current.innerHTML = safeHtml;
        handleEditorInputChange();
      } else {
        contentStore.current.html = safeHtml;
        markDirty();
      }
      confetti({ particleCount: 50, colors: ['#0061A4'] });
    };
    reader.readAsText(file);
  };

  const handleAiAssist = async () => {
    if (!aiPrompt.trim() || isAiLoading) return;
    // Day 9 Task 2 — SnapAI now works on the student's actual material: selected
    // text when present, otherwise the full note content. The editor DOM is the
    // authoritative source (state only mirrors it). Nothing is sent when there
    // is no material to process.
    const editorText = editorRef.current
      ? ((editorRef.current as HTMLElement).innerText || editorRef.current.textContent || '').trim()
      : '';
    const noteText = (selectedText || editorText || stripHtml(content)).trim();
    if (!noteText) {
      setAiResponse('Add some content to your note first, then ask SnapAI.');
      return;
    }
    setIsAiLoading(true);
    setAiResponse('');
    try {
      const context = buildStudyContext({ note: { title: title || activeNote?.title, content: noteText } });
      const contextMessages = buildContextMessages(context, aiPrompt.trim());
      const data = await apiFetch(API.ai.chat, {
        method: 'POST',
        body: JSON.stringify({ messages: contextMessages }),
        token: (await getToken()) ?? undefined,
      });
      if (data.success) {
        const text = (data.message?.content) || (data as { response?: string }).response || (data as { text?: string }).text || '';
        setAiResponse(text);
      } else if (data.sessionExpired) {
        setAiResponse('Your session has expired. Please sign in again.');
      } else {
        setAiResponse('AI response failed. Try again.');
      }
    } catch {
      setAiResponse('AI response failed. Try again.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const insertAiResponse = () => {
    if (aiResponse) {
      const html = aiResponse.replace(/\n/g, '<br>');
      insertAtCursor(DOMPurify.sanitize(`<p>${html}</p>`));
      handleEditorInputChange();
      setShowAiAssistant(false);
      setAiPrompt('');
      setAiResponse('');
    }
  };

  const toolbarItems: ToolbarItem[] = [
    { icon: Undo2, action: handleUndo, label: 'Undo' },
    { icon: Redo2, action: handleRedo, label: 'Redo' },
    { type: 'divider' },
    { icon: Bold, action: () => execFormat('bold'), label: 'Bold', shortcut: '**' },
    { icon: Italic, action: () => execFormat('italic'), label: 'Italic', shortcut: '*' },
    { icon: Underline, action: () => execFormat('underline'), label: 'Underline' },
    { icon: Strikethrough, action: () => execFormat('strikeThrough'), label: 'Strikethrough' },
    { type: 'divider' },
    { icon: Heading1, action: () => execFormat('formatBlock', '<h1>'), label: 'Heading 1' },
    { icon: Heading2, action: () => execFormat('formatBlock', '<h2>'), label: 'Heading 2' },
    { icon: Heading3, action: () => execFormat('formatBlock', '<h3>'), label: 'Heading 3' },
    { type: 'divider' },
    { icon: List, action: () => execFormat('insertUnorderedList'), label: 'Bullet List' },
    { icon: ListOrdered, action: () => execFormat('insertOrderedList'), label: 'Numbered List' },
    { icon: Quote, action: () => execFormat('formatBlock', '<blockquote>'), label: 'Quote' },
    { icon: Code, action: () => insertCodeBlock('javascript'), label: 'Code Block' },
    { type: 'divider' },
    { icon: Sigma, action: insertMath, label: 'Math' },
    { icon: Table2, action: () => setShowTablePicker(!showTablePicker), label: 'Table' },
    { icon: Image, action: insertImage, label: 'Image' },
  ];

  return (
    <div className="editor-container">
      {/* ─── Toolbar ─── */}
      <div className="editor-toolbar-wrapper">
        <div className="editor-toolbar">
          <div className="editor-toolbar-left">
            <button onClick={onBack} className="editor-toolbar-back" aria-label="Back to notes">
              <ArrowLeft size={16} />
            </button>
            <span className="editor-toolbar-divider" />
            <EditorToolbarItems items={toolbarItems} />
          </div>
          <div className="editor-toolbar-right">
            <span className="editor-save-status" style={{ color: saveStatus === 'saved' ? '#10B981' : saveStatus === 'saving' ? 'var(--primary)' : 'var(--outline)' }}>
              <RefreshCw size={11} className={saveStatus === 'saving' ? 'pulse-recording' : ''} />
              {saveStatus === 'saved' ? 'Saved' : saveStatus === 'saving' ? 'Saving...' : 'Unsaved'}
            </span>
            <button onClick={() => setIsPinned(!isPinned)} className="editor-toolbar-btn" aria-label={isPinned ? 'Unpin note' : 'Pin note'} style={{ color: isPinned ? 'var(--primary)' : 'var(--outline)' }}>
              <Pin size={15} style={{ fill: isPinned ? 'var(--primary)' : 'transparent' }} />
            </button>
            <button onClick={() => setIsFavorite(!isFavorite)} className="editor-toolbar-btn" aria-label={isFavorite ? 'Remove from favorites' : 'Mark as favorite'} style={{ color: isFavorite ? '#F59E0B' : 'var(--outline)' }}>
              <Star size={15} style={{ fill: isFavorite ? '#F59E0B' : 'transparent' }} />
            </button>
            <button onClick={handleLockToggle} className="editor-toolbar-btn" aria-label={pinLock ? 'Unlock note' : 'Lock note with PIN'} style={{ color: pinLock ? 'var(--error)' : 'var(--outline)' }}>
              {pinLock ? <Lock size={15} /> : <Unlock size={15} />}
            </button>
          </div>
        </div>
      </div>

      {/* ─── Meta Bar ─── */}
      <div className="editor-meta-bar">
        <div className="editor-meta-field">
          <Tag size={12} />
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">General</option>
            {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>
        </div>
        <div className="editor-meta-field">
          <FolderOpen size={12} />
          <select value={folderId} onChange={(e) => setFolderId(e.target.value)}>
            <option value="">Root</option>
            {folders.map(folder => <option key={folder.id} value={folder.id}>{folder.name}</option>)}
          </select>
        </div>
      </div>

      {/* ─── Editor ─── */}
      <div className="editor-paper">
        <input
          type="text" placeholder="Untitled" value={title}
          onChange={(e) => { setTitle(e.target.value); setSaveStatus('unsaved'); }}
          className="editor-title-input"
        />

        {isSpeaking && (
          <div className="editor-speaking-indicator">
            <div className="wave-bar" /><div className="wave-bar" /><div className="wave-bar" /><div className="wave-bar" />
            <span>Reading aloud...</span>
            <button onClick={handleStopListeningVoice} className="editor-speaking-stop">
              <VolumeX size={14} /> Stop
            </button>
          </div>
        )}

        <EditorArea
          ref={editorRef}
          onInput={handleEditorInputChange}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleEditorCompositionStart}
          onCompositionEnd={handleEditorCompositionEnd}
        />
      </div>

      {/* ─── Tags ─── */}
      <div className="editor-tags-section">
        <div className="editor-tags-list">
          {tags.map((tag) => (
            <span key={tag} className="editor-tag">
              #{tag}
              <button onClick={() => handleRemoveTag(tag)} aria-label={`Remove tag ${tag}`}>×</button>
            </span>
          ))}
        </div>
        <input type="text" placeholder="Add tags... (Press Enter)" value={tagInput}
          onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleAddTag} className="editor-tags-input" />
      </div>

      {/* ─── Footer ─── */}
      <div className="editor-footer">
        <div className="editor-footer-left">
          <button onClick={handleListenNote} className={`editor-footer-btn ${isSpeaking && !isPaused ? 'active' : ''}`}>
            <Volume2 size={15} /> {isSpeaking ? (isPaused ? 'Resume' : 'Pause') : 'Listen'}
          </button>
          <button onClick={handleDictateSpeech} className={`editor-footer-btn ${isListening ? 'recording' : ''}`}>
            {isListening ? <MicOff size={15} /> : <Mic size={15} />} {isListening ? 'Stop' : 'Dictate'}
          </button>
        </div>
        <div className="editor-footer-right">
          <button onClick={handleExportPDF} className="editor-footer-btn">
            <Download size={15} /> PDF
          </button>
          <label className="editor-footer-btn">
            <Upload size={15} /> Import
            <input type="file" accept=".txt,.md" onChange={handleImportFile} style={{ display: 'none' }} />
          </label>
        </div>
      </div>

      {/* ─── Table Picker ─── */}
      {showTablePicker && (
        <div className="editor-table-picker-overlay" role="dialog" aria-modal="true" aria-labelledby="table-picker-title" onClick={() => setShowTablePicker(false)}>
          <div className="editor-table-picker" onClick={e => e.stopPropagation()}>
            <div className="editor-table-picker-header" id="table-picker-title">
              <Table2 size={14} /> Insert Table
            </div>
            <div className="editor-table-picker-grid">
              <div className="editor-table-picker-sizes">
                <label>Rows</label>
                <select value={tableRows} onChange={e => setTableRows(Number(e.target.value))}>
                  {TABLE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="editor-table-picker-sizes">
                <label>Columns</label>
                <select value={tableCols} onChange={e => setTableCols(Number(e.target.value))}>
                  {TABLE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button onClick={insertTable} className="editor-table-picker-insert">
              Insert Table
            </button>
          </div>
        </div>
      )}

      {/* ─── Floating AI Assistant ─── */}
      {showAiAssistant && (
        <div className="editor-ai-overlay" role="dialog" aria-modal="true" aria-labelledby="ai-assistant-title" onClick={() => setShowAiAssistant(false)}>
          <div className="editor-ai-panel" onClick={e => e.stopPropagation()}>
            <div className="editor-ai-header" id="ai-assistant-title">
              <Sparkles size={16} /> SnapAI Assistant
              <button onClick={() => setShowAiAssistant(false)} className="editor-ai-close" aria-label="Close AI Assistant">
                <X size={16} />
              </button>
            </div>
            <div className="editor-ai-body">
              <div className="editor-ai-context">
                <Sparkles size={12} />
                {selectedText
                  ? `Using selected text${title ? ` from "${title}"` : ''}`
                  : title
                    ? `Using note: ${title}`
                    : 'Using full note content'}
              </div>
              <textarea
                placeholder="Ask AI to write, rewrite, or improve content..."
                value={aiPrompt}
                onChange={e => setAiPrompt(e.target.value)}
                className="editor-ai-input"
                rows={3}
              />
              <button onClick={handleAiAssist} className="editor-ai-send" disabled={isAiLoading || !aiPrompt.trim()}>
                {isAiLoading ? 'Thinking...' : 'Generate'}
                <Send size={14} />
              </button>
              {aiResponse && (
                <div className="editor-ai-response">
                  <p>{aiResponse}</p>
                  <button onClick={insertAiResponse} className="editor-ai-insert-btn">
                    Insert into Note
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── AI FAB ─── */}
      <button onClick={() => setShowAiAssistant(true)} onMouseDown={captureSelection} className="editor-ai-fab" aria-label="Open AI Assistant">
        <Sparkles size={20} />
      </button>

      {/* ─── Pin Modal ─── */}
      {showPinModal && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="pin-modal-title" onClick={() => setShowPinModal(false)}>
          <form className="modal-content" onClick={e => e.stopPropagation()} onSubmit={handleSavePin} style={{ textAlign: 'center', maxWidth: '360px' }}>
            <Lock size={40} style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
            <h3 id="pin-modal-title" style={{ fontSize: '18px' }}>Lock Note</h3>
            <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', marginBottom: '16px' }}>Set a 4-digit PIN to secure this note</p>
            <input type="password" maxLength={PIN_LENGTH} placeholder="••••" value={pinCode}
              onChange={(e) => setPinCode(e.target.value.replace(/\D/g, ''))} required autoFocus
              style={{ width: '120px', padding: '14px', borderRadius: '12px', border: '1.5px solid var(--outline-variant)', background: 'var(--surface)', color: 'var(--on-surface)', fontSize: '22px', letterSpacing: '10px', textAlign: 'center', outline: 'none', margin: '0 auto' }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
              <button type="button" onClick={() => setShowPinModal(false)} className="md3-btn md3-btn-text">Cancel</button>
              <button type="submit" className="md3-btn md3-btn-primary" disabled={pinCode.length !== PIN_LENGTH || isPinSetting}>
                {isPinSetting ? 'Locking...' : 'Set Lock'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
