'use client';

import React, { useCallback, useEffect, useMemo } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { navigationConfig, type NavSection, type NavItem } from '@/config/navigation';
import { useUIStore } from '@/store';
import { Badge } from '@/components/ui/badge';
import { Search } from 'lucide-react';

interface CommandPaletteItem {
  id: string;
  title: string;
  category: string;
  categoryIcon: React.ComponentType<{ className?: string }>;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

function buildFlatItems(sections: NavSection[]): CommandPaletteItem[] {
  const items: CommandPaletteItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      items.push({
        id: item.id,
        title: item.title,
        category: section.title,
        categoryIcon: section.icon,
        icon: item.icon,
        href: item.href,
      });
    }
  }
  return items;
}

const allItems = buildFlatItems(navigationConfig);

function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen, setActiveSection } = useUIStore();

  // Ctrl+K / Cmd+K keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!useUIStore.getState().commandPaletteOpen);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [setCommandPaletteOpen]);

  const handleSelect = useCallback(
    (item: CommandPaletteItem) => {
      const sectionId = item.href.replace('#', '');
      setActiveSection(sectionId);
      setCommandPaletteOpen(false);
    },
    [setActiveSection, setCommandPaletteOpen]
  );

  // Group items by category for the command list
  const groupedItems = useMemo(() => {
    const groups = new Map<string, CommandPaletteItem[]>();
    for (const item of allItems) {
      const existing = groups.get(item.category) || [];
      existing.push(item);
      groups.set(item.category, existing);
    }
    return groups;
  }, []);

  return (
    <CommandDialog
      open={commandPaletteOpen}
      onOpenChange={setCommandPaletteOpen}
      title="Command Palette"
      description="Search for sections, pages, and actions..."
      showCloseButton={false}
      className="rounded-xl border border-border max-w-lg shadow-2xl"
    >
      <CommandInput
        placeholder="Search sections..."
      />
      <CommandList className="max-h-[420px]">
        <CommandEmpty className="py-10">
          <div className="flex flex-col items-center gap-2 text-muted-foreground">
            <Search className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">No results found</p>
            <p className="text-xs opacity-60">Try a different search term</p>
          </div>
        </CommandEmpty>

        {Array.from(groupedItems.entries()).map(([category, items], index) => (
          <React.Fragment key={category}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup
              heading={
                <div className="flex items-center gap-1.5">
                  {React.createElement(
                    items[0].categoryIcon,
                    { className: 'h-3.5 w-3.5 text-primary/60' }
                  )}
                  <span>{category}</span>
                  <Badge
                    variant="secondary"
                    className="ml-1 h-4 px-1.5 text-[10px] font-mono opacity-50"
                  >
                    {items.length}
                  </Badge>
                </div>
              }
            >
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.id}
                    value={`${item.title} ${item.category} ${item.id}`}
                    onSelect={() => handleSelect(item)}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary/70" />
                    <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                      <span className="text-sm font-medium truncate">{item.title}</span>
                      <span className="text-[11px] text-muted-foreground/60 truncate">
                        {category}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="shrink-0 h-5 px-1.5 text-[10px] font-mono border-border/50 text-muted-foreground/50"
                    >
                      {item.id}
                    </Badge>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </React.Fragment>
        ))}
      </CommandList>

      {/* Footer with shortcut hint */}
      <div className="border-t border-border/50 px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1 font-mono text-[10px]">↑↓</kbd>
            <span>Navigate</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1 font-mono text-[10px]">↵</kbd>
            <span>Open</span>
          </span>
          <span className="flex items-center gap-1">
            <kbd className="inline-flex h-5 items-center rounded border border-border/50 bg-muted/50 px-1 font-mono text-[10px]">esc</kbd>
            <span>Close</span>
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground/40 font-mono">
          {allItems.length} sections
        </span>
      </div>
    </CommandDialog>
  );
}

export { CommandPalette };
