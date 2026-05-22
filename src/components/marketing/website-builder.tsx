'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Globe, Palette, Search, BarChart3, Eye, CheckCircle, Layout, Star, Sparkles,
  Code, Plus, Trash2, Edit3, Settings, ExternalLink, Copy, RefreshCw,
  ChevronUp, ChevronDown, FileText, Link2, Save, Loader2, AlertCircle,
  Monitor, Home, Utensils, Map, HelpCircle, Phone, Image,
  BookOpen, type LucideIcon, ChevronRight, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────

interface WebsiteData {
  id: string;
  tenantId: string;
  propertyId: string;
  domain: string;
  customDomain?: string;
  status: 'draft' | 'published' | 'unpublished';
  template: 'modern' | 'classic' | 'boutique' | 'resort' | 'minimal';
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    borderRadius: string;
    logoUrl?: string;
    heroImageUrl?: string;
  };
  pages: WebsitePage[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
    faviconUrl?: string;
  };
  analytics: {
    googleAnalyticsId?: string;
    googleTagManagerId?: string;
    facebookPixelId?: string;
    metaPixelId?: string;
    linkedInsightTag?: string;
    twitterPixelId?: string;
  };
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface WebsitePage {
  id: string;
  slug: string;
  title: string;
  sections: PageSection[];
  published: boolean;
}

interface PageSection {
  id: string;
  type: 'hero' | 'rooms_grid' | 'features' | 'gallery' | 'testimonials' | 'cta' | 'amenities' | 'dining' | 'map' | 'faq' | 'contact_form' | 'booking_widget' | 'html';
  content: Record<string, unknown>;
  order: number;
  visible: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────

const TEMPLATES: { id: WebsiteData['template']; name: string; description: string; gradient: string; icon: LucideIcon; popular?: boolean }[] = [
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary with bold typography', gradient: 'from-teal-500 to-cyan-500', icon: Sparkles, popular: true },
  { id: 'classic', name: 'Classic', description: 'Elegant, timeless with refined details', gradient: 'from-amber-500 to-orange-500', icon: Star },
  { id: 'boutique', name: 'Boutique', description: 'Artistic design for boutique properties', gradient: 'from-rose-500 to-pink-500', icon: Layout },
  { id: 'resort', name: 'Resort', description: 'Immersive design showcasing amenities', gradient: 'from-emerald-500 to-green-500', icon: Globe },
  { id: 'minimal', name: 'Minimal', description: 'Fast-loading minimalist design', gradient: 'from-zinc-500 to-slate-600', icon: Layout },
];

const TEMPLATE_THEMES: Record<string, { primaryColor: string; secondaryColor: string; fontFamily: string; borderRadius: string }> = {
  modern: { primaryColor: '#0d9488', secondaryColor: '#f59e0b', fontFamily: 'Inter', borderRadius: '8px' },
  classic: { primaryColor: '#1e3a5f', secondaryColor: '#c9a96e', fontFamily: 'Playfair Display', borderRadius: '4px' },
  boutique: { primaryColor: '#e11d48', secondaryColor: '#f472b6', fontFamily: 'DM Sans', borderRadius: '12px' },
  resort: { primaryColor: '#059669', secondaryColor: '#f97316', fontFamily: 'Montserrat', borderRadius: '16px' },
  minimal: { primaryColor: '#18181b', secondaryColor: '#6b7280', fontFamily: 'Inter', borderRadius: '2px' },
};

const FONT_OPTIONS = ['Inter', 'Poppins', 'Playfair Display', 'Roboto', 'Open Sans', 'Lato', 'Montserrat'];

const SECTION_TYPES: { value: PageSection['type']; label: string; icon: LucideIcon }[] = [
  { value: 'hero', label: 'Hero Banner', icon: Home },
  { value: 'rooms_grid', label: 'Rooms Grid', icon: Layout },
  { value: 'features', label: 'Features', icon: Sparkles },
  { value: 'gallery', label: 'Gallery', icon: Image },
  { value: 'testimonials', label: 'Testimonials', icon: Star },
  { value: 'cta', label: 'Call to Action', icon: Zap },
  { value: 'amenities', label: 'Amenities', icon: CheckCircle },
  { value: 'dining', label: 'Dining', icon: Utensils },
  { value: 'map', label: 'Map', icon: Map },
  { value: 'faq', label: 'FAQ', icon: HelpCircle },
  { value: 'contact_form', label: 'Contact Form', icon: Phone },
  { value: 'booking_widget', label: 'Booking Widget', icon: BookOpen },
  { value: 'html', label: 'Custom HTML', icon: Code },
];

function sectionLabel(type: string) {
  return SECTION_TYPES.find(s => s.value === type)?.label ?? type;
}

function sectionIcon(type: string): LucideIcon {
  return SECTION_TYPES.find(s => s.value === type)?.icon ?? FileText;
}

// ─── Status Badge (outside main component to satisfy react-hooks/static-components) ──

function StatusBadge({ status }: { status: string }) {
  const config = {
    published: { class: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300', icon: CheckCircle, label: 'Published' },
    draft: { class: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300', icon: Edit3, label: 'Draft' },
    unpublished: { class: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300', icon: AlertCircle, label: 'Unpublished' },
  }[status] ?? { class: '', icon: AlertCircle, label: status };
  const Icon = config.icon;
  return <Badge className={cn('gap-1', config.class)}><Icon className="h-3 w-3" />{config.label}</Badge>;
}

// ─── Section Content Editor ───────────────────────────────────────────────

function SectionEditor({
  type, content, onChange,
}: {
  type: string;
  content: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const field = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        value={(content[key] as string) || ''}
        onChange={e => onChange(key, e.target.value)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );

  const toggle = (key: string, label: string) => (
    <div className="flex items-center justify-between py-1">
      <Label className="text-xs font-medium">{label}</Label>
      <Switch checked={!!content[key]} onCheckedChange={v => onChange(key, v)} />
    </div>
  );

  const numField = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <Input
        type="number"
        value={(content[key] as number) ?? ''}
        onChange={e => onChange(key, e.target.value ? Number(e.target.value) : undefined)}
        placeholder={placeholder}
        className="h-9"
      />
    </div>
  );

  const itemList = (
    key: string, label: string, fields: { k: string; l: string; p?: string }[], newItem: Record<string, string>,
  ) => (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">{label}</Label>
        <Button
          variant="outline" size="sm" className="h-7 text-xs"
          onClick={() => {
            const items = (content[key] as Record<string, string>[]) ?? [];
            onChange(key, [...items, { ...newItem }]);
          }}
        >
          <Plus className="h-3 w-3 mr-1" />Add
        </Button>
      </div>
      {((content[key] as Record<string, string>[]) ?? []).map((item, idx) => (
        <div key={idx} className="p-3 border rounded-lg space-y-2 bg-muted/20">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">#{idx + 1}</span>
            <Button
              variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
              onClick={() => {
                const items = [...((content[key] as Record<string, string>[]) ?? [])];
                items.splice(idx, 1);
                onChange(key, items);
              }}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
          {fields.map(f => (
            <Input
              key={f.k}
              value={item[f.k] || ''}
              onChange={e => {
                const items = [...((content[key] as Record<string, string>[]) ?? [])];
                items[idx] = { ...items[idx], [f.k]: e.target.value };
                onChange(key, items);
              }}
              placeholder={f.p}
              className="h-8 text-sm"
            />
          ))}
        </div>
      ))}
    </div>
  );

  switch (type) {
    case 'hero':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Welcome to Our Hotel')}
          {field('subheading', 'Subheading', 'Experience luxury and comfort')}
          {field('ctaText', 'CTA Button Text', 'Book Now')}
          {toggle('showBookingWidget', 'Show Booking Widget')}
        </div>
      );
    case 'rooms_grid':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Our Rooms')}
          {toggle('showPrices', 'Show Prices')}
          {toggle('showAmenities', 'Show Amenities')}
        </div>
      );
    case 'features':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Why Choose Us')}
          {itemList('items', 'Feature Items', [
            { k: 'icon', l: 'Icon', p: 'CheckCircle' },
            { k: 'title', l: 'Title', p: 'Feature title' },
            { k: 'description', l: 'Description', p: 'Feature description' },
          ], { icon: 'CheckCircle', title: '', description: '' })}
        </div>
      );
    case 'gallery':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Gallery')}
          {itemList('images', 'Images', [
            { k: 'url', l: 'URL', p: 'https://example.com/photo.jpg' },
            { k: 'alt', l: 'Alt Text', p: 'Image description' },
          ], { url: '', alt: '' })}
        </div>
      );
    case 'testimonials':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Guest Reviews')}
          {numField('maxReviews', 'Max Reviews', '6')}
        </div>
      );
    case 'cta':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Ready to Book?')}
          {field('subheading', 'Subheading', 'Best rates guaranteed')}
          {field('buttonText', 'Button Text', 'Reserve Now')}
          {field('buttonUrl', 'Button URL', '/booking')}
        </div>
      );
    case 'amenities':
      return <div className="space-y-3">{field('heading', 'Heading', 'Amenities')}</div>;
    case 'dining':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Dining')}
          {itemList('restaurants', 'Restaurants', [
            { k: 'name', l: 'Name', p: 'Restaurant name' },
            { k: 'description', l: 'Description', p: 'Description' },
            { k: 'cuisine', l: 'Cuisine', p: 'Italian' },
            { k: 'hours', l: 'Hours', p: '7am - 10pm' },
          ], { name: '', description: '', cuisine: '', hours: '' })}
        </div>
      );
    case 'map':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Find Us')}
          {numField('zoom', 'Zoom Level', '14')}
        </div>
      );
    case 'faq':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'FAQ')}
          {itemList('items', 'FAQ Items', [
            { k: 'question', l: 'Question', p: 'Question text' },
            { k: 'answer', l: 'Answer', p: 'Answer text' },
          ], { question: '', answer: '' })}
        </div>
      );
    case 'contact_form':
      return (
        <div className="space-y-3">
          {field('heading', 'Heading', 'Get in Touch')}
          {toggle('showMap', 'Show Map')}
          {toggle('showPhone', 'Show Phone')}
          {toggle('showEmail', 'Show Email')}
        </div>
      );
    case 'booking_widget':
      return <div className="space-y-3">{field('heading', 'Heading', 'Book Your Stay')}</div>;
    case 'html':
      return (
        <div className="space-y-1.5">
          <Label className="text-xs font-medium">Custom HTML</Label>
          <Textarea
            value={(content.html as string) || ''}
            onChange={e => onChange('html', e.target.value)}
            placeholder="Enter custom HTML code..."
            rows={10}
            className="font-mono text-sm"
          />
        </div>
      );
    default:
      return <p className="text-sm text-muted-foreground text-center py-4">No editor for section type &quot;{type}&quot;</p>;
  }
}

// ─── Skeleton Loaders ─────────────────────────────────────────────────────

function OverviewSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-52 bg-muted rounded" />
          <div className="h-4 w-80 bg-muted rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted rounded" />
          <div className="h-9 w-24 bg-muted rounded" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted rounded-lg" />)}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map(i => <div key={i} className="h-56 bg-muted rounded-lg" />)}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────

export default function WebsiteBuilder() {
  const { currentProperty } = useAuthStore();
  const propertyId = currentProperty?.id;

  // Core state
  const [website, setWebsite] = useState<WebsiteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Theme state
  const [theme, setTheme] = useState({
    primaryColor: '#0d9488', secondaryColor: '#f59e0b',
    fontFamily: 'Inter', borderRadius: '8px', logoUrl: '', heroImageUrl: '',
  });

  // SEO state
  const [seo, setSeo] = useState({
    title: '', description: '', keywords: '', ogImage: '', favicon: '',
  });

  // Analytics state
  const [analytics, setAnalytics] = useState({
    gaId: '', gtmId: '', fbPixel: '', metaPixel: '', linkedinInsight: '', twitterPixel: '',
  });

  // Domain state
  const [customDomain, setCustomDomain] = useState('');

  // Pages state
  const [pages, setPages] = useState<WebsitePage[]>([]);
  const [expandedPage, setExpandedPage] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);

  // Dialog state
  const [newPageDialog, setNewPageDialog] = useState({ isOpen: false, title: '', slug: '' });
  const [editPageDialog, setEditPageDialog] = useState({ isOpen: false, pageId: '', title: '', slug: '', published: false });
  const [addSectionDialog, setAddSectionDialog] = useState({ isOpen: false, pageId: '', pageIdx: -1 });

  // ─── Sync local state from API data ─────────────────────────────────────

  const syncLocalState = useCallback((data: WebsiteData) => {
    setTheme({
      primaryColor: data.theme?.primaryColor || '#0d9488',
      secondaryColor: data.theme?.secondaryColor || '#f59e0b',
      fontFamily: data.theme?.fontFamily || 'Inter',
      borderRadius: data.theme?.borderRadius || '8px',
      logoUrl: data.theme?.logoUrl || '',
      heroImageUrl: data.theme?.heroImageUrl || '',
    });
    setSeo({
      title: data.seo?.title || '',
      description: data.seo?.description || '',
      keywords: Array.isArray(data.seo?.keywords) ? data.seo.keywords.join(', ') : '',
      ogImage: data.seo?.ogImage || '',
      favicon: data.seo?.faviconUrl || '',
    });
    setAnalytics({
      gaId: data.analytics?.googleAnalyticsId || '',
      gtmId: data.analytics?.googleTagManagerId || '',
      fbPixel: data.analytics?.facebookPixelId || '',
      metaPixel: data.analytics?.metaPixelId || '',
      linkedinInsight: data.analytics?.linkedInsightTag || '',
      twitterPixel: data.analytics?.twitterPixelId || '',
    });
    setCustomDomain(data.customDomain || '');
    setPages(data.pages || []);
  }, []);

  // ─── Fetch website ──────────────────────────────────────────────────────

  const fetchWebsite = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/website-builder?propertyId=${propertyId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setWebsite(json.data);
        syncLocalState(json.data);
      } else {
        setWebsite(null);
      }
    } catch {
      toast.error('Failed to load website data');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, syncLocalState]);

  useEffect(() => { fetchWebsite(); }, [fetchWebsite]);

  // ─── API helpers ─────────────────────────────────────────────────────────

  const apiPost = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return res.json();
  };

  const apiPut = async (url: string, body: unknown) => {
    const res = await fetch(url, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    return res.json();
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleCreateWebsite = async (templateId: string) => {
    if (!propertyId) { toast.error('No property selected'); return; }
    setIsSaving(true);
    try {
      const json = await apiPost('/api/website-builder', { propertyId, template: templateId });
      if (json.success) {
        setWebsite(json.data);
        syncLocalState(json.data);
        toast.success('Website created successfully!');
        setActiveTab('pages');
      } else {
        toast.error(json.error?.message || 'Failed to create website');
      }
    } catch {
      toast.error('Failed to create website');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTemplateChange = async (templateId: string) => {
    if (!website) return;
    setIsSaving(true);
    try {
      const templateTheme = TEMPLATE_THEMES[templateId] || TEMPLATE_THEMES.modern;
      const json = await apiPut('/api/website-builder', { id: website.id, template: templateId, theme: templateTheme });
      if (json.success) {
        setWebsite(json.data);
        syncLocalState(json.data);
        toast.success('Template updated!');
      } else {
        toast.error(json.error?.message || 'Failed to update template');
      }
    } catch {
      toast.error('Failed to update template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const json = await apiPut('/api/website-builder', {
        id: website.id,
        theme: {
          primaryColor: theme.primaryColor, secondaryColor: theme.secondaryColor,
          fontFamily: theme.fontFamily, borderRadius: theme.borderRadius,
          logoUrl: theme.logoUrl || undefined, heroImageUrl: theme.heroImageUrl || undefined,
        },
      });
      if (json.success) { setWebsite(json.data); toast.success('Theme saved!'); }
      else { toast.error(json.error?.message || 'Failed to save theme'); }
    } catch { toast.error('Failed to save theme'); }
    finally { setIsSaving(false); }
  };

  const handleSaveSEO = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const json = await apiPut('/api/website-builder/seo', {
        websiteId: website.id,
        title: seo.title, description: seo.description,
        keywords: seo.keywords.split(',').map(k => k.trim()).filter(Boolean),
        ogImage: seo.ogImage || undefined, faviconUrl: seo.favicon || undefined,
      });
      if (json.success) toast.success('SEO settings saved!');
      else toast.error(json.error?.message || 'Failed to save SEO');
    } catch { toast.error('Failed to save SEO settings'); }
    finally { setIsSaving(false); }
  };

  const handleSaveAnalytics = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const json = await apiPut('/api/website-builder/analytics', {
        websiteId: website.id,
        googleAnalyticsId: analytics.gaId || undefined, googleTagManagerId: analytics.gtmId || undefined,
        facebookPixelId: analytics.fbPixel || undefined, metaPixelId: analytics.metaPixel || undefined,
        linkedInsightTag: analytics.linkedinInsight || undefined, twitterPixelId: analytics.twitterPixel || undefined,
      });
      if (json.success) toast.success('Analytics settings saved!');
      else toast.error(json.error?.message || 'Failed to save analytics');
    } catch { toast.error('Failed to save analytics'); }
    finally { setIsSaving(false); }
  };

  const handleSaveDomain = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const json = await apiPut('/api/website-builder', { id: website.id, customDomain: customDomain || undefined });
      if (json.success) { setWebsite(json.data); toast.success('Domain saved!'); }
      else toast.error(json.error?.message || 'Failed to save domain');
    } catch { toast.error('Failed to save domain'); }
    finally { setIsSaving(false); }
  };

  const handleSavePages = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const json = await apiPut('/api/website-builder', { id: website.id, pages });
      if (json.success) { setWebsite(json.data); toast.success('Pages saved!'); }
      else toast.error(json.error?.message || 'Failed to save pages');
    } catch { toast.error('Failed to save pages'); }
    finally { setIsSaving(false); }
  };

  const handlePublish = async () => {
    if (!website) return;
    setIsPublishing(true);
    try {
      const action = website.status === 'published' ? 'unpublish' : 'publish';
      const json = await apiPost('/api/website-builder/publish', { websiteId: website.id, action });
      if (json.success) { setWebsite(json.data); toast.success(action === 'publish' ? 'Website published!' : 'Website unpublished'); }
      else toast.error(json.error?.message || `Failed to ${action}`);
    } catch { toast.error('Failed to update publish status'); }
    finally { setIsPublishing(false); }
  };

  const handleDeleteWebsite = async () => {
    if (!website) return;
    try {
      const res = await fetch(`/api/website-builder?websiteId=${website.id}&propertyId=${propertyId}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { setWebsite(null); toast.success('Website deleted'); }
      else toast.error(json.error?.message || 'Failed to delete website');
    } catch { toast.error('Failed to delete website'); }
  };

  const handleSyncFromProperty = async () => {
    if (!website) return;
    setIsSyncing(true);
    try {
      const json = await apiPost('/api/website-builder/sync', {
        websiteId: website.id, syncTypes: ['rooms', 'amenities', 'reviews', 'property'],
      });
      if (json.success) { await fetchWebsite(); toast.success('Property data synced!'); }
      else toast.error(json.error?.message || 'Failed to sync');
    } catch { toast.error('Failed to sync property data'); }
    finally { setIsSyncing(false); }
  };

  // ─── Page / Section handlers ─────────────────────────────────────────────

  const handleAddPage = async () => {
    if (!website || !newPageDialog.title.trim()) return;
    try {
      const json = await apiPost('/api/website-builder', {
        action: 'add-page', websiteId: website.id,
        page: {
          slug: newPageDialog.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          title: newPageDialog.title.trim(), sections: [], published: false,
        },
      });
      if (json.success) { await fetchWebsite(); setNewPageDialog({ isOpen: false, title: '', slug: '' }); toast.success('Page added!'); }
      else toast.error(json.error?.message || 'Failed to add page');
    } catch { toast.error('Failed to add page'); }
  };

  const handleRemovePage = async (pageId: string) => {
    if (!website) return;
    try {
      const json = await apiPost('/api/website-builder', { action: 'remove-page', websiteId: website.id, pageId });
      if (json.success) { await fetchWebsite(); toast.success('Page removed'); }
      else toast.error(json.error?.message || 'Failed to remove page');
    } catch { toast.error('Failed to remove page'); }
  };

  const handleUpdatePage = async () => {
    if (!website) return;
    try {
      const json = await apiPut('/api/website-builder', {
        action: 'update-page', websiteId: website.id, pageId: editPageDialog.pageId,
        updates: { title: editPageDialog.title, slug: editPageDialog.slug, published: editPageDialog.published },
      });
      if (json.success) { await fetchWebsite(); setEditPageDialog({ isOpen: false, pageId: '', title: '', slug: '', published: false }); toast.success('Page updated!'); }
      else toast.error(json.error?.message || 'Failed to update page');
    } catch { toast.error('Failed to update page'); }
  };

  const handleToggleSectionVisibility = (pageIdx: number, sectionIdx: number) => {
    setPages(prev => prev.map((p, pi) =>
      pi !== pageIdx ? p : { ...p, sections: p.sections.map((s, si) => si !== sectionIdx ? s : { ...s, visible: !s.visible }) }
    ));
  };

  const handleMoveSection = (pageIdx: number, sectionIdx: number, direction: 'up' | 'down') => {
    const swapIdx = direction === 'up' ? sectionIdx - 1 : sectionIdx + 1;
    if (swapIdx < 0 || swapIdx >= pages[pageIdx].sections.length) return;
    setPages(prev => prev.map((p, pi) => {
      if (pi !== pageIdx) return p;
      const sections = [...p.sections];
      [sections[sectionIdx], sections[swapIdx]] = [sections[swapIdx], sections[sectionIdx]];
      return { ...p, sections };
    }));
  };

  const handleRemoveSection = (pageIdx: number, sectionId: string) => {
    setPages(prev => prev.map((p, pi) =>
      pi !== pageIdx ? p : { ...p, sections: p.sections.filter(s => s.id !== sectionId) }
    ));
  };

  const handleAddSection = (pageIdx: number, type: PageSection['type']) => {
    const newSection: PageSection = {
      id: `s-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type, content: {}, order: pages[pageIdx].sections.length, visible: true,
    };
    setPages(prev => prev.map((p, pi) =>
      pi !== pageIdx ? p : { ...p, sections: [...p.sections, newSection] }
    ));
    setAddSectionDialog({ isOpen: false, pageId: '', pageIdx: -1 });
  };

  const handleSectionContentChange = (pageId: string, sectionId: string, key: string, value: unknown) => {
    setPages(prev => prev.map(p => {
      if (p.id !== pageId) return p;
      return { ...p, sections: p.sections.map(s =>
        s.id !== sectionId ? s : { ...s, content: { ...s.content, [key]: value } }
      )};
    }));
  };

  // ─── Utility ─────────────────────────────────────────────────────────────

  const handleCopyDomain = () => {
    if (website?.domain) {
      navigator.clipboard.writeText(website.customDomain || website.domain);
      toast.success('Domain copied to clipboard');
    }
  };

  const totalSections = pages.reduce((acc, p) => acc + p.sections.length, 0);

  const previewUrl = useMemo(() => {
    if (!website) return '';
    const slug = currentProperty?.slug || website.customDomain || website.domain;
    return `/site/${slug}?preview=true`;
  }, [website, currentProperty]);



  // ─── Loading ─────────────────────────────────────────────────────────────

  if (isLoading) return <OverviewSkeleton />;

  // ─── No website ──────────────────────────────────────────────────────────

  if (!website) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-teal-600 dark:text-teal-400" />Website Builder
          </h2>
          <p className="text-muted-foreground mt-1">Create a beautiful website for your property in seconds</p>
        </div>

        {!propertyId ? (
          <Card className="border-0 shadow-sm">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
              <AlertCircle className="h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No Property Selected</p>
              <p className="text-sm text-muted-foreground">Please select a property first to create a website.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Card className="border-0 shadow-sm bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30">
              <CardContent className="py-8 text-center">
                <Globe className="h-16 w-16 text-teal-600 dark:text-teal-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No Website Yet</h3>
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  Choose a template below to create a professional website for <strong>{currentProperty?.name || 'your property'}</strong>.
                </p>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-lg font-semibold mb-4">Choose a Template</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATES.map(t => {
                  const Icon = t.icon;
                  return (
                    <Card
                      key={t.id}
                      className={cn(
                        'border-2 cursor-pointer transition-all hover:shadow-lg',
                        'hover:border-teal-300 dark:hover:border-teal-700',
                      )}
                      onClick={() => handleCreateWebsite(t.id)}
                    >
                      <CardContent className="p-0">
                        <div className={cn('h-36 bg-gradient-to-br', t.gradient, 'relative overflow-hidden')}>
                          <div className="absolute inset-0 p-4 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1">
                                {[1, 2, 3].map(d => <div key={d} className="w-2 h-2 rounded-full bg-white/40" />)}
                              </div>
                              {t.popular && <Badge className="bg-white/90 text-gray-900 text-xs">Popular</Badge>}
                            </div>
                            <div>
                              <div className="w-24 h-3 bg-white/40 rounded mb-2" />
                              <div className="w-40 h-2 bg-white/30 rounded mb-1" />
                              <div className="w-32 h-2 bg-white/20 rounded" />
                            </div>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-1">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold">{t.name}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground">{t.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ─── Website exists — Full Editor ────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-teal-600 dark:text-teal-400" />Website Builder
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-muted-foreground">{website.customDomain || website.domain}</span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopyDomain}>
              <Copy className="h-3 w-3" />
            </Button>
            <StatusBadge status={website.status} />
            {website.publishedAt && (
              <span className="text-xs text-muted-foreground">
                Published {new Date(website.publishedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-2" />Preview
            </a>
          </Button>
          <Button
            size="sm"
            className={cn(
              website.status === 'published'
                ? 'bg-amber-500 hover:bg-amber-600 text-white'
                : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white',
            )}
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            {website.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <ScrollArea className="w-full">
          <TabsList className="grid w-max min-w-full grid-cols-6">
            <TabsTrigger value="overview" className="gap-1.5"><Monitor className="h-3.5 w-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="pages" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Pages</TabsTrigger>
            <TabsTrigger value="appearance" className="gap-1.5"><Palette className="h-3.5 w-3.5" />Appearance</TabsTrigger>
            <TabsTrigger value="seo" className="gap-1.5"><Search className="h-3.5 w-3.5" />SEO</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" />Analytics</TabsTrigger>
            <TabsTrigger value="domain" className="gap-1.5"><Link2 className="h-3.5 w-3.5" />Domain</TabsTrigger>
          </TabsList>
        </ScrollArea>

        {/* ─── Overview Tab ────────────────────────────────────────────── */}
        <TabsContent value="overview" className="mt-4 space-y-6">
          {/* Quick Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-teal-100 dark:bg-teal-900/50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pages.length}</p>
                  <p className="text-xs text-muted-foreground">Pages</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
                  <Layout className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalSections}</p>
                  <p className="text-xs text-muted-foreground">Sections</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{website.publishedAt ? new Date(website.publishedAt).toLocaleDateString() : '—'}</p>
                  <p className="text-xs text-muted-foreground">Last Published</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Template Selector */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Template</h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {TEMPLATES.map(t => {
                const Icon = t.icon;
                const isActive = website.template === t.id;
                return (
                  <Card
                    key={t.id}
                    className={cn(
                      'border-2 cursor-pointer transition-all hover:shadow-md',
                      isActive ? 'border-teal-500 shadow-md shadow-teal-500/20' : 'border-transparent hover:border-muted',
                    )}
                    onClick={() => { if (!isActive && !isSaving) handleTemplateChange(t.id); }}
                  >
                    <CardContent className="p-0">
                      <div className={cn('h-28 bg-gradient-to-br', t.gradient, 'relative overflow-hidden')}>
                        <div className="absolute inset-0 p-3 flex flex-col justify-between">
                          <div className="flex gap-1">
                            {[1, 2, 3].map(d => <div key={d} className="w-1.5 h-1.5 rounded-full bg-white/40" />)}
                          </div>
                          <div className="w-20 h-2 bg-white/30 rounded" />
                        </div>
                        {isActive && (
                          <div className="absolute top-2 right-2 bg-white rounded-full p-0.5">
                            <CheckCircle className="h-4 w-4 text-teal-600" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5 mb-0.5">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="font-medium text-sm">{t.name}</span>
                        </div>
                        {isActive && <Badge className="bg-teal-100 text-teal-700 text-xs mt-1">Active</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Quick Actions */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" onClick={handleSyncFromProperty} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sync Property Data
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />Open Preview
                </a>
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4 mr-2" />Delete Website</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Website</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete your website at <strong>{website.domain}</strong> and remove all pages, SEO settings, and analytics. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteWebsite} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Permanently
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </TabsContent>

        {/* ─── Pages Tab ────────────────────────────────────────────────── */}
        <TabsContent value="pages" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pages & Sections</h3>
              <p className="text-sm text-muted-foreground">Manage your website pages and their content sections</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleSyncFromProperty} disabled={isSyncing}>
                {isSyncing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Sync
              </Button>
              <Button size="sm" onClick={handleSavePages} disabled={isSaving} className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Pages
              </Button>
              <Button variant="outline" size="sm" onClick={() => setNewPageDialog({ isOpen: true, title: '', slug: '' })}>
                <Plus className="h-4 w-4 mr-2" />Add Page
              </Button>
            </div>
          </div>

          <ScrollArea className="max-h-[calc(100vh-320px)]">
            <div className="space-y-3">
              {pages.map((page, pageIdx) => {
                const isExpanded = expandedPage === page.id;
                return (
                  <Card key={page.id} className="border-0 shadow-sm">
                    <CardHeader className="p-4 pb-0">
                      <div className="flex items-center justify-between">
                        <button
                          className="flex items-center gap-3 flex-1 text-left"
                          onClick={() => setExpandedPage(isExpanded ? null : page.id)}
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          <FileText className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <p className="font-medium">{page.title}</p>
                            <p className="text-xs text-muted-foreground">/{page.slug}</p>
                          </div>
                          <Badge
                            variant={page.published ? 'default' : 'secondary'}
                            className={cn('ml-2', page.published && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300')}
                          >
                            {page.published ? 'Published' : 'Draft'}
                          </Badge>
                          {page.slug === 'home' && <Badge variant="outline" className="text-xs">Home</Badge>}
                        </button>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost" size="sm" className="h-8 w-8 p-0"
                            onClick={() => setEditPageDialog({
                              isOpen: true, pageId: page.id, title: page.title, slug: page.slug, published: page.published,
                            })}
                          >
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          {page.slug !== 'home' && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Page</AlertDialogTitle>
                                  <AlertDialogDescription>Delete &quot;{page.title}&quot;? This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => handleRemovePage(page.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="p-4 pt-3 space-y-3">
                        {page.sections.map((section, sectionIdx) => {
                          const SectionIcon = sectionIcon(section.type);
                          const isEditing = editingSection === section.id;
                          return (
                            <div key={section.id} className={cn(
                              'border rounded-lg transition-colors',
                              section.visible ? 'border-border' : 'border-muted bg-muted/20 opacity-70',
                            )}>
                              {/* Section Header */}
                              <div className="flex items-center gap-2 p-3">
                                <SectionIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium flex-1">{sectionLabel(section.type)}</span>
                                {!section.visible && <Badge variant="outline" className="text-xs">Hidden</Badge>}
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={sectionIdx === 0} onClick={() => handleMoveSection(pageIdx, sectionIdx, 'up')}>
                                    <ChevronUp className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" disabled={sectionIdx === page.sections.length - 1} onClick={() => handleMoveSection(pageIdx, sectionIdx, 'down')}>
                                    <ChevronDown className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="sm" className="h-7 w-7 p-0"
                                    onClick={() => setEditingSection(isEditing ? null : section.id)}
                                  >
                                    {isEditing ? <ChevronUp className="h-3.5 w-3.5" /> : <Settings className="h-3.5 w-3.5" />}
                                  </Button>
                                  <Switch
                                    checked={section.visible}
                                    onCheckedChange={() => handleToggleSectionVisibility(pageIdx, sectionIdx)}
                                    className="scale-75"
                                  />
                                  <Button
                                    variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveSection(pageIdx, section.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>

                              {/* Inline Section Editor */}
                              {isEditing && (
                                <div className="px-3 pb-3 border-t bg-muted/10">
                                  <div className="pt-3">
                                    <SectionEditor
                                      type={section.type}
                                      content={section.content}
                                      onChange={(key, value) => handleSectionContentChange(page.id, section.id, key, value)}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {page.sections.length === 0 && (
                          <p className="text-sm text-muted-foreground text-center py-4">No sections yet. Add one below.</p>
                        )}

                        <Separator />

                        {/* Add Section */}
                        <div className="flex flex-wrap gap-2">
                          {SECTION_TYPES.map(st => {
                            const Icon = st.icon;
                            return (
                              <Button
                                key={st.value} variant="outline" size="sm" className="h-7 text-xs gap-1"
                                onClick={() => handleAddSection(pageIdx, st.value)}
                              >
                                <Icon className="h-3 w-3" />{st.label}
                              </Button>
                            );
                          })}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}

              {pages.length === 0 && (
                <Card className="border-0 shadow-sm">
                  <CardContent className="py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium">No pages yet</p>
                    <p className="text-sm text-muted-foreground mb-4">Add your first page to get started.</p>
                    <Button size="sm" onClick={() => setNewPageDialog({ isOpen: true, title: '', slug: '' })}>
                      <Plus className="h-4 w-4 mr-2" />Add Page
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>

          {/* New Page Dialog */}
          <Dialog open={newPageDialog.isOpen} onOpenChange={open => setNewPageDialog(prev => ({ ...prev, isOpen: open }))}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Page</DialogTitle>
                <DialogDescription>Create a new page for your website</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Page Title</Label>
                  <Input
                    value={newPageDialog.title}
                    onChange={e => setNewPageDialog(prev => ({
                      ...prev,
                      title: e.target.value,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
                    }))}
                    placeholder="e.g., Spa & Wellness"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input
                    value={newPageDialog.slug}
                    onChange={e => setNewPageDialog(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="spa-wellness"
                  />
                  <p className="text-xs text-muted-foreground">/{newPageDialog.slug || 'page-slug'}</p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setNewPageDialog({ isOpen: false, title: '', slug: '' })}>Cancel</Button>
                <Button onClick={handleAddPage} disabled={!newPageDialog.title.trim() || !newPageDialog.slug.trim()}>Add Page</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Page Dialog */}
          <Dialog open={editPageDialog.isOpen} onOpenChange={open => setEditPageDialog(prev => ({ ...prev, isOpen: open }))}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Page</DialogTitle>
                <DialogDescription>Update page settings</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Page Title</Label>
                  <Input value={editPageDialog.title} onChange={e => setEditPageDialog(prev => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input value={editPageDialog.slug} onChange={e => setEditPageDialog(prev => ({ ...prev, slug: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editPageDialog.published} onCheckedChange={v => setEditPageDialog(prev => ({ ...prev, published: v }))} />
                  <Label>Published</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setEditPageDialog({ isOpen: false, pageId: '', title: '', slug: '', published: false })}>Cancel</Button>
                <Button onClick={handleUpdatePage}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Appearance Tab ───────────────────────────────────────────── */}
        <TabsContent value="appearance" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-teal-600 dark:text-teal-400" />Theme Customizer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Primary Color */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Primary Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={theme.primaryColor} onChange={e => setTheme(p => ({ ...p, primaryColor: e.target.value }))} className="w-12 h-10 p-1 cursor-pointer" />
                    <Input value={theme.primaryColor} onChange={e => setTheme(p => ({ ...p, primaryColor: e.target.value }))} className="flex-1" />
                  </div>
                  <div className="flex gap-2 mt-1">
                    {['#0d9488', '#059669', '#e11d48', '#f59e0b', '#ef4444', '#1e3a5f', '#7c3aed', '#18181b'].map(c => (
                      <button
                        key={c}
                        className={cn('w-7 h-7 rounded-full border-2 transition-transform hover:scale-110', theme.primaryColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                        style={{ backgroundColor: c }}
                        onClick={() => setTheme(p => ({ ...p, primaryColor: c }))}
                      />
                    ))}
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Secondary Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input type="color" value={theme.secondaryColor} onChange={e => setTheme(p => ({ ...p, secondaryColor: e.target.value }))} className="w-12 h-10 p-1 cursor-pointer" />
                    <Input value={theme.secondaryColor} onChange={e => setTheme(p => ({ ...p, secondaryColor: e.target.value }))} className="flex-1" />
                  </div>
                </div>

                {/* Font Family */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Font Family</Label>
                  <Select value={theme.fontFamily} onValueChange={v => setTheme(p => ({ ...p, fontFamily: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(f => <SelectItem key={f} value={f}><span style={{ fontFamily: f }}>{f}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {/* Border Radius */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Border Radius — {theme.borderRadius}</Label>
                  <Slider
                    value={[parseInt(theme.borderRadius)]}
                    onValueChange={([v]) => setTheme(p => ({ ...p, borderRadius: `${v}px` }))}
                    min={0} max={24} step={2}
                    className="py-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Sharp (0px)</span><span>Round (24px)</span>
                  </div>
                </div>

                <Separator />

                {/* Logo & Hero URLs */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Logo URL</Label>
                  <Input value={theme.logoUrl} onChange={e => setTheme(p => ({ ...p, logoUrl: e.target.value }))} placeholder="https://example.com/logo.png" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Hero Image URL</Label>
                  <Input value={theme.heroImageUrl} onChange={e => setTheme(p => ({ ...p, heroImageUrl: e.target.value }))} placeholder="https://example.com/hero.jpg" />
                </div>

                <Separator />

                <Button
                  className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
                  onClick={handleSaveTheme} disabled={isSaving}
                >
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Appearance
                </Button>
              </CardContent>
            </Card>

            {/* Live Preview */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-teal-600 dark:text-teal-400" />Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[500px] border rounded-lg bg-white"
                    title="Website Preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div className="h-[500px] border rounded-lg flex items-center justify-center bg-muted/30">
                    <p className="text-sm text-muted-foreground">No preview available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── SEO Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="seo" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Search className="h-5 w-5 text-teal-600 dark:text-teal-400" />SEO Settings
                </CardTitle>
                <CardDescription>Optimize your website for search engines</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Meta Title</Label>
                  <Input value={seo.title} onChange={e => setSeo(p => ({ ...p, title: e.target.value }))} placeholder="Your Hotel Name — Official Website" />
                  <p className={cn('text-xs', seo.title.length > 60 ? 'text-destructive' : 'text-muted-foreground')}>{seo.title.length}/60 characters</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Meta Description</Label>
                  <Textarea value={seo.description} onChange={e => setSeo(p => ({ ...p, description: e.target.value }))} rows={3} placeholder="Experience luxury and comfort at our hotel..." />
                  <p className={cn('text-xs', seo.description.length > 160 ? 'text-destructive' : 'text-muted-foreground')}>{seo.description.length}/160 characters</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Keywords</Label>
                  <Input value={seo.keywords} onChange={e => setSeo(p => ({ ...p, keywords: e.target.value }))} placeholder="luxury hotel, resort, spa" />
                  <p className="text-xs text-muted-foreground">Comma-separated keywords</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Open Graph Image URL</Label>
                  <Input value={seo.ogImage} onChange={e => setSeo(p => ({ ...p, ogImage: e.target.value }))} placeholder="https://example.com/og-image.jpg" />
                  <p className="text-xs text-muted-foreground">Social sharing image (1200×630 recommended)</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Favicon URL</Label>
                  <Input value={seo.favicon} onChange={e => setSeo(p => ({ ...p, favicon: e.target.value }))} placeholder="https://example.com/favicon.ico" />
                </div>

                <Button className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white" onClick={handleSaveSEO} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save SEO Settings
                </Button>
              </CardContent>
            </Card>

            {/* Google Preview */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Search Engine Preview</CardTitle>
                <CardDescription>How your site may appear in Google search results</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="p-4 rounded-lg border bg-white dark:bg-zinc-950 space-y-1">
                  <p className="text-blue-700 dark:text-blue-400 text-lg font-medium hover:underline cursor-pointer truncate">
                    {seo.title || 'Your Hotel Name — Official Website'}
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-500">{customDomain || website.domain}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {seo.description || 'Add a meta description to improve how your site appears in search results...'}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Analytics Tab ────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />Analytics & Tracking
                </CardTitle>
                <CardDescription>Configure tracking pixels and analytics integrations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {[
                  { key: 'gaId' as const, label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX', desc: 'Track visitors with Google Analytics 4' },
                  { key: 'gtmId' as const, label: 'Google Tag Manager ID', placeholder: 'GTM-XXXXXXX', desc: 'Manage all tracking tags centrally' },
                  { key: 'fbPixel' as const, label: 'Facebook Pixel ID', placeholder: 'XXXXXXXXXX', desc: 'Track conversions and retargeting' },
                  { key: 'metaPixel' as const, label: 'Meta Pixel ID', placeholder: 'XXXXXXXXXX', desc: 'Instagram + Facebook conversion tracking' },
                  { key: 'linkedinInsight' as const, label: 'LinkedIn Insight Tag', placeholder: 'XXXXXXXXXX', desc: 'LinkedIn ad conversions and B2B analytics' },
                  { key: 'twitterPixel' as const, label: 'Twitter/X Pixel ID', placeholder: 'XXXXXXXXXX', desc: 'Twitter/X ad campaign conversions' },
                ].map(({ key, label, placeholder, desc }) => (
                  <div key={key} className="space-y-1.5">
                    <Label className="text-sm font-medium">{label}</Label>
                    <Input
                      value={analytics[key]}
                      onChange={e => setAnalytics(p => ({ ...p, [key]: e.target.value }))}
                      placeholder={placeholder}
                    />
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                ))}

                <Button className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white" onClick={handleSaveAnalytics} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Analytics Settings
                </Button>
              </CardContent>
            </Card>

            {/* Connection Status */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Tracking Status</CardTitle>
                <CardDescription>Overview of configured integrations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Google Analytics', configured: !!analytics.gaId },
                    { name: 'Google Tag Manager', configured: !!analytics.gtmId },
                    { name: 'Facebook Pixel', configured: !!analytics.fbPixel },
                    { name: 'Meta Pixel', configured: !!analytics.metaPixel },
                    { name: 'LinkedIn Insight', configured: !!analytics.linkedinInsight },
                    { name: 'Twitter/X Pixel', configured: !!analytics.twitterPixel },
                  ].map(tracker => (
                    <div key={tracker.name} className="flex items-center justify-between py-2 border-b last:border-0">
                      <span className="text-sm">{tracker.name}</span>
                      <div className="flex items-center gap-2">
                        <div className={cn('h-2 w-2 rounded-full', tracker.configured ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600')} />
                        <Badge variant={tracker.configured ? 'default' : 'secondary'} className={cn('text-xs', tracker.configured && 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300')}>
                          {tracker.configured ? 'Connected' : 'Not set'}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Domain Tab ───────────────────────────────────────────────── */}
        <TabsContent value="domain" className="mt-4">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />Domain Settings
                </CardTitle>
                <CardDescription>Manage your website domain and custom domain</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Default Domain</Label>
                  <div className="flex gap-2">
                    <Input value={website.domain} readOnly className="flex-1 bg-muted" />
                    <Button variant="outline" size="sm" onClick={handleCopyDomain}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Auto-generated domain for your website</p>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label className="text-sm font-medium">Custom Domain</Label>
                  <Input
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    placeholder="www.myhotel.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Point your own domain to this website. Make sure your DNS records are configured correctly.
                  </p>
                </div>

                {customDomain && customDomain !== website.customDomain && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-300">DNS Configuration Required</p>
                        <p className="text-amber-700 dark:text-amber-400 text-xs mt-1">
                          Add a CNAME record pointing <strong>{customDomain}</strong> to <strong>{website.domain}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                <Button className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white" onClick={handleSaveDomain} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Domain
                </Button>
              </CardContent>
            </Card>

            {/* Domain Info Card */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Domain Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 rounded-lg border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status</span>
                    <StatusBadge status={website.status} />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Active Domain</span>
                    <span className="text-sm font-medium">{website.customDomain || website.domain}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Template</span>
                    <span className="text-sm font-medium capitalize">{website.template}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Last Updated</span>
                    <span className="text-sm font-medium">{new Date(website.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800">
                  <h4 className="text-sm font-medium text-teal-800 dark:text-teal-300 mb-2">DNS Setup Guide</h4>
                  <ol className="text-xs text-teal-700 dark:text-teal-400 space-y-1.5 list-decimal list-inside">
                    <li>Log in to your domain registrar</li>
                    <li>Add a CNAME record pointing to <strong>{website.domain}</strong></li>
                    <li>Wait for DNS propagation (up to 48 hours)</li>
                    <li>Enter your custom domain above and save</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
