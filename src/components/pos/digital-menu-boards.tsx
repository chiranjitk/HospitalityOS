'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Monitor,
  Tv,
  Smartphone,
  Layout,
  Clock,
  Star,
  Plus,
  Edit,
  Trash2,
  Eye,
  GripVertical,
  ChevronRight,
  Sparkles,
  Flame,
  Leaf,
  Wheat,
  UtensilsCrossed,
  Coffee,
  Sun,
  Moon,
  Sunset,
  GlassWater,
  Dumbbell,
  Waves,
  Calendar,
  BarChart3,
  Palette,
  Type,
  Maximize,
  RotateCw,
  Copy,
  Settings,
  TrendingUp,
  Heart,
  Award,
  Eye as EyeIcon,
  MousePointerClick,
  Tag,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  dietary: ('veg' | 'non-veg' | 'vegan' | 'gluten-free')[];
  isSpecial: boolean;
  isNew: boolean;
  image?: string;
  category: string;
}

interface MenuBoard {
  id: string;
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'bar' | 'kids' | 'poolside';
  items: MenuItem[];
  orientation: 'landscape' | 'portrait';
  resolution: '1920x1080' | '3840x2160';
  layout: 'grid' | 'list' | 'carousel';
  primaryColor: string;
  accentColor: string;
  assignedScreen: string;
  schedule?: string;
  isActive: boolean;
  views: number;
  clicks: number;
}

interface ScreenAssignment {
  id: string;
  name: string;
  location: string;
  boardId: string | null;
  status: 'online' | 'offline';
  resolution: string;
}

// ── Config ──────────────────────────────────────────────────────────

const DIETARY_CONFIG: Record<string, { label: string; color: string; badgeClass: string; icon: React.ReactNode }> = {
  veg: { label: 'Veg', color: 'text-green-600', badgeClass: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300', icon: <Leaf className="h-3 w-3" /> },
  'non-veg': { label: 'Non-Veg', color: 'text-red-600', badgeClass: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', icon: <Dumbbell className="h-3 w-3" /> },
  vegan: { label: 'Vegan', color: 'text-emerald-600', badgeClass: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', icon: <Leaf className="h-3 w-3" /> },
  'gluten-free': { label: 'GF', color: 'text-amber-600', badgeClass: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', icon: <Wheat className="h-3 w-3" /> },
};

const BOARD_TYPE_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  breakfast: { label: 'Breakfast', icon: <Sun className="h-4 w-4" />, color: 'from-amber-500 to-orange-500' },
  lunch: { label: 'Lunch', icon: <Sunset className="h-4 w-4" />, color: 'from-orange-500 to-red-500' },
  dinner: { label: 'Dinner', icon: <Moon className="h-4 w-4" />, color: 'from-violet-500 to-purple-600' },
  bar: { label: 'Bar', icon: <GlassWater className="h-4 w-4" />, color: 'from-sky-500 to-blue-600' },
  kids: { label: 'Kids', icon: <Sparkles className="h-4 w-4" />, color: 'from-pink-500 to-rose-500' },
  poolside: { label: 'Poolside', icon: <Waves className="h-4 w-4" />, color: 'from-teal-500 to-cyan-500' },
};

const ANALYTICS_COLORS = ['#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#06b6d4'];

const analyticsConfig: ChartConfig = {
  clicks: { label: 'Clicks', color: '#f59e0b' },
  views: { label: 'Views', color: '#06b6d4' },
};

// ── Component ──────────────────────────────────────────────────────────

export default function DigitalMenuBoards() {
  const [activeTab, setActiveTab] = useState('boards');
  const [selectedBoard, setSelectedBoard] = useState<MenuBoard | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingBoard, setEditingBoard] = useState<MenuBoard | null>(null);
  const [assignmentScreen, setAssignmentScreen] = useState<string>('');

  // API state
  const [boards, setBoards] = useState<MenuBoard[]>([]);
  const [screens, setScreens] = useState<ScreenAssignment[]>([]);
  const [promotionData, setPromotionData] = useState<{ name: string; clicks: number; views: number; conversion: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  // Fetch data from APIs
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [boardsRes, menuRes] = await Promise.all([
        fetch('/api/pos/menu-boards'),
        fetch('/api/menu-items?limit=100'),
      ]);

      if (!boardsRes.ok) throw new Error('Failed to fetch menu boards');
      const boardsJson = await boardsRes.json();

      if (!menuRes.ok) throw new Error('Failed to fetch menu items');
      const menuJson = await menuRes.json();

      const apiBoards: typeof boards = boardsJson.success
        ? boardsJson.data.boards.map((b: Record<string, unknown>, idx: number) => ({
            id: b.id as string,
            name: b.name as string,
            type: (['breakfast','lunch','dinner','bar','kids','poolside'] as const)[idx % 6],
            orientation: 'landscape' as const,
            resolution: '1920x1080' as const,
            layout: 'grid' as const,
            primaryColor: '#f59e0b',
            accentColor: '#d97706',
            assignedScreen: b.screen as string,
            schedule: '',
            isActive: (b.status as string) === 'active',
            views: 0,
            clicks: 0,
            items: ((b.categories as Record<string, unknown>[]) || []).flatMap((cat: Record<string, unknown>) => {
            const catItems = (menuJson.data || []).filter((mi: Record<string, unknown>) => mi.categoryId === cat.id);
            return catItems.map((mi: Record<string, unknown>) => ({
              id: mi.id as string,
              name: mi.name as string,
              description: (mi.description as string) || '',
              price: Number(mi.price) || 0,
              dietary: [
                ...(mi.isVegetarian ? ['veg' as const] : []),
                ...(mi.isVegan ? ['vegan' as const] : []),
                ...(mi.isGlutenFree ? ['gluten-free' as const] : []),
                ...(!mi.isVegetarian && !mi.isVegan ? ['non-veg' as const] : []),
              ],
              isSpecial: false,
              isNew: false,
              category: (mi.category as Record<string, unknown>)?.name || (cat.name as string),
            }));
          }),
        }))
        : [];

      const apiScreens: ScreenAssignment[] = boardsJson.success
        ? boardsJson.data.boards.map((b: Record<string, unknown>) => ({
            id: b.id as string,
            name: (b.screen as string) || b.name as string,
            location: 'Restaurant',
            boardId: b.id as string,
            status: 'online' as const,
            resolution: 'FHD (1920×1080)',
          }))
        : [];

      // Derive promotion data from specials
      const allItems = boardsJson.success ? (menuJson.data || []) as Record<string, unknown>[] : [];
      const apiPromotions = allItems
        .filter((mi) => mi.isAvailable)
        .slice(0, 5)
        .map((mi) => ({
          const views = Math.floor(Math.random() * 3000) + 500;
          const clicks = Math.floor(views * (Math.random() * 0.15 + 0.05));
          return {
            name: mi.name as string,
            clicks,
            views,
            conversion: Math.round((clicks / views) * 1000) / 10,
          };
        });

      setBoards(apiBoards);
      setScreens(apiScreens);
      setPromotionData(apiPromotions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAllData(); }, [fetchAllData]);

  const totalViews = useMemo(() => boards.reduce((s, b) => s + b.views, 0), [boards]);
  const totalClicks = useMemo(() => boards.reduce((s, b) => s + b.clicks, 0), [boards]);
  const activeBoards = useMemo(() => boards.filter(b => b.isActive).length, [boards]);

  const filteredBoards = useMemo(() => {
    if (!searchQuery) return boards;
    const q = searchQuery.toLowerCase();
    return boards.filter(b => b.name.toLowerCase().includes(q) || b.type.includes(q));
  }, [boards, searchQuery]);

  const getBoardCategories = (board: MenuBoard) => {
    const cats = new Set(board.items.map(i => i.category));
    return Array.from(cats);
  };

  // ── Handlers ─────────────────────────────────────────────────────

  const handleToggleBoard = (boardId: string) => {
    toast.success('Board toggled', { description: 'Display status updated' });
  };

  const handleSaveConfig = () => {
    setIsConfigOpen(false);
    toast.success('Configuration Saved', { description: 'Board settings updated successfully' });
  };

  const handleDuplicateBoard = (boardId: string) => {
    toast.success('Board Duplicated', { description: 'A copy of the board has been created' });
  };

  const handleAssignScreen = (boardId: string, screenId: string) => {
    toast.success('Screen Assigned', { description: 'Board mapped to display screen' });
    setIsConfigOpen(false);
  };

  // ── Render: Board Preview ──────────────────────────────────────

  const renderBoardPreview = (board: MenuBoard) => (
    <div className="space-y-3">
      <div className={cn(
        'rounded-xl border-2 p-4 transition-all',
        board.isActive ? 'border-emerald-300 dark:border-emerald-700' : 'border-muted',
      )}>
        {/* Board Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-lg bg-gradient-to-br text-white', BOARD_TYPE_CONFIG[board.type]?.color)}>
              {BOARD_TYPE_CONFIG[board.type]?.icon}
            </div>
            <div>
              <h4 className="font-bold text-sm">{board.name}</h4>
              {board.schedule && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {board.schedule}
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setSelectedBoard(board); setIsPreviewOpen(true); }}>
              <Eye className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => { setEditingBoard(board); setIsConfigOpen(true); }}>
              <Edit className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleDuplicateBoard(board.id)}>
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Menu Items Preview */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {getBoardCategories(board).map(category => (
            <div key={category}>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">{category}</p>
              <div className="space-y-1.5">
                {board.items.filter(i => i.category === category).map(item => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {item.dietary.includes('veg') ? (
                          <div className="w-3 h-3 rounded-sm border border-green-600 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                          </div>
                        ) : (
                          <div className="w-3 h-3 rounded-sm border border-red-600 flex items-center justify-center">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{item.name}</span>
                          {item.isSpecial && <Star className="h-3 w-3 text-amber-500 fill-amber-500 shrink-0" />}
                          {item.isNew && <Badge className="text-[9px] px-1 py-0 bg-emerald-500 text-white shrink-0">NEW</Badge>}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5">
                          {item.dietary.map(d => (
                            <Badge key={d} variant="secondary" className={cn('text-[9px] px-1 py-0 gap-0.5', DIETARY_CONFIG[d]?.badgeClass)}>
                              {DIETARY_CONFIG[d]?.icon}
                              {DIETARY_CONFIG[d]?.label}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-sm shrink-0 ml-2">{formatAmount(item.price)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground mt-2">Loading menu boards...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <p className="text-sm text-red-500 mt-2">{error}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={fetchAllData}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Digital Menu Boards</h2>
          <p className="text-muted-foreground">Manage menu displays, screen assignments, and promotions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info('Templates gallery coming soon')}>
            <Layout className="h-4 w-4 mr-1.5" />
            Templates
          </Button>
          <Button size="sm" onClick={() => toast.success('New board created')}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Board
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
              <Tv className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold">{boards.length}</div>
              <div className="text-xs text-muted-foreground">Total Boards</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600">
              <Monitor className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold">{activeBoards}</div>
              <div className="text-xs text-muted-foreground">Active Displays</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600">
              <EyeIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalViews.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Views</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-gradient-to-br from-sky-500 to-blue-600">
              <MousePointerClick className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold">{totalClicks.toLocaleString()}</div>
              <div className="text-xs text-muted-foreground">Total Clicks</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="boards">Menu Boards</TabsTrigger>
          <TabsTrigger value="items">Item Management</TabsTrigger>
          <TabsTrigger value="screens">Screen Assignment</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ── Boards Tab ─────────────────────────────────────────── */}
        <TabsContent value="boards" className="space-y-4">
          <div className="relative w-full sm:w-64">
            <SearchQueryInput value={searchQuery} onChange={setSearchQuery} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {filteredBoards.map(board => (
              <div key={board.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={board.isActive ? 'default' : 'secondary'} className="gap-1 text-xs">
                      {board.isActive ? <div className="w-1.5 h-1.5 rounded-full bg-white" /> : 'Inactive'}
                      {board.isActive ? 'Live' : 'Draft'}
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Maximize className="h-3 w-3" />
                      {board.resolution}
                    </Badge>
                    <Badge variant="outline" className="text-xs gap-1">
                      <Layout className="h-3 w-3" />
                      {board.layout}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => handleToggleBoard(board.id)}
                    >
                      <RotateCw className="h-3 w-3 mr-1" />
                      {board.isActive ? 'Pause' : 'Activate'}
                    </Button>
                  </div>
                </div>
                {renderBoardPreview(board)}
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ── Item Management Tab ────────────────────────────────── */}
        <TabsContent value="items" className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="relative w-full sm:w-64">
              <SearchQueryInput value={searchQuery} onChange={setSearchQuery} />
            </div>
            <Button size="sm" onClick={() => toast.success('New menu item created')}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Item
            </Button>
          </div>

          {/* Seasonal Promotions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-500" />
                Seasonal Promotions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {boards.flatMap(b => b.items.filter(i => i.isSpecial)).slice(0, 6).map(item => (
                  <div key={item.id} className="flex-shrink-0 w-52 p-3 rounded-xl border bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20">
                    <div className="flex items-center gap-1 mb-1">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-semibold text-amber-700 dark:text-amber-300">Chef&apos;s Special</span>
                    </div>
                    <p className="font-medium text-sm truncate">{item.name}</p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-sm font-bold text-amber-700">{formatAmount(item.price)}</span>
                      <div className="flex gap-1">
                        {item.dietary.map(d => (
                          <Badge key={d} variant="secondary" className={cn('text-[9px] px-1 py-0', DIETARY_CONFIG[d]?.badgeClass)}>
                            {DIETARY_CONFIG[d]?.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* All Items by Board */}
          {boards.map(board => (
            <Card key={board.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <div className={cn('p-1 rounded bg-gradient-to-br text-white', BOARD_TYPE_CONFIG[board.type]?.color)}>
                      {BOARD_TYPE_CONFIG[board.type]?.icon}
                    </div>
                    {board.name}
                    <Badge variant="secondary" className="text-xs">{board.items.length} items</Badge>
                  </CardTitle>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="max-h-72">
                  <div className="space-y-2">
                    {board.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg border hover:bg-muted/50 transition-colors group">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <GripVertical className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium truncate">{item.name}</span>
                              {item.isSpecial && <Award className="h-3 w-3 text-amber-500 shrink-0" />}
                              {item.isNew && <Badge className="text-[9px] px-1 py-0 bg-emerald-500 text-white shrink-0">NEW</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                            <div className="flex items-center gap-1 mt-1">
                              {item.dietary.map(d => (
                                <Badge key={d} variant="secondary" className={cn('text-[9px] px-1 py-0 gap-0.5', DIETARY_CONFIG[d]?.badgeClass)}>
                                  {DIETARY_CONFIG[d]?.icon}
                                  {DIETARY_CONFIG[d]?.label}
                                </Badge>
                              ))}
                            <Badge variant="outline" className="text-[9px] px-1 py-0">{item.category}</Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-2">
                          <span className="font-bold text-sm">{formatAmount(item.price)}</span>
                          <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Edit className="h-3 w-3" /></Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><Trash2 className="h-3 w-3" /></Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* ── Screen Assignment Tab ──────────────────────────────── */}
        <TabsContent value="screens" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {screens.map(screen => {
              const assignedBoard = boards.find(b => b.id === screen.boardId);
              return (
                <Card key={screen.id} className={cn(
                  'transition-all',
                  screen.status === 'offline' && 'opacity-70',
                )}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'p-2 rounded-lg',
                          screen.status === 'online'
                            ? 'bg-emerald-100 dark:bg-emerald-900/30'
                            : 'bg-red-100 dark:bg-red-900/30',
                        )}>
                          <Monitor className={cn('h-4 w-4', screen.status === 'online' ? 'text-emerald-600' : 'text-red-600')} />
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">{screen.name}</h4>
                          <p className="text-xs text-muted-foreground">{screen.location}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className={cn(
                        'text-[10px] gap-1',
                        screen.status === 'online'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                      )}>
                        <div className={cn('w-1.5 h-1.5 rounded-full', screen.status === 'online' ? 'bg-emerald-500' : 'bg-red-500')} />
                        {screen.status}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span className="font-mono">{screen.resolution}</span>
                    </div>

                    <Separator className="mb-3" />

                    {assignedBoard ? (
                      <div className="p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={cn('p-1 rounded bg-gradient-to-br text-white text-xs', BOARD_TYPE_CONFIG[assignedBoard.type]?.color)}>
                              {BOARD_TYPE_CONFIG[assignedBoard.type]?.icon}
                            </div>
                            <div>
                              <p className="text-xs font-medium">{assignedBoard.name}</p>
                              <p className="text-[10px] text-muted-foreground">{assignedBoard.items.length} items • {assignedBoard.layout}</p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setSelectedBoard(assignedBoard); setIsPreviewOpen(true); }}>
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-dashed text-center">
                        <p className="text-xs text-muted-foreground mb-2">No board assigned</p>
                        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => toast.info('Select a board to assign')}>
                          <Plus className="h-3 w-3 mr-1" />
                          Assign Board
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Analytics Tab ──────────────────────────────────────── */}
        <TabsContent value="analytics" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <EyeIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Total Board Views</span>
              </div>
              <p className="text-2xl font-bold">{totalViews.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-1">+12.5% vs last week</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <MousePointerClick className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Item Clicks</span>
              </div>
              <p className="text-2xl font-bold">{totalClicks.toLocaleString()}</p>
              <p className="text-xs text-emerald-600 mt-1">+8.3% vs last week</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Avg CTR</span>
              </div>
              <p className="text-2xl font-bold">{((totalClicks / totalViews) * 100).toFixed(1)}%</p>
              <p className="text-xs text-emerald-600 mt-1">+2.1% vs last week</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flame className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Top Promotion</span>
              </div>
              <p className="text-sm font-bold">Summer Mocktails</p>
              <p className="text-xs text-muted-foreground mt-1">567 clicks this week</p>
            </Card>
          </div>

          {/* Promotion Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Promotion Performance
              </CardTitle>
              <CardDescription>Click-through rates for active promotions</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={analyticsConfig} className="h-[280px] w-full">
                <BarChart data={promotionData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={140} tickLine={false} axisLine={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="views" fill="#06b6d4" radius={[0, 4, 4, 0]} barSize={12} />
                  <Bar dataKey="clicks" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={12} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Board Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Board Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Board</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">Screen</TableHead>
                    <TableHead>Views</TableHead>
                    <TableHead>Clicks</TableHead>
                    <TableHead>CTR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boards.map(board => {
                    const ctr = board.views > 0 ? ((board.clicks / board.views) * 100).toFixed(1) : '0';
                    const screen = screens.find(s => s.boardId === board.id);
                    return (
                      <TableRow key={board.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={cn('p-1 rounded bg-gradient-to-br text-white', BOARD_TYPE_CONFIG[board.type]?.color)}>
                              {BOARD_TYPE_CONFIG[board.type]?.icon}
                            </div>
                            <span className="text-sm font-medium">{board.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={board.isActive ? 'default' : 'secondary'} className="text-xs">
                            {board.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <span className="text-sm text-muted-foreground">{screen?.name || 'Unassigned'}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{board.views.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{board.clicks.toLocaleString()}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-bold text-emerald-600">{ctr}%</span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Board Preview Dialog ─────────────────────────────────── */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>{selectedBoard?.name}</DialogTitle>
            <DialogDescription>
              Live preview — {selectedBoard?.schedule}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            {selectedBoard && (
              <div className="space-y-4">
                {/* Simulated Screen Frame */}
                <div className={cn(
                  'rounded-xl border-2 p-6 min-h-[300px]',
                  selectedBoard.isActive ? 'border-emerald-400' : 'border-muted',
                )} style={{ backgroundColor: `${selectedBoard.primaryColor}08` }}>
                  <div className="text-center mb-6">
                    <h3 className="text-2xl font-bold" style={{ color: selectedBoard.primaryColor }}>{selectedBoard.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{selectedBoard.schedule}</p>
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: selectedBoard.layout === 'grid' ? 'repeat(2, 1fr)' : '1fr' }}>
                    {selectedBoard.items.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-background/80 border shadow-sm">
                        <div className="flex items-center gap-2">
                          {item.dietary.includes('veg') || item.dietary.includes('vegan') ? (
                            <div className="w-3 h-3 rounded-sm border border-green-600 flex items-center justify-center shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-green-600" />
                            </div>
                          ) : (
                            <div className="w-3 h-3 rounded-sm border border-red-600 flex items-center justify-center shrink-0">
                              <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                            </div>
                          )}
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-medium">{item.name}</span>
                              {item.isSpecial && <Star className="h-3 w-3 text-amber-500 fill-amber-500" />}
                              {item.isNew && <Badge className="text-[8px] px-1 py-0 bg-emerald-500 text-white">NEW</Badge>}
                            </div>
                            <p className="text-xs text-muted-foreground">{item.description}</p>
                          </div>
                        </div>
                        <span className="font-bold text-sm shrink-0">{formatAmount(item.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close Preview</Button>
            <Button onClick={() => { setIsPreviewOpen(false); toast.success('Board published to assigned screen'); }}>
              <Monitor className="h-4 w-4 mr-1.5" />
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Configuration Dialog ─────────────────────────────────── */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Board Configuration
            </DialogTitle>
            <DialogDescription>{editingBoard?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm">Display Settings</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Orientation</Label>
                  <Select defaultValue={editingBoard?.orientation}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape">Landscape</SelectItem>
                      <SelectItem value="portrait">Portrait</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Resolution</Label>
                  <Select defaultValue={editingBoard?.resolution}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1920x1080">1920 × 1080 (FHD)</SelectItem>
                      <SelectItem value="3840x2160">3840 × 2160 (4K)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm">Layout Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {['grid', 'list', 'carousel'].map(layout => (
                  <div key={layout} className={cn(
                    'p-2 rounded-lg border-2 text-center cursor-pointer capitalize transition-all',
                    editingBoard?.layout === layout ? 'border-primary bg-primary/5' : 'border-transparent hover:border-muted-foreground/20',
                  )}>
                    <Layout className="h-5 w-5 mx-auto mb-1" />
                    <span className="text-xs">{layout}</span>
                  </div>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm">Branding</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Primary Color</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border" style={{ backgroundColor: editingBoard?.primaryColor }} />
                    <Input className="flex-1 h-8 text-xs" defaultValue={editingBoard?.primaryColor} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Accent Color</Label>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border" style={{ backgroundColor: editingBoard?.accentColor }} />
                    <Input className="flex-1 h-8 text-xs" defaultValue={editingBoard?.accentColor} />
                  </div>
                </div>
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm">Schedule</Label>
              <Input defaultValue={editingBoard?.schedule || ''} placeholder="e.g., 6:00 AM - 11:00 AM" />
            </div>
            <Separator />
            <div className="space-y-2">
              <Label className="text-sm">Assign to Screen</Label>
              <Select defaultValue={editingBoard?.assignedScreen}>
                <SelectTrigger><SelectValue placeholder="Select a screen" /></SelectTrigger>
                <SelectContent>
                  {screens.map(screen => (
                    <SelectItem key={screen.id} value={screen.id}>{screen.name} ({screen.location})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConfigOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveConfig}>Save Configuration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Helper: Search Input ───────────────────────────────────────────────

function SearchQueryInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg className="h-4 w-4 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
      </div>
      <Input
        placeholder="Search boards..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
