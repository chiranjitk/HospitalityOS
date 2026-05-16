'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  GitBranch,
  Plus,
  Loader2,
  RefreshCw,
  Pencil,
  Trash2,
  ArrowUpDown,
  Filter,
  Zap,
  Building2,
  AlertCircle,
  CheckCircle2,
  X,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface RoutingRule {
  id: string;
  name: string;
  description: string | null;
  chargeCategory: string;
  targetFolioType: string;
  priority: number;
  conditions: {
    source?: string;
    amountMin?: number;
    amountMax?: number;
    roomType?: string;
    channel?: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RoutingRuleStats {
  totalRules: number;
  activeRules: number;
  inactiveRules: number;
  categoriesCovered: string[];
  rulesPerCategory: Record<string, number>;
}

const CHARGE_CATEGORIES = [
  { value: 'room', label: 'Room Charge', icon: '🛏️' },
  { value: 'food_beverage', label: 'Food & Beverage', icon: '🍽️' },
  { value: 'spa', label: 'Spa & Wellness', icon: '💆' },
  { value: 'laundry', label: 'Laundry', icon: '👕' },
  { value: 'minibar', label: 'Minibar', icon: '🍸' },
  { value: 'telephone', label: 'Telephone', icon: '📞' },
  { value: 'parking', label: 'Parking', icon: '🅿️' },
  { value: 'miscellaneous', label: 'Miscellaneous', icon: '📦' },
];

const TARGET_FOLIO_TYPES = [
  { value: 'guest', label: 'Guest Folio' },
  { value: 'company', label: 'Company Folio' },
  { value: 'city_ledger', label: 'City Ledger' },
  { value: 'travel_agent', label: 'Travel Agent' },
  { value: 'package', label: 'Package Folio' },
];

const SOURCE_OPTIONS = [
  { value: 'all', label: 'All Sources' },
  { value: 'direct', label: 'Direct' },
  { value: 'ota', label: 'OTA' },
  { value: 'corporate', label: 'Corporate' },
  { value: 'travel_agent', label: 'Travel Agent' },
];

export default function RoutingRules() {
  const { toast } = useToast();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [stats, setStats] = useState<RoutingRuleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    chargeCategory: '',
    targetFolioType: '',
    priority: 0,
    conditions: {
      source: 'all',
      amountMin: '',
      amountMax: '',
      roomType: 'all',
    },
    isActive: true,
  });

  const fetchRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/billing/routing-rules?includeInactive=true');
      const result = await res.json();
      if (result.success) {
        setRules(result.data);
        setStats(result.stats);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch routing rules', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      chargeCategory: '',
      targetFolioType: '',
      priority: 0,
      conditions: { source: 'all', amountMin: '', amountMax: '', roomType: 'all' },
      isActive: true,
    });
    setEditingRule(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (rule: RoutingRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      chargeCategory: rule.chargeCategory,
      targetFolioType: rule.targetFolioType,
      priority: rule.priority,
      conditions: {
        source: rule.conditions?.source || 'all',
        amountMin: rule.conditions?.amountMin?.toString() || '',
        amountMax: rule.conditions?.amountMax?.toString() || '',
        roomType: rule.conditions?.roomType || 'all',
      },
      isActive: rule.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.chargeCategory || !formData.targetFolioType) {
      toast({ title: 'Validation Error', description: 'Name, category, and target folio type are required', variant: 'destructive' });
      return;
    }

    setIsSaving(true);
    try {
      const conditions: Record<string, unknown> = { source: formData.conditions.source };
      if (formData.conditions.amountMin) conditions.amountMin = parseFloat(formData.conditions.amountMin);
      if (formData.conditions.amountMax) conditions.amountMax = parseFloat(formData.conditions.amountMax);

      if (editingRule) {
        const res = await fetch('/api/billing/routing-rules', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingRule.id,
            ...formData,
            conditions,
          }),
        });
        const result = await res.json();
        if (result.success) {
          toast({ title: 'Success', description: 'Routing rule updated' });
          setIsDialogOpen(false);
          fetchRules();
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to update rule', variant: 'destructive' });
        }
      } else {
        const res = await fetch('/api/billing/routing-rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...formData,
            propertyId: 'default',
            conditions,
          }),
        });
        const result = await res.json();
        if (result.success) {
          toast({ title: 'Success', description: 'Routing rule created' });
          setIsDialogOpen(false);
          fetchRules();
        } else {
          toast({ title: 'Error', description: result.error?.message || 'Failed to create rule', variant: 'destructive' });
        }
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to save routing rule', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (rule: RoutingRule) => {
    try {
      const res = await fetch('/api/billing/routing-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rule.id, isActive: !rule.isActive }),
      });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: `Rule ${!rule.isActive ? 'enabled' : 'disabled'}` });
        fetchRules();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle rule', variant: 'destructive' });
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      const res = await fetch(`/api/billing/routing-rules?id=${ruleId}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        toast({ title: 'Success', description: 'Rule deleted' });
        fetchRules();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete rule', variant: 'destructive' });
    }
  };

  const getCategoryLabel = (value: string) => CHARGE_CATEGORIES.find((c) => c.value === value)?.label || value;
  const getCategoryIcon = (value: string) => CHARGE_CATEGORIES.find((c) => c.value === value)?.icon || '📦';
  const getTargetLabel = (value: string) => TARGET_FOLIO_TYPES.find((t) => t.value === value)?.label || value;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-teal-600" />
            Folio Routing Rules
          </h2>
          <p className="text-sm text-muted-foreground">
            Auto-route charges to specific folios based on category and conditions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchRules}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <GitBranch className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.totalRules}</div>
                <div className="text-xs text-muted-foreground">Total Rules</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.activeRules}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-gray-500/10">
                <AlertCircle className="h-4 w-4 text-gray-500" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.inactiveRules}</div>
                <div className="text-xs text-muted-foreground">Inactive</div>
              </div>
            </div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Filter className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.categoriesCovered?.length || 0}</div>
                <div className="text-xs text-muted-foreground">Categories</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Rules List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowUpDown className="h-4 w-4" />
            Active Rules (sorted by priority)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <GitBranch className="h-12 w-12 mb-4" />
              <p>No routing rules configured</p>
              <p className="text-sm">Create a rule to start auto-routing charges</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[500px]">
              <div className="divide-y">
                {rules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className={cn(
                      'flex items-center justify-between p-4 gap-4 hover:bg-muted/50 transition-colors',
                      !rule.isActive && 'opacity-60'
                    )}
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-teal-400 text-white text-xs font-bold shrink-0">
                        {rule.priority}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-lg mr-1">{getCategoryIcon(rule.chargeCategory)}</span>
                          <span className="font-medium truncate">{rule.name}</span>
                          {rule.isActive ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-700 text-xs">Active</Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-gray-500/10 text-gray-600 text-xs">Inactive</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                          <span>{getCategoryLabel(rule.chargeCategory)}</span>
                          <span>→</span>
                          <span className="text-teal-600 font-medium">{getTargetLabel(rule.targetFolioType)}</span>
                          {rule.conditions?.source && rule.conditions.source !== 'all' && (
                            <Badge variant="outline" className="text-xs">{rule.conditions.source}</Badge>
                          )}
                          {rule.conditions?.amountMin && (
                            <span>Min: ${rule.conditions.amountMin}</span>
                          )}
                          {rule.conditions?.amountMax && (
                            <span>Max: ${rule.conditions.amountMax}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={rule.isActive} onCheckedChange={() => handleToggle(rule)} />
                      <Button variant="ghost" size="sm" onClick={() => openEditDialog(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(rule.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { resetForm(); } setIsDialogOpen(open); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-teal-600" />
              {editingRule ? 'Edit Routing Rule' : 'New Routing Rule'}
            </DialogTitle>
            <DialogDescription>
              Define how charges are automatically routed to specific folios
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rule-name">Rule Name</Label>
              <Input
                id="rule-name"
                placeholder="e.g., Room charges to company folio"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rule-desc">Description</Label>
              <Input
                id="rule-desc"
                placeholder="Optional description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="charge-category">Charge Category</Label>
                <Select
                  value={formData.chargeCategory}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, chargeCategory: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.icon} {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target-folio">Target Folio Type</Label>
                <Select
                  value={formData.targetFolioType}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, targetFolioType: val }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target" />
                  </SelectTrigger>
                  <SelectContent>
                    {TARGET_FOLIO_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="priority">Priority</Label>
                <Input
                  id="priority"
                  type="number"
                  min={0}
                  value={formData.priority}
                  onChange={(e) => setFormData((prev) => ({ ...prev, priority: parseInt(e.target.value) || 0 }))}
                />
                <p className="text-xs text-muted-foreground">Lower = higher priority</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="source">Source</Label>
                <Select
                  value={formData.conditions.source}
                  onValueChange={(val) => setFormData((prev) => ({ ...prev, conditions: { ...prev.conditions, source: val } }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="p-3 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">Amount Range Conditions (optional)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min Amount ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    value={formData.conditions.amountMin}
                    onChange={(e) => setFormData((prev) => ({ ...prev, conditions: { ...prev.conditions, amountMin: e.target.value } }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Amount ($)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="No limit"
                    value={formData.conditions.amountMax}
                    onChange={(e) => setFormData((prev) => ({ ...prev, conditions: { ...prev.conditions, amountMax: e.target.value } }))}
                  />
                </div>
              </div>
            </Card>

            <div className="flex items-center justify-between">
              <Label htmlFor="is-active">Active</Label>
              <Switch
                id="is-active"
                checked={formData.isActive}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isActive: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { resetForm(); setIsDialogOpen(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
