'use client';

import React from 'react';
import { Lock, Pin, Star, Trash2 } from 'lucide-react';
import { type Note, type Category } from '@/lib/store/useStore';
import { formatShortDate, stripHtml, handleCardKeyDown } from '@/lib/utils';

interface NoteCardProps {
  note: Note;
  category: Category | undefined;
  onOpen: (noteId: string) => void;
  onDelete: (noteId: string) => void;
}

// Day 11 Task 2 — note cards are memoized so a single-note update (pin toggle,
// revision streak, server sync) re-renders only that card instead of the whole
// grid. The store replaces the notes array but keeps untouched note objects at
// the same reference, so React.memo's shallow compare skips every other card.
export const NoteCard = React.memo(function NoteCard({ note, category, onOpen, onDelete }: NoteCardProps) {
  return (
    <div className="md3-card" role="button" tabIndex={0} onClick={() => onOpen(note.id)} onKeyDown={(e) => handleCardKeyDown(e, () => onOpen(note.id))} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer', borderTop: category ? `4px solid ${category.color}` : '4px solid var(--outline-variant)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <h4 style={{ fontSize: '15px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
          {note.pinLock && <Lock size={12} style={{ color: 'var(--outline)' }} />}
          {note.title}
        </h4>
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {note.isPinned && <Pin size={13} style={{ color: 'var(--primary)', fill: 'var(--primary)' }} />}
          {note.isFavorite && <Star size={13} style={{ color: '#F59E0B', fill: '#F59E0B' }} />}
        </div>
      </div>
      <p style={{ fontSize: '13px', color: 'var(--on-surface-variant)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.5 }}>
        {note.pinLock ? '[🔒 Locked Note]' : stripHtml(note.content).substring(0, 150)}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: 'auto' }}>
        {category && <span className="md3-chip" style={{ fontSize: '10px', padding: '2px 10px', background: `${category.color}18`, color: category.color }}>{category.name}</span>}
        {note.tags.slice(0, 2).map((tag, idx) => (
          <span key={idx} className="md3-chip" style={{ fontSize: '10px', padding: '2px 10px' }}>#{tag}</span>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--outline-variant)', paddingTop: '10px', marginTop: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--outline)' }}>{formatShortDate(note.updatedAt)}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} aria-label={`Delete note ${note.title}`} className="md3-btn-ghost" style={{ padding: '4px', color: 'var(--error)', fontSize: '12px' }}><Trash2 size={14} /></button>
      </div>
    </div>
  );
});

export const NoteListItem = React.memo(function NoteListItem({ note, category, onOpen, onDelete }: NoteCardProps) {
  return (
    <div className="md3-card-sm" role="button" tabIndex={0} onClick={() => onOpen(note.id)} onKeyDown={(e) => handleCardKeyDown(e, () => onOpen(note.id))} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer', borderLeft: category ? `4px solid ${category.color}` : '4px solid var(--outline-variant)' }}>
      <div style={{ flexGrow: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h4 style={{ fontSize: '14px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{note.title}</h4>
          {note.isPinned && <Pin size={11} style={{ color: 'var(--primary)', fill: 'var(--primary)', flexShrink: 0 }} />}
          {note.isFavorite && <Star size={11} style={{ color: '#F59E0B', fill: '#F59E0B', flexShrink: 0 }} />}
        </div>
        <p style={{ fontSize: '12px', color: 'var(--on-surface-variant)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px' }}>
          {stripHtml(note.content).substring(0, 100)}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {category && <span className="md3-chip" style={{ fontSize: '10px', padding: '2px 10px', background: `${category.color}18`, color: category.color }}>{category.name}</span>}
        <span style={{ fontSize: '11px', color: 'var(--outline)', whiteSpace: 'nowrap' }}>{formatShortDate(note.updatedAt)}</span>
        <button onClick={(e) => { e.stopPropagation(); onDelete(note.id); }} aria-label={`Delete note ${note.title}`} className="md3-btn-ghost" style={{ padding: '4px', color: 'var(--error)' }}><Trash2 size={14} /></button>
      </div>
    </div>
  );
});
