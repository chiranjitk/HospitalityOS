'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  Plus,
  Loader2,
  Trophy,
  Eye,
  MousePointer,
  Target,
  TrendingUp,
  AlertTriangle,
  FlaskConical,
  Trash2,
  Edit,
} from 'lucide-react';
import { toast } from 'sonner';

interface AbVariant {
  id: string;
  variantLabel: string;
  variantName: string;
  subject?: string | null;
  content: string;
  splitPercentage: number;
  sentCount: number;
  openedCount: number;
  clickedCount: number;
  conversionCount: number;
  isWinner: boolean;
  declaredAt?: string | null;
  openRate?: string;
  clickRate?: string;
  conversionRate?: string;
  splitPercentageOfTotal?: string;
}

interface AbTestData {
  variants: AbVariant[];
  totalSent: number;
  hasWinner: boolean;
  significance?: {
    zScore: string;
    isSignificant: boolean;
    confidenceLevel: string;
  } | null;
}

interface AbTestManagerProps {
  campaignId: string;
  campaignName: string;
}

export default function AbTestManager({ campaignId, campaignName }: AbTestManagerProps) {
  const [data, setData] = useState<AbTestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingVariant, setEditingVariant] = useState<AbVariant | null>(null);
  const [saving, setSaving] = useState(false);

  const [newVariant, setNewVariant] = useState({
    variantLabel: '',
    variantName: '',
    subject: '',
    content: '',
    splitPercentage: 50,
  });

  const fetchResults = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/ab-test`);
      if (res.ok) {
        const json = await res.json();
        setData(json.data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  // Initial fetch
  const fetchResultsRef = useRef(true);
  useEffect(() => {
    if (fetchResultsRef.current) {
      fetchResultsRef.current = false;
      fetchResults();
    }
  }, [fetchResults]);

  const handleCreateVariant = async () => {
    if (!newVariant.variantLabel || !newVariant.variantName || !newVariant.content) {
      toast.error('Fill in required fields');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/ab-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newVariant),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Variant created');
        setCreateDialogOpen(false);
        setNewVariant({ variantLabel: '', variantName: '', subject: '', content: '', splitPercentage: 50 });
        fetchResults();
      } else {
        toast.error(json.error || 'Failed to create variant');
      }
    } catch (error) {
      toast.error('Failed to create variant');
    } finally {
      setSaving(false);
    }
  };

  const handleDeclareWinner = async (variantId: string) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/ab-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'winner', variantId }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Winner declared! Applying to full audience.');
        fetchResults();
      } else {
        toast.error(json.error || 'Failed to declare winner');
      }
    } catch (error) {
      toast.error('Failed to declare winner');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateVariant = async () => {
    if (!editingVariant) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/ab-test`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          variantId: editingVariant.id,
          variantName: editingVariant.variantName,
          subject: editingVariant.subject,
          content: editingVariant.content,
          splitPercentage: editingVariant.splitPercentage,
        }),
      });

      const json = await res.json();
      if (json.success) {
        toast.success('Variant updated');
        setEditDialogOpen(false);
        fetchResults();
      } else {
        toast.error(json.error || 'Failed to update variant');
      }
    } catch (error) {
      toast.error('Failed to update variant');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!data || data.variants.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-violet-500" />
            A/B Test
          </h4>
          <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Create Variant
          </Button>
        </div>
        <div className="text-center py-8 text-muted-foreground border rounded-lg">
          <FlaskConical className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No A/B test variants. Create variants to compare performance.</p>
        </div>
        <CreateVariantDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          formData={newVariant}
          setFormData={setNewVariant}
          onSubmit={handleCreateVariant}
          saving={saving}
          existingLabels={[]}
        />
      </div>
    );
  }

  const bestVariant = [...data.variants].sort((a, b) => {
    const rateA = parseFloat(a.clickRate || '0');
    const rateB = parseFloat(b.clickRate || '0');
    return rateB - rateA;
  })[0];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-violet-500" />
            A/B Test Results
            {data.hasWinner && <Trophy className="h-4 w-4 text-amber-500" />}
          </h4>
          <p className="text-xs text-muted-foreground">Campaign: {campaignName}</p>
        </div>
        <div className="flex gap-2">
          {data.significance && (
            <Badge variant={data.significance.isSignificant ? 'default' : 'secondary'}
              className={data.significance.isSignificant ? 'bg-emerald-500' : ''}>
              {data.significance.confidenceLevel} Confidence
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> Add Variant
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Total Sent</p>
          <p className="text-lg font-bold">{data.totalSent}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Variants</p>
          <p className="text-lg font-bold">{data.variants.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Best Click Rate</p>
          <p className="text-lg font-bold text-emerald-600">{bestVariant?.clickRate || 0}%</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Best Open Rate</p>
          <p className="text-lg font-bold text-cyan-600">{bestVariant?.openRate || 0}%</p>
        </Card>
      </div>

      {/* Variant Comparison */}
      <Tabs defaultValue="comparison">
        <TabsList className="w-full">
          <TabsTrigger value="comparison" className="flex-1">
            <BarChart3 className="h-4 w-4 mr-1" /> Comparison
          </TabsTrigger>
          <TabsTrigger value="details" className="flex-1">
            <Eye className="h-4 w-4 mr-1" /> Details
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comparison" className="space-y-3 mt-4">
          {data.variants.map((variant) => (
            <Card key={variant.id} className={`border-2 ${variant.isWinner ? 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/20' : ''}`}>
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-violet-600 text-white text-xs">{variant.variantLabel}</Badge>
                      <span className="font-medium">{variant.variantName}</span>
                      {variant.isWinner && (
                        <Badge className="bg-amber-500 text-white">
                          <Trophy className="h-3 w-3 mr-1" /> Winner
                        </Badge>
                      )}
                      {variant === bestVariant && !data.hasWinner && (
                        <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                          <TrendingUp className="h-3 w-3 mr-1" /> Best
                        </Badge>
                      )}
                    </div>
                    {variant.subject && (
                      <p className="text-sm text-muted-foreground truncate max-w-md">{variant.subject}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => { setEditingVariant(variant); setEditDialogOpen(true); }}>
                      <Edit className="h-3 w-3 mr-1" /> Edit
                    </Button>
                    {!data.hasWinner && (
                      <Button size="sm" variant="outline" className="text-amber-600 border-amber-300 hover:bg-amber-50"
                        onClick={() => handleDeclareWinner(variant.id)} disabled={saving}>
                        <Trophy className="h-3 w-3 mr-1" /> Declare Winner
                      </Button>
                    )}
                  </div>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-4">
                  <div className="text-center p-2 bg-muted/50 rounded">
                    <p className="text-lg font-bold">{variant.sentCount}</p>
                    <p className="text-xs text-muted-foreground">Sent</p>
                  </div>
                  <div className="text-center p-2 bg-emerald-50 dark:bg-emerald-950/30 rounded">
                    <p className="text-lg font-bold text-emerald-600">{variant.openRate || 0}%</p>
                    <p className="text-xs text-muted-foreground">Open Rate</p>
                    <Progress value={parseFloat(variant.openRate || '0')} className="h-1 mt-1" />
                  </div>
                  <div className="text-center p-2 bg-cyan-50 dark:bg-cyan-950/30 rounded">
                    <p className="text-lg font-bold text-cyan-600">{variant.clickRate || 0}%</p>
                    <p className="text-xs text-muted-foreground">Click Rate</p>
                    <Progress value={parseFloat(variant.clickRate || '0')} className="h-1 mt-1" />
                  </div>
                  <div className="text-center p-2 bg-rose-50 dark:bg-rose-950/30 rounded">
                    <p className="text-lg font-bold text-rose-600">{variant.conversionRate || 0}%</p>
                    <p className="text-xs text-muted-foreground">Conversion</p>
                    <Progress value={parseFloat(variant.conversionRate || '0')} className="h-1 mt-1" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="details" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {data.variants.map((variant) => (
              <Card key={variant.id} className={variant.isWinner ? 'border-amber-400' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Badge className="bg-violet-600 text-white text-xs">{variant.variantLabel}</Badge>
                      {variant.variantName}
                      {variant.isWinner && <Trophy className="h-4 w-4 text-amber-500" />}
                    </CardTitle>
                    <Badge variant="outline" className="text-xs">{variant.splitPercentage}%</Badge>
                  </div>
                </CardHeader>
                <CardContent className="text-sm">
                  {variant.subject && (
                    <div className="mb-2">
                      <span className="text-muted-foreground">Subject: </span>
                      <span>{variant.subject}</span>
                    </div>
                  )}
                  <div className="bg-muted/50 rounded p-2 max-h-32 overflow-y-auto">
                    <p className="whitespace-pre-wrap text-xs">{variant.content}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Variant Dialog */}
      <CreateVariantDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        formData={newVariant}
        setFormData={setNewVariant}
        onSubmit={handleCreateVariant}
        saving={saving}
        existingLabels={data.variants.map(v => v.variantLabel)}
      />

      {/* Edit Variant Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Variant {editingVariant?.variantLabel}</DialogTitle>
            <DialogDescription>Update variant configuration</DialogDescription>
          </DialogHeader>
          {editingVariant && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Variant Name</Label>
                <Input value={editingVariant.variantName}
                  onChange={e => setEditingVariant({ ...editingVariant, variantName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Subject Line</Label>
                <Input value={editingVariant.subject || ''}
                  onChange={e => setEditingVariant({ ...editingVariant, subject: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea value={editingVariant.content}
                  onChange={e => setEditingVariant({ ...editingVariant, content: e.target.value })} rows={6} />
              </div>
              <div className="space-y-2">
                <Label>Split Percentage: {editingVariant.splitPercentage}%</Label>
                <Input type="range" min="1" max="99" value={editingVariant.splitPercentage}
                  onChange={e => setEditingVariant({ ...editingVariant, splitPercentage: parseInt(e.target.value) })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateVariant} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CreateVariantDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onSubmit,
  saving,
  existingLabels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: { variantLabel: string; variantName: string; subject: string; content: string; splitPercentage: number };
  setFormData: React.Dispatch<React.SetStateAction<{ variantLabel: string; variantName: string; subject: string; content: string; splitPercentage: number }>>;
  onSubmit: () => void;
  saving: boolean;
  existingLabels: string[];
}) {
  const nextLabel = String.fromCharCode(65 + existingLabels.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create A/B Test Variant</DialogTitle>
          <DialogDescription>Add a new variant to test against</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Variant Label *</Label>
              <Input placeholder={nextLabel} value={formData.variantLabel}
                onChange={e => setFormData({ ...formData, variantLabel: e.target.value })}
                maxLength={1} />
            </div>
            <div className="space-y-2">
              <Label>Variant Name *</Label>
              <Input placeholder="e.g., Control Group" value={formData.variantName}
                onChange={e => setFormData({ ...formData, variantName: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input placeholder="Email subject for this variant" value={formData.subject}
              onChange={e => setFormData({ ...formData, subject: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Content *</Label>
            <Textarea placeholder="Variant content..." value={formData.content}
              onChange={e => setFormData({ ...formData, content: e.target.value })} rows={5} />
          </div>
          <div className="space-y-2">
            <Label>Split Percentage: {formData.splitPercentage}%</Label>
            <Input type="range" min="1" max="99" value={formData.splitPercentage}
              onChange={e => setFormData({ ...formData, splitPercentage: parseInt(e.target.value) })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Create Variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
