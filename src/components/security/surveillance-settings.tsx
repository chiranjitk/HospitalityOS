'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Save,
  Server,
  HardDrive,
  Bell,
  Monitor,
  Info,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { SectionGuard } from '@/components/common/section-guard';

interface SurveillanceSettings {
  stream: {
    mediaServerType: 'go2rtc' | 'mediamtx' | 'none';
    mediaServerUrl: string;
    hlsBaseUrl: string;
    rtspToHlsProxy: boolean;
  };
  recording: {
    retentionDays: number;
    maxStorageGB: number;
    quality: '1080p' | '720p' | '480p' | '360p';
    autoDeleteAfterRetention: boolean;
  };
  alerts: {
    notifications: boolean;
    sound: boolean;
    autoAckLowAfter: number;
    refreshInterval: '10s' | '30s' | '60s' | '5min';
  };
  display: {
    gridLayout: '1x1' | '2x2' | '3x3';
    showCameraNames: boolean;
    showStatusIndicators: boolean;
    showRecordingIndicator: boolean;
    darkMode: boolean;
  };
}

const DEFAULT_SETTINGS: SurveillanceSettings = {
  stream: {
    mediaServerType: 'none',
    mediaServerUrl: '',
    hlsBaseUrl: '',
    rtspToHlsProxy: false,
  },
  recording: {
    retentionDays: 30,
    maxStorageGB: 500,
    quality: '1080p',
    autoDeleteAfterRetention: true,
  },
  alerts: {
    notifications: true,
    sound: true,
    autoAckLowAfter: 0,
    refreshInterval: '30s',
  },
  display: {
    gridLayout: '2x2',
    showCameraNames: true,
    showStatusIndicators: true,
    showRecordingIndicator: true,
    darkMode: false,
  },
};

// Map between configType keys and the SurveillanceSettings section names
const CONFIG_TYPE_MAP = {
  stream: 'streaming',
  recording: 'recording',
  alerts: 'alerts',
  display: 'display',
} as const;

type SettingsSection = keyof SurveillanceSettings;

async function fetchAllSettings(): Promise<SurveillanceSettings> {
  const response = await fetch('/api/security/surveillance-config');
  if (!response.ok) throw new Error('Failed to fetch settings');
  const result = await response.json();
  if (!result.success) throw new Error(result.error?.message || 'Failed to fetch settings');

  const merged: SurveillanceSettings = {
    stream: { ...DEFAULT_SETTINGS.stream },
    recording: { ...DEFAULT_SETTINGS.recording },
    alerts: { ...DEFAULT_SETTINGS.alerts },
    display: { ...DEFAULT_SETTINGS.display },
  };

  for (const config of result.data) {
    const section = Object.entries(CONFIG_TYPE_MAP).find(
      ([, apiType]) => apiType === config.configType
    )?.[0] as SettingsSection | undefined;
    if (section && config.settings) {
      merged[section] = { ...DEFAULT_SETTINGS[section], ...config.settings };
    }
  }

  return merged;
}

async function saveSection(section: SettingsSection, settings: SurveillanceSettings[SettingsSection]): Promise<void> {
  const configType = CONFIG_TYPE_MAP[section];
  const response = await fetch('/api/security/surveillance-config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ configType, settings }),
  });
  if (!response.ok) throw new Error('Failed to save settings');
  const result = await response.json();
  if (!result.success) throw new Error(result.error?.message || 'Failed to save settings');
}

export default function SurveillanceSettings() {
  const [settings, setSettings] = useState<SurveillanceSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchAllSettings();
        setSettings(data);
      } catch (error) {
        console.error('Failed to load surveillance settings:', error);
        toast.error('Failed to load settings from server. Using defaults.');
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const updateSettings = useCallback(
    <K extends keyof SurveillanceSettings>(
      section: K,
      key: keyof SurveillanceSettings[K],
      value: SurveillanceSettings[K][keyof SurveillanceSettings[K]]
    ) => {
      setSettings((prev) => ({
        ...prev,
        [section]: {
          ...prev[section],
          [key]: value,
        },
      }));
      setHasChanges(true);
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each section independently
      const sections: SettingsSection[] = ['stream', 'recording', 'alerts', 'display'];
      await Promise.all(sections.map((section) => saveSection(section, settings[section])));
      setHasChanges(false);
      toast.success('Surveillance settings saved successfully');
    } catch (error) {
      console.error('Failed to save surveillance settings:', error);
      toast.error('Failed to save some settings. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    setHasChanges(true);
    toast.info('Settings have been reset to defaults. Click Save to apply.');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SectionGuard permission="surveillance.manage">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Surveillance Settings
            </h2>
            <p className="text-muted-foreground">
              Configure cameras, recording, alerts, and display preferences
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={handleReset}
              className="shadow-md hover:shadow-lg transition-all duration-200"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset Defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="shadow-md hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {!saving && <Save className="h-4 w-4 mr-2" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Stream Configuration */}
        <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-2">
                <Server className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle>Stream Configuration</CardTitle>
                <CardDescription>
                  Configure media server and stream proxy settings
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Media Server Type
                </Label>
                <Select
                  value={settings.stream.mediaServerType}
                  onValueChange={(v) =>
                    updateSettings(
                      'stream',
                      'mediaServerType',
                      v as SurveillanceSettings['stream']['mediaServerType']
                    )
                  }
                >
                  <SelectTrigger className="rounded-xl transition-all duration-200 hover:border-primary/30 focus:ring-2 focus:ring-primary/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="go2rtc">go2rtc</SelectItem>
                    <SelectItem value="mediamtx">MediaMTX</SelectItem>
                    <SelectItem value="none">None / Custom</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Select the media server software used to manage camera streams
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Media Server URL
                </Label>
                <Input
                  placeholder="http://192.168.1.10:1984"
                  value={settings.stream.mediaServerUrl}
                  onChange={(e) =>
                    updateSettings('stream', 'mediaServerUrl', e.target.value)
                  }
                  className="transition-all duration-200 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl"
                />
                <p className="text-xs text-muted-foreground">
                  The base URL of your media server instance
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                HLS Base URL
              </Label>
              <Input
                placeholder="http://192.168.1.10:8080"
                value={settings.stream.hlsBaseUrl}
                onChange={(e) =>
                  updateSettings('stream', 'hlsBaseUrl', e.target.value)
                }
                className="transition-all duration-200 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl max-w-md"
              />
              <p className="text-xs text-muted-foreground">
                Base URL for HLS stream endpoints (used by browser video players)
              </p>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
              <div>
                <Label className="cursor-pointer">RTSP to HLS Proxy</Label>
                <p className="text-sm text-muted-foreground">
                  Enable automatic conversion of RTSP/ONVIF streams to HLS for browser
                  playback
                </p>
              </div>
              <Switch
                checked={settings.stream.rtspToHlsProxy}
                onCheckedChange={(checked) =>
                  updateSettings('stream', 'rtspToHlsProxy', checked)
                }
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-emerald-500 data-[state=checked]:to-emerald-400 data-[state=checked]:border-emerald-500 transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-emerald-500/20"
              />
            </div>

            {settings.stream.mediaServerType === 'none' && (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  When set to &quot;None / Custom&quot;, streams must be provided in a
                  format directly playable by browsers (HLS, WebRTC, or MP4). RTSP and
                  ONVIF streams require a media server to convert them.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Recording Settings */}
        <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 p-2">
                <HardDrive className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <CardTitle>Recording Settings</CardTitle>
                <CardDescription>
                  Configure recording retention, storage, and quality
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Default Recording Retention</Label>
                  <p className="text-sm text-muted-foreground">
                    Number of days to keep recordings before deletion
                  </p>
                </div>
                <span className="text-sm font-semibold tabular-nums bg-muted px-3 py-1 rounded-lg">
                  {settings.recording.retentionDays} days
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-6">1</span>
                <Slider
                  value={[settings.recording.retentionDays]}
                  min={1}
                  max={365}
                  step={1}
                  onValueChange={([v]) =>
                    updateSettings('recording', 'retentionDays', v)
                  }
                  className="flex-1"
                />
                <span className="text-xs text-muted-foreground w-8">365</span>
              </div>
            </div>

            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Max Storage Limit
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    placeholder="500"
                    value={settings.recording.maxStorageGB}
                    onChange={(e) =>
                      updateSettings(
                        'recording',
                        'maxStorageGB',
                        Math.max(1, parseInt(e.target.value, 10) || 1)
                      )
                    }
                    className="transition-all duration-200 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    GB
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum storage allocated for camera recordings
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Recording Quality
                </Label>
                <Select
                  value={settings.recording.quality}
                  onValueChange={(v) =>
                    updateSettings(
                      'recording',
                      'quality',
                      v as SurveillanceSettings['recording']['quality']
                    )
                  }
                >
                  <SelectTrigger className="rounded-xl transition-all duration-200 hover:border-primary/30 focus:ring-2 focus:ring-primary/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                    <SelectItem value="720p">720p (HD)</SelectItem>
                    <SelectItem value="480p">480p (SD)</SelectItem>
                    <SelectItem value="360p">360p (Low)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Higher quality uses more storage and bandwidth
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
              <div>
                <Label className="cursor-pointer">Auto-delete after retention</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically remove recordings older than the retention period
                </p>
              </div>
              <Switch
                checked={settings.recording.autoDeleteAfterRetention}
                onCheckedChange={(checked) =>
                  updateSettings('recording', 'autoDeleteAfterRetention', checked)
                }
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-amber-500 data-[state=checked]:to-amber-400 data-[state=checked]:border-amber-500 transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-amber-500/20"
              />
            </div>
          </CardContent>
        </Card>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Alert Settings */}
        <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-red-500/10 to-red-500/5 p-2">
                <Bell className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <CardTitle>Alert Settings</CardTitle>
                <CardDescription>
                  Configure notification behavior for security events
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
              <div>
                <Label className="cursor-pointer">Alert Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Show browser notifications for security events
                </p>
              </div>
              <Switch
                checked={settings.alerts.notifications}
                onCheckedChange={(checked) =>
                  updateSettings('alerts', 'notifications', checked)
                }
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-red-500 data-[state=checked]:to-red-400 data-[state=checked]:border-red-500 transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-red-500/20"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
              <div>
                <Label className="cursor-pointer">Alert Sound</Label>
                <p className="text-sm text-muted-foreground">
                  Play an audio alert when new events are detected
                </p>
              </div>
              <Switch
                checked={settings.alerts.sound}
                onCheckedChange={(checked) =>
                  updateSettings('alerts', 'sound', checked)
                }
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-red-500 data-[state=checked]:to-red-400 data-[state=checked]:border-red-500 transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-red-500/20"
              />
            </div>

            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Auto-acknowledge Low Severity After
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={settings.alerts.autoAckLowAfter}
                    onChange={(e) =>
                      updateSettings(
                        'alerts',
                        'autoAckLowAfter',
                        Math.max(0, parseInt(e.target.value, 10) || 0)
                      )
                    }
                    className="transition-all duration-200 focus:ring-2 focus:ring-primary/10 hover:border-primary/30 rounded-xl pr-14"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                    min
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Set to 0 to disable auto-acknowledgment
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Alert Refresh Interval
                </Label>
                <Select
                  value={settings.alerts.refreshInterval}
                  onValueChange={(v) =>
                    updateSettings(
                      'alerts',
                      'refreshInterval',
                      v as SurveillanceSettings['alerts']['refreshInterval']
                    )
                  }
                >
                  <SelectTrigger className="rounded-xl transition-all duration-200 hover:border-primary/30 focus:ring-2 focus:ring-primary/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10s">10 seconds</SelectItem>
                    <SelectItem value="30s">30 seconds</SelectItem>
                    <SelectItem value="60s">60 seconds</SelectItem>
                    <SelectItem value="5min">5 minutes</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How often the alert feed polls for new events
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gradient divider */}
        <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        {/* Display Settings */}
        <Card className="border-0 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 rounded-2xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 p-2">
                <Monitor className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <CardTitle>Display Settings</CardTitle>
                <CardDescription>
                  Configure how cameras and feeds are displayed
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                  Default Grid Layout
                </Label>
                <Select
                  value={settings.display.gridLayout}
                  onValueChange={(v) =>
                    updateSettings(
                      'display',
                      'gridLayout',
                      v as SurveillanceSettings['display']['gridLayout']
                    )
                  }
                >
                  <SelectTrigger className="rounded-xl transition-all duration-200 hover:border-primary/30 focus:ring-2 focus:ring-primary/10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1x1">1x1 (Single camera)</SelectItem>
                    <SelectItem value="2x2">2x2 (4 cameras)</SelectItem>
                    <SelectItem value="3x3">3x3 (9 cameras)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Default camera grid layout when opening the live view
                </p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
                <div>
                  <Label className="cursor-pointer">Show Camera Names on Grid</Label>
                  <p className="text-sm text-muted-foreground">
                    Display camera name overlay on each feed tile
                  </p>
                </div>
                <Switch
                  checked={settings.display.showCameraNames}
                  onCheckedChange={(checked) =>
                    updateSettings('display', 'showCameraNames', checked)
                  }
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-violet-400 data-[state=checked]:border-violet-500 transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-violet-500/20"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
                <div>
                  <Label className="cursor-pointer">Show Status Indicators</Label>
                  <p className="text-sm text-muted-foreground">
                    Display online/offline/maintenance status badges on feeds
                  </p>
                </div>
                <Switch
                  checked={settings.display.showStatusIndicators}
                  onCheckedChange={(checked) =>
                    updateSettings('display', 'showStatusIndicators', checked)
                  }
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-violet-400 data-[state=checked]:border-violet-500 transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-violet-500/20"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
                <div>
                  <Label className="cursor-pointer">Show Recording Indicator</Label>
                  <p className="text-sm text-muted-foreground">
                    Show a red dot when a camera is actively recording
                  </p>
                </div>
                <Switch
                  checked={settings.display.showRecordingIndicator}
                  onCheckedChange={(checked) =>
                    updateSettings('display', 'showRecordingIndicator', checked)
                  }
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-violet-400 data-[state=checked]:border-violet-500 transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-violet-500/20"
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors duration-200 -mx-1">
                <div>
                  <Label className="cursor-pointer">Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Use a darker theme for the surveillance view (reduces eye strain in
                    monitoring rooms)
                  </p>
                </div>
                <Switch
                  checked={settings.display.darkMode}
                  onCheckedChange={(checked) =>
                    updateSettings('display', 'darkMode', checked)
                  }
                  className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-500 data-[state=checked]:to-violet-400 data-[state=checked]:border-violet-500 transition-all duration-300 data-[state=checked]:shadow-md data-[state=checked]:shadow-violet-500/20"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Synced Info Banner */}
        <Alert>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertDescription>
            Settings are synced to the database and shared across all devices and browsers
            for your property.
          </AlertDescription>
        </Alert>
      </div>
    </SectionGuard>
  );
}
