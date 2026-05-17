'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Globe,
  Palette,
  Search,
  BarChart3,
  Upload,
  Eye,
  CheckCircle,
  Layout,
  Star,
  Sparkles,
  Code,
  Plus,
  Trash2,
  Edit3,
  GripVertical,
  Settings,
  ExternalLink,
  Copy,
  RefreshCw,
  FileText,
  Link2,
  Save,
  Loader2,
  AlertCircle,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuthStore } from '@/store';

// ─── Types ──────────────────────────────────────────────────────────────────

interface WebsiteData {
  id: string;
  tenantId: string;
  propertyId: string;
  domain: string;
  customDomain?: string;
  status: 'draft' | 'published' | 'unpublished';
  template: string;
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
  type: string;
  content: Record<string, unknown>;
  order: number;
  visible: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string;
  color: string;
  features: string[];
  icon: LucideIcon;
  popular?: boolean;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary design with bold typography', color: 'from-teal-500 to-cyan-500', features: ['Hero slider', 'Animations', 'Responsive'], icon: Sparkles, popular: true },
  { id: 'classic', name: 'Classic', description: 'Elegant, timeless design with refined details', color: 'from-amber-500 to-orange-500', features: ['Traditional layout', 'Photo gallery', 'Reviews'], icon: Star },
  { id: 'boutique', name: 'Boutique', description: 'Unique, artistic design for boutique properties', color: 'from-violet-500 to-purple-500', features: ['Storytelling', 'Visual focus', 'Instagram feed'], icon: Layout },
  { id: 'resort', name: 'Resort', description: 'Immersive design showcasing resort amenities', color: 'from-emerald-500 to-green-500', features: ['Full-width images', 'Activity cards', 'Booking widget'], icon: Globe },
  { id: 'minimal', name: 'Minimal', description: 'Stripped-down, fast-loading minimalist design', color: 'from-gray-500 to-slate-600', features: ['Fast loading', 'Simple nav', 'CTA focused'], icon: Layout },
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter' },
  { value: 'Playfair Display', label: 'Playfair Display' },
  { value: 'Lato', label: 'Lato' },
  { value: 'Montserrat', label: 'Montserrat' },
  { value: 'Roboto', label: 'Roboto' },
  { value: 'Merriweather', label: 'Merriweather' },
  { value: 'Outfit', label: 'Outfit' },
  { value: 'DM Sans', label: 'DM Sans' },
];

const SECTION_TYPES = [
  { value: 'hero', label: 'Hero Banner' },
  { value: 'rooms_grid', label: 'Rooms Grid' },
  { value: 'features', label: 'Features' },
  { value: 'gallery', label: 'Gallery' },
  { value: 'testimonials', label: 'Testimonials' },
  { value: 'cta', label: 'Call to Action' },
  { value: 'amenities', label: 'Amenities' },
  { value: 'dining', label: 'Dining' },
  { value: 'map', label: 'Map' },
  { value: 'faq', label: 'FAQ' },
  { value: 'contact_form', label: 'Contact Form' },
  { value: 'booking_widget', label: 'Booking Widget' },
  { value: 'html', label: 'Custom HTML' },
];

const TEMPLATE_THEMES: Record<string, { primaryColor: string; secondaryColor: string; fontFamily: string; borderRadius: string }> = {
  modern: { primaryColor: '#0d9488', secondaryColor: '#f59e0b', fontFamily: 'Inter', borderRadius: '8px' },
  classic: { primaryColor: '#1e3a5f', secondaryColor: '#c9a96e', fontFamily: 'Playfair Display', borderRadius: '4px' },
  boutique: { primaryColor: '#7c3aed', secondaryColor: '#ec4899', fontFamily: 'DM Sans', borderRadius: '12px' },
  resort: { primaryColor: '#059669', secondaryColor: '#f97316', fontFamily: 'Outfit', borderRadius: '16px' },
  minimal: { primaryColor: '#18181b', secondaryColor: '#6b7280', fontFamily: 'Inter', borderRadius: '2px' },
};

const DEFAULT_PAGES: WebsitePage[] = [
  {
    id: 'page-home',
    slug: 'home',
    title: 'Home',
    sections: [
      { id: 's1', type: 'hero', content: { heading: 'Welcome to Our Hotel', subheading: 'Experience luxury and comfort', ctaText: 'Book Now', showBookingWidget: true }, order: 0, visible: true },
      { id: 's2', type: 'rooms_grid', content: { heading: 'Our Rooms', showPrices: true }, order: 1, visible: true },
      { id: 's3', type: 'features', content: { heading: 'Why Choose Us' }, order: 2, visible: true },
      { id: 's4', type: 'testimonials', content: { heading: 'Guest Reviews', maxReviews: 6 }, order: 3, visible: true },
      { id: 's5', type: 'cta', content: { heading: 'Ready to Book?', subheading: 'Best rates guaranteed', buttonText: 'Reserve Now' }, order: 4, visible: true },
    ],
    published: true,
  },
  {
    id: 'page-rooms',
    slug: 'rooms',
    title: 'Rooms & Suites',
    sections: [
      { id: 's1', type: 'rooms_grid', content: { heading: 'Accommodations', showPrices: true, showAmenities: true }, order: 0, visible: true },
      { id: 's2', type: 'gallery', content: { heading: 'Gallery' }, order: 1, visible: true },
    ],
    published: true,
  },
  {
    id: 'page-contact',
    slug: 'contact',
    title: 'Contact Us',
    sections: [
      { id: 's1', type: 'contact_form', content: { heading: 'Get in Touch', showMap: true, showPhone: true, showEmail: true }, order: 0, visible: true },
      { id: 's2', type: 'map', content: {}, order: 1, visible: true },
    ],
    published: true,
  },
];

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WebsiteBuilder() {
  const { currentProperty } = useAuthStore();
  const propertyId = currentProperty?.id;

  // ─── State ──────────────────────────────────────────────────────────────
  const [website, setWebsite] = useState<WebsiteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');

  // Theme state
  const [primaryColor, setPrimaryColor] = useState('#0d9488');
  const [secondaryColor, setSecondaryColor] = useState('#f59e0b');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [borderRadius, setBorderRadius] = useState('8px');
  const [logoUrl, setLogoUrl] = useState('');
  const [heroImageUrl, setHeroImageUrl] = useState('');

  // SEO state
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');
  const [seoFavicon, setSeoFavicon] = useState('');

  // Analytics state
  const [gaId, setGaId] = useState('');
  const [gtmId, setGtmId] = useState('');
  const [fbPixel, setFbPixel] = useState('');
  const [metaPixel, setMetaPixel] = useState('');
  const [linkedinInsight, setLinkedinInsight] = useState('');
  const [twitterPixel, setTwitterPixel] = useState('');

  // Domain state
  const [customDomain, setCustomDomain] = useState('');

  // Pages state
  const [pages, setPages] = useState<WebsitePage[]>([]);

  // Page edit dialog
  const [editingPage, setEditingPage] = useState<WebsitePage | null>(null);
  const [editPageTitle, setEditPageTitle] = useState('');
  const [editPageSlug, setEditPageSlug] = useState('');
  const [editPagePublished, setEditPagePublished] = useState(true);
  const [isPageDialogOpen, setIsPageDialogOpen] = useState(false);

  // Section edit dialog
  const [editingSection, setEditingSection] = useState<PageSection | null>(null);
  const [editingSectionPageId, setEditingSectionPageId] = useState('');
  const [isSectionDialogOpen, setIsSectionDialogOpen] = useState(false);

  // Add page dialog
  const [newPageTitle, setNewPageTitle] = useState('');
  const [newPageSlug, setNewPageSlug] = useState('');
  const [isNewPageDialogOpen, setIsNewPageDialogOpen] = useState(false);

  // ─── API Calls ──────────────────────────────────────────────────────────

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
    } catch (err) {
      console.error('Error fetching website:', err);
      toast.error('Failed to load website data');
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  // Sync local state from API data
  const syncLocalState = (data: WebsiteData) => {
    setPrimaryColor(data.theme?.primaryColor || '#0d9488');
    setSecondaryColor(data.theme?.secondaryColor || '#f59e0b');
    setFontFamily(data.theme?.fontFamily || 'Inter');
    setBorderRadius(data.theme?.borderRadius || '8px');
    setLogoUrl(data.theme?.logoUrl || '');
    setHeroImageUrl(data.theme?.heroImageUrl || '');
    setSeoTitle(data.seo?.title || '');
    setSeoDescription(data.seo?.description || '');
    setSeoKeywords(Array.isArray(data.seo?.keywords) ? data.seo.keywords.join(', ') : '');
    setSeoOgImage(data.seo?.ogImage || '');
    setSeoFavicon(data.seo?.faviconUrl || '');
    setGaId(data.analytics?.googleAnalyticsId || '');
    setGtmId(data.analytics?.googleTagManagerId || '');
    setFbPixel(data.analytics?.facebookPixelId || '');
    setMetaPixel(data.analytics?.metaPixelId || '');
    setLinkedinInsight(data.analytics?.linkedInsightTag || '');
    setTwitterPixel(data.analytics?.twitterPixelId || '');
    setCustomDomain(data.customDomain || '');
    setPages(data.pages || []);
  };

  useEffect(() => {
    fetchWebsite();
  }, [fetchWebsite]);

  // ─── Create Website ─────────────────────────────────────────────────────

  const handleCreateWebsite = async (templateId: string) => {
    if (!propertyId) {
      toast.error('No property selected');
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch('/api/website-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ propertyId, template: templateId }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        syncLocalState(json.data);
        toast.success('Website created successfully!');
        setActiveTab('appearance');
      } else {
        toast.error(json.error?.message || 'Failed to create website');
      }
    } catch (err) {
      console.error('Error creating website:', err);
      toast.error('Failed to create website');
    } finally {
      setIsCreating(false);
    }
  };

  // ─── Save Theme ─────────────────────────────────────────────────────────

  const handleSaveTheme = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: website.id,
          theme: {
            primaryColor,
            secondaryColor,
            fontFamily,
            borderRadius,
            logoUrl: logoUrl || undefined,
            heroImageUrl: heroImageUrl || undefined,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        toast.success('Theme saved successfully!');
      } else {
        toast.error(json.error?.message || 'Failed to save theme');
      }
    } catch (err) {
      console.error('Error saving theme:', err);
      toast.error('Failed to save theme');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Save Template ──────────────────────────────────────────────────────

  const handleTemplateChange = async (templateId: string) => {
    if (!website) {
      // No website yet - create one with this template
      await handleCreateWebsite(templateId);
      return;
    }
    setIsSaving(true);
    try {
      const templateTheme = TEMPLATE_THEMES[templateId] || TEMPLATE_THEMES.modern;
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: website.id,
          template: templateId,
          theme: templateTheme,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        syncLocalState(json.data);
        toast.success('Template updated!');
      } else {
        toast.error(json.error?.message || 'Failed to update template');
      }
    } catch (err) {
      console.error('Error updating template:', err);
      toast.error('Failed to update template');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Save SEO ───────────────────────────────────────────────────────────

  const handleSaveSEO = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/website-builder/seo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId: website.id,
          title: seoTitle,
          description: seoDescription,
          keywords: seoKeywords.split(',').map(k => k.trim()).filter(Boolean),
          ogImage: seoOgImage || undefined,
          faviconUrl: seoFavicon || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('SEO settings saved!');
      } else {
        toast.error(json.error?.message || 'Failed to save SEO settings');
      }
    } catch (err) {
      console.error('Error saving SEO:', err);
      toast.error('Failed to save SEO settings');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Save Analytics ─────────────────────────────────────────────────────

  const handleSaveAnalytics = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/website-builder/analytics', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId: website.id,
          googleAnalyticsId: gaId || undefined,
          googleTagManagerId: gtmId || undefined,
          facebookPixelId: fbPixel || undefined,
          metaPixelId: metaPixel || undefined,
          linkedInsightTag: linkedInsight || undefined,
          twitterPixelId: twitterPixel || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Analytics settings saved!');
      } else {
        toast.error(json.error?.message || 'Failed to save analytics settings');
      }
    } catch (err) {
      console.error('Error saving analytics:', err);
      toast.error('Failed to save analytics settings');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Save Custom Domain ─────────────────────────────────────────────────

  const handleSaveDomain = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: website.id,
          customDomain: customDomain || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        toast.success('Domain settings saved!');
      } else {
        toast.error(json.error?.message || 'Failed to save domain settings');
      }
    } catch (err) {
      console.error('Error saving domain:', err);
      toast.error('Failed to save domain settings');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Save Pages ─────────────────────────────────────────────────────────

  const handleSavePages = async () => {
    if (!website) return;
    setIsSaving(true);
    try {
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: website.id,
          pages,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        toast.success('Pages saved successfully!');
      } else {
        toast.error(json.error?.message || 'Failed to save pages');
      }
    } catch (err) {
      console.error('Error saving pages:', err);
      toast.error('Failed to save pages');
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Publish / Unpublish ────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!website) return;
    setIsPublishing(true);
    try {
      const action = website.status === 'published' ? 'unpublish' : 'publish';
      const res = await fetch('/api/website-builder/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ websiteId: website.id, action }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        toast.success(action === 'publish' ? 'Website published!' : 'Website unpublished');
      } else {
        toast.error(json.error?.message || `Failed to ${action} website`);
      }
    } catch (err) {
      console.error('Error publishing:', err);
      toast.error('Failed to update publish status');
    } finally {
      setIsPublishing(false);
    }
  };

  // ─── Delete Website ─────────────────────────────────────────────────────

  const handleDeleteWebsite = async () => {
    if (!website) return;
    try {
      const res = await fetch(`/api/website-builder?id=${website.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        setWebsite(null);
        toast.success('Website deleted');
      } else {
        toast.error(json.error?.message || 'Failed to delete website');
      }
    } catch (err) {
      console.error('Error deleting website:', err);
      toast.error('Failed to delete website');
    }
  };

  // ─── Page Management ────────────────────────────────────────────────────

  const handleAddPage = async () => {
    if (!website || !newPageTitle.trim() || !newPageSlug.trim()) return;
    try {
      const res = await fetch('/api/website-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-page',
          websiteId: website.id,
          page: {
            slug: newPageSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            title: newPageTitle.trim(),
            sections: [],
            published: false,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchWebsite();
        setNewPageTitle('');
        setNewPageSlug('');
        setIsNewPageDialogOpen(false);
        toast.success('Page added!');
      } else {
        toast.error(json.error?.message || 'Failed to add page');
      }
    } catch (err) {
      console.error('Error adding page:', err);
      toast.error('Failed to add page');
    }
  };

  const handleRemovePage = async (pageId: string) => {
    if (!website) return;
    try {
      const res = await fetch('/api/website-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove-page', websiteId: website.id, pageId }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchWebsite();
        toast.success('Page removed');
      } else {
        toast.error(json.error?.message || 'Failed to remove page');
      }
    } catch (err) {
      console.error('Error removing page:', err);
      toast.error('Failed to remove page');
    }
  };

  const handleUpdatePage = async () => {
    if (!website || !editingPage) return;
    try {
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-page',
          websiteId: website.id,
          pageId: editingPage.id,
          updates: {
            title: editPageTitle,
            slug: editPageSlug,
            published: editPagePublished,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchWebsite();
        setIsPageDialogOpen(false);
        setEditingPage(null);
        toast.success('Page updated!');
      } else {
        toast.error(json.error?.message || 'Failed to update page');
      }
    } catch (err) {
      console.error('Error updating page:', err);
      toast.error('Failed to update page');
    }
  };

  // ─── Section Management ─────────────────────────────────────────────────

  const handleToggleSectionVisibility = (pageIdx: number, sectionIdx: number) => {
    const updated = [...pages];
    updated[pageIdx] = {
      ...updated[pageIdx],
      sections: updated[pageIdx].sections.map((s, i) =>
        i === sectionIdx ? { ...s, visible: !s.visible } : s
      ),
    };
    setPages(updated);
  };

  const handleRemoveSection = (pageIdx: number, sectionId: string) => {
    const updated = [...pages];
    updated[pageIdx] = {
      ...updated[pageIdx],
      sections: updated[pageIdx].sections.filter(s => s.id !== sectionId),
    };
    setPages(updated);
  };

  const handleAddSection = (pageIdx: number, type: string) => {
    const updated = [...pages];
    const newSection: PageSection = {
      id: `s-${Date.now()}`,
      type,
      content: {},
      order: updated[pageIdx].sections.length,
      visible: true,
    };
    updated[pageIdx] = {
      ...updated[pageIdx],
      sections: [...updated[pageIdx].sections, newSection],
    };
    setPages(updated);
  };

  const handleCopyDomain = () => {
    if (website?.domain) {
      navigator.clipboard.writeText(website.customDomain || website.domain);
      toast.success('Domain copied to clipboard');
    }
  };

  // ─── Render Helpers ─────────────────────────────────────────────────────

  const getStatusBadge = () => {
    if (!website) return <Badge variant="secondary">No Website</Badge>;
    switch (website.status) {
      case 'published':
        return <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300"><CheckCircle className="h-3 w-3 mr-1" />Published</Badge>;
      case 'draft':
        return <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"><Edit3 className="h-3 w-3 mr-1" />Draft</Badge>;
      case 'unpublished':
        return <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"><AlertCircle className="h-3 w-3 mr-1" />Unpublished</Badge>;
      default:
        return <Badge variant="secondary">{website.status}</Badge>;
    }
  };

  const getSectionTypeLabel = (type: string) => {
    return SECTION_TYPES.find(s => s.value === type)?.label || type;
  };

  // ─── Loading State ──────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-64 bg-muted animate-pulse rounded" />
            <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          </div>
          <div className="flex gap-2">
            <div className="h-9 w-24 bg-muted animate-pulse rounded" />
            <div className="h-9 w-24 bg-muted animate-pulse rounded" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-72 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  // ─── No Website Yet — Create Flow ───────────────────────────────────────

  if (!website) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Website Builder
          </h2>
          <p className="text-muted-foreground">
            Create a beautiful website for your property in seconds
          </p>
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
                  Choose a template below to instantly create a professional website for <strong>{currentProperty?.name || 'your property'}</strong>.
                </p>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-lg font-semibold mb-4">Choose a Template</h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {TEMPLATES.map((template) => {
                  const TemplateIcon = template.icon;
                  return (
                    <Card
                      key={template.id}
                      className="border-2 cursor-pointer transition-all hover:shadow-lg hover:border-teal-300 dark:hover:border-teal-700"
                      onClick={() => handleCreateWebsite(template.id)}
                    >
                      <CardContent className="p-0">
                        <div className={`h-40 bg-gradient-to-br ${template.color} relative overflow-hidden`}>
                          <div className="absolute inset-0 p-4 flex flex-col justify-between">
                            <div className="flex items-center justify-between">
                              <div className="flex gap-1">
                                <div className="w-2 h-2 rounded-full bg-white/40" />
                                <div className="w-2 h-2 rounded-full bg-white/40" />
                                <div className="w-2 h-2 rounded-full bg-white/40" />
                              </div>
                              {template.popular && (
                                <Badge className="bg-white/90 text-gray-900 text-xs">Popular</Badge>
                              )}
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
                            <TemplateIcon className="h-4 w-4 text-muted-foreground" />
                            <h4 className="font-semibold">{template.name}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {template.features.map((f) => (
                              <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                            ))}
                          </div>
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

  // ─── Website Exists — Full Editor ────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Website Builder
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-muted-foreground text-sm">
              {website.customDomain || website.domain}
            </span>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopyDomain}>
              <Copy className="h-3 w-3" />
            </Button>
            {getStatusBadge()}
            {website.publishedAt && (
              <span className="text-xs text-muted-foreground">
                Published {new Date(website.publishedAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <a href={`https://${website.customDomain || website.domain}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Visit
            </a>
          </Button>
          <Button
            size="sm"
            className={website.status === 'published'
              ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : 'bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white'
            }
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Processing...</>
            ) : website.status === 'published' ? (
              'Unpublish'
            ) : (
              'Publish'
            )}
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5 max-w-[650px]">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="pages">Pages</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* ─── Templates Tab ────────────────────────────────────────────── */}
        <TabsContent value="templates" className="mt-4">
          <Card className="border-0 shadow-sm mb-4">
            <CardHeader>
              <CardTitle className="text-lg">Current Template</CardTitle>
              <CardDescription>Switching templates will reset your theme colors to the template defaults</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className={`h-12 w-12 rounded-lg bg-gradient-to-br ${TEMPLATES.find(t => t.id === website.template)?.color || 'from-gray-400 to-gray-500'} flex items-center justify-center text-white`}>
                  {(() => { const T = TEMPLATES.find(t => t.id === website.template)?.icon || Layout; return <T className="h-6 w-6" />; })()}
                </div>
                <div>
                  <p className="font-semibold">{TEMPLATES.find(t => t.id === website.template)?.name || website.template}</p>
                  <p className="text-sm text-muted-foreground">{TEMPLATES.find(t => t.id === website.template)?.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <h3 className="text-lg font-semibold mb-4">Switch Template</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {TEMPLATES.map((template) => {
              const TemplateIcon = template.icon;
              const isSelected = website.template === template.id;
              return (
                <Card
                  key={template.id}
                  className={`border-2 cursor-pointer transition-all hover:shadow-lg ${
                    isSelected
                      ? 'border-teal-500 shadow-md shadow-teal-500/20'
                      : 'border-transparent hover:border-muted'
                  }`}
                  onClick={() => { if (!isSelected) handleTemplateChange(template.id); }}
                >
                  <CardContent className="p-0">
                    <div className={`h-40 bg-gradient-to-br ${template.color} relative overflow-hidden`}>
                      <div className="absolute inset-0 p-4 flex flex-col justify-between">
                        <div className="flex items-center justify-between">
                          <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-white/40" />
                            <div className="w-2 h-2 rounded-full bg-white/40" />
                            <div className="w-2 h-2 rounded-full bg-white/40" />
                          </div>
                          {template.popular && (
                            <Badge className="bg-white/90 text-gray-900 text-xs">Popular</Badge>
                          )}
                        </div>
                        <div>
                          <div className="w-24 h-3 bg-white/40 rounded mb-2" />
                          <div className="w-40 h-2 bg-white/30 rounded mb-1" />
                          <div className="w-32 h-2 bg-white/20 rounded" />
                        </div>
                      </div>
                      {isSelected && (
                        <div className="absolute top-2 right-2">
                          <CheckCircle className="h-6 w-6 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TemplateIcon className="h-4 w-4 text-muted-foreground" />
                        <h4 className="font-semibold">{template.name}</h4>
                        {isSelected && <Badge className="bg-teal-100 text-teal-700 text-xs ml-auto">Active</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                      <div className="flex flex-wrap gap-1">
                        {template.features.map((f) => (
                          <Badge key={f} variant="outline" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ─── Pages Tab ────────────────────────────────────────────────── */}
        <TabsContent value="pages" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold">Pages</h3>
              <p className="text-sm text-muted-foreground">Manage your website pages and sections</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSavePages} disabled={isSaving} size="sm">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Pages
              </Button>
              <Dialog open={isNewPageDialogOpen} onOpenChange={setIsNewPageDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Page
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add New Page</DialogTitle>
                    <DialogDescription>Create a new page for your website</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Page Title</Label>
                      <Input
                        value={newPageTitle}
                        onChange={(e) => {
                          setNewPageTitle(e.target.value);
                          setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                        }}
                        placeholder="e.g., Spa & Wellness"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL Slug</Label>
                      <Input value={newPageSlug} onChange={(e) => setNewPageSlug(e.target.value)} placeholder="spa-wellness" />
                      <p className="text-xs text-muted-foreground">/{newPageSlug || 'page-slug'}</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsNewPageDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddPage} disabled={!newPageTitle.trim() || !newPageSlug.trim()}>Add Page</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <ScrollArea className="max-h-[600px]">
            <div className="space-y-4">
              {pages.map((page, pageIdx) => (
                <Card key={page.id} className="border-0 shadow-sm">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <FileText className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <CardTitle className="text-base">{page.title}</CardTitle>
                          <p className="text-sm text-muted-foreground">/{page.slug}</p>
                        </div>
                        <Badge variant={page.published ? 'default' : 'secondary'} className={page.published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300' : ''}>
                          {page.published ? 'Published' : 'Draft'}
                        </Badge>
                        {page.slug === 'home' && <Badge variant="outline" className="text-xs">Home</Badge>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setEditingPage(page);
                            setEditPageTitle(page.title);
                            setEditPageSlug(page.slug);
                            setEditPagePublished(page.published);
                            setIsPageDialogOpen(true);
                          }}
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
                                <AlertDialogDescription>
                                  Are you sure you want to delete &quot;{page.title}&quot;? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemovePage(page.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {page.sections.map((section, sectionIdx) => (
                        <div
                          key={section.id}
                          className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                            section.visible ? 'bg-background' : 'bg-muted/30 opacity-60'
                          }`}
                        >
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{getSectionTypeLabel(section.type)}</span>
                              {!section.visible && (
                                <Badge variant="outline" className="text-xs">Hidden</Badge>
                              )}
                            </div>
                          </div>
                          <Switch
                            checked={section.visible}
                            onCheckedChange={() => handleToggleSectionVisibility(pageIdx, sectionIdx)}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveSection(pageIdx, section.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                      {page.sections.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-4">No sections yet. Add one below.</p>
                      )}
                      <Separator />
                      <div className="flex flex-wrap gap-2 pt-2">
                        {SECTION_TYPES.map((st) => (
                          <Button
                            key={st.value}
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => handleAddSection(pageIdx, st.value)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            {st.label}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>

          {/* Page Edit Dialog */}
          <Dialog open={isPageDialogOpen} onOpenChange={setIsPageDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Page</DialogTitle>
                <DialogDescription>Update page settings</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Page Title</Label>
                  <Input value={editPageTitle} onChange={(e) => setEditPageTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input value={editPageSlug} onChange={(e) => setEditPageSlug(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={editPagePublished} onCheckedChange={setEditPagePublished} />
                  <Label>Published</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsPageDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdatePage}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* ─── Appearance Tab ───────────────────────────────────────────── */}
        <TabsContent value="appearance" className="mt-4 space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                  Theme Customizer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label>Primary Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {['#0d9488', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#1e3a5f', '#059669', '#18181b'].map((c) => (
                      <button
                        key={c}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          primaryColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setPrimaryColor(c)}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="flex-1"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Font Family</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.value}
                        className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                          fontFamily === f.value
                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                            : 'hover:border-muted'
                        }`}
                        onClick={() => setFontFamily(f.value)}
                      >
                        <span className="font-medium" style={{ fontFamily: f.value }}>{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Border Radius</Label>
                  <div className="flex gap-2">
                    {['0px', '2px', '4px', '8px', '12px', '16px'].map((r) => (
                      <button
                        key={r}
                        className={`px-3 py-2 rounded-lg border text-sm transition-colors ${
                          borderRadius === r
                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                            : 'hover:border-muted'
                        }`}
                        onClick={() => setBorderRadius(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Logo URL</Label>
                  <Input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hero Image URL</Label>
                  <Input
                    value={heroImageUrl}
                    onChange={(e) => setHeroImageUrl(e.target.value)}
                    placeholder="https://example.com/hero.jpg"
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <Label>Custom Domain</Label>
                  </div>
                  <Input
                    value={customDomain}
                    onChange={(e) => setCustomDomain(e.target.value)}
                    placeholder="www.myhotel.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Default: {website.domain} — Set a custom domain to use your own URL
                  </p>
                  <Button variant="outline" size="sm" onClick={handleSaveDomain} disabled={isSaving}>
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    Save Domain
                  </Button>
                </div>

                <Button className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white" onClick={handleSaveTheme} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Appearance
                </Button>
              </CardContent>
            </Card>

            {/* Live Preview */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                  Live Preview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">
                  {/* Browser chrome */}
                  <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-400" />
                      <div className="w-3 h-3 rounded-full bg-yellow-400" />
                      <div className="w-3 h-3 rounded-full bg-green-400" />
                    </div>
                    <div className="flex-1 ml-3">
                      <div className="bg-white dark:bg-gray-700 rounded px-3 py-1 text-xs text-muted-foreground truncate">
                        {customDomain || website.domain}
                      </div>
                    </div>
                  </div>
                  {/* Preview content */}
                  <div className="p-4" style={{ fontFamily }}>
                    <div className="flex items-center gap-2 mb-4">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo" className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded" style={{ backgroundColor: primaryColor, borderRadius }} />
                      )}
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="flex-1" />
                      <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div
                        className="h-8 w-20 text-white text-xs flex items-center justify-center"
                        style={{ backgroundColor: primaryColor, borderRadius }}
                      >
                        Book Now
                      </div>
                    </div>
                    <div
                      className="h-24 rounded-lg mb-4 relative overflow-hidden"
                      style={{
                        background: heroImageUrl
                          ? `linear-gradient(135deg, ${primaryColor}88, ${primaryColor}44), url(${heroImageUrl}) center/cover`
                          : `linear-gradient(135deg, ${primaryColor}88, ${primaryColor}44)`,
                        borderRadius,
                      }}
                    >
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-white text-center">
                          <div className="h-3 w-32 bg-white/40 rounded mx-auto mb-2" />
                          <div className="h-2 w-48 bg-white/30 rounded mx-auto" />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded p-2" style={{ borderRadius }}>
                          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-1" />
                          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── SEO Tab ──────────────────────────────────────────────────── */}
        <TabsContent value="seo" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                SEO Settings
              </CardTitle>
              <CardDescription>Optimize your website for search engines</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="seoTitle">Meta Title</Label>
                <Input id="seoTitle" value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
                <p className="text-xs text-muted-foreground">{seoTitle.length}/60 characters recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoDesc">Meta Description</Label>
                <Textarea id="seoDesc" value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={3} />
                <p className="text-xs text-muted-foreground">{seoDescription.length}/160 characters recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoKeywords">Keywords</Label>
                <Input id="seoKeywords" value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} />
                <p className="text-xs text-muted-foreground">Comma-separated keywords for search engines</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoOgImage">Open Graph Image URL</Label>
                <Input id="seoOgImage" value={seoOgImage} onChange={(e) => setSeoOgImage(e.target.value)} placeholder="https://example.com/og-image.jpg" />
                <p className="text-xs text-muted-foreground">Image shown when sharing on social media (1200×630 recommended)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoFavicon">Favicon URL</Label>
                <Input id="seoFavicon" value={seoFavicon} onChange={(e) => setSeoFavicon(e.target.value)} placeholder="https://example.com/favicon.ico" />
              </div>

              {/* Google Preview */}
              <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <p className="text-xs text-muted-foreground mb-1">Google Search Preview</p>
                <p className="text-blue-700 dark:text-blue-400 text-lg font-medium hover:underline cursor-pointer truncate">
                  {seoTitle || 'Your Hotel Name'}
                </p>
                <p className="text-sm text-green-700 dark:text-green-500">{customDomain || website.domain}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{seoDescription || 'Add a meta description...'}</p>
              </div>

              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white" onClick={handleSaveSEO} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save SEO Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Analytics Tab ────────────────────────────────────────────── */}
        <TabsContent value="analytics" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                Analytics & Tracking
              </CardTitle>
              <CardDescription>Configure tracking pixels and analytics integrations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="gaId">Google Analytics ID</Label>
                <Input id="gaId" value={gaId} onChange={(e) => setGaId(e.target.value)} placeholder="G-XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track website visitors and behavior with Google Analytics 4</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gtmId">Google Tag Manager ID</Label>
                <Input id="gtmId" value={gtmId} onChange={(e) => setGtmId(e.target.value)} placeholder="GTM-XXXXXXX" />
                <p className="text-xs text-muted-foreground">Manage all tracking tags from one place</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fbPixel">Facebook Pixel ID</Label>
                <Input id="fbPixel" value={fbPixel} onChange={(e) => setFbPixel(e.target.value)} placeholder="XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track conversions and build retargeting audiences</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaPixel">Meta Pixel ID</Label>
                <Input id="metaPixel" value={metaPixel} onChange={(e) => setMetaPixel(e.target.value)} placeholder="XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Meta (Instagram + Facebook) conversion tracking</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedinInsight">LinkedIn Insight Tag</Label>
                <Input id="linkedinInsight" value={linkedinInsight} onChange={(e) => setLinkedinInsight(e.target.value)} placeholder="XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track LinkedIn ad conversions and B2B analytics</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterPixel">Twitter/X Pixel ID</Label>
                <Input id="twitterPixel" value={twitterPixel} onChange={(e) => setTwitterPixel(e.target.value)} placeholder="XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track Twitter/X ad campaign conversions</p>
              </div>

              {/* Tracking Status */}
              <div className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Tracking Status</p>
                </div>
                <div className="space-y-2">
                  {[
                    { name: 'Google Analytics', configured: !!gaId },
                    { name: 'Google Tag Manager', configured: !!gtmId },
                    { name: 'Facebook Pixel', configured: !!fbPixel },
                    { name: 'Meta Pixel', configured: !!metaPixel },
                    { name: 'LinkedIn Insight', configured: !!linkedinInsight },
                    { name: 'Twitter/X Pixel', configured: !!twitterPixel },
                  ].map((tracker) => (
                    <div key={tracker.name} className="flex items-center justify-between text-sm">
                      <span>{tracker.name}</span>
                      {tracker.configured ? (
                        <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Connected</Badge>
                      ) : (
                        <Badge variant="secondary">Not configured</Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white" onClick={handleSaveAnalytics} disabled={isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Analytics Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Danger Zone */}
      <Separator />
      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Delete Website</p>
              <p className="text-sm text-muted-foreground">Permanently delete this website and all its data. This cannot be undone.</p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">Delete Website</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Website</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your website at <strong>{website.domain}</strong> and remove all pages, SEO settings, and analytics configuration. This action cannot be undone.
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
        </CardContent>
      </Card>
    </div>
  );
}
