'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useTranslations } from 'next-intl';
import {
  StickyNote,
  Plus,
  X,
  Trash2,
  Clock,
  Palette,
  FileText,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────

type NoteColor = 'yellow' | 'green' | 'red' | 'violet';

interface Note {
  id: string;
  title: string;
  content: string;
  color: NoteColor;
  createdAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const STORAGE_KEY = 'staysuite-quick-notes';
const MAX_NOTES = 20;
const MAX_CHARS = 200;

const NOTE_COLORS: Record<NoteColor, { bg: string; border: string; header: string; dot: string; label: string }> = {
  yellow: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200/60 dark:border-amber-800/40', header: 'bg-amber-100/80 dark:bg-amber-900/40', dot: 'bg-amber-400', label: 'Yellow' },
  green: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200/60 dark:border-emerald-800/40', header: 'bg-emerald-100/80 dark:bg-emerald-900/40', dot: 'bg-emerald-400', label: 'Important' },
  red: { bg: 'bg-rose-50 dark:bg-rose-950/30', border: 'border-rose-200/60 dark:border-rose-800/40', header: 'bg-rose-100/80 dark:bg-rose-900/40', dot: 'bg-rose-400', label: 'Urgent' },
  violet: { bg: 'bg-violet-50 dark:bg-violet-950/30', border: 'border-violet-200/60 dark:border-violet-800/40', header: 'bg-violet-100/80 dark:bg-violet-900/40', dot: 'bg-violet-400', label: 'Ideas' },
};

const COLOR_OPTIONS: NoteColor[] = ['yellow', 'green', 'red', 'violet'];

// ─── Helpers ────────────────────────────────────────────────────────────

function loadNotes(): Note[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as Note[];
  } catch { /* ignore */ }
  return [];
}

function saveNotes(notes: Note[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
  } catch { /* ignore */ }
}

function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Skeleton ───────────────────────────────────────────────────────────

function QuickNotesSkeleton() {
  return (
    <Card className="border border-border/50 shadow-sm rounded-2xl overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-amber-400 via-rose-400 to-violet-400" />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-7 w-7 rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Single Note Card ──────────────────────────────────────────────────

function NoteCard({ note, onDelete, onColorChange }: { note: Note; onDelete: (id: string) => void; onColorChange: (id: string, color: NoteColor) => void }) {
  const colorConfig = NOTE_COLORS[note.color];
  const [showColors, setShowColors] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.85, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={cn(
        'group relative rounded-xl overflow-hidden border transition-all duration-200 shadow-sm hover:shadow-md',
        colorConfig.bg,
        colorConfig.border
      )}
    >
      {/* Header */}
      <div className={cn('px-3 py-1.5 flex items-center justify-between border-b', colorConfig.header, colorConfig.border)}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className={cn('h-2 w-2 rounded-full flex-shrink-0', colorConfig.dot)} />
          <p className="text-[11px] font-semibold truncate">{note.title || 'Untitled'}</p>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); setShowColors(!showColors); }}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Change color"
          >
            <Palette className="h-2.5 w-2.5 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
            className="h-5 w-5 flex items-center justify-center rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            title="Delete note"
          >
            <Trash2 className="h-2.5 w-2.5 text-rose-400" />
          </button>
        </div>
      </div>

      {/* Color picker overlay */}
      <AnimatePresence>
        {showColors && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-white/50 dark:bg-black/20 border-b border-inherit">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  onClick={(e) => { e.stopPropagation(); onColorChange(note.id, c); setShowColors(false); }}
                  className={cn(
                    'h-4 w-4 rounded-full border-2 transition-transform hover:scale-125',
                    NOTE_COLORS[c].dot,
                    note.color === c ? 'border-foreground scale-110' : 'border-transparent'
                  )}
                  title={NOTE_COLORS[c].label}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="px-3 py-2">
        <p className="text-xs text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-wrap">{note.content}</p>
        <div className="flex items-center gap-1 mt-2 text-[10px] text-muted-foreground/70">
          <Clock className="h-2.5 w-2.5" />
          {formatTimestamp(note.createdAt)}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Quick Notes Widget ────────────────────────────────────────────────

export function QuickNotesStickyWidget() {
  const t = useTranslations('dashboard');
  const [notes, setNotes] = useState<Note[]>(() => loadNotes());
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newColor, setNewColor] = useState<NoteColor>('yellow');
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus title when form opens
  useEffect(() => {
    if (showAddForm && titleInputRef.current) {
      titleInputRef.current.focus();
    }
  }, [showAddForm]);

  // Add note
  const handleAddNote = useCallback(() => {
    if (notes.length >= MAX_NOTES) return;

    const trimmedTitle = newTitle.trim();
    const trimmedContent = newContent.trim();
    if (!trimmedTitle && !trimmedContent) return;

    const note: Note = {
      id: `note-${Date.now()}`,
      title: trimmedTitle,
      content: trimmedContent || trimmedTitle,
      color: newColor,
      createdAt: new Date().toISOString(),
    };

    const updatedNotes = [note, ...notes];
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
    setNewTitle('');
    setNewContent('');
    setNewColor('yellow');
    setShowAddForm(false);
  }, [notes, newTitle, newContent, newColor]);

  // Delete note
  const handleDelete = useCallback((id: string) => {
    const updatedNotes = notes.filter((n) => n.id !== id);
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  }, [notes]);

  // Change color
  const handleColorChange = useCallback((id: string, color: NoteColor) => {
    const updatedNotes = notes.map((n) => (n.id === id ? { ...n, color } : n));
    setNotes(updatedNotes);
    saveNotes(updatedNotes);
  }, [notes]);

  // Cancel form
  const handleCancel = useCallback(() => {
    setShowAddForm(false);
    setNewTitle('');
    setNewContent('');
    setNewColor('yellow');
  }, []);

  return (
    <Card className="border border-border/50 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-0.5 bg-gradient-to-r from-amber-400 via-rose-400 to-violet-400" />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            {t('stickyNotesTitle')}
          </CardTitle>
          <div className="flex items-center gap-2">
            {notes.length > 0 && (
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {notes.length}/{MAX_NOTES}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                'h-7 w-7 transition-colors',
                showAddForm
                  ? 'text-muted-foreground'
                  : 'text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300',
                notes.length >= MAX_NOTES && 'opacity-40 cursor-not-allowed'
              )}
              onClick={() => notes.length < MAX_NOTES && setShowAddForm(!showAddForm)}
              disabled={notes.length >= MAX_NOTES}
            >
              {showAddForm ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* ── Add Note Form ── */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="p-3 rounded-xl bg-muted/50 border border-border/50 space-y-2.5">
                <input
                  ref={titleInputRef}
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value.slice(0, 40))}
                  placeholder={t('stickyNotesTitlePlaceholder')}
                  className="w-full text-sm bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground font-medium"
                  maxLength={40}
                />
                <textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value.slice(0, MAX_CHARS))}
                  placeholder={t('stickyNotesContentPlaceholder')}
                  className="w-full text-xs bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground resize-none min-h-[40px] max-h-[80px]"
                  rows={2}
                  maxLength={MAX_CHARS}
                />

                <div className="flex items-center justify-between">
                  {/* Color selector */}
                  <div className="flex items-center gap-1.5">
                    <Palette className="h-3 w-3 text-muted-foreground mr-0.5" />
                    {COLOR_OPTIONS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setNewColor(c)}
                        className={cn(
                          'h-5 w-5 rounded-full border-2 transition-transform hover:scale-110',
                          NOTE_COLORS[c].dot,
                          newColor === c ? 'border-foreground scale-110' : 'border-transparent'
                        )}
                        title={NOTE_COLORS[c].label}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'text-[10px] tabular-nums',
                      (newContent.length > MAX_CHARS * 0.9) ? 'text-rose-500 font-medium' : 'text-muted-foreground'
                    )}>
                      {newContent.length}/{MAX_CHARS}
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleAddNote}
                      disabled={(!newTitle.trim() && !newContent.trim()) || notes.length >= MAX_NOTES}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      {t('stickyNotesAddBtn')}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Notes Grid (Masonry-like 2 columns) ── */}
        {notes.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border/50 scrollbar-track-transparent">
            <AnimatePresence mode="popLayout">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onDelete={handleDelete}
                  onColorChange={handleColorChange}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          /* ── Empty State ── */
          !showAddForm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <div className="rounded-full bg-amber-50 dark:bg-amber-950/30 p-3 mb-3">
                <FileText className="h-6 w-6 text-amber-400 dark:text-amber-500" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">{t('stickyNotesEmpty')}</p>
              <p className="text-xs text-muted-foreground/60 mt-1 max-w-[200px]">{t('stickyNotesEmptyDesc')}</p>
            </motion.div>
          )
        )}

        {/* ── Max Notes Warning ── */}
        {notes.length >= MAX_NOTES && (
          <p className="text-[10px] text-center text-muted-foreground/60">
            {t('stickyNotesMaxReached')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default QuickNotesStickyWidget;
