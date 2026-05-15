'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Plus, Trash2, ShieldAlert, Globe, Ban, Info, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface IpWhitelistRule {
  id: string;
  tenantId: string;
  type: 'whitelist' | 'blacklist';
  ipAddress: string;
  description: string | null;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  creator: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export default function IpAccessControlCard({
  ipWhitelistEnabled,
  onToggleEnforcement,
}: {
  ipWhitelistEnabled: boolean;
  onToggleEnforcement: (enabled: boolean) => void;
}) {
  const [rules, setRules] = useState<IpWhitelistRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('whitelist');

  // Add rule form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<'whitelist' | 'blacklist'>('whitelist');
  const [newIpAddress, setNewIpAddress] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newIsEnabled, setNewIsEnabled] = useState(true);
  const [addingRule, setAddingRule] = useState(false);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<IpWhitelistRule | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ip-whitelist');
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
      }
    } catch {
      toast.error('Failed to load IP access rules');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClientIp = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/ip-whitelist/client-ip');
      const data = await res.json();
      if (data.success) {
        setClientIp(data.data.ip);
      }
    } catch {
      // Non-critical
    }
  }, []);

  useEffect(() => {
    fetchRules();
    fetchClientIp();
  }, [fetchRules, fetchClientIp]);

  const whitelistRules = rules.filter(r => r.type === 'whitelist');
  const blacklistRules = rules.filter(r => r.type === 'blacklist');

  const handleAddRule = async () => {
    const trimmedIp = newIpAddress.trim();
    if (!trimmedIp) {
      toast.error('IP address is required');
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    if (!ipRegex.test(trimmedIp)) {
      toast.error('Invalid IP address or CIDR format. Use format like 192.168.1.5 or 10.0.0.0/24');
      return;
    }

    if (trimmedIp.includes('/')) {
      const prefix = parseInt(trimmedIp.split('/')[1], 10);
      if (isNaN(prefix) || prefix < 0 || prefix > 32) {
        toast.error('CIDR prefix must be between 0 and 32');
        return;
      }
    }

    setAddingRule(true);
    try {
      const res = await fetch('/api/settings/ip-whitelist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          ipAddress: trimmedIp,
          description: newDescription.trim() || undefined,
          isEnabled: newIsEnabled,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Rule added successfully');
        setNewIpAddress('');
        setNewDescription('');
        setNewIsEnabled(true);
        setShowAddForm(false);
        await fetchRules();
      } else {
        toast.error(data.error?.message || 'Failed to add rule');
      }
    } catch {
      toast.error('Failed to add rule');
    } finally {
      setAddingRule(false);
    }
  };

  const handleToggleRule = async (rule: IpWhitelistRule) => {
    try {
      const res = await fetch('/api/settings/ip-whitelist', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isEnabled: !rule.isEnabled }),
      });
      const data = await res.json();
      if (data.success) {
        setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, isEnabled: !rule.isEnabled } : r)));
        toast.success(`Rule ${!rule.isEnabled ? 'enabled' : 'disabled'}`);
      } else {
        toast.error(data.error?.message || 'Failed to update rule');
      }
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const handleDeleteRule = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/settings/ip-whitelist?id=${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Rule deleted');
        setRules(prev => prev.filter(r => r.id !== deleteTarget.id));
        setDeleteTarget(null);
      } else {
        toast.error(data.error?.message || 'Failed to delete rule');
      }
    } catch {
      toast.error('Failed to delete rule');
    } finally {
      setDeleting(false);
    }
  };

  const renderRuleRow = (rule: IpWhitelistRule) => (
    <div
      key={rule.id}
      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <code className="text-sm font-mono font-medium">{rule.ipAddress}</code>
          {!rule.isEnabled && (
            <Badge variant="secondary" className="text-xs">
              Disabled
            </Badge>
          )}
        </div>
        {rule.description && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{rule.description}</p>
        )}
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          {rule.creator && <span>By {rule.creator.email}</span>}
          <span>{new Date(rule.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Switch checked={rule.isEnabled} onCheckedChange={() => handleToggleRule(rule)} />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => setDeleteTarget(rule)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" />
            IP Access Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5" />
                IP Access Control
              </CardTitle>
              <CardDescription className="mt-1.5">
                Manage IP-based access control for your organization
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current client IP */}
          {clientIp && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Your current IP:</span>
              <code className="text-sm font-mono font-medium">{clientIp}</code>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>This is the IP address detected from your request. Use it to whitelist your current connection.</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}

          {/* Enforcement toggle */}
          <div className="flex items-center justify-between p-4 rounded-lg border">
            <div className="flex items-center gap-3">
              <ShieldCheck className={`h-5 w-5 ${ipWhitelistEnabled ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="font-medium">Enable IP Whitelist Enforcement</p>
                <p className="text-sm text-muted-foreground">
                  When enabled, only whitelisted IPs can access the system
                </p>
              </div>
            </div>
            <Switch checked={ipWhitelistEnabled} onCheckedChange={onToggleEnforcement} />
          </div>

          {/* Tabs for whitelist/blacklist */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="whitelist" className="gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Whitelist
                  {whitelistRules.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                      {whitelistRules.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="blacklist" className="gap-1.5">
                  <Ban className="h-3.5 w-3.5" />
                  Blacklist
                  {blacklistRules.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs px-1.5 py-0">
                      {blacklistRules.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <Button
                size="sm"
                onClick={() => {
                  setNewType(activeTab as 'whitelist' | 'blacklist');
                  setShowAddForm(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                Add Entry
              </Button>
            </div>

            <TabsContent value="whitelist" className="mt-3">
              {whitelistRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ShieldCheck className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">No whitelist entries</p>
                  <p className="text-sm">Add IP addresses or CIDR ranges to allow access</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {whitelistRules.map(renderRuleRow)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="blacklist" className="mt-3">
              {blacklistRules.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Ban className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p className="font-medium">No blacklist entries</p>
                  <p className="text-sm">Add IP addresses or CIDR ranges to block access</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {blacklistRules.map(renderRuleRow)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddForm(false)}>
          <Card className="w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Add IP Access Rule</CardTitle>
              <CardDescription>
                Add an IP address or CIDR range to the {newType === 'whitelist' ? 'whitelist' : 'blacklist'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Rule Type</Label>
                <Select value={newType} onValueChange={v => setNewType(v as 'whitelist' | 'blacklist')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whitelist">Whitelist — Allow access</SelectItem>
                    <SelectItem value="blacklist">Blacklist — Block access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-ip">IP Address / CIDR Range</Label>
                <Input
                  id="new-ip"
                  placeholder="e.g., 192.168.1.5 or 10.0.0.0/24"
                  value={newIpAddress}
                  onChange={e => setNewIpAddress(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleAddRule();
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Supports single IPv4 addresses and CIDR notation (e.g., 10.0.0.0/24)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-desc">Description (optional)</Label>
                <Input
                  id="new-desc"
                  placeholder="e.g., Office network, VPN gateway"
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="new-enabled">Enabled</Label>
                <Switch id="new-enabled" checked={newIsEnabled} onCheckedChange={setNewIsEnabled} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddRule} disabled={addingRule || !newIpAddress.trim()}>
                  {addingRule && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Add Rule
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete IP Access Rule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the rule for{' '}
              <code className="font-mono font-medium">{deleteTarget?.ipAddress}</code>?
              {deleteTarget?.description && ` (${deleteTarget.description})`}
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRule}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
