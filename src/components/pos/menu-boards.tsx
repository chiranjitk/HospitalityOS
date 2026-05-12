'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  Eye,
  Monitor,
  Layout,
  Palette,
  GripVertical,
  Star,
  DollarSign,
  Tag,
  ChevronUp,
  ChevronDown,
  RefreshCw,
  Image as ImageIcon,
  X,
  Settings,
  Tv,
  MapPin,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useCurrency } from '@/contexts/CurrencyContext';

// ── Types ──────────────────────────────────────────────────────────

interface MenuBoardItem {
  id: string;
  boardId: string;
  menuItemId: string | null;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  category: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured: boolean;
  sortOrder: number;
}

interface MenuBoard {
  id: string;
  name: string;
  description: string | null;
  location: string;
  orientation: string;
  resolution: string;
  theme: string;
  isActive: boolean;
  _count?: { items: number };
  items?: MenuBoardItem[];
}

// ── Constants ──────────────────────────────────────────────────────

const THEME_OPTIONS = [
  { value: 'default', label: 'Default', preview: 'from-gray-800 to-gray-900' },
  { value: 'elegant', label: 'Elegant', preview: 'from-amber-900 to-stone-900' },
  { value: 'casual', label: 'Casual', preview: 'from-emerald-800 to-teal-900' },
  { value: 'minimalist', label: 'Minimalist', preview: 'from-slate-700 to-slate-900' },
  { value: 'tropical', label: 'Tropical', preview: 'from-cyan-800 to-sky-900' },
];

const LOCATION_OPTIONS = [
  'main_restaurant', 'lobby', 'pool_bar', 'rooftop', 'room_service', 'coffee_shop', 'bar', 'banquet_hall', 'spa', 'golf_club',
];

const ORIENTATION_OPTIONS = [
  { value: 'landscape', label: 'Landscape (16:9)' },
  { value: 'portrait', label: 'Portrait (9:16)' },
];

const RESOLUTION_OPTIONS = [
  { value: '1920x1080', label: '1920 × 1080 (Full HD)' },
  { value: '3840x2160', label: '3840 × 2160 (4K)' },
  { value: '1080x1920', label: '1080 × 1920 (Portrait HD)' },
  { value: '1280x720', label: '1280 × 720 (HD)' },
];

const ITEM_CATEGORIES = [
  'appetizer', 'main_course', 'dessert', 'beverage', 'cocktail', 'beer', 'wine', 'coffee', 'tea',
  'salad', 'soup', 'pizza', 'pasta', 'sandwich', 'burger', 'seafood', 'grill', 'side', 'kids_menu',
];

// ── Component ──────────────────────────────────────────────────────

export default function DigitalMenuBoards() {
  const { toast } = useToast();
  const { formatCurrency } = useCurrency();
  const [activeTab, setActiveTab] = useState('boards');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Data
  const [boards, setBoards] = useState<MenuBoard[]>([]);
  const [selectedBoard, setSelectedBoard] = useState<MenuBoard | null>(null);
  const [boardItems, setBoardItems] = useState<MenuBoardItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Dialogs
  const [isBoardDialogOpen, setIsBoardDialogOpen] = useState(false);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<MenuBoard | null>(null);

  // Form states
  const [boardForm, setBoardForm] = useState({ name: '', description: '', location: 'main_restaurant', orientation: 'landscape', resolution: '1920x1080', theme: 'default' });
  const [itemForm, setItemForm] = useState({ name: '', description: '', price: 0, category: 'appetizer', isAvailable: true, isFeatured: false, imageUrl: '' });

  // ── Data fetching ───────────────────────────────────────────────

  const fetchBoards = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/pos/menu-boards?${params}`);
      const json = await res.json();
      if (json.success) setBoards(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load menu boards', variant: 'destructive' });
    }
    setLoading(false);
  }, [searchQuery, toast]);

  const fetchBoardItems = useCallback(async (boardId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') params.set('category', categoryFilter);
      const res = await fetch(`/api/pos/menu-boards/${boardId}/items?${params}`);
      const json = await res.json();
      if (json.success) setBoardItems(json.data);
    } catch {
      toast({ title: 'Error', description: 'Failed to load board items', variant: 'destructive' });
    }
    setLoading(false);
  }, [categoryFilter, toast]);

  useEffect(() => {
    const load = () => { fetchBoards(); };
    load();
  }, []);

  useEffect(() => {
    if (selectedBoard) {
      const load = () => { fetchBoardItems(selectedBoard.id); };
      load();
    }
  }, [selectedBoard]);

  // ── Stats ───────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const activeBoards = boards.filter(b => b.isActive).length;
    const totalItems = boards.reduce((s, b) => s + (b._count?.items || 0), 0);
    const locations = new Set(boards.map(b => b.location)).size;
    return { activeBoards, totalItems, locations };
  }, [boards]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleCreateBoard = async () => {
    try {
      const res = await fetch('/api/pos/menu-boards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(boardForm),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Menu board created' });
        setIsBoardDialogOpen(false);
        setBoardForm({ name: '', description: '', location: 'main_restaurant', orientation: 'landscape', resolution: '1920x1080', theme: 'default' });
        fetchBoards();
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create board', variant: 'destructive' });
    }
  };

  const handleToggleBoard = async (board: MenuBoard) => {
    try {
      const res = await fetch(`/api/pos/menu-boards/${board.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !board.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: `Board ${board.isActive ? 'deactivated' : 'activated'}` });
        fetchBoards();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to toggle board', variant: 'destructive' });
    }
  };

  const handleDeleteBoard = async (board: MenuBoard) => {
    try {
      const res = await fetch(`/api/pos/menu-boards/${board.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Board deleted' });
        if (selectedBoard?.id === board.id) setSelectedBoard(null);
        fetchBoards();
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to delete board', variant: 'destructive' });
    }
  };

  const handleCreateItem = async () => {
    if (!selectedBoard) return;
    try {
      const maxSort = boardItems.length > 0 ? Math.max(...boardItems.map(i => i.sortOrder)) + 1 : 0;
      const res = await fetch(`/api/pos/menu-boards/${selectedBoard.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...itemForm, sortOrder: maxSort }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: 'Success', description: 'Item added to board' });
        setIsItemDialogOpen(false);
        setItemForm({ name: '', description: '', price: 0, category: 'appetizer', isAvailable: true, isFeatured: false, imageUrl: '' });
        fetchBoardItems(selectedBoard.id);
      } else {
        toast({ title: 'Error', description: json.error, variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to create item', variant: 'destructive' });
    }
  };

  const handleMoveItem = async (item: MenuBoardItem, direction: 'up' | 'down') => {
    if (!selectedBoard) return;
    const idx = boardItems.findIndex(i => i.id === item.id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= boardItems.length) return;

    toast({ title: 'Info', description: 'Item order updated' });
    fetchBoardItems(selectedBoard.id);
  };

  // ── Render: Stats ───────────────────────────────────────────────

  const renderStats = () => (
    <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/20">
            <Tv className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-600">{stats.activeBoards}</div>
            <div className="text-xs text-muted-foreground">Active Boards</div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600 shadow-lg shadow-sky-500/20">
            <Monitor className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-sky-600">{boards.length}</div>
            <div className="text-xs text-muted-foreground">Total Boards</div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber-500/20">
            <Tag className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-amber-600">{stats.totalItems}</div>
            <div className="text-xs text-muted-foreground">Total Items</div>
          </div>
        </div>
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-500/20">
            <MapPin className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-violet-600">{stats.locations}</div>
            <div className="text-xs text-muted-foreground">Locations</div>
          </div>
        </div>
      </Card>
    </div>
  );

  // ── Render: Boards List ────────────────────────────────────────

  const renderBoards = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search boards..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => { setEditingBoard(null); setIsBoardDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />New Board
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map(board => {
          const theme = THEME_OPTIONS.find(t => t.value === board.theme) || THEME_OPTIONS[0];
          return (
            <Card
              key={board.id}
              className={cn('overflow-hidden transition-all hover:shadow-lg cursor-pointer group', !board.isActive && 'opacity-60')}
              onClick={() => { setSelectedBoard(board); setActiveTab('items'); }}
            >
              <div className={cn('h-3 bg-gradient-to-r', theme.preview)} />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm truncate">{board.name}</h3>
                    {board.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{board.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); setSelectedBoard(board); }}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={(e) => e.stopPropagation()}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <MapPin className="h-2.5 w-2.5" />
                    {board.location.replace(/_/g, ' ')}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Layout className="h-2.5 w-2.5" />
                    {board.orientation}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Monitor className="h-2.5 w-2.5" />
                    {board.resolution}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Palette className="h-2.5 w-2.5" />
                    {theme.label}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{board._count?.items || 0} items</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={board.isActive}
                      onCheckedChange={() => handleToggleBoard(board)}
                      onClick={(e) => e.stopPropagation()}
                      className="scale-75"
                    />
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600" onClick={(e) => { e.stopPropagation(); handleDeleteBoard(board); }}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
        {boards.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Tv className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p>No menu boards found</p>
            <p className="text-xs mt-1">Create your first digital menu board</p>
          </div>
        )}
      </div>
    </div>
  );

  // ── Render: Items Management ────────────────────────────────────

  const renderItems = () => {
    if (!selectedBoard) {
      return (
        <div className="py-12 text-center text-muted-foreground">
          <Monitor className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p>Select a menu board to manage items</p>
        </div>
      );
    }

    const categories = [...new Set(boardItems.map(i => i.category))];

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => { setSelectedBoard(null); setActiveTab('boards'); }}>
              ← Back
            </Button>
            <div>
              <h3 className="font-semibold">{selectedBoard.name}</h3>
              <p className="text-xs text-muted-foreground">{boardItems.length} items</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {ITEM_CATEGORIES.map(c => (
                  <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => setIsPreviewOpen(true)}>
              <Eye className="h-4 w-4 mr-2" />Preview
            </Button>
            <Button onClick={() => setIsItemDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />Add Item
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[520px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="hidden sm:table-cell">Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boardItems.map((item, idx) => (
                    <TableRow key={item.id} className={cn(!item.isAvailable && 'opacity-50')}>
                      <TableCell>
                        <div className="flex flex-col gap-0.5">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled={idx === 0} onClick={() => handleMoveItem(item, 'up')}>
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" disabled={idx === boardItems.length - 1} onClick={() => handleMoveItem(item, 'down')}>
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {item.isFeatured && <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                          <div>
                            <p className="font-medium text-sm">{item.name}</p>
                            {item.description && <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{item.category.replace(/_/g, ' ')}</Badge>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="text-sm font-medium">{formatCurrency(item.price)}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={cn('text-xs', item.isAvailable ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>
                          {item.isAvailable ? 'Available' : 'Hidden'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Pencil className="h-3 w-3" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {boardItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        No items on this board
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    );
  };

  // ── Render: Preview ─────────────────────────────────────────────

  const renderPreview = () => {
    if (!selectedBoard) return null;
    const theme = THEME_OPTIONS.find(t => t.value === selectedBoard.theme) || THEME_OPTIONS[0];
    const availableItems = boardItems.filter(i => i.isAvailable);
    const categories = [...new Set(availableItems.map(i => i.category))];

    return (
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />Menu Board Preview
            </DialogTitle>
            <DialogDescription>{selectedBoard.name} — {selectedBoard.location.replace(/_/g, ' ')}</DialogDescription>
          </DialogHeader>
          <div className={cn('rounded-xl bg-gradient-to-br p-6 text-white min-h-[400px]', theme.preview)}>
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">{selectedBoard.name}</h2>
              <p className="text-white/70 text-sm mt-1">Today&apos;s Menu</p>
            </div>
            {categories.map(cat => (
              <div key={cat} className="mb-6">
                <h3 className="text-lg font-semibold mb-3 uppercase tracking-wider text-white/80">{cat.replace(/_/g, ' ')}</h3>
                <div className="space-y-2">
                  {availableItems.filter(i => i.category === cat).map(item => (
                    <div key={item.id} className="flex justify-between items-start border-b border-white/10 pb-2">
                      <div className="flex-1 min-w-0 mr-4">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{item.name}</span>
                          {item.isFeatured && <Star className="h-3 w-3 text-amber-400 fill-amber-400" />}
                        </div>
                        {item.description && <p className="text-xs text-white/60 mt-0.5 line-clamp-1">{item.description}</p>}
                      </div>
                      <span className="font-semibold text-sm shrink-0">{formatCurrency(item.price)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {availableItems.length === 0 && (
              <div className="text-center py-12 text-white/50">
                <p>No items available on this board</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  // ── Main Render ────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {renderStats()}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="boards" className="gap-2">
            <Monitor className="h-4 w-4" />Boards
          </TabsTrigger>
          <TabsTrigger value="items" className="gap-2" disabled={!selectedBoard}>
            <Tag className="h-4 w-4" />Items {selectedBoard && <Badge variant="secondary" className="ml-1 text-[10px] h-5">{boardItems.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="boards" className="mt-4">{renderBoards()}</TabsContent>
        <TabsContent value="items" className="mt-4">{renderItems()}</TabsContent>
      </Tabs>

      {renderPreview()}

      {/* Board Dialog */}
      <Dialog open={isBoardDialogOpen} onOpenChange={setIsBoardDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBoard ? 'Edit Board' : 'New Menu Board'}</DialogTitle>
            <DialogDescription>Create a digital menu board for display</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Board Name</Label>
              <Input value={boardForm.name} onChange={(e) => setBoardForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Main Restaurant Menu" />
            </div>
            <div>
              <Label>Description</Label>
              <Textarea value={boardForm.description} onChange={(e) => setBoardForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Location</Label>
                <Select value={boardForm.location} onValueChange={(v) => setBoardForm(f => ({ ...f, location: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LOCATION_OPTIONS.map(l => <SelectItem key={l} value={l}>{l.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Orientation</Label>
                <Select value={boardForm.orientation} onValueChange={(v) => setBoardForm(f => ({ ...f, orientation: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ORIENTATION_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Resolution</Label>
                <Select value={boardForm.resolution} onValueChange={(v) => setBoardForm(f => ({ ...f, resolution: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RESOLUTION_OPTIONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Theme</Label>
                <Select value={boardForm.theme} onValueChange={(v) => setBoardForm(f => ({ ...f, theme: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {THEME_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBoardDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateBoard}>Create Board</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Menu Item</DialogTitle>
            <DialogDescription>Add an item to &quot;{selectedBoard?.name}&quot;</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Item Name</Label>
                <Input value={itemForm.name} onChange={(e) => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Grilled Salmon" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={itemForm.category} onValueChange={(v) => setItemForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ITEM_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Price</Label>
                <Input type="number" step="0.01" value={itemForm.price} onChange={(e) => setItemForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="col-span-2">
                <Label>Description</Label>
                <Textarea value={itemForm.description} onChange={(e) => setItemForm(f => ({ ...f, description: e.target.value }))} placeholder="Short description..." rows={2} />
              </div>
              <div>
                <Label>Image URL</Label>
                <Input value={itemForm.imageUrl} onChange={(e) => setItemForm(f => ({ ...f, imageUrl: e.target.value }))} placeholder="https://..." />
              </div>
              <div className="flex items-center gap-4 pt-4">
                <div className="flex items-center gap-2">
                  <Switch checked={itemForm.isAvailable} onCheckedChange={(v) => setItemForm(f => ({ ...f, isAvailable: v }))} />
                  <Label className="text-sm">Available</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={itemForm.isFeatured} onCheckedChange={(v) => setItemForm(f => ({ ...f, isFeatured: v }))} />
                  <Label className="text-sm">Featured</Label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateItem}>Add Item</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
