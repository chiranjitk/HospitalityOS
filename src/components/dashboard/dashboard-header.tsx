'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, Download, Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DashboardHeaderProps {
  onRefresh?: () => void;
  isRefreshing?: boolean;
  lastUpdated?: Date;
}

export function DashboardHeader({ onRefresh, isRefreshing, lastUpdated }: DashboardHeaderProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleRefresh = useCallback(() => {
    if (onRefresh) {
      onRefresh();
      toast.success('Dashboard data refreshed');
    }
  }, [onRefresh]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  const timeAgo = lastUpdated
    ? Math.round((Date.now() - lastUpdated.getTime()) / 1000 / 60)
    : null;

  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {/* Pulsing green live data indicator */}
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
          Live
        </span>
        {timeAgo !== null && (
          <span className="text-[10px] text-muted-foreground/50 tabular-nums ml-1">
            Updated {timeAgo === 0 ? 'just now' : `${timeAgo}m ago`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-primary/10 transition-all duration-200"
          onClick={handleRefresh}
          disabled={isRefreshing}
          title="Refresh dashboard"
        >
          <RefreshCw
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-all duration-500',
              isRefreshing && 'animate-spin text-primary'
            )}
          />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-primary/10 transition-all duration-200"
          onClick={toggleFullscreen}
          title="Toggle fullscreen"
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5 text-muted-foreground" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      </div>
    </div>
  );
}
