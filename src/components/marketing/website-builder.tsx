'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Globe, Plus, Settings, Eye, EyeOff, Trash2, Palette, Search,
  BarChart3, Layout, Copy, ExternalLink, CheckCircle, XCircle, Loader2,
  ChevronDown, ChevronRight, GripVertical, Image, Type, Paintbrush,
  MousePointer, Monitor, Smartphone, FileText, MessageSquare, MapPin,
  HelpCircle, Mail, Calendar, Star, Columns, Sparkles, ArrowRight,
  ToggleLeft, ToggleRight, Minus, CircleDot,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Template Definitions ────────────────────────────────────────────────────

const TEMPLATES = [
  { id: 'modern', name: 'Modern', desc: 'Clean & contemporary design with bold imagery', accent: 'from-teal-600 to-cyan-500' },
  { id: 'classic', name: 'Classic', desc: 'Timeless elegance with refined typography', accent: 'from-slate-800 to-slate-600' },
  { id: 'boutique', name: 'Boutique', desc: 'Charming & intimate feel for small hotels', accent: 'from-violet-600 to-purple-400' },
  { id: 'resort', name: 'Resort', desc: 'Luxurious & expansive for resort properties', accent: 'from-emerald-600 to-green-400' },
  { id: 'minimal', name: 'Minimal', desc: 'Ultra-clean design with ample whitespace', accent: 'from-zinc-800 to-zinc-600' },
];

const TEMPLATE_THEMES: Record<string, { primary: string; secondary: string }> = {
  modern: { primary: '#0d9488', secondary: '#f59e0b' },
  classic: { primary: '#1e3a5f', secondary: '#c9a96e' },
  boutique: { primary: '#7c3aed', secondary: '#ec4899' },
  resort: { primary: '#059669', secondary: '#f97316' },
  minimal: { primary: '#18181b', secondary: '#6b7280' },
};

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'DM Sans', label: 'DM Sans' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Poppins', label: 'Poppins' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Montserrat', label: 'Montserrat' },
];

const BORDER_RADIUS_OPTIONS = [
  { value: '0px', label: 'None' },
  { value: '2px', label: 'Sharp' },
  { value: '4px', label: 'Small' },
  { value: '8px', label: 'Medium' },
  { value: '12px', label: 'Rounded' },
  { value: '16px', label: 'Large' },
  { value: '24px', label: 'Extra Large' },
];

const SECTION_TYPES = [
  { id: 'hero', label: 'Hero Banner', icon: Monitor },
  { id: 'rooms_grid', label: 'Rooms Grid', icon: Columns },
  { id: 'features', label: 'Features', icon: Star },
  { id: 'gallery', label: 'Photo Gallery', icon: Image },
  { id: 'testimonials', label: 'Testimonials', icon: MessageSquare },
  { id: 'cta', label: 'Call to Action', icon: MousePointer },
  { id: 'amenities', label: 'Amenities', icon: Sparkles },
  { id: 'dining', label: 'Dining', icon: Calendar },
  { id: 'map', label: 'Location Map', icon: MapPin },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
  { id: 'contact_form', label: 'Contact Form', icon: Mail },
  { id: 'booking_widget', label: 'Booking Widget', icon: Calendar },
  { id: 'html', label: 'Custom HTML', icon: FileText },
];

const ANALYTICS_FIELDS = [
  { key: 'googleAnalyticsId', label: 'Google Analytics ID', placeholder: 'G-XXXXXXXXXX' },
  { key: 'googleTagManagerId', label: 'Google Tag Manager ID', placeholder: 'GTM-XXXXXXX' },
  { key: 'facebookPixelId', label: 'Facebook Pixel ID', placeholder: 'XXXXXXXXXXXXXXX' },
  { key: 'metaPixelId', label: 'Meta Conversions API', placeholder: 'Pixel ID' },
  { key: 'linkedInsightTag', label: 'LinkedIn Insight Tag', placeholder: 'Partner ID' },
  { key: 'twitterPixelId', label: 'Twitter/X Pixel', placeholder: 'Pixel ID' },
];

// ─── Types ───────────────────────────────────────────────────────────────────

interface PageSection {
  id: string;
  type: string;
  content: Record<string, unknown>;
  order: number;
  visible: boolean;
}

interface WebsitePage {
  id: string;
  slug: string;
  title: string;
  sections: PageSection[];
  published: boolean;
}

interface WebsiteConfig {
  id?: string;
  domain?: string;
  customDomain?: string;
  status?: string;
  template?: string;
  theme?: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    borderRadius: string;
    logoUrl?: string;
    heroImageUrl?: string;
  };
  seo?: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
    faviconUrl?: string;
  };
  analytics?: Record<string, string>;
  pages?: WebsitePage[];
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function WebsiteBuilder() {
  const [website, setWebsite] = useState<WebsiteConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [propertyId] = useState('preview-property');

  // Theme state
  const [themePrimary, setThemePrimary] = useState('#0d9488');
  const [themeSecondary, setThemeSecondary] = useState('#f59e0b');
  const [themeFont, setThemeFont] = useState('Inter');
  const [themeRadius, setThemeRadius] = useState('8px');

  // SEO state
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');
  const [seoFaviconUrl, setSeoFaviconUrl] = useState('');

  // Analytics state
  const [analyticsState, setAnalyticsState] = useState<Record<string, string>>({});

  // Page editor state
  const [selectedPage, setSelectedPage] = useState<string | null>(null);
  const [showAddPageDialog, setShowAddPageDialog] = useState(false);
  const [showAddSectionDialog, setShowAddSectionDialog] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [selectedSectionType, setSelectedSectionType] = useState('features');

  const fetchWebsite = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/website-builder?propertyId=${propertyId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setWebsite(json.data);
        setSeoTitle(json.data.seo?.title || '');
        setSeoDescription(json.data.seo?.description || '');
        setSeoKeywords(json.data.seo?.keywords?.join(', ') || '');
        setSeoOgImage(json.data.seo?.ogImage || '');
        setSeoFaviconUrl(json.data.seo?.faviconUrl || '');
        setThemePrimary(json.data.theme?.primaryColor || '#0d9488');
        setThemeSecondary(json.data.theme?.secondaryColor || '#f59e0b');
        setThemeFont(json.data.theme?.fontFamily || 'Inter');
        setThemeRadius(json.data.theme?.borderRadius || '8px');
        setAnalyticsState(json.data.analytics || {});
        if (json.data.pages?.length > 0) {
          setSelectedPage(json.data.pages[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch website:', err);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => { fetchWebsite(); }, [fetchWebsite]);

  // ─── Actions ───

  const handleCreate = async () => {
    try {
      setCreating(true);
      const res = await fetch('/api/website-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, template: selectedTemplate }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        setShowCreateDialog(false);
        toast.success('Website created successfully!');
      } else {
        toast.error(json.error?.message || 'Failed to create website');
      }
    } catch {
      toast.error('Failed to create website');
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (action: 'publish' | 'unpublish') => {
    if (!website?.id) return;
    try {
      setSaving(true);
      const res = await fetch('/api/website-builder/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId: website.id, action }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        toast.success(action === 'publish' ? 'Website published!' : 'Website unpublished');
      }
    } catch {
      toast.error('Failed to update publish status');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveTheme = async () => {
    if (!website?.id) return;
    try {
      setSaving(true);
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: website.id,
          theme: { primaryColor: themePrimary, secondaryColor: themeSecondary, fontFamily: themeFont, borderRadius: themeRadius },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        toast.success('Theme updated!');
      }
    } catch {
      toast.error('Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeo = async () => {
    if (!website?.id) return;
    try {
      setSaving(true);
      const res = await fetch('/api/website-builder/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId: website.id,
          title: seoTitle,
          description: seoDescription,
          keywords: seoKeywords.split(',').map(k => k.trim()).filter(Boolean),
          ogImage: seoOgImage || undefined,
          faviconUrl: seoFaviconUrl || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite({ ...website, seo: json.data });
        toast.success('SEO settings saved!');
      }
    } catch {
      toast.error('Failed to save SEO settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAnalytics = async () => {
    if (!website?.id) return;
    try {
      setSaving(true);
      const clean: Record<string, string> = {};
      for (const [k, v] of Object.entries(analyticsState)) {
        if (v && v.trim()) clean[k] = v.trim();
      }
      const res = await fetch('/api/website-builder/analytics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId: website.id, ...clean }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite({ ...website, analytics: json.data });
        toast.success('Analytics settings saved!');
      }
    } catch {
      toast.error('Failed to save analytics settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!website?.id) return;
    try {
      await fetch(`/api/website-builder?id=${website.id}`, { method: 'DELETE' });
      setWebsite(null);
      toast.success('Website deleted');
    } catch {
      toast.error('Failed to delete website');
    }
  };

  const handleAddPage = async () => {
    if (!website?.id || !newPageTitle) return;
    try {
      setSaving(true);
      const res = await fetch('/api/website-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-page',
          websiteId: website.id,
          page: { slug: newPageSlug || newPageTitle.toLowerCase().replace(/[^a-z0-9]/g, '-'), title: newPageTitle, sections: [], published: false },
        }),
      });
      const json = await res.json();
      if (json.success) {
        const updatedPages = [...(website.pages || []), json.data];
        setWebsite({ ...website, pages: updatedPages });
        setSelectedPage(json.data.id);
        setShowAddPageDialog(false);
        setNewPageTitle('');
        setNewPageSlug('');
        toast.success('Page added!');
      }
    } catch {
      toast.error('Failed to add page');
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePage = async (pageId: string) => {
    if (!website?.id) return;
    try {
      setSaving(true);
      const res = await fetch('/api/website-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-page', websiteId: website.id, pageId }),
      });
      if (res.ok) {
        const updatedPages = (website.pages || []).filter(p => p.id !== pageId);
        setWebsite({ ...website, pages: updatedPages });
        if (selectedPage === pageId) {
          setSelectedPage(updatedPages[0]?.id || null);
        }
        toast.success('Page removed');
      }
    } catch {
      toast.error('Failed to remove page');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleSection = async (pageId: string, sectionId: string, visible: boolean) => {
    if (!website?.id) return;
    const page = (website.pages || []).find(p => p.id === pageId);
    if (!page) return;
    const updatedSections = page.sections.map(s => s.id === sectionId ? { ...s, visible } : s);
    try {
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-page', websiteId: website.id, pageId, updates: { sections: updatedSections } }),
      });
      const json = await res.json();
      if (json.success) {
        const updatedPages = (website.pages || []).map(p => p.id === pageId ? json.data : p);
        setWebsite({ ...website, pages: updatedPages });
      }
    } catch {
      toast.error('Failed to toggle section');
    }
  };

  const handleAddSection = async (pageId: string) => {
    if (!website?.id) return;
    const page = (website.pages || []).find(p => p.id === pageId);
    if (!page) return;
    const newSection: PageSection = {
      id: `sec-${Date.now()}`,
      type: selectedSectionType,
      content: { heading: SECTION_TYPES.find(s => s.id === selectedSectionType)?.label || 'New Section' },
      order: page.sections.length,
      visible: true,
    };
    const updatedSections = [...page.sections, newSection];
    try {
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-page', websiteId: website.id, pageId, updates: { sections: updatedSections } }),
      });
      const json = await res.json();
      if (json.success) {
        const updatedPages = (website.pages || []).map(p => p.id === pageId ? json.data : p);
        setWebsite({ ...website, pages: updatedPages });
        setShowAddSectionDialog(false);
        toast.success('Section added!');
      }
    } catch {
      toast.error('Failed to add section');
    }
  };

  const handleRemoveSection = async (pageId: string, sectionId: string) => {
    if (!website?.id) return;
    const page = (website.pages || []).find(p => p.id === pageId);
    if (!page) return;
    const updatedSections = page.sections.filter(s => s.id !== sectionId);
    try {
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-page', websiteId: website.id, pageId, updates: { sections: updatedSections } }),
      });
      const json = await res.json();
      if (json.success) {
        const updatedPages = (website.pages || []).map(p => p.id === pageId ? json.data : p);
        setWebsite({ ...website, pages: updatedPages });
        toast.success('Section removed');
      }
    } catch {
      toast.error('Failed to remove section');
    }
  };

  // ─── Render ───

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // ─── No Website — Creation Screen ─────────────────────────────────────

  if (!website) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Website Builder</h2>
            <p className="text-muted-foreground text-sm mt-1">Create a stunning website for your hotel in minutes</p>
          </div>
        </div>

        <Card className="border-0 shadow-lg max-w-5xl mx-auto">
          <CardContent className="p-8 text-center space-y-8">
            <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 shadow-lg shadow-teal-500/20">
              <Globe className="h-10 w-10 text-white" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">Launch Your Hotel Website</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Choose from 5 professionally designed templates. Customize colors, fonts, SEO, tracking pixels — all in one click.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 pt-4">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setSelectedTemplate(t.id); setShowCreateDialog(true); }}
                  className="group relative text-left p-4 rounded-xl border-2 border-transparent hover:border-teal-500 bg-muted/50 hover:bg-muted transition-all duration-200"
                >
                  {/* Preview Thumbnail */}
                  <div className={`h-32 rounded-lg bg-gradient-to-br ${t.accent} mb-3 overflow-hidden relative`}>
                    <div className="absolute inset-0 p-3 flex flex-col gap-1.5">
                      <div className="h-1.5 bg-white/30 rounded w-3/4" />
                      <div className="h-1 bg-white/20 rounded w-1/2" />
                      <div className="flex-1" />
                      <div className="h-5 bg-white/25 rounded w-1/3" />
                    </div>
                    <div className="absolute bottom-1.5 right-1.5">
                      <div className="w-6 h-6 rounded-full bg-white/20" />
                    </div>
                  </div>
                  <h4 className="font-semibold text-sm">{t.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{t.desc}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TEMPLATE_THEMES[t.id].primary }} />
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TEMPLATE_THEMES[t.id].secondary }} />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Hotel Website</DialogTitle>
              <DialogDescription>Choose a template and customize your domain</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-4">
                <div className={`h-20 w-36 rounded-lg bg-gradient-to-br ${TEMPLATES.find(t => t.id === selectedTemplate)?.accent} flex items-center justify-center relative overflow-hidden`}>
                  <div className="absolute inset-0 p-2 flex flex-col gap-1">
                    <div className="h-1 bg-white/30 rounded w-3/4" />
                    <div className="h-0.5 bg-white/20 rounded w-1/2" />
                    <div className="flex-1" />
                    <div className="h-4 bg-white/25 rounded w-1/3" />
                  </div>
                </div>
                <div>
                  <p className="font-semibold">{TEMPLATES.find(t => t.id === selectedTemplate)?.name}</p>
                  <p className="text-xs text-muted-foreground">{TEMPLATES.find(t => t.id === selectedTemplate)?.desc}</p>
                </div>
              </div>
              <div>
                <Label>Template</Label>
                <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TEMPLATES.map(t => (
                      <SelectItem key={t.id} value={t.id}>{t.name} — {t.desc}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Custom Domain (optional)</Label>
                <Input placeholder="www.myhotel.com" className="mt-1" disabled />
                <p className="text-xs text-muted-foreground mt-1">Custom domains require DNS configuration</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating} className="bg-teal-600 hover:bg-teal-700 text-white">
                {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Create Website
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Website Dashboard ────────────────────────────────────────────────

  const statusColor = website.status === 'published' ? 'bg-emerald-500' : website.status === 'draft' ? 'bg-amber-500' : 'bg-slate-500';
  const statusLabel = website.status === 'published' ? 'Published' : website.status === 'draft' ? 'Draft' : 'Unpublished';
  const templateInfo = TEMPLATES.find(t => t.id === website.template);
  const currentPageData = (website.pages || []).find(p => p.id === selectedPage);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Website Builder</h2>
          <p className="text-muted-foreground text-sm mt-1">Manage your hotel&apos;s website</p>
        </div>
        <div className="flex items-center gap-2">
          {website.status === 'published' ? (
            <Button variant="outline" onClick={() => handlePublish('unpublish')} disabled={saving} className="gap-2">
              <EyeOff className="h-4 w-4" /> Unpublish
            </Button>
          ) : (
            <Button onClick={() => handlePublish('publish')} disabled={saving} className="gap-2 bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
              Publish
            </Button>
          )}
          <Button variant="outline" onClick={handleDelete} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Globe className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge variant="secondary" className={`${statusColor} text-white text-xs`}>{statusLabel}</Badge>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Layout className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Template</p>
              <p className="font-semibold text-sm">{templateInfo?.name}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Search className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pages</p>
              <p className="font-semibold text-sm">{website.pages?.length || 0} pages</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <ExternalLink className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Domain</p>
              <p className="font-semibold text-sm text-teal-600 truncate">{website.domain}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="designer">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="designer">Designer</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        {/* ─── Theme/Template Designer ─── */}
        <TabsContent value="designer" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Palette className="h-4 w-4" /> Theme Customizer
              </CardTitle>
              <CardDescription>Customize colors, fonts, and border radius for your website</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Selection */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Template</Label>
                <div className="grid grid-cols-5 gap-3">
                  {TEMPLATES.map(t => {
                    const isActive = website.template === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={async () => {
                          if (!website.id) return;
                          setSaving(true);
                          try {
                            const res = await fetch('/api/website-builder', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ id: website.id, template: t.id }),
                            });
                            const json = await res.json();
                            if (json.success) {
                              setWebsite(json.data);
                              const theme = TEMPLATE_THEMES[t.id];
                              setThemePrimary(theme.primary);
                              setThemeSecondary(theme.secondary);
                              toast.success(`Switched to ${t.name} template`);
                            }
                          } catch { toast.error('Failed to switch template'); }
                          setSaving(false);
                        }}
                        disabled={saving}
                        className={cn(
                          'relative text-left p-2 rounded-lg border-2 transition-all duration-200',
                          isActive ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-transparent bg-muted/50 hover:bg-muted'
                        )}
                      >
                        <div className={`h-16 rounded bg-gradient-to-br ${t.accent} mb-1.5 relative overflow-hidden`}>
                          <div className="absolute inset-0 p-2 flex flex-col gap-1">
                            <div className="h-1 bg-white/30 rounded w-3/4" />
                            <div className="h-0.5 bg-white/20 rounded w-1/2" />
                            <div className="flex-1" />
                            <div className="h-3 bg-white/25 rounded w-1/3" />
                          </div>
                          {isActive && <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-white flex items-center justify-center"><CheckCircle className="h-3 w-3 text-teal-600" /></div>}
                        </div>
                        <p className="text-[10px] font-medium truncate">{t.name}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Color Picker */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">Primary Color</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="relative">
                      <input type="color" value={themePrimary} onChange={e => setThemePrimary(e.target.value)} className="w-10 h-10 rounded-lg border-2 border-border cursor-pointer" />
                    </div>
                    <Input value={themePrimary} onChange={e => setThemePrimary(e.target.value)} className="flex-1 font-mono text-sm" />
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Secondary Color</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="relative">
                      <input type="color" value={themeSecondary} onChange={e => setThemeSecondary(e.target.value)} className="w-10 h-10 rounded-lg border-2 border-border cursor-pointer" />
                    </div>
                    <Input value={themeSecondary} onChange={e => setThemeSecondary(e.target.value)} className="flex-1 font-mono text-sm" />
                  </div>
                </div>
              </div>

              {/* Font & Radius */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium">Font Family</Label>
                  <Select value={themeFont} onValueChange={setThemeFont}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map(f => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm font-medium">Border Radius</Label>
                  <Select value={themeRadius} onValueChange={setThemeRadius}>
                    <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BORDER_RADIUS_OPTIONS.map(r => (
                        <SelectItem key={r.value} value={r.value}>{r.label} ({r.value})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Preview Strip */}
              <div className="p-4 bg-muted/50 rounded-xl space-y-3">
                <p className="text-xs text-muted-foreground font-medium">Live Preview</p>
                <div className="flex items-center gap-4">
                  <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: themePrimary, borderRadius: themeRadius }}>
                    Primary Button
                  </div>
                  <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: themeSecondary, borderRadius: themeRadius }}>
                    Secondary
                  </div>
                  <div className="px-4 py-2 rounded-lg border-2 text-sm font-medium" style={{ borderColor: themePrimary, color: themePrimary, borderRadius: themeRadius }}>
                    Outlined
                  </div>
                </div>
                <p className="text-sm" style={{ fontFamily: themeFont }}>
                  The quick brown fox jumps over the lazy dog. 0123456789
                </p>
              </div>

              <Button onClick={handleSaveTheme} disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Paintbrush className="h-4 w-4 mr-2" />}
                Save Theme
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Page Editor ─── */}
        <TabsContent value="pages" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Page List */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Pages</CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setShowAddPageDialog(true)} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" /> Add
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ScrollArea className="max-h-[500px]">
                  <div className="divide-y">
                    {(website.pages || []).map(page => (
                      <button
                        key={page.id}
                        onClick={() => setSelectedPage(page.id)}
                        className={cn(
                          'w-full flex items-center justify-between p-3 text-left transition-colors',
                          selectedPage === page.id ? 'bg-teal-50 dark:bg-teal-900/20 border-l-2 border-teal-500' : 'hover:bg-muted/50'
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {selectedPage === page.id ? <ChevronRight className="h-4 w-4 text-teal-600 shrink-0" /> : <CircleDot className="h-3 w-3 text-muted-foreground shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{page.title}</p>
                            <p className="text-xs text-muted-foreground">/{page.slug}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {page.published ? (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">Live</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Draft</Badge>
                          )}
                          {page.slug !== 'home' && (
                            <Button
                              variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-red-600"
                              onClick={(e) => { e.stopPropagation(); handleRemovePage(page.id); }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Section Editor */}
            <Card className="lg:col-span-2">
              {currentPageData ? (
                <>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">{currentPageData.title}</CardTitle>
                        <p className="text-xs text-muted-foreground">/{currentPageData.slug}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setShowAddSectionDialog(true)} className="h-7 text-xs gap-1">
                        <Plus className="h-3 w-3" /> Add Section
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ScrollArea className="max-h-[500px]">
                      <div className="divide-y">
                        {currentPageData.sections.length === 0 && (
                          <div className="p-8 text-center text-muted-foreground text-sm">
                            <Columns className="h-8 w-8 mx-auto mb-2 opacity-40" />
                            No sections yet. Click &quot;Add Section&quot; to build this page.
                          </div>
                        )}
                        {currentPageData.sections.map((section, idx) => {
                          const sectionType = SECTION_TYPES.find(s => s.id === section.type);
                          const SectionIcon = sectionType?.icon || FileText;
                          return (
                            <div key={section.id} className={cn('flex items-center gap-3 p-3 transition-colors', !section.visible && 'opacity-50')}>
                              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center',
                                section.visible ? 'bg-teal-100 dark:bg-teal-900/30 text-teal-600' : 'bg-muted text-muted-foreground'
                              )}>
                                <SectionIcon className="h-4 w-4" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{sectionType?.label || section.type}</p>
                                <p className="text-xs text-muted-foreground">Order: {section.order} • {(section.content.heading as string) || 'No heading'}</p>
                              </div>
                              <Switch
                                checked={section.visible}
                                onCheckedChange={(v) => handleToggleSection(currentPageData.id, section.id, v)}
                              />
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-600"
                                onClick={() => handleRemoveSection(currentPageData.id, section.id)}
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </>
              ) : (
                <CardContent className="p-8 text-center text-muted-foreground text-sm">
                  <FileText className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Select a page to edit its sections
                </CardContent>
              )}
            </Card>
          </div>
        </TabsContent>

        {/* ─── SEO ─── */}
        <TabsContent value="seo" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> SEO Settings
              </CardTitle>
              <CardDescription>Optimize your website for search engines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Title Tag</Label>
                <Input value={seoTitle} onChange={e => setSeoTitle(e.target.value)} placeholder="Hotel Name - Best Rates Guaranteed" className="mt-1" />
                <p className="text-xs text-muted-foreground mt-1">{seoTitle.length}/60 characters</p>
              </div>
              <div>
                <Label>Meta Description</Label>
                <Textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} placeholder="Brief description of your hotel..." className="mt-1" rows={3} />
                <p className="text-xs text-muted-foreground mt-1">{seoDescription.length}/160 characters</p>
              </div>
              <div>
                <Label>Keywords (comma-separated)</Label>
                <Input value={seoKeywords} onChange={e => setSeoKeywords(e.target.value)} placeholder="hotel, booking, luxury, resort" className="mt-1" />
                <div className="flex flex-wrap gap-1 mt-2">
                  {seoKeywords.split(',').map(k => k.trim()).filter(Boolean).map((kw, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">{kw}</Badge>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label>OG Image URL</Label>
                  <Input value={seoOgImage} onChange={e => setSeoOgImage(e.target.value)} placeholder="https://..." className="mt-1" />
                </div>
                <div>
                  <Label>Favicon URL</Label>
                  <Input value={seoFaviconUrl} onChange={e => setSeoFaviconUrl(e.target.value)} placeholder="https://..." className="mt-1" />
                </div>
              </div>
              <Button onClick={handleSaveSeo} disabled={saving} className="bg-teal-600 hover:bg-teal-700 text-white">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Save SEO Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Analytics ─── */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" /> Tracking Pixels & Analytics
              </CardTitle>
              <CardDescription>Configure tracking for Google, Facebook, LinkedIn, Twitter, and more</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {ANALYTICS_FIELDS.map(field => (
                <div key={field.key}>
                  <Label className="text-sm">{field.label}</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      value={analyticsState[field.key] || ''}
                      onChange={e => setAnalyticsState(prev => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="flex-1"
                    />
                    {analyticsState[field.key] ? (
                      <Badge className="bg-emerald-100 text-emerald-700 text-xs shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs shrink-0">Not set</Badge>
                    )}
                  </div>
                </div>
              ))}
              <Button onClick={handleSaveAnalytics} disabled={saving} className="w-full bg-teal-600 hover:bg-teal-700 text-white mt-2">
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-2" />}
                Save Analytics Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Preview ─── */}
        <TabsContent value="preview" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Website Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border overflow-hidden">
                {/* Browser chrome */}
                <div className="bg-muted/80 px-4 py-2 flex items-center gap-2 border-b">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" />
                    <div className="w-3 h-3 rounded-full bg-green-400" />
                  </div>
                  <div className="flex-1 bg-background rounded-md px-3 py-1 text-xs text-muted-foreground flex items-center gap-1">
                    <Globe className="h-3 w-3" />
                    https://{website.domain}
                  </div>
                </div>
                {/* Preview content */}
                <div className="aspect-[16/9] flex flex-col items-center justify-center text-white p-8 relative overflow-hidden" style={{ backgroundColor: themePrimary }}>
                  <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 25% 25%, white 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                  <h3 className="text-3xl font-bold mb-2 relative z-10" style={{ fontFamily: themeFont }}>Welcome to Our Hotel</h3>
                  <p className="text-white/80 text-sm mb-6 relative z-10">Experience luxury and comfort</p>
                  <div className="px-6 py-2.5 bg-white text-sm font-semibold relative z-10" style={{ color: themePrimary, borderRadius: themeRadius }}>
                    Book Now
                  </div>
                  <div className="mt-4 text-xs text-white/60 relative z-10">
                    Template: {templateInfo?.name} • {website.pages?.length || 0} pages • Font: {themeFont}
                  </div>
                </div>
              </div>
              {website.customDomain && (
                <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Copy className="h-3 w-3" />
                  Custom domain: {website.customDomain}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ─── Dialogs ─── */}

      {/* Add Page Dialog */}
      <Dialog open={showAddPageDialog} onOpenChange={setShowAddPageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Page</DialogTitle>
            <DialogDescription>Create a new page for your website</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Page Title *</Label>
              <Input value={newPageTitle} onChange={e => setNewPageTitle(e.target.value)} placeholder="e.g. About Us" className="mt-1" />
            </div>
            <div>
              <Label>URL Slug</Label>
              <Input value={newPageSlug} onChange={e => setNewPageSlug(e.target.value)} placeholder="about-us" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Auto-generated from title if left empty</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddPageDialog(false)}>Cancel</Button>
            <Button onClick={handleAddPage} disabled={saving || !newPageTitle} className="bg-teal-600 hover:bg-teal-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Section Dialog */}
      <Dialog open={showAddSectionDialog} onOpenChange={setShowAddSectionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Section</DialogTitle>
            <DialogDescription>Choose a section type to add to this page</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid grid-cols-2 gap-2">
              {SECTION_TYPES.map(st => {
                const Icon = st.icon;
                return (
                  <button
                    key={st.id}
                    onClick={() => setSelectedSectionType(st.id)}
                    className={cn(
                      'flex items-center gap-2 p-3 rounded-lg border-2 text-left transition-all',
                      selectedSectionType === st.id ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20' : 'border-transparent hover:bg-muted'
                    )}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium">{st.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddSectionDialog(false)}>Cancel</Button>
            <Button
              onClick={() => currentPageData && handleAddSection(currentPageData.id)}
              disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Add Section
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
