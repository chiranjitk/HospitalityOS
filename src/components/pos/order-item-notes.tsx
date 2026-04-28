'use client';

import { useTranslations } from 'next-intl';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { StickyNote, X } from 'lucide-react';

interface OrderItemNotesProps {
  value?: string;
  onChange: (notes: string) => void;
  maxLength?: number;
}

const quickNotes = [
  'No MSG', 'Vegetarian', 'Extra sauce', 'Less salt', 'Well done', 'Rare',
  'No onions', 'Extra spicy', 'Gluten-free', 'Dairy-free',
];

export function OrderItemNotes({ value = '', onChange, maxLength = 200 }: OrderItemNotesProps) {
 value = '', onChange, maxLength = 200 }: OrderItemNotesProps) {const t = useTranslations('pos');
  const [open, setOpen] = useState(false);

  const handleQuickNote = (note: string) => {
    const newNotes = value ? `${value}, ${note}` : note;
    if (newNotes.length <= maxLength) onChange(newNotes.slice(0, maxLength));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={value ? 'default' : 'ghost'}
          size="icon"
          className={`h-7 w-7 ${value ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'text-muted-foreground hover:text-foreground'}`}
          type="button"
        >
          <StickyNote className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" side="right" align="start">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Special Instructions</span>
            <div className="flex items-center gap-1">
              {value && (
                <Badge variant="secondary" className="text-xs">
                  {value.length}/{maxLength}
                </Badge>
              )}
              {value && (
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { onChange(''); setOpen(false); }}>
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
          <Textarea
            placeholder="e.g., No onions, Extra spicy, Allergy: nuts..."
            value={value}
            onChange={e => onChange(e.target.value.slice(0, maxLength))}
            className="text-sm min-h-[60px]"
            autoFocus
          />
          <div className="flex flex-wrap gap-1">
            {quickNotes.map(note => (
              <Button
                key={note}
                variant="outline"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => handleQuickNote(note)}
                type="button"
              >
                {note}
              </Button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function NoteIndicator({ notes }: { notes?: string | null }) {
  if (!notes) return null;
  return (
    <div className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400" title={notes}>
      <StickyNote className="h-3 w-3" />
      <span className="truncate max-w-[100px]">{notes}</span>
    </div>
  );
}
