'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Layers, Merge, Split, Loader2, CheckCircle, History } from 'lucide-react';

interface Table { id: string; number: string; capacity: number; area?: string; status: string; }
interface MergeRecord { id: string; tableIds: string; partySize: number; status: string; mergedAt: string; splitAt?: string; tables: Table[]; }

export default function TableMerge() {
const t = useTranslations('pos');
  const { propertyId } = usePropertyId();
  const [tables, setTables] = useState<Table[]>([]);
  const [merges, setMerges] = useState<MergeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTables, setSelectedTables] = useState<string[]>([]);
  const [partySize, setPartySize] = useState(0);
  const [mergeDialog, setMergeDialog] = useState(false);
  const [merging, setMerging] = useState(false);

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    try {
      const [tRes, mRes] = await Promise.all([
        fetch(`/api/tables?propertyId=${propertyId}`),
        fetch(`/api/tables/merge?XTransformPort=3000&propertyId=${propertyId}`),
      ]);
      const tData = await tRes.json();
      const mData = await mRes.json();
      if (tData.success) setTables((tData.data || []).map((t: any) => ({ id: t.id, number: t.number, capacity: t.capacity, area: t.area, status: t.status })));
      if (mData.success) setMerges(mData.data || []);
    } catch { } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const availableTables = tables.filter(t => t.status === 'available');
  const mergedTableIds = new Set(merges.filter(m => m.status === 'merged').flatMap(m => JSON.parse(m.tableIds)));
  const selectableTables = availableTables.filter(t => !mergedTableIds.has(t.id));
  const selectedCapacity = selectedTables.reduce((sum, id) => sum + (tables.find(t => t.id === id)?.capacity || 0), 0);

  const toggleTable = (id: string) => {
    setSelectedTables(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
  };

  const doMerge = async () => {
    if (selectedTables.length < 2 || partySize <= 0) { toast.error('Select at least 2 tables and party size'); return; }
    setMerging(true);
    try {
      const res = await fetch('/api/tables/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, tableIds: selectedTables, partySize }) });
      const data = await res.json();
      if (data.success) { toast.success('Tables merged'); setMergeDialog(false); setSelectedTables([]); setPartySize(0); fetchData(); } else toast.error(data.error?.message || 'Failed');
    } catch { toast.error('Failed'); } finally { setMerging(false); }
  };

  const doSplit = async (mergeId: string) => {
    try {
      const res = await fetch('/api/tables/split', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mergedGroupId: mergeId, propertyId }) });
      const data = await res.json();
      if (data.success) { toast.success('Tables split back'); fetchData(); } else toast.error(data.error?.message || 'Failed');
    } catch { toast.error('Failed'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!propertyId) return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Layers className="h-12 w-12 mb-4" /><p>No Property Selected</p></div>;

  const activeMerges = merges.filter(m => m.status === 'merged');
  const historyMerges = merges.filter(m => m.status === 'split');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Table Merge / Split</h1><p className="text-muted-foreground">Combine tables for large parties</p></div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setMergeDialog(true)} disabled={selectableTables.length < 2}>
          <Merge className="h-4 w-4 mr-2" />Merge Tables
        </Button>
      </div>

      {/* Active Merges */}
      {activeMerges.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Merge className="h-4 w-4" />Active Merges ({activeMerges.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {activeMerges.map(m => {
                const tbls = m.tables || [];
                return (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-violet-50 dark:bg-violet-950/20">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200">Merged</Badge>
                        <span className="font-medium">{tbls.map(t => `T${t.number}`).join(' + ')}</span>
                        <span className="text-sm text-muted-foreground">• {m.partySize} guests • {tbls.reduce((s, t) => s + t.capacity, 0)} seats</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">Merged {new Date(m.mergedAt).toLocaleString()}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => doSplit(m.id)}><Split className="h-4 w-4 mr-1" />Split</Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Tables Grid */}
      <Card>
        <CardHeader><CardTitle>Available Tables</CardTitle><CardDescription>{selectableTables.length} tables available for merging</CardDescription></CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {selectableTables.map(t => (
              <div key={t.id} className="flex flex-col items-center justify-center p-3 rounded-lg border hover:border-emerald-300 transition-colors cursor-pointer" onClick={() => toggleTable(t.id)}>
                <div className={`h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${selectedTables.includes(t.id) ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}>
                  {t.number}
                </div>
                <span className="text-xs text-muted-foreground mt-1">{t.capacity} seats</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* History */}
      {historyMerges.length > 0 && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><History className="h-4 w-4" />Merge History</CardTitle></CardHeader>
          <CardContent><ScrollArea className="max-h-48"><div className="space-y-1">{historyMerges.map(m => (
            <div key={m.id} className="flex items-center justify-between p-2 text-sm rounded border"><span>{JSON.parse(m.tableIds).join(', ')}</span><span className="text-muted-foreground">Split {m.splitAt ? new Date(m.splitAt).toLocaleString() : 'N/A'}</span></div>
          ))}</div></ScrollArea></CardContent>
        </Card>
      )}

      {/* Merge Dialog */}
      <Dialog open={mergeDialog} onOpenChange={setMergeDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Merge Tables</DialogTitle><DialogDescription>Select tables to merge for a large party</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <ScrollArea className="h-48"><div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {selectableTables.map(t => (
                <div key={t.id} className={`flex items-center gap-2 p-2 rounded border cursor-pointer ${selectedTables.includes(t.id) ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30' : ''}`} onClick={() => toggleTable(t.id)}>
                  <Checkbox checked={selectedTables.includes(t.id)} />
                  <span className="text-sm font-medium">T{t.number}</span>
                  <span className="text-xs text-muted-foreground">({t.capacity})</span>
                </div>
              ))}
            </div></ScrollArea>
            {selectedTables.length > 0 && (
              <div className="text-sm">
                <p>Selected: {selectedTables.map(id => `T${tables.find(t => t.id === id)?.number}`).join(', ')}</p>
                <p className="text-muted-foreground">Combined capacity: {selectedCapacity} seats</p>
              </div>
            )}
            <div><label className="text-sm font-medium">Party Size</label><Input type="number" min={1} value={partySize || ''} onChange={e => setPartySize(+e.target.value)} placeholder="Number of guests" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setMergeDialog(false); setSelectedTables([]); }}>Cancel</Button>
            <Button onClick={doMerge} disabled={merging || selectedTables.length < 2 || partySize <= 0} className="bg-emerald-600 hover:bg-emerald-700">
              {merging ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Merge className="h-4 w-4 mr-1" />}Merge ({selectedTables.length} tables)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
