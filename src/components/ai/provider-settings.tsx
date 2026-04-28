'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Loader2, Bot, Save, Key, Settings, Zap, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface AIProvider {
  id: string;
  name: string;
  enabled: boolean;
  model: string;
  apiKey: string;
  temperature: number;
  maxTokens: number;
  usage: { total: number; limit: number; period: string };
}

interface AISettings {
  providers: AIProvider[];
  features: {
    copilotEnabled: boolean;
    insightsEnabled: boolean;
    recommendationsEnabled: boolean;
    autoTagging: boolean;
    sentimentAnalysis: boolean;
  };
  defaultProvider: string;
}

export default function AIProviderSettings() {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/ai/provider-settings');
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch {
      toast.error('Failed to fetch AI provider settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    
    setSaving(true);
    try {
      const response = await fetch('/api/ai/provider-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('AI settings saved successfully');
      }
    } catch {
      toast.error('Failed to save AI settings');
    } finally {
      setSaving(false);
    }
  };

  const updateProvider = (id: string, key: keyof AIProvider, value: unknown) => {
    if (!settings) return;
    setSettings({
      ...settings,
      providers: settings.providers.map(p => 
        p.id === id ? { ...p, [key]: value } : p
      ),
    });
  };

  const updateFeature = (key: keyof AISettings['features'], value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      features: { ...settings.features, [key]: value },
    });
  };

  const handleTestConnection = async (providerId: string) => {
    setTestingProvider(providerId);
    try {
      const response = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
        }),
      });
      if (response.ok) {
        toast.success('AI connection successful');
      } else {
        toast.error('AI connection failed');
      }
    } catch {
      toast.error('AI connection failed');
    } finally {
      setTestingProvider(null);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">AI Provider Settings</h2>
          <p className="text-muted-foreground">Configure AI providers and features</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      {/* AI Features */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            AI Features
          </CardTitle>
          <CardDescription>Enable or disable AI-powered features</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">AI Copilot</p>
                <p className="text-sm text-muted-foreground">AI assistant for staff operations</p>
              </div>
              <Switch checked={settings.features.copilotEnabled} onCheckedChange={(v) => updateFeature('copilotEnabled', v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">AI Insights</p>
                <p className="text-sm text-muted-foreground">Automated insights and recommendations</p>
              </div>
              <Switch checked={settings.features.insightsEnabled} onCheckedChange={(v) => updateFeature('insightsEnabled', v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Smart Recommendations</p>
                <p className="text-sm text-muted-foreground">Pricing and upsell suggestions</p>
              </div>
              <Switch checked={settings.features.recommendationsEnabled} onCheckedChange={(v) => updateFeature('recommendationsEnabled', v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Auto Tagging</p>
                <p className="text-sm text-muted-foreground">Automatically tag bookings and guests</p>
              </div>
              <Switch checked={settings.features.autoTagging} onCheckedChange={(v) => updateFeature('autoTagging', v)} />
            </div>
            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div>
                <p className="font-medium">Sentiment Analysis</p>
                <p className="text-sm text-muted-foreground">Analyze guest feedback sentiment</p>
              </div>
              <Switch checked={settings.features.sentimentAnalysis} onCheckedChange={(v) => updateFeature('sentimentAnalysis', v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Providers */}
      {settings.providers.map((provider) => (
        <Card key={provider.id}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                {provider.name}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => handleTestConnection(provider.id)} disabled={testingProvider === provider.id}>
                  {testingProvider === provider.id ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                  Test Connection
                </Button>
                <Switch checked={provider.enabled} onCheckedChange={(v) => updateProvider(provider.id, 'enabled', v)} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Model</Label>
                <Input value={provider.model} onChange={(e) => updateProvider(provider.id, 'model', e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>API Key</Label>
                <div className="flex gap-2">
                  <Input 
                    type={visibleKeys.has(provider.id) ? 'text' : 'password'} 
                    value={provider.apiKey} 
                    onChange={(e) => updateProvider(provider.id, 'apiKey', e.target.value)} 
                    placeholder="sk-xxxxx" 
                  />
                  <Button variant="ghost" size="icon" onClick={() => {
                    const next = new Set(visibleKeys);
                    if (next.has(provider.id)) next.delete(provider.id); else next.add(provider.id);
                    setVisibleKeys(next);
                  }}>
                    {visibleKeys.has(provider.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {provider.apiKey === '' && (
                  <p className="text-xs text-amber-500">No API key configured</p>
                )}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Temperature</Label>
                <Input 
                  type="number" 
                  step="0.1" 
                  min={0} 
                  max={2} 
                  value={provider.temperature} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val >= 0 && val <= 2) updateProvider(provider.id, 'temperature', val);
                  }} 
                />
              </div>
              <div className="space-y-2">
                <Label>Max Tokens</Label>
                <Input 
                  type="number" 
                  min={1} 
                  max={32000} 
                  value={provider.maxTokens}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1) updateProvider(provider.id, 'maxTokens', val);
                  }} 
                />
              </div>
            </div>
            {provider.enabled && (
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between mb-2">
                  <Label>Usage This Month</Label>
                  <span className="text-sm">{provider.usage.total.toLocaleString()} / {provider.usage.limit.toLocaleString()} tokens</span>
                </div>
                <Progress value={(provider.usage.total / provider.usage.limit) * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Default Provider */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Default Provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={settings.defaultProvider} onValueChange={(v) => setSettings({ ...settings, defaultProvider: v })}>
            <SelectTrigger className="w-full md:w-[300px]">
              <SelectValue placeholder="Select a provider" />
            </SelectTrigger>
            <SelectContent>
              {settings.providers.map(p => (
                <SelectItem key={p.id} value={p.id} disabled={!p.enabled}>
                  {p.name} {!p.enabled ? '(disabled)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
    </div>
  );
}
