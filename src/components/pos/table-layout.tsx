'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePropertyId } from '@/hooks/use-property';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Save,
  Plus,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Grid3X3,
  Trash2,
  Loader2,
  Users,
  Square,
  Circle,
  RectangleHorizontal,
} from 'lucide-react';

interface LayoutTable {
  id: string;
  number: string;
  name?: string | null;
  capacity: number;
  status: string;
  area?: string | null;
  floor: number;
  shape: string;
  posX: number | null;
  posY: number | null;
  width: number | null;
  height: number | null;
}

const STATUS_COLORS: Record<string, { bg: string; border: string }> = {
  available: { bg: '#22c55e', border: '#16a34a' },
  occupied: { bg: '#ef4444', border: '#dc2626' },
  reserved: { bg: '#eab308', border: '#ca8a04' },
  cleaning: { bg: '#3b82f6', border: '#2563eb' },
};

const DEFAULT_WIDTH = 80;
const DEFAULT_HEIGHT = 80;
const MIN_WIDTH = 40;
const MIN_HEIGHT = 40;
const GRID_SIZE = 20;
const CANVAS_W = 1200;
const CANVAS_H = 800;

export default function TableLayout() {
  const { propertyId } = usePropertyId();
  const [tables, setTables] = useState<LayoutTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Canvas
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });

  // Drag state
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [dragTableStart, setDragTableStart] = useState({ x: 0, y: 0 });

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Edit panel
  const [editTable, setEditTable] = useState<LayoutTable | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    capacity: '4',
    shape: 'round',
    width: '80',
    height: '80',
  });

  // Add table dialog
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    number: '',
    name: '',
    capacity: '4',
    shape: 'round',
  });

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchTables = useCallback(async () => {
    if (!propertyId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/tables?propertyId=${propertyId}&limit=200`);
      const data = await res.json();
      if (data.success) {
        // Normalize: ensure all tables have positions
        const normalized = data.data.map((t: LayoutTable, idx: number) => ({
          ...t,
          posX: t.posX ?? (100 + (idx % 6) * 150),
          posY: t.posY ?? (100 + Math.floor(idx / 6) * 150),
          width: t.width ?? DEFAULT_WIDTH,
          height: t.height ?? DEFAULT_HEIGHT,
          shape: t.shape || 'round',
        }));
        setTables(normalized);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
      toast.error('Failed to fetch tables');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  // Mouse event handlers for drag
  const handleMouseDown = useCallback((e: React.MouseEvent, tableId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    setSelectedId(tableId);
    setEditTable(table);
    setEditForm({
      name: table.name || '',
      capacity: table.capacity.toString(),
      shape: table.shape || 'round',
      width: (table.width || DEFAULT_WIDTH).toString(),
      height: (table.height || DEFAULT_HEIGHT).toString(),
    });

    setDragging(tableId);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragTableStart({ x: table.posX ?? 0, y: table.posY ?? 0 });
  }, [tables]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;

    const dx = (e.clientX - dragStart.x) / zoom;
    const dy = (e.clientY - dragStart.y) / zoom;

    let newX = dragTableStart.x + dx;
    let newY = dragTableStart.y + dy;

    // Grid snap
    if (showGrid) {
      newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
      newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
    }

    // Clamp
    newX = Math.max(0, Math.min(newX, CANVAS_W - MIN_WIDTH));
    newY = Math.max(0, Math.min(newY, CANVAS_H - MIN_HEIGHT));

    setTables(prev => prev.map(t =>
      t.id === dragging ? { ...t, posX: newX, posY: newY } : t
    ));
  }, [dragging, dragStart, dragTableStart, zoom, showGrid]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
  }, []);

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('mousemove', handleMouseMove as unknown as EventListener);
      return () => {
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleMouseMove as unknown as EventListener);
      };
    }
  }, [dragging, handleMouseUp, handleMouseMove]);

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).dataset.canvas === 'true') {
      setSelectedId(null);
      setEditTable(null);
    }
  };

  // Save layout
  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = tables.map(t => ({
        id: t.id,
        posX: Math.round(t.posX ?? 0),
        posY: Math.round(t.posY ?? 0),
        width: Math.round(t.width ?? DEFAULT_WIDTH),
        height: Math.round(t.height ?? DEFAULT_HEIGHT),
        shape: t.shape,
        capacity: t.capacity,
        name: t.name || undefined,
      }));

      const res = await fetch('/api/tables/batch-layout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tables: payload }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(`Layout saved! ${data.data.updated} tables updated.`);
      } else {
        toast.error(data.error?.message || 'Failed to save layout');
      }
    } catch (error) {
      console.error('Error saving layout:', error);
      toast.error('Failed to save layout');
    } finally {
      setSaving(false);
    }
  };

  // Add table
  const handleAddTable = async () => {
    if (!addForm.number.trim()) {
      toast.error('Table number is required');
      return;
    }

    try {
      const res = await fetch('/api/tables', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId,
          number: addForm.number,
          name: addForm.name || undefined,
          capacity: parseInt(addForm.capacity, 10),
          shape: addForm.shape,
          status: 'available',
          floor: 1,
          posX: Math.round(CANVAS_W / 2),
          posY: Math.round(CANVAS_H / 2),
          width: DEFAULT_WIDTH,
          height: DEFAULT_HEIGHT,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Table added successfully');
        setAddDialogOpen(false);
        setAddForm({ number: '', name: '', capacity: '4', shape: 'round' });
        fetchTables();
      } else {
        toast.error(data.error?.message || 'Failed to add table');
      }
    } catch (error) {
      console.error('Error adding table:', error);
      toast.error('Failed to add table');
    }
  };

  // Update selected table from edit panel
  const handleUpdateTable = async () => {
    if (!editTable) return;

    try {
      const w = parseInt(editForm.width, 10);
      const h = parseInt(editForm.height, 10);

      const res = await fetch('/api/tables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editTable.id,
          name: editForm.name || undefined,
          capacity: parseInt(editForm.capacity, 10),
          shape: editForm.shape,
          width: isNaN(w) ? undefined : w,
          height: isNaN(h) ? undefined : h,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Table updated');
        // Update local state
        setTables(prev => prev.map(t =>
          t.id === editTable.id ? {
            ...t,
            name: editForm.name || undefined,
            capacity: parseInt(editForm.capacity, 10),
            shape: editForm.shape,
            width: isNaN(w) ? t.width : w,
            height: isNaN(h) ? t.height : h,
          } : t
        ));
        setEditTable(prev => prev ? {
          ...prev,
          name: editForm.name || undefined,
          capacity: parseInt(editForm.capacity, 10),
          shape: editForm.shape,
          width: isNaN(w) ? prev.width : w,
          height: isNaN(h) ? prev.height : h,
        } : null);
      } else {
        toast.error(data.error?.message || 'Failed to update table');
      }
    } catch (error) {
      console.error('Error updating table:', error);
      toast.error('Failed to update table');
    }
  };

  // Delete table
  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/tables?id=${deleteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        toast.success('Table deleted');
        setTables(prev => prev.filter(t => t.id !== deleteId));
        if (selectedId === deleteId) {
          setSelectedId(null);
          setEditTable(null);
        }
      } else {
        toast.error(data.error?.message || 'Failed to delete table');
      }
    } catch {
      toast.error('Failed to delete table');
    } finally {
      setDeleteId(null);
    }
  };

  // Zoom controls
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.3));
  const handleResetZoom = () => setZoom(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedTable = tables.find(t => t.id === selectedId);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Table Layout</h1>
        <p className="text-muted-foreground">
          Drag tables to position them on the floor plan
        </p>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Layout
            </Button>

            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Table
              </Button>
              <DialogContent className="w-[95vw] sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Table</DialogTitle>
                  <DialogDescription>Add a new table to the layout</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Table Number *</Label>
                    <Input
                      value={addForm.number}
                      onChange={(e) => setAddForm({ ...addForm, number: e.target.value })}
                      placeholder="e.g., T12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Name (Optional)</Label>
                    <Input
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      placeholder="e.g., Window Seat"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Capacity</Label>
                      <Select
                        value={addForm.capacity}
                        onValueChange={(v) => setAddForm({ ...addForm, capacity: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2, 4, 6, 8, 10, 12].map(c => (
                            <SelectItem key={c} value={c.toString()}>{c} seats</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Shape</Label>
                      <Select
                        value={addForm.shape}
                        onValueChange={(v) => setAddForm({ ...addForm, shape: v })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="round">Round</SelectItem>
                          <SelectItem value="square">Square</SelectItem>
                          <SelectItem value="rectangular">Rectangular</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleAddTable} className="bg-gradient-to-r from-emerald-500 to-teal-600">Add Table</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <div className="h-6 w-px bg-border mx-1" />

            <Button variant="outline" size="sm" onClick={handleResetZoom} title="Reset Zoom">
              <RotateCcw className="h-4 w-4 mr-1" />
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomIn} title="Zoom In">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={handleZoomOut} title="Zoom Out">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3rem]">{Math.round(zoom * 100)}%</span>

            <div className="h-6 w-px bg-border mx-1" />

            <Button
              variant={showGrid ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowGrid(!showGrid)}
              title="Toggle Grid Snap"
            >
              <Grid3X3 className="h-4 w-4 mr-1" />
              Grid {showGrid ? 'ON' : 'OFF'}
            </Button>

            {/* Status Legend */}
            <div className="ml-auto flex items-center gap-3 text-xs">
              {Object.entries(STATUS_COLORS).map(([status, { bg }]) => (
                <div key={status} className="flex items-center gap-1">
                  <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: bg }} />
                  <span className="capitalize text-muted-foreground">{status}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Layout: Canvas + Edit Panel */}
      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Canvas */}
        <Card className="flex-1 overflow-hidden">
          <CardContent className="p-0">
            <div
              className="overflow-auto border border-dashed border-muted-foreground/20 rounded-md"
              style={{ minHeight: 600 }}
              onClick={handleCanvasClick}
              data-canvas="true"
            >
              <div
                ref={canvasRef}
                className="relative bg-muted/20"
                style={{
                  width: CANVAS_W * zoom,
                  height: CANVAS_H * zoom,
                  minWidth: 800,
                  minHeight: 600,
                  backgroundImage: showGrid
                    ? `linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                       linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)`
                    : 'none',
                  backgroundSize: showGrid
                    ? `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`
                    : 'none',
                }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              >
                {tables.map((table) => {
                  const colors = STATUS_COLORS[table.status] || STATUS_COLORS.available;
                  const isSelected = table.id === selectedId;
                  const w = (table.width || DEFAULT_WIDTH) * zoom;
                  const h = (table.height || DEFAULT_HEIGHT) * zoom;
                  const x = (table.posX || 0) * zoom;
                  const y = (table.posY || 0) * zoom;
                  const isRound = table.shape === 'round';
                  const isDragging = dragging === table.id;

                  return (
                    <div
                      key={table.id}
                      className={`absolute flex flex-col items-center justify-center cursor-grab active:cursor-grabbing select-none transition-shadow ${
                        isSelected ? 'ring-2 ring-offset-2 ring-primary shadow-lg' : ''
                      } ${isDragging ? 'opacity-80 shadow-xl' : 'hover:shadow-md'}`}
                      style={{
                        left: x,
                        top: y,
                        width: w,
                        height: h,
                        backgroundColor: colors.bg,
                        borderRadius: isRound ? '50%' : table.shape === 'rectangular' ? '8px' : '4px',
                        border: `2px solid ${colors.border}`,
                        minWidth: MIN_WIDTH * zoom,
                        minHeight: MIN_HEIGHT * zoom,
                        zIndex: isDragging ? 10 : isSelected ? 5 : 1,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, table.id)}
                    >
                      <span className="text-white font-bold text-sm leading-tight text-center px-1" style={{ fontSize: Math.max(10, 12 * zoom) }}>
                        {table.number}
                      </span>
                      <span className="text-white/80 text-xs flex items-center gap-0.5" style={{ fontSize: Math.max(8, 10 * zoom) }}>
                        <Users className="h-2.5 w-2.5" />
                        {table.capacity}
                      </span>
                    </div>
                  );
                })}

                {/* Canvas label */}
                <div className="absolute bottom-2 right-2 text-xs text-muted-foreground/40 pointer-events-none">
                  {CANVAS_W} × {CANVAS_H} px
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Panel */}
        {selectedTable && (
          <Card className="w-full lg:w-72 shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Edit Table</CardTitle>
              <CardDescription>
                {selectedTable.number} — {selectedTable.status}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Table Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="e.g., Window Seat"
                />
              </div>

              <div className="space-y-2">
                <Label>Capacity</Label>
                <Select
                  value={editForm.capacity}
                  onValueChange={(v) => setEditForm({ ...editForm, capacity: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 6, 8, 10, 12, 14, 16, 20].map(c => (
                      <SelectItem key={c} value={c.toString()}>{c} seats</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Shape</Label>
                <Select
                  value={editForm.shape}
                  onValueChange={(v) => setEditForm({ ...editForm, shape: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round">
                      <span className="flex items-center gap-2"><Circle className="h-3 w-3" /> Round</span>
                    </SelectItem>
                    <SelectItem value="square">
                      <span className="flex items-center gap-2"><Square className="h-3 w-3" /> Square</span>
                    </SelectItem>
                    <SelectItem value="rectangular">
                      <span className="flex items-center gap-2"><RectangleHorizontal className="h-3 w-3" /> Rectangular</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Width (px)</Label>
                  <Input
                    type="number"
                    min={MIN_WIDTH}
                    value={editForm.width}
                    onChange={(e) => setEditForm({ ...editForm, width: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Height (px)</Label>
                  <Input
                    type="number"
                    min={MIN_HEIGHT}
                    value={editForm.height}
                    onChange={(e) => setEditForm({ ...editForm, height: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <p>Position: X={Math.round(selectedTable.posX ?? 0)}, Y={Math.round(selectedTable.posY ?? 0)}</p>
                <p>Status: <Badge variant="outline" className="text-xs capitalize">{selectedTable.status}</Badge></p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  className="flex-1 bg-gradient-to-r from-emerald-500 to-teal-600"
                  size="sm"
                  onClick={handleUpdateTable}
                >
                  Apply Changes
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setDeleteId(selectedTable.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* No selection hint */}
        {!selectedTable && (
          <Card className="w-full lg:w-72 shrink-0">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <RectangleHorizontal className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No Table Selected</p>
              <p className="text-xs text-muted-foreground mt-1">
                Click a table on the canvas to edit its properties
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Empty state */}
      {tables.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Grid3X3 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Tables Yet</h3>
            <p className="text-muted-foreground text-center">
              Add your first table to start building the layout
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Table</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this table? It will be removed from the layout.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
