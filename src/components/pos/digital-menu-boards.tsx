'use client';

import { useState, useMemo } from 'react';
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

// ── Mock Data ──────────────────────────────────────────────────────────

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

const MOCK_BOARDS: MenuBoard[] = [
  {
    id: 'mb-001',
    name: 'Grand Breakfast Board',
    type: 'breakfast',
    orientation: 'landscape',
    resolution: '3840x2160',
    layout: 'grid',
    primaryColor: '#f59e0b',
    accentColor: '#d97706',
    assignedScreen: 'scr-001',
    schedule: '6:00 AM - 11:00 AM',
    isActive: true,
    views: 3420,
    clicks: 485,
    items: [
      { id: 'mi-001', name: 'Classic Eggs Benedict', description: 'Poached eggs, hollandaise, English muffin', price: 450, dietary: ['non-veg'], isSpecial: true, isNew: false, category: 'Mains' },
      { id: 'mi-002', name: 'Avocado Toast', description: 'Sourdough, smashed avocado, cherry tomatoes', price: 380, dietary: ['vegan'], isSpecial: false, isNew: true, category: 'Mains' },
      { id: 'mi-003', name: 'Masala Omelette', description: 'Three-egg omelette with onions, chillies, coriander', price: 320, dietary: ['non-veg'], isSpecial: false, isNew: false, category: 'Mains' },
      { id: 'mi-004', name: 'Fresh Fruit Bowl', description: 'Seasonal fruits with yogurt drizzle', price: 280, dietary: ['veg', 'gluten-free'], isSpecial: false, isNew: false, category: 'Bowls' },
      { id: 'mi-005', name: 'Blueberry Pancakes', description: 'Fluffy pancakes, maple syrup, fresh berries', price: 420, dietary: ['veg'], isSpecial: true, isNew: false, category: 'Sweet' },
      { id: 'mi-006', name: 'Chai Latte', description: 'Spiced tea with steamed milk', price: 180, dietary: ['veg'], isSpecial: false, isNew: false, category: 'Beverages' },
      { id: 'mi-007', name: 'Cold Pressed Juice', description: 'Orange, carrot, ginger immunity booster', price: 220, dietary: ['veg', 'gluten-free', 'vegan'], isSpecial: false, isNew: true, category: 'Beverages' },
    ],
  },
  {
    id: 'mb-002',
    name: 'Executive Lunch Menu',
    type: 'lunch',
    orientation: 'landscape',
    resolution: '1920x1080',
    layout: 'list',
    primaryColor: '#ea580c',
    accentColor: '#c2410c',
    assignedScreen: 'scr-002',
    schedule: '12:00 PM - 3:00 PM',
    isActive: true,
    views: 5680,
    clicks: 892,
    items: [
      { id: 'mi-010', name: 'Grilled Chicken Caesar', description: 'Romaine, parmesan, croutons, creamy dressing', price: 520, dietary: ['non-veg'], isSpecial: true, isNew: false, category: 'Salads' },
      { id: 'mi-011', name: 'Paneer Tikka Wrap', description: 'Smoky paneer, mint chutney, pickled onions', price: 380, dietary: ['veg'], isSpecial: false, isNew: true, category: 'Mains' },
      { id: 'mi-012', name: 'Fish & Chips', description: 'Beer-battered cod, tartar sauce, fries', price: 620, dietary: ['non-veg'], isSpecial: false, isNew: false, category: 'Mains' },
      { id: 'mi-013', name: 'Quinoa Power Bowl', description: 'Quinoa, roasted veggies, tahini dressing', price: 450, dietary: ['vegan', 'gluten-free'], isSpecial: true, isNew: false, category: 'Bowls' },
      { id: 'mi-014', name: 'Dal Makhani', description: 'Slow-cooked black lentils, cream, butter', price: 340, dietary: ['veg', 'gluten-free'], isSpecial: false, isNew: false, category: 'Indian' },
      { id: 'mi-015', name: 'Naan Basket', description: 'Butter, garlic, and plain naan selection', price: 160, dietary: ['veg'], isSpecial: false, isNew: false, category: 'Breads' },
    ],
  },
  {
    id: 'mb-003',
    name: 'Dinner à la Carte',
    type: 'dinner',
    orientation: 'landscape',
    resolution: '3840x2160',
    layout: 'carousel',
    primaryColor: '#7c3aed',
    accentColor: '#6d28d9',
    assignedScreen: 'scr-003',
    schedule: '7:00 PM - 11:00 PM',
    isActive: true,
    views: 4120,
    clicks: 673,
    items: [
      { id: 'mi-020', name: 'Filet Mignon', description: '8oz prime beef, truffle jus, seasonal vegetables', price: 1850, dietary: ['non-veg', 'gluten-free'], isSpecial: true, isNew: false, category: 'Mains' },
      { id: 'mi-021', name: 'Lobster Thermidor', description: 'Whole lobster, brandy cream, gruyère gratin', price: 2200, dietary: ['non-veg', 'gluten-free'], isSpecial: true, isNew: true, category: 'Signature' },
      { id: 'mi-022', name: 'Mushroom Risotto', description: 'Arborio rice, wild mushrooms, parmesan', price: 680, dietary: ['veg', 'gluten-free'], isSpecial: false, isNew: false, category: 'Mains' },
      { id: 'mi-023', name: 'Tandoori Prawns', description: 'Jumbo prawns, spiced yogurt marinade', price: 950, dietary: ['non-veg', 'gluten-free'], isSpecial: false, isNew: false, category: 'Starters' },
      { id: 'mi-024', name: 'Burrata Salad', description: 'Fresh burrata, heirloom tomatoes, basil oil', price: 520, dietary: ['veg', 'gluten-free'], isSpecial: false, isNew: true, category: 'Starters' },
      { id: 'mi-025', name: 'Crème Brûlée', description: 'Vanilla bean custard, caramelized sugar', price: 380, dietary: ['veg', 'gluten-free'], isSpecial: false, isNew: false, category: 'Desserts' },
    ],
  },
  {
    id: 'mb-004',
    name: 'Lobby Bar Cocktails',
    type: 'bar',
    orientation: 'portrait',
    resolution: '1920x1080',
    layout: 'grid',
    primaryColor: '#0284c7',
    accentColor: '#0369a1',
    assignedScreen: 'scr-004',
    schedule: '5:00 PM - 12:00 AM',
    isActive: true,
    views: 2890,
    clicks: 1256,
    items: [
      { id: 'mi-030', name: 'Old Fashioned', description: 'Bourbon, Angostura bitters, orange peel', price: 750, dietary: ['veg'], isSpecial: true, isNew: false, category: 'Classic Cocktails' },
      { id: 'mi-031', name: 'Espresso Martini', description: 'Vodka, Kahlúa, fresh espresso', price: 680, dietary: ['veg'], isSpecial: true, isNew: false, category: 'Classic Cocktails' },
      { id: 'mi-032', name: 'Mango Lassi Cocktail', description: 'Rum, mango purée, yogurt, cardamom', price: 620, dietary: ['veg'], isSpecial: false, isNew: true, category: 'Signature' },
      { id: 'mi-033', name: 'Craft IPA Selection', description: 'Rotating selection of local craft IPAs', price: 450, dietary: ['veg'], isSpecial: false, isNew: false, category: 'Beer' },
      { id: 'mi-034', name: 'Sparkling Water', description: 'San Pellegrino or Perrier', price: 180, dietary: ['veg', 'vegan', 'gluten-free'], isSpecial: false, isNew: false, category: 'Non-Alcoholic' },
    ],
  },
  {
    id: 'mb-005',
    name: 'Kids Fun Menu',
    type: 'kids',
    orientation: 'landscape',
    resolution: '1920x1080',
    layout: 'grid',
    primaryColor: '#ec4899',
    accentColor: '#db2777',
    assignedScreen: 'scr-005',
    schedule: '12:00 PM - 9:00 PM',
    isActive: false,
    views: 1560,
    clicks: 423,
    items: [
      { id: 'mi-040', name: 'Mini Margherita Pizza', description: 'Cheese pizza with tomato sauce', price: 280, dietary: ['veg'], isSpecial: false, isNew: false, category: 'Mains' },
      { id: 'mi-041', name: 'Chicken Nuggets', description: 'Crispy chicken nuggets with fries', price: 250, dietary: ['non-veg'], isSpecial: true, isNew: false, category: 'Mains' },
      { id: 'mi-042', name: 'Mac & Cheese', description: 'Creamy macaroni and cheese', price: 220, dietary: ['veg'], isSpecial: false, isNew: false, category: 'Mains' },
      { id: 'mi-043', name: 'Rainbow Fruit Platter', description: 'Colorful fresh fruit arrangement', price: 180, dietary: ['veg', 'gluten-free', 'vegan'], isSpecial: false, isNew: true, category: 'Sides' },
      { id: 'mi-044', name: 'Chocolate Milkshake', description: 'Thick chocolate shake with whipped cream', price: 200, dietary: ['veg'], isSpecial: true, isNew: false, category: 'Drinks' },
    ],
  },
  {
    id: 'mb-006',
    name: 'Poolside Bites',
    type: 'poolside',
    orientation: 'portrait',
    resolution: '1920x1080',
    layout: 'carousel',
    primaryColor: '#14b8a6',
    accentColor: '#0d9488',
    assignedScreen: 'scr-006',
    schedule: '10:00 AM - 7:00 PM',
    isActive: true,
    views: 2100,
    clicks: 678,
    items: [
      { id: 'mi-050', name: 'Grilled Fish Tacos', description: 'Mahi-mahi, slaw, lime crema', price: 480, dietary: ['non-veg'], isSpecial: true, isNew: false, category: 'Light Bites' },
      { id: 'mi-051', name: 'Acai Bowl', description: 'Acai, granola, banana, honey', price: 350, dietary: ['vegan', 'gluten-free'], isSpecial: false, isNew: true, category: 'Bowls' },
      { id: 'mi-052', name: 'Club Sandwich', description: 'Triple-decker, turkey, bacon, avocado', price: 520, dietary: ['non-veg'], isSpecial: false, isNew: false, category: 'Sandwiches' },
      { id: 'mi-053', name: 'Mojito (Non-Alcoholic)', description: 'Mint, lime, soda, sugar', price: 250, dietary: ['veg', 'vegan', 'gluten-free'], isSpecial: false, isNew: false, category: 'Drinks' },
    ],
  },
];

const MOCK_SCREENS: ScreenAssignment[] = [
  { id: 'scr-001', name: 'Restaurant Main Display', location: 'Main Restaurant', boardId: 'mb-001', status: 'online', resolution: '4K (3840×2160)' },
  { id: 'scr-002', name: 'Lobby Cafe Display', location: 'Lobby', boardId: 'mb-002', status: 'online', resolution: 'FHD (1920×1080)' },
  { id: 'scr-003', name: 'Fine Dining Display', location: 'Restaurant 2', boardId: 'mb-003', status: 'online', resolution: '4K (3840×2160)' },
  { id: 'scr-004', name: 'Lobby Bar Display', location: 'Lobby Bar', boardId: 'mb-004', status: 'online', resolution: 'FHD (1920×1080)' },
  { id: 'scr-005', name: 'Kids Corner Display', location: 'Pool Area', boardId: 'mb-005', status: 'offline', resolution: 'FHD (1920×1080)' },
  { id: 'scr-006', name: 'Pool Bar Display', location: 'Pool Area', boardId: 'mb-006', status: 'online', resolution: 'FHD (1920×1080)' },
  { id: 'scr-007', name: 'Room Service Kitchen', location: 'Kitchen', boardId: null, status: 'online', resolution: 'FHD (1920×1080)' },
];

const MOCK_PROMOTION_DATA = [
  { name: 'Happy Hour Specials', clicks: 456, views: 2100, conversion: 21.7 },
  { name: 'Seasonal Fruit Desserts', clicks: 234, views: 1800, conversion: 13.0 },
  { name: 'Chef\'s Special Platter', clicks: 189, views: 1200, conversion: 15.8 },
  { name: 'Kids Eat Free Weekend', clicks: 312, views: 1560, conversion: 20.0 },
  { name: 'Summer Mocktails', clicks: 567, views: 3200, conversion: 17.7 },
];

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

  const formatAmount = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount);

  const totalViews = useMemo(() => MOCK_BOARDS.reduce((s, b) => s + b.views, 0), []);
  const totalClicks = useMemo(() => MOCK_BOARDS.reduce((s, b) => s + b.clicks, 0), []);
  const activeBoards = useMemo(() => MOCK_BOARDS.filter(b => b.isActive).length, []);

  const filteredBoards = useMemo(() => {
    if (!searchQuery) return MOCK_BOARDS;
    const q = searchQuery.toLowerCase();
    return MOCK_BOARDS.filter(b => b.name.toLowerCase().includes(q) || b.type.includes(q));
  }, [searchQuery]);

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
              <div className="text-2xl font-bold">{MOCK_BOARDS.length}</div>
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
                {MOCK_BOARDS.flatMap(b => b.items.filter(i => i.isSpecial)).slice(0, 6).map(item => (
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
          {MOCK_BOARDS.map(board => (
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
            {MOCK_SCREENS.map(screen => {
              const assignedBoard = MOCK_BOARDS.find(b => b.id === screen.boardId);
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
                <BarChart data={MOCK_PROMOTION_DATA} layout="vertical">
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
                  {MOCK_BOARDS.map(board => {
                    const ctr = board.views > 0 ? ((board.clicks / board.views) * 100).toFixed(1) : '0';
                    const screen = MOCK_SCREENS.find(s => s.boardId === board.id);
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
                  {MOCK_SCREENS.map(screen => (
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
