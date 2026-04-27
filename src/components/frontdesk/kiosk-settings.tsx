'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Monitor,
  Palette,
  Clock,
  ToggleLeft,
  FileText,
  CreditCard,
  Link2,
  Copy,
  Loader2,
  Save,
  QrCode,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ============================================================
// Types
// ============================================================

interface KioskSettingsData {
  id?: string;
  propertyId?: string;
  hotelName: string;
  welcomeMessage: string;
  primaryColor: string;
  logoUrl: string | null;
  backgroundStyle: 'gradient' | 'solid' | 'image';
  idleTimeout: number;
  showClock: boolean;
  showLanguageSwitch: boolean;
  enableCheckIn: boolean;
  enableCheckOut: boolean;
  enablePayment: boolean;
  termsContent: string;
  requirePaymentOnCheckout: boolean;
  createdAt?: string;
  updatedAt?: string;
}

const DEFAULTS: KioskSettingsData = {
  hotelName: 'StaySuite',
  welcomeMessage: 'Welcome! Please select an option below.',
  primaryColor: '#10b981',
  logoUrl: null,
  backgroundStyle: 'gradient',
  idleTimeout: 120,
  showClock: true,
  showLanguageSwitch: true,
  enableCheckIn: true,
  enableCheckOut: true,
  enablePayment: false,
  termsContent: "By using this kiosk, I agree to the hotel's terms and conditions.",
  requirePaymentOnCheckout: false,
};

// ============================================================
// Component
// ============================================================

export default function KioskSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState<KioskSettingsData>(DEFAULTS);
  const [originalSettings, setOriginalSettings] = useState<KioskSettingsData>(DEFAULTS);

  // ---- Fetch settings ----

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/frontdesk/kiosk-settings');
        if (!res.ok) throw new Error('Failed to fetch');
        const result = await res.json();
        if (cancelled || !result.success || !result.data) return;
        const data = result.data as KioskSettingsData;
        setSettings(data);
        setOriginalSettings(data);
      } catch (err) {
        if (!cancelled) {
          console.error('Error loading kiosk settings:', err);
          toast({
            title: 'Error',
            description: 'Failed to load kiosk settings.',
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/frontdesk/kiosk-settings');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      if (result.success && result.data) {
        const data = result.data as KioskSettingsData;
        setSettings(data);
        setOriginalSettings(data);
      }
    } catch (err) {
      console.error('Error loading kiosk settings:', err);
      toast({
        title: 'Error',
        description: 'Failed to load kiosk settings.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // ---- Detect changes ----
  const hasChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  // ---- Update a single field ----
  const update = <K extends keyof KioskSettingsData>(key: K, value: KioskSettingsData[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  // ---- Save ----
  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/frontdesk/kiosk-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error('Failed to save');
      const result = await res.json();
      if (result.success) {
        setOriginalSettings(settings);
        toast({
          title: 'Saved',
          description: 'Kiosk settings have been updated successfully.',
        });
      } else {
        throw new Error(result.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error saving kiosk settings:', err);
      toast({
        title: 'Error',
        description: 'Failed to save kiosk settings. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // ---- Copy kiosk URL ----
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin + '/kiosk');
      setCopied(true);
      toast({
        title: 'Copied',
        description: 'Kiosk URL copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy URL.',
        variant: 'destructive',
      });
    }
  };

  // ---- Render helpers ----
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const formatTimeout = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m === 0) return `${s}s`;
    if (s === 0) return `${m}m`;
    return `${m}m ${s}s`;
  };

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-4xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <Monitor className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Kiosk Settings</h1>
            <p className="text-sm text-muted-foreground">
              Configure the self-service kiosk display and features
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-1.5", loading && "animate-spin")} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || saving || loading}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {hasChanges && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>You have unsaved changes.</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* Section 1: Branding */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Branding</CardTitle>
          </div>
          <CardDescription>
            Customize the kiosk appearance with your hotel branding
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Hotel Name */}
          <div className="space-y-2">
            <Label htmlFor="hotelName">Hotel Name</Label>
            <Input
              id="hotelName"
              value={settings.hotelName}
              onChange={(e) => update('hotelName', e.target.value)}
              placeholder="Enter hotel name"
              maxLength={100}
            />
          </div>

          {/* Welcome Message */}
          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">Welcome Message</Label>
            <Textarea
              id="welcomeMessage"
              value={settings.welcomeMessage}
              onChange={(e) => update('welcomeMessage', e.target.value)}
              placeholder="Enter welcome message"
              maxLength={500}
              rows={3}
            />
            <p className="text-xs text-muted-foreground text-right">
              {settings.welcomeMessage.length}/500
            </p>
          </div>

          {/* Logo URL */}
          <div className="space-y-2">
            <Label htmlFor="logoUrl">Logo URL</Label>
            <Input
              id="logoUrl"
              value={settings.logoUrl || ''}
              onChange={(e) => update('logoUrl', e.target.value || null)}
              placeholder="https://example.com/logo.png"
            />
            {settings.logoUrl && (
              <div className="mt-2 flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <img
                  src={settings.logoUrl}
                  alt="Logo preview"
                  className="h-10 w-auto object-contain rounded"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium truncate max-w-[280px]">
                    {settings.logoUrl}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => update('logoUrl', null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Remove
                </Button>
              </div>
            )}
          </div>

          {/* Primary Color */}
          <div className="space-y-2">
            <Label htmlFor="primaryColor">Primary Color</Label>
            <div className="flex items-center gap-3">
              <div className="relative">
                <input
                  type="color"
                  id="primaryColor"
                  value={settings.primaryColor}
                  onChange={(e) => update('primaryColor', e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                />
              </div>
              <Input
                value={settings.primaryColor}
                onChange={(e) => {
                  const val = e.target.value;
                  if (/^#[0-9a-fA-F]{0,6}$/.test(val)) {
                    update('primaryColor', val);
                  }
                }}
                maxLength={7}
                className="w-32 font-mono text-sm"
              />
              <div
                className="h-10 w-24 rounded-lg border"
                style={{ backgroundColor: settings.primaryColor }}
              />
              <div className="ml-auto">
                <div
                  className="px-4 py-2 rounded-lg text-white font-medium text-sm"
                  style={{ backgroundColor: settings.primaryColor }}
                >
                  Preview
                </div>
              </div>
            </div>
          </div>

          {/* Background Style */}
          <div className="space-y-2">
            <Label>Background Style</Label>
            <Select
              value={settings.backgroundStyle}
              onValueChange={(v) => update('backgroundStyle', v as 'gradient' | 'solid' | 'image')}
            >
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gradient">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-gradient-to-r from-emerald-400 to-teal-500" />
                    Gradient
                  </div>
                </SelectItem>
                <SelectItem value="solid">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-emerald-500" />
                    Solid
                  </div>
                </SelectItem>
                <SelectItem value="image">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 rounded bg-muted-foreground/20 border" />
                    Image
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Section 2: Display */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Display</CardTitle>
          </div>
          <CardDescription>
            Configure kiosk timeout and display options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Idle Timeout */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Idle Timeout</Label>
              <Badge variant="outline" className="font-mono text-xs">
                {formatTimeout(settings.idleTimeout)}
              </Badge>
            </div>
            <Slider
              value={[settings.idleTimeout]}
              onValueChange={([v]) => update('idleTimeout', v)}
              min={30}
              max={300}
              step={10}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>30s</span>
              <span>5min</span>
            </div>
          </div>

          <Separator />

          {/* Show Clock */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showClock" className="text-sm font-medium">Show Clock</Label>
              <p className="text-xs text-muted-foreground">
                Display a real-time clock on the kiosk screen
              </p>
            </div>
            <Switch
              id="showClock"
              checked={settings.showClock}
              onCheckedChange={(v) => update('showClock', v)}
            />
          </div>

          {/* Show Language Switch */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="showLanguageSwitch" className="text-sm font-medium">
                Show Language Switch
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow guests to switch kiosk language
              </p>
            </div>
            <Switch
              id="showLanguageSwitch"
              checked={settings.showLanguageSwitch}
              onCheckedChange={(v) => update('showLanguageSwitch', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Section 3: Features */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Features</CardTitle>
          </div>
          <CardDescription>
            Enable or disable kiosk features
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Enable Check-In */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enableCheckIn" className="text-sm font-medium">
                Enable Check-In
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow guests to check in via the kiosk
              </p>
            </div>
            <Switch
              id="enableCheckIn"
              checked={settings.enableCheckIn}
              onCheckedChange={(v) => update('enableCheckIn', v)}
            />
          </div>

          <Separator />

          {/* Enable Check-Out */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enableCheckOut" className="text-sm font-medium">
                Enable Check-Out
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow guests to check out via the kiosk
              </p>
            </div>
            <Switch
              id="enableCheckOut"
              checked={settings.enableCheckOut}
              onCheckedChange={(v) => update('enableCheckOut', v)}
            />
          </div>

          <Separator />

          {/* Enable Payment */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enablePayment" className="text-sm font-medium">
                Enable Payment
              </Label>
              <p className="text-xs text-muted-foreground">
                Allow guests to make payments via the kiosk
              </p>
            </div>
            <Switch
              id="enablePayment"
              checked={settings.enablePayment}
              onCheckedChange={(v) => update('enablePayment', v)}
            />
          </div>
          {settings.enablePayment && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Payment gateway integration required. Configure in Integrations settings.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Section 4: Terms & Conditions */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Terms & Conditions</CardTitle>
          </div>
          <CardDescription>
            Set the terms displayed on the kiosk during check-in
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={settings.termsContent}
            onChange={(e) => update('termsContent', e.target.value)}
            placeholder="Enter terms and conditions content"
            maxLength={5000}
            rows={6}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground text-right">
            {settings.termsContent.length}/5000
          </p>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Section 5: Payment */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Payment</CardTitle>
          </div>
          <CardDescription>
            Configure payment requirements at kiosk check-out
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="requirePaymentOnCheckout" className="text-sm font-medium">
                Require Payment on Check-out
              </Label>
              <p className="text-xs text-muted-foreground">
                Prompt guests to settle their balance before completing check-out
              </p>
            </div>
            <Switch
              id="requirePaymentOnCheckout"
              checked={settings.requirePaymentOnCheckout}
              onCheckedChange={(v) => update('requirePaymentOnCheckout', v)}
            />
          </div>
          <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            <CreditCard className="h-4 w-4 shrink-0" />
            <span>Payment gateway integration required to process transactions.</span>
          </div>
        </CardContent>
      </Card>

      {/* ============================================================ */}
      {/* Section 6: Kiosk URL */}
      {/* ============================================================ */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-lg">Kiosk URL</CardTitle>
          </div>
          <CardDescription>
            The public URL for your self-service kiosk
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* URL Display */}
          <div className="space-y-2">
            <Label>Kiosk Address</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-muted rounded-lg border">
                <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-mono truncate select-all">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/kiosk
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyUrl}
                className="shrink-0"
              >
                {copied ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-500" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1.5" />
                    Copy
                  </>
                )}
              </Button>
            </div>
          </div>

          <Separator />

          {/* QR Code Placeholder */}
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="h-36 w-36 bg-muted rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 shrink-0">
              <QrCode className="h-10 w-10 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground font-medium">QR Code</span>
            </div>
            <div className="space-y-2 text-sm">
              <p className="font-medium">QR Code for Kiosk</p>
              <p className="text-muted-foreground">
                Print this QR code and place it at the kiosk terminal.
                Guests can also scan it to access the kiosk on their mobile device.
              </p>
              <p className="text-muted-foreground">
                The QR code encodes the URL shown above.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bottom Save Bar */}
      <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t pt-4 pb-2 flex items-center justify-end gap-3">
        <p className="text-sm text-muted-foreground mr-auto">
          {hasChanges ? 'Unsaved changes' : 'All changes saved'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSettings(originalSettings);
          }}
          disabled={!hasChanges || loading}
        >
          Discard
        </Button>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || saving || loading}
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-1.5" />
              Save Changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
