'use client';

import * as React from 'react';
import { 
  Check, 
  Moon, 
  Sun, 
  Monitor, 
  Sparkles, 
  Box, 
  Palette,
  Building2,
  Palmtree,
  LayoutDashboard,
  Briefcase,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUIStyleStore, UIStyleTheme } from '@/lib/themes/store';

// UI Style theme configuration with enhanced visuals - 7 themes
const uiStyleThemes: Array<{
  id: UIStyleTheme;
  name: string;
  description: string;
  icon: React.ElementType;
  previewGradient: string;
  lightPreview: string;
  darkPreview: string;
  features: string[];
  bestFor: string;
  category: 'default' | 'original' | 'enterprise';
}> = [
  {
    id: 'hospitality-sunrise',
    name: 'Hospitality Sunrise',
    description: 'Warm hospitality theme with vibrant orange and clean white — designed for hotels and resorts.',
    icon: Sun,
    previewGradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 50%, #C2410C 100%)',
    lightPreview: 'linear-gradient(135deg, #fff7ed 0%, #ffedd5 50%, #fed7aa 100%)',
    darkPreview: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #1c1917 100%)',
    features: ['Warm orange', 'Hospitality', 'Clean white'],
    bestFor: 'Both modes',
    category: 'default',
  },
  {
    id: 'gradient-modern',
    name: 'Gradient Modern',
    description: 'Bold gradients with vibrant violet and indigo colors.',
    icon: Sparkles,
    previewGradient: 'linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #4F46E5 100%)',
    lightPreview: 'linear-gradient(135deg, #ffffff 0%, #f5f3ff 50%, #ede9fe 100%)',
    darkPreview: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)',
    features: ['Vibrant gradients', 'Purple accent', 'Modern feel'],
    bestFor: 'Light mode',
    category: 'original',
  },
  {
    id: 'neumorphism',
    name: 'Neumorphism',
    description: 'Soft UI with subtle shadows creating an extruded effect.',
    icon: Box,
    previewGradient: 'linear-gradient(145deg, #e6e9ef 0%, #d1d5db 50%, #e6e9ef 100%)',
    lightPreview: 'linear-gradient(145deg, #f3f4f6 0%, #e5e7eb 50%, #d1d5db 100%)',
    darkPreview: 'linear-gradient(135deg, #1f2937 0%, #111827 50%, #1f2937 100%)',
    features: ['Soft shadows', 'Extruded feel', 'Tactile design'],
    bestFor: 'Light mode',
    category: 'original',
  },
  // ===== ENTERPRISE THEMES =====
  {
    id: 'slate-enterprise',
    name: 'Slate Enterprise',
    description: 'Professional enterprise theme with refined slate tones — built for serious business operations.',
    icon: Building2,
    previewGradient: 'linear-gradient(135deg, #475569 0%, #64748B 50%, #334155 100%)',
    lightPreview: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 50%, #e2e8f0 100%)',
    darkPreview: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)',
    features: ['Flat design', 'Soft shadows', 'Professional'],
    bestFor: 'Both modes',
    category: 'enterprise',
  },
  {
    id: 'terra-corporate',
    name: 'Terra Corporate',
    description: 'Warm corporate theme with copper and ivory — refined hospitality aesthetics.',
    icon: Palmtree,
    previewGradient: 'linear-gradient(135deg, #78350f 0%, #b45309 50%, #78350f 100%)',
    lightPreview: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fde68a 100%)',
    darkPreview: 'linear-gradient(135deg, #1c1917 0%, #292524 50%, #1c1917 100%)',
    features: ['Warm tones', 'Hospitality', 'Copper accents'],
    bestFor: 'Both modes',
    category: 'enterprise',
  },
  {
    id: 'arctic-steel',
    name: 'Arctic Steel',
    description: 'Modern productivity theme with cool steel tones — crisp and efficient.',
    icon: LayoutDashboard,
    previewGradient: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 50%, #1e40af 100%)',
    lightPreview: 'linear-gradient(135deg, #ffffff 0%, #f0f4ff 50%, #dbeafe 100%)',
    darkPreview: 'linear-gradient(135deg, #172032 0%, #1e3a5f 50%, #172032 100%)',
    features: ['Sharp corners', 'High contrast', 'Productive'],
    bestFor: 'Both modes',
    category: 'enterprise',
  },
  {
    id: 'noir-executive',
    name: 'Noir Executive',
    description: 'Executive dark theme with champagne accents — premium boardroom aesthetics.',
    icon: Briefcase,
    previewGradient: 'linear-gradient(135deg, #000000 0%, #d4a574 50%, #000000 100%)',
    lightPreview: 'linear-gradient(135deg, #fafaf9 0%, #f5f5f4 50%, #e7e5e4 100%)',
    darkPreview: 'linear-gradient(135deg, #000000 0%, #0a0a0a 50%, #000000 100%)',
    features: ['Ultra-dark', 'Champagne', 'Luxury minimal'],
    bestFor: 'Dark mode',
    category: 'enterprise',
  },
];

interface UIStyleCardProps {
  theme: typeof uiStyleThemes[0];
  isActive: boolean;
  onClick: () => void;
  effectiveMode: 'light' | 'dark';
}

function UIStyleCard({ theme, isActive, onClick, effectiveMode: _effectiveMode }: UIStyleCardProps) {
  const Icon = theme.icon;
  const catConfig = categoryConfig[theme.category];

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  };
  
  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={(e) => e.stopPropagation()}
      className={cn(
        'relative flex flex-col items-start gap-3 rounded-2xl border-2 p-4 text-left transition-all w-full group',
        'hover:bg-accent/30 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5',
        'active:scale-[0.99]',
        isActive && 'border-primary ring-2 ring-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-lg shadow-primary/10'
      )}
    >
      {/* Active indicator with animation */}
      <div className={cn(
        "absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-all duration-300",
        isActive ? "scale-100 opacity-100" : "scale-0 opacity-0"
      )}>
        <Check className="h-3.5 w-3.5" />
      </div>
      
      {/* Preview gradient with icon and category badge */}
      <div className="flex items-center gap-3 w-full">
        <div 
          className="h-12 w-12 rounded-xl shadow-lg flex items-center justify-center transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3"
          style={{ background: theme.previewGradient }}
        >
          <Icon className="h-6 w-6 text-white drop-shadow-lg" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-sm">{theme.name}</h4>
            <Badge
              className={cn(
                'h-4 text-[9px] px-1.5 py-0 leading-none font-semibold',
                catConfig.badgeColor
              )}
            >
              {theme.category}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {theme.description}
          </p>
        </div>
      </div>
      
      {/* Preview bar */}
      <div 
        className="h-1.5 w-full rounded-full overflow-hidden"
        style={{ background: 'var(--muted)' }}
      >
        <div 
          className="h-full w-full rounded-full transition-transform duration-500 group-hover:scale-x-105"
          style={{ background: theme.previewGradient }}
        />
      </div>
      
      {/* Features */}
      <div className="flex flex-wrap gap-1.5 w-full">
        {theme.features.slice(0, 2).map((feature) => (
          <span 
            key={feature}
            className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted/80 text-muted-foreground"
          >
            {feature}
          </span>
        ))}
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
          {theme.bestFor}
        </span>
      </div>
    </button>
  );
}

interface UIStyleSwitcherProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function UIStyleSwitcher({ trigger, open, onOpenChange }: UIStyleSwitcherProps) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open ?? internalOpen;
  const setIsOpen = onOpenChange ?? setInternalOpen;
  
  const {
    themeId,
    mode,
    getEffectiveMode,
    setTheme,
    setMode,
  } = useUIStyleStore();
  
  const effectiveMode = getEffectiveMode();
  const currentTheme = uiStyleThemes.find(t => t.id === themeId);
  const CurrentIcon = currentTheme?.icon || Sparkles;
  
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 rounded-xl hover:shadow-md transition-all"
          >
            <CurrentIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Theme</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-4xl h-[90vh] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl">
        {/* Header */}
        <DialogHeader className="p-5 pb-3 shrink-0 border-b bg-gradient-to-r from-background to-muted/30">
          <DialogTitle className="flex items-center gap-3 text-xl">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
              <Palette className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text text-transparent">
                Choose Your Style
              </span>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                7 handcrafted design themes • Default, Original & Enterprise collections
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Mode Toggle */}
        <div className="flex items-center justify-between p-4 px-5 bg-muted/20 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <div>
              <h4 className="font-medium text-sm">Appearance</h4>
              <p className="text-[11px] text-muted-foreground">
                Light / Dark mode
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-background border shadow-sm">
            <Button
              variant={effectiveMode === 'light' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('light')}
              className={cn(
                "gap-1.5 rounded-md transition-all h-8",
                effectiveMode === 'light' && "shadow-md"
              )}
            >
              <Sun className="h-3.5 w-3.5" />
              <span className="text-xs">Light</span>
            </Button>
            <Button
              variant={effectiveMode === 'dark' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('dark')}
              className={cn(
                "gap-1.5 rounded-md transition-all h-8",
                effectiveMode === 'dark' && "shadow-md"
              )}
            >
              <Moon className="h-3.5 w-3.5" />
              <span className="text-xs">Dark</span>
            </Button>
            <Button
              variant={mode === 'system' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode('system')}
              className={cn(
                "rounded-md transition-all h-8",
                mode === 'system' && "shadow-md"
              )}
              title="Use system preference"
            >
              <Monitor className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Theme Selection */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pb-2">
            {groupedThemes.map((group) => (
              <React.Fragment key={group.key}>
                <CategoryHeader category={group} />
                {group.themes.map((theme) => (
                  <UIStyleCard
                    key={theme.id}
                    theme={theme}
                    isActive={themeId === theme.id}
                    onClick={() => setTheme(theme.id)}
                    effectiveMode={effectiveMode}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
        
        {/* Footer */}
        <DialogFooter className="p-3 px-5 border-t shrink-0 flex justify-between items-center bg-muted/10">
          <div className="flex items-center gap-2">
            <div 
              className="h-7 w-7 rounded-lg shadow-md"
              style={{ background: currentTheme?.previewGradient }}
            >
              <CurrentIcon className="h-full w-full p-1.5 text-white" />
            </div>
            <div>
              <p className="text-xs font-medium">
                {currentTheme?.name || 'Gradient Modern'}
              </p>
              <p className="text-[10px] text-muted-foreground capitalize">
                {effectiveMode} mode
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => {
              setIsOpen(false);
            }}
            className="rounded-xl gap-1.5"
          >
            <Check className="h-3.5 w-3.5" />
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Compact UI Style toggle for header
 */
export function UIStyleToggle() {
  const { themeId, setTheme } = useUIStyleStore();
  const currentTheme = uiStyleThemes.find(t => t.id === themeId);
  const Icon = currentTheme?.icon || Sparkles;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-muted">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 rounded-xl p-2">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          UI Themes • 7 available
        </div>
        <DropdownMenuSeparator className="my-1" />
        <div className="max-h-80 overflow-y-auto">
          {groupedThemes.map((group, groupIdx) => {
            const GroupIcon = group.icon;
            const isDefault = group.key === 'default';
            return (
              <React.Fragment key={group.key}>
                {groupIdx > 0 && <DropdownMenuSeparator className="my-1" />}
                <DropdownMenuLabel className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  <GroupIcon className={cn(
                    'h-3.5 w-3.5',
                    group.key === 'default' && 'text-orange-500 dark:text-orange-400',
                    group.key === 'original' && 'text-violet-500 dark:text-violet-400',

                    group.key === 'enterprise' && 'text-slate-500',
                  )} />
                  {group.name}
                  {isDefault && (
                    <Badge className="h-4 text-[9px] px-1.5 py-0 leading-none font-bold bg-primary/15 text-primary border-primary/20 hover:bg-primary/25">
                      DEFAULT
                    </Badge>
                  )}
                </DropdownMenuLabel>
                {group.themes.map((theme) => {
                  const ThemeIcon = theme.icon;
                  return (
                    <DropdownMenuItem
                      key={theme.id}
                      onClick={() => setTheme(theme.id)}
                      className={cn(
                        "gap-3 rounded-lg py-2 cursor-pointer",
                        themeId === theme.id && "bg-primary/10 text-primary"
                      )}
                    >
                      <div 
                        className="h-5 w-5 rounded-md flex items-center justify-center shrink-0"
                        style={{ background: theme.previewGradient }}
                      >
                        <ThemeIcon className="h-3 w-3 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium text-sm">{theme.name}</span>
                      </div>
                      {themeId === theme.id && (
                        <Check className="h-4 w-4 ml-auto text-primary shrink-0" />
                      )}
                    </DropdownMenuItem>
                  );
                })}
              </React.Fragment>
            );
          })}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Quick theme mode toggle
 */
export function UIThemeToggle() {
  const { getEffectiveMode, toggleMode } = useUIStyleStore();
  const effectiveMode = getEffectiveMode();
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleMode}
      className="h-9 w-9 rounded-xl"
    >
      {effectiveMode === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}

export { uiStyleThemes };

// Category configuration
const categoryConfig = {
  default: {
    name: 'Default Theme',
    description: 'The recommended theme for StaySuite — optimized for hospitality',
    icon: Sun,
    badgeVariant: 'default' as const,
    badgeColor: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  },
  original: {
    name: 'Original Collection',
    description: 'Classic themes with vibrant colors and creative effects',
    icon: Sparkles,
    badgeVariant: 'default' as const,
    badgeColor: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  },
  enterprise: {
    name: 'Enterprise Collection',
    description: 'Professional themes designed for business operations',
    icon: Building2,
    badgeVariant: 'secondary' as const,
    badgeColor: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
  },
} as const;

type CategoryKey = keyof typeof categoryConfig;

const categoryOrder: CategoryKey[] = ['default', 'original', 'enterprise'];

const groupedThemes = categoryOrder.map((cat) => ({
  key: cat,
  ...categoryConfig[cat],
  themes: uiStyleThemes.filter((t) => t.category === cat),
}));

// Category group header for the dialog grid
function CategoryHeader({ category }: { category: typeof groupedThemes[0] }) {
  const Icon = category.icon;
  const isNew = category.key === 'default';

  return (
    <div className="col-span-1 md:col-span-2 lg:col-span-3 mt-4 first:mt-0">
      <div className="flex items-center gap-3 py-2">
        <div className={cn(
          'h-8 w-8 rounded-lg flex items-center justify-center shadow-sm',
          category.key === 'default' && 'bg-orange-500/15',
          category.key === 'original' && 'bg-violet-500/15',

          category.key === 'enterprise' && 'bg-slate-500/15',
        )}>
          <Icon className={cn(
            'h-4 w-4',
            category.key === 'default' && 'text-orange-600 dark:text-orange-400',
            category.key === 'original' && 'text-violet-600 dark:text-violet-400',

            category.key === 'enterprise' && 'text-slate-600 dark:text-slate-400',
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-sm">{category.name}</h3>
            {isNew && (
              <Badge className="h-5 text-[10px] px-1.5 bg-primary/15 text-primary border-primary/20 hover:bg-primary/25">
                {category.key === 'default' ? 'DEFAULT' : 'NEW'}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground font-normal">
              {category.themes.length} themes
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{category.description}</p>
        </div>
        <div className="hidden sm:block h-px flex-1 bg-border/50" />
      </div>
    </div>
  );
}

/**
 * Hook to access UI style state and actions
 */
export function useUIStyle() {
  const store = useUIStyleStore();
  
  return {
    // State
    themeId: store.themeId,
    mode: store.mode,
    effectiveMode: store.getEffectiveMode(),
    isDark: store.getEffectiveMode() === 'dark',
    isLight: store.getEffectiveMode() === 'light',
    isSystem: store.mode === 'system',
    
    // Actions
    setTheme: store.setTheme,
    setMode: store.setMode,
    toggleMode: store.toggleMode,
  };
}
