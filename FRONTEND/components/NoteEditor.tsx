'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/lib/store/useStore';
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
import { API, apiFetch } from '@/lib/config';
import { useAuth } from '@clerk/nextjs';

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
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showAiAssistant, setShowAiAssistant] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

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
          let finalTranscript = '';
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i][0].transcript) finalTranscript += event.results[i][0].transcript;
          }
          if (finalTranscript) {
            if (editorRef.current) {
              editorRef.current.focus();
              insertAtCursor(finalTranscript + ' ');
            }
            setContent(prev => prev + finalTranscript + ' ');
            setSaveStatus('unsaved');
          }
        };
        rec.onerror = (e: SpeechRecognitionErrorEvent) => { console.error("STT Error:", e.error); setIsListening(false); };
        rec.onend = () => setIsListening(false);
        recognitionRef.current = rec;
      }
    }
  }, []);

  useEffect(() => {
    if (isNew && !title.trim() && !content.trim()) return;
    const savingTimer = setTimeout(() => setSaveStatus('saving'), 0);
    const timer = setTimeout(() => {
      const notePayload = {
        title: title || 'Untitled Note',
        content,
        tags,
        categoryId: categoryId || null,
        folderId: folderId || null,
        isPinned,
        isFavorite,
        pinLock,
      };
      if (isNew) {
        const created = addNote(notePayload);
        updateNote(created.id, {});
      } else if (noteId) {
        updateNote(noteId, notePayload);
      }
      setSaveStatus('saved');
    }, 1500);
    return () => { clearTimeout(savingTimer); clearTimeout(timer); };
  }, [title, content, tags, categoryId, folderId, isPinned, isFavorite, pinLock, isNew, noteId, addNote, updateNote]);

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

  const pushHistory = useCallback((html: string) => {
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(html);
      if (newHistory.length > 50) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const handleEditorInput = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setContent(html);
      setSaveStatus('unsaved');
      pushHistory(html);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      const html = history[newIndex];
      if (editorRef.current) {
        editorRef.current.innerHTML = DOMPurify.sanitize(html);
        setContent(html);
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      const html = history[newIndex];
      if (editorRef.current) {
        editorRef.current.innerHTML = DOMPurify.sanitize(html);
        setContent(html);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
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
  };

  const insertCodeBlock = (lang: string) => {
    const html = `<div class="editor-code-block"><div class="editor-code-header"><span>${lang}</span><button class="editor-code-copy" onclick="(function(btn){var code=btn.parentElement.nextElementSibling.textContent;navigator.clipboard.writeText(code);btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},2000);})(this)">Copy</button></div><pre><code class="language-${lang}"> </code></pre></div>`;
    insertAtCursor(html);
    if (editorRef.current) handleEditorInput();
  };

  const insertTable = () => {
    const html = generateTableHtml(tableRows, tableCols);
    insertAtCursor(html);
    setShowTablePicker(false);
    if (editorRef.current) handleEditorInput();
  };

  const insertImage = () => {
    const url = prompt('Paste image URL:');
    if (url) {
      const sanitizedUrl = url.replace(/^javascript:/i, '').replace(/<[^>]*>/g, '');
      const fileName = sanitizedUrl.split('/').pop()?.replace(/[?#].*$/, '').split('.')[0] || '';
      const html = `<figure class="editor-image-block"><img src="${sanitizedUrl}" alt="${fileName}" loading="lazy" /><figcaption>Image</figcaption></figure>`;
      insertAtCursor(html);
      if (editorRef.current) handleEditorInput();
    }
  };

  const insertMath = () => {
    const expr = prompt('Enter math expression (e.g., E = mc²):');
    if (expr) {
      const html = `<span class="editor-math-inline" contenteditable="false">📐 ${expr}</span>`;
      insertAtCursor(html + ' ');
      if (editorRef.current) handleEditorInput();
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
    if (isListening) recognitionRef.current.stop();
    else recognitionRef.current.start();
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

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (pinCode.length === PIN_LENGTH) { setPinLock(pinCode); setShowPinModal(false); confetti({ particleCount: 50, colors: ['#0061A4'] }); }
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
      setContent(`<p>${escaped}</p>`);
      setSaveStatus('unsaved');
      confetti({ particleCount: 50, colors: ['#0061A4'] });
    };
    reader.readAsText(file);
  };

  const handleAiAssist = async () => {
    if (!aiPrompt.trim() || isAiLoading) return;
    setIsAiLoading(true);
    setAiResponse('');
    try {
      const data = await apiFetch(API.ai.chat, {
        method: 'POST',
        body: JSON.stringify({ messages: [{ role: 'user', content: aiPrompt }] }),
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
      if (editorRef.current) handleEditorInput();
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

        <div
          ref={editorRef}
          className="editor-content"
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onKeyDown={handleKeyDown}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) || '<p><br></p>' }}
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
      <button onClick={() => setShowAiAssistant(true)} className="editor-ai-fab" aria-label="Open AI Assistant">
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
              <button type="submit" className="md3-btn md3-btn-primary" disabled={pinCode.length !== PIN_LENGTH}>Set Lock</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
