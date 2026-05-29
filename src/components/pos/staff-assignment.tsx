'use client';

import { useTranslations } from 'next-intl';

import { useState, useEffect, useCallback } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Users, Loader2, UserCheck, Clock, Plus, Trash2, Briefcase } from 'lucide-react';

interface StaffMember { id: string; name: string; role: string; status: string; tablesCount: number; ordersCount: number; }
interface Assignment { id: string; tableId: string; tableNumber: string; staffId: string; staffName: string; startedAt: string; }

export default function StaffAssignment() {
const t = useTranslations('pos');
  const { propertyId } = usePropertyId();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tables, setTables] = useState<{ id: string; number: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignDialog, setAssignDialog] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const fetchData = useCallback(async () => {
    if (!propertyId) return;
    try {
      const [sRes, aRes, tRes] = await Promise.all([
        fetch(`/api/pos-staff?propertyId=${propertyId}`),
        fetch(`/api/pos-staff?propertyId=${propertyId}&assignments=true`),
        fetch(`/api/tables?propertyId=${propertyId}&status=occupied`),
      ]);
      const sData = await sRes.json(); const aData = await aRes.json(); const tData = await tRes.json();
      if (sData.success) setStaff(sData.data || []);
      if (aData.success) setAssignments(aData.data?.assignments || []);
      if (tData.success) setTables((tData.data || []).map((t: any) => ({ id: t.id, number: t.number })));
    } catch (error) { console.error('Context: fetching staff assignment data:', error); } finally { setLoading(false); }
  }, [propertyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const doAssign = async () => {
    if (!selectedTableId || !selectedStaffId) return;
    setAssigning(true);
    try {
      const res = await fetch('/api/pos-staff', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ propertyId, tableId: selectedTableId, staffId: selectedStaffId }) });
      const data = await res.json();
      if (data.success) { toast.success('Staff assigned to table'); setAssignDialog(false); fetchData(); } else toast.error(data.error?.message || 'Failed');
    } catch { toast.error('Failed'); } finally { setAssigning(false); }
  };

  const removeAssignment = async (id: string) => {
    try {
      const res = await fetch('/api/pos-staff', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
      const data = await res.json();
      if (data.success) { toast.success('Assignment removed'); fetchData(); }
    } catch (error) { console.error('Context: removing assignment:', error); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  if (!propertyId) return <div className="flex flex-col items-center justify-center h-64 text-muted-foreground"><Users className="h-12 w-12 mb-4" /><p>No Property Selected</p></div>;

  const onDutyStaff = staff.filter(s => s.status === 'on-duty');
  const unassignedTables = tables.filter(t => !assignments.some(a => a.tableId === t.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Staff Assignment</h1><p className="text-muted-foreground">Assign waiters to tables</p></div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setAssignDialog(true)} disabled={onDutyStaff.length === 0}>
          <Plus className="h-4 w-4 mr-2" />Assign Staff
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {/* Staff List */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Staff</CardTitle><CardDescription>{onDutyStaff.length} on duty</CardDescription></CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {onDutyStaff.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No staff on duty</p> : onDutyStaff.map(s => (
                  <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-teal-100 to-teal-200 dark:from-teal-800 dark:to-teal-900 flex items-center justify-center"><UserCheck className="h-4 w-4" /></div>
                      <div>
                        <p className="font-medium text-sm">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.role} • {s.tablesCount} tables • {s.ordersCount} orders</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200">On Duty</Badge>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Assignments */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><Briefcase className="h-4 w-4" />Current Assignments</CardTitle><CardDescription>{assignments.length} active assignments</CardDescription></CardHeader>
          <CardContent>
            <ScrollArea className="max-h-96">
              <div className="space-y-2">
                {assignments.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">No assignments yet</p> : assignments.map(a => (
                  <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">Table {a.tableNumber}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="text-sm">{a.staffName}</span>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(a.startedAt).toLocaleTimeString()}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8" onClick={() => removeAssignment(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Assign Dialog */}
      <Dialog open={assignDialog} onOpenChange={setAssignDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Assign Staff to Table</DialogTitle><DialogDescription>Select a staff member and table</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div><label className="text-sm font-medium">Staff Member</label>
              <Select value={selectedStaffId} onValueChange={setSelectedStaffId}>
                <SelectTrigger><SelectValue placeholder="Select staff" /></SelectTrigger>
                <SelectContent>{onDutyStaff.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.tablesCount} tables)</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><label className="text-sm font-medium">Table</label>
              <Select value={selectedTableId} onValueChange={setSelectedTableId}>
                <SelectTrigger><SelectValue placeholder="Select table" /></SelectTrigger>
                <SelectContent>{unassignedTables.map(t => <SelectItem key={t.id} value={t.id}>Table {t.number}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialog(false)}>Cancel</Button>
            <Button onClick={doAssign} disabled={assigning || !selectedStaffId || !selectedTableId} className="bg-emerald-600 hover:bg-emerald-700">{assigning ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
