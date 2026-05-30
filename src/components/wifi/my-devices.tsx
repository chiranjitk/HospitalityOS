'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
  Trash2,
  Loader2,
  Star,
  Clock,
  Wifi,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface Device {
  id: string;
  macAddress: string;
  deviceName: string | null;
  deviceType: string | null;
  ipAddress: string | null;
  isPrimary: boolean;
  isActive: boolean;
  source: string;
  lastSeen: string;
  firstSeen: string;
}

interface MyDevicesProps {
  username: string;
  maxDevices: number;
  className?: string;
  onDeviceCountChange?: (activeCount: number) => void;
}

// ─── Device Type Icon ────────────────────────────────────────────────────────────

function DeviceTypeIcon({ type, className }: { type: string | null; className?: string }) {
  const cls = className || 'h-4 w-4';
  switch (type) {
    case 'phone': return <Smartphone className={cls} />;
    case 'tablet': return <Tablet className={cls} />;
    case 'laptop':
    case 'desktop': return <Laptop className={cls} />;
    case 'tv': return <Monitor className={cls} />;
    case 'watch': return <Clock className={cls} />;
    default: return <Monitor className={cls} />;
  }
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function MyDevices({ username, maxDevices, className, onDeviceCountChange }: MyDevicesProps) {
  const { toast } = useToast();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [removeDeviceId, setRemoveDeviceId] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);

  // ─── Fetch Devices ──────────────────────────────────────────────────────────

  const fetchDevices = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/wifi/devices?username=${encodeURIComponent(username)}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setDevices(data.data);
        onDeviceCountChange?.(data.data.filter((d: Device) => d.isActive).length);
      }
    } catch (err) {
      console.error('[MyDevices] Failed to fetch devices:', err);
    } finally {
      setIsLoading(false);
    }
  }, [username, onDeviceCountChange]);

  useEffect(() => { fetchDevices(); }, [fetchDevices]);

  // ─── Remove Device ──────────────────────────────────────────────────────────

  const handleRemove = async () => {
    if (!removeDeviceId) return;
    setRemoving(true);
    try {
      const res = await fetch('/api/v1/wifi/devices', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: removeDeviceId }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'Device Removed', description: 'The device has been disconnected. It will need to re-authenticate.' });
        setRemoveDeviceId(null);
        fetchDevices();
      } else {
        toast({ title: 'Error', description: data.error?.message || 'Failed to remove device', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to remove device', variant: 'destructive' });
    } finally {
      setRemoving(false);
    }
  };

  const activeDevices = devices.filter(d => d.isActive);
  const hasDevices = activeDevices.length > 0;

  return (
    <div className={className}>
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Wifi className="h-4 w-4 text-primary" />
              My Devices
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                {activeDevices.length}/{maxDevices}
              </Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={fetchDevices}>
              <Loader2 className={`h-3 w-3 mr-1 ${isLoading ? 'animate-spin' : 'hidden'}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !hasDevices ? (
            <div className="text-center py-4 text-xs text-muted-foreground">
              No devices registered yet. Connect a device to get started.
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {activeDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="rounded-md bg-primary/10 p-1.5">
                    <DeviceTypeIcon type={device.deviceType} className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium truncate">{device.deviceName || 'Unknown Device'}</p>
                      {device.isPrimary && (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-0 text-[9px] px-1 py-0">
                          <Star className="h-2.5 w-2.5 mr-0.5" /> Primary
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground">{device.macAddress}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground hidden sm:inline">
                      {device.lastSeen ? formatDistanceToNow(new Date(device.lastSeen)) + ' ago' : ''}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setRemoveDeviceId(device.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Usage bar */}
          {maxDevices > 0 && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>{activeDevices.length} of {maxDevices} devices connected</span>
                <span>{maxDevices - activeDevices.length} remaining</span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    activeDevices.length >= maxDevices ? 'bg-destructive' :
                    activeDevices.length >= maxDevices * 0.8 ? 'bg-amber-500' : 'bg-primary'
                  }`}
                  style={{ width: `${Math.min(100, (activeDevices.length / maxDevices) * 100)}%` }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeDeviceId} onOpenChange={(open) => { if (!open) setRemoveDeviceId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Device</AlertDialogTitle>
            <AlertDialogDescription>
              This device will be disconnected immediately. It will need to re-authenticate to connect again. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} disabled={removing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
