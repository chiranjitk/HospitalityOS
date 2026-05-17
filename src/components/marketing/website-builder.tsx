'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  Eye,
  CheckCircle,
  Layout,
  Star,
  Sparkles,
  Code,
  Plus,
  Trash2,
  Edit3,
  Settings,
  ExternalLink,
  Copy,
  RefreshCw,
  FileText,
  Link2,
  Save,
  Loader2,
  AlertCircle,
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

// ─── Grouped State Types ────────────────────────────────────────────────────

interface ThemeState {
  primaryColor: string;
  secondaryColor: string;
  fontFamily: string;
  borderRadius: string;
  logoUrl: string;
  heroImageUrl: string;
}

interface SEOState {
  title: string;
  description: string;
  keywords: string;
  ogImage: string;
  favicon: string;
}

interface AnalyticsState {
  gaId: string;
  gtmId: string;
  fbPixel: string;
  metaPixel: string;
  linkedinInsight: string;
  twitterPixel: string;
}

interface PageDialogState {
  isOpen: boolean;
  page: WebsitePage | null;
  title: string;
  slug: string;
  published: boolean;
}

interface SectionDialogState {
  isOpen: boolean;
  pageId: string;
  sectionId: string;
  sectionType: string;
  content: Record<string, unknown>;
}

interface NewPageDialogState {
  isOpen: boolean;
  title: string;
  slug: string;
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

// ─── Section Content Editor Component ───────────────────────────────────────

function SectionContentEditor({
  sectionType,
  content,
  onChange,
}: {
  sectionType: string;
  content: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}) {
  const updateField = (key: string, value: unknown) => onChange(key, value);

  const renderTextField = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        value={(content[key] as string) || ''}
        onChange={(e) => updateField(key, e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );

  const renderSwitchField = (key: string, label: string) => (
    <div className="flex items-center gap-2">
      <Switch
        checked={!!content[key]}
        onCheckedChange={(checked) => updateField(key, checked)}
      />
      <Label>{label}</Label>
    </div>
  );

  const renderNumberField = (key: string, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        value={(content[key] as number) ?? ''}
        onChange={(e) => updateField(key, e.target.value ? Number(e.target.value) : undefined)}
        placeholder={placeholder}
      />
    </div>
  );

  switch (sectionType) {
    case 'hero':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Welcome to Our Hotel')}
          {renderTextField('subheading', 'Subheading', 'Experience luxury and comfort')}
          {renderTextField('ctaText', 'CTA Button Text', 'Book Now')}
          {renderSwitchField('showBookingWidget', 'Show Booking Widget')}
        </div>
      );

    case 'rooms_grid':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Our Rooms')}
          {renderSwitchField('showPrices', 'Show Prices')}
          {renderSwitchField('showAmenities', 'Show Amenities')}
        </div>
      );

    case 'features':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Why Choose Us')}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Feature Items</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const items = (content.items as Record<string, string>[]) || [];
                  updateField('items', [...items, { icon: 'CheckCircle', title: '', description: '' }]);
                }}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Item
              </Button>
            </div>
            {((content.items as Record<string, string>[]) || []).map((item, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Item {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      const items = [...((content.items as Record<string, string>[]) || [])];
                      items.splice(idx, 1);
                      updateField('items', items);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={item.icon || ''}
                  onChange={(e) => {
                    const items = [...((content.items as Record<string, string>[]) || [])];
                    items[idx] = { ...items[idx], icon: e.target.value };
                    updateField('items', items);
                  }}
                  placeholder="Icon name (e.g., CheckCircle)"
                />
                <Input
                  value={item.title || ''}
                  onChange={(e) => {
                    const items = [...((content.items as Record<string, string>[]) || [])];
                    items[idx] = { ...items[idx], title: e.target.value };
                    updateField('items', items);
                  }}
                  placeholder="Title"
                />
                <Input
                  value={item.description || ''}
                  onChange={(e) => {
                    const items = [...((content.items as Record<string, string>[]) || [])];
                    items[idx] = { ...items[idx], description: e.target.value };
                    updateField('items', items);
                  }}
                  placeholder="Description"
                />
              </div>
            ))}
          </div>
        </div>
      );

    case 'gallery':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Gallery')}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Images</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const images = (content.images as Record<string, string>[]) || [];
                  updateField('images', [...images, { url: '', alt: '' }]);
                }}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Image
              </Button>
            </div>
            {((content.images as Record<string, string>[]) || []).map((img, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Image {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      const images = [...((content.images as Record<string, string>[]) || [])];
                      images.splice(idx, 1);
                      updateField('images', images);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={img.url || ''}
                  onChange={(e) => {
                    const images = [...((content.images as Record<string, string>[]) || [])];
                    images[idx] = { ...images[idx], url: e.target.value };
                    updateField('images', images);
                  }}
                  placeholder="Image URL"
                />
                <Input
                  value={img.alt || ''}
                  onChange={(e) => {
                    const images = [...((content.images as Record<string, string>[]) || [])];
                    images[idx] = { ...images[idx], alt: e.target.value };
                    updateField('images', images);
                  }}
                  placeholder="Alt text"
                />
              </div>
            ))}
          </div>
        </div>
      );

    case 'testimonials':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Guest Reviews')}
          {renderNumberField('maxReviews', 'Max Reviews to Show', '6')}
        </div>
      );

    case 'cta':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Ready to Book?')}
          {renderTextField('subheading', 'Subheading', 'Best rates guaranteed')}
          {renderTextField('buttonText', 'Button Text', 'Reserve Now')}
          {renderTextField('buttonUrl', 'Button URL', '/booking')}
        </div>
      );

    case 'amenities':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Amenities')}
        </div>
      );

    case 'dining':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Dining')}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Restaurants</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const restaurants = (content.restaurants as Record<string, string>[]) || [];
                  updateField('restaurants', [...restaurants, { name: '', description: '', cuisine: '', hours: '' }]);
                }}
              >
                <Plus className="h-3 w-3 mr-1" /> Add Restaurant
              </Button>
            </div>
            {((content.restaurants as Record<string, string>[]) || []).map((r, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Restaurant {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      const restaurants = [...((content.restaurants as Record<string, string>[]) || [])];
                      restaurants.splice(idx, 1);
                      updateField('restaurants', restaurants);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={r.name || ''}
                  onChange={(e) => {
                    const restaurants = [...((content.restaurants as Record<string, string>[]) || [])];
                    restaurants[idx] = { ...restaurants[idx], name: e.target.value };
                    updateField('restaurants', restaurants);
                  }}
                  placeholder="Restaurant name"
                />
                <Input
                  value={r.description || ''}
                  onChange={(e) => {
                    const restaurants = [...((content.restaurants as Record<string, string>[]) || [])];
                    restaurants[idx] = { ...restaurants[idx], description: e.target.value };
                    updateField('restaurants', restaurants);
                  }}
                  placeholder="Description"
                />
                <Input
                  value={r.cuisine || ''}
                  onChange={(e) => {
                    const restaurants = [...((content.restaurants as Record<string, string>[]) || [])];
                    restaurants[idx] = { ...restaurants[idx], cuisine: e.target.value };
                    updateField('restaurants', restaurants);
                  }}
                  placeholder="Cuisine type"
                />
                <Input
                  value={r.hours || ''}
                  onChange={(e) => {
                    const restaurants = [...((content.restaurants as Record<string, string>[]) || [])];
                    restaurants[idx] = { ...restaurants[idx], hours: e.target.value };
                    updateField('restaurants', restaurants);
                  }}
                  placeholder="Hours (e.g., 7am - 10pm)"
                />
              </div>
            ))}
          </div>
        </div>
      );

    case 'map':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Find Us')}
          {renderNumberField('zoom', 'Zoom Level', '14')}
        </div>
      );

    case 'faq':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'FAQ')}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>FAQ Items</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const items = (content.items as Record<string, string>[]) || [];
                  updateField('items', [...items, { question: '', answer: '' }]);
                }}
              >
                <Plus className="h-3 w-3 mr-1" /> Add FAQ
              </Button>
            </div>
            {((content.items as Record<string, string>[]) || []).map((item, idx) => (
              <div key={idx} className="p-3 border rounded-lg space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">FAQ {idx + 1}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => {
                      const items = [...((content.items as Record<string, string>[]) || [])];
                      items.splice(idx, 1);
                      updateField('items', items);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Input
                  value={item.question || ''}
                  onChange={(e) => {
                    const items = [...((content.items as Record<string, string>[]) || [])];
                    items[idx] = { ...items[idx], question: e.target.value };
                    updateField('items', items);
                  }}
                  placeholder="Question"
                />
                <Textarea
                  value={item.answer || ''}
                  onChange={(e) => {
                    const items = [...((content.items as Record<string, string>[]) || [])];
                    items[idx] = { ...items[idx], answer: e.target.value };
                    updateField('items', items);
                  }}
                  placeholder="Answer"
                  rows={2}
                />
              </div>
            ))}
          </div>
        </div>
      );

    case 'contact_form':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Get in Touch')}
          {renderSwitchField('showMap', 'Show Map')}
          {renderSwitchField('showPhone', 'Show Phone')}
          {renderSwitchField('showEmail', 'Show Email')}
        </div>
      );

    case 'booking_widget':
      return (
        <div className="space-y-4">
          {renderTextField('heading', 'Heading', 'Book Your Stay')}
        </div>
      );

    case 'html':
      return (
        <div className="space-y-2">
          <Label>Custom HTML</Label>
          <Textarea
            value={(content.html as string) || ''}
            onChange={(e) => updateField('html', e.target.value)}
            placeholder="Enter custom HTML code..."
            rows={12}
            className="font-mono text-sm"
          />
        </div>
      );

    default:
      return (
        <div className="p-4 border rounded-lg bg-muted/30 text-center">
          <p className="text-sm text-muted-foreground">
            No editor available for section type &quot;{sectionType}&quot;
          </p>
        </div>
      );
  }
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WebsiteBuilder() {
  const { currentProperty } = useAuthStore();
  const propertyId = currentProperty?.id;

  // ─── Core State ────────────────────────────────────────────────────────
  const [website, setWebsite] = useState<WebsiteData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');
  const [previewKey, setPreviewKey] = useState(Date.now());

  // ─── Grouped State ─────────────────────────────────────────────────────
  const [theme, setTheme] = useState<ThemeState>({
    primaryColor: '#0d9488',
    secondaryColor: '#f59e0b',
    fontFamily: 'Inter',
    borderRadius: '8px',
    logoUrl: '',
    heroImageUrl: '',
  });

  const [seo, setSeo] = useState<SEOState>({
    title: '',
    description: '',
    keywords: '',
    ogImage: '',
    favicon: '',
  });

  const [analytics, setAnalytics] = useState<AnalyticsState>({
    gaId: '',
    gtmId: '',
    fbPixel: '',
    metaPixel: '',
    linkedinInsight: '',
    twitterPixel: '',
  });

  const [customDomain, setCustomDomain] = useState('');
  const [pages, setPages] = useState<WebsitePage[]>([]);

  const [pageDialog, setPageDialog] = useState<PageDialogState>({
    isOpen: false,
    page: null,
    title: '',
    slug: '',
    published: true,
  });

  const [sectionDialog, setSectionDialog] = useState<SectionDialogState>({
    isOpen: false,
    pageId: '',
    sectionId: '',
    sectionType: '',
    content: {},
  });

  const [newPageDialog, setNewPageDialog] = useState<NewPageDialogState>({
    isOpen: false,
    title: '',
    slug: '',
  });

  // ─── Sync local state from API data ─────────────────────────────────────

  const syncLocalState = (data: WebsiteData) => {
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
  };

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

  useEffect(() => {
    fetchWebsite();
  }, [fetchWebsite]);

  // ─── Create Website ─────────────────────────────────────────────────────

  const handleCreateWebsite = async (templateId: string) => {
    if (!propertyId) {
      toast.error('No property selected');
      return;
    }
    setIsSaving(true);
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
      setIsSaving(false);
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
            primaryColor: theme.primaryColor,
            secondaryColor: theme.secondaryColor,
            fontFamily: theme.fontFamily,
            borderRadius: theme.borderRadius,
            logoUrl: theme.logoUrl || undefined,
            heroImageUrl: theme.heroImageUrl || undefined,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        setWebsite(json.data);
        setPreviewKey(Date.now());
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
        setPreviewKey(Date.now());
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
          title: seo.title,
          description: seo.description,
          keywords: seo.keywords.split(',').map(k => k.trim()).filter(Boolean),
          ogImage: seo.ogImage || undefined,
          faviconUrl: seo.favicon || undefined,
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
          googleAnalyticsId: analytics.gaId || undefined,
          googleTagManagerId: analytics.gtmId || undefined,
          facebookPixelId: analytics.fbPixel || undefined,
          metaPixelId: analytics.metaPixel || undefined,
          linkedInsightTag: analytics.linkedinInsight || undefined,
          twitterPixelId: analytics.twitterPixel || undefined,
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
        setPreviewKey(Date.now());
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
    if (!website || !newPageDialog.title.trim() || !newPageDialog.slug.trim()) return;
    try {
      const res = await fetch('/api/website-builder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-page',
          websiteId: website.id,
          page: {
            slug: newPageDialog.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
            title: newPageDialog.title.trim(),
            sections: [],
            published: false,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchWebsite();
        setNewPageDialog({ isOpen: false, title: '', slug: '' });
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
    if (!website || !pageDialog.page) return;
    try {
      const res = await fetch('/api/website-builder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-page',
          websiteId: website.id,
          pageId: pageDialog.page.id,
          updates: {
            title: pageDialog.title,
            slug: pageDialog.slug,
            published: pageDialog.published,
          },
        }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchWebsite();
        setPageDialog(prev => ({ ...prev, isOpen: false, page: null }));
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

  const handleOpenSectionEditor = (pageId: string, section: PageSection) => {
    setSectionDialog({
      isOpen: true,
      pageId,
      sectionId: section.id,
      sectionType: section.type,
      content: JSON.parse(JSON.stringify(section.content)), // deep clone
    });
  };

  const handleSaveSectionContent = () => {
    const { pageId, sectionId, content } = sectionDialog;
    setPages(prev => prev.map(page => {
      if (page.id !== pageId) return page;
      return {
        ...page,
        sections: page.sections.map(s =>
          s.id === sectionId ? { ...s, content } : s
        ),
      };
    }));
    setSectionDialog(prev => ({ ...prev, isOpen: false }));
    setPreviewKey(Date.now());
  };

  const handleSectionContentChange = (key: string, value: unknown) => {
    setSectionDialog(prev => ({
      ...prev,
      content: { ...prev.content, [key]: value },
    }));
  };

  // ─── Sync from Property ─────────────────────────────────────────────────

  const handleSyncFromProperty = async () => {
    if (!website) return;
    setIsSyncing(true);
    try {
      const res = await fetch('/api/website-builder/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          websiteId: website.id,
          syncTypes: ['rooms', 'amenities', 'reviews', 'property_info'],
        }),
      });
      const json = await res.json();
      if (json.success && json.data?.sectionUpdates) {
        const { sectionUpdates } = json.data;
        // Merge section updates into pages state
        setPages(prev => prev.map(page => ({
          ...page,
          sections: page.sections.map(section => {
            if (sectionUpdates[section.type]) {
              return {
                ...section,
                content: { ...section.content, ...sectionUpdates[section.type] },
              };
            }
            return section;
          }),
        })));
        toast.success('Property data synced! Save pages to apply.');
      } else {
        toast.error(json.error?.message || 'Failed to sync property data');
      }
    } catch (err) {
      console.error('Error syncing property data:', err);
      toast.error('Failed to sync property data');
    } finally {
      setIsSyncing(false);
    }
  };

  // ─── Utility ────────────────────────────────────────────────────────────

  const handleCopyDomain = () => {
    if (website?.domain) {
      navigator.clipboard.writeText(website.customDomain || website.domain);
      toast.success('Domain copied to clipboard');
    }
  };

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

  const previewUrl = useMemo(() => {
    if (!website) return '';
    return `/site/${website.customDomain || website.domain}?preview=true`;
  }, [website]);

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
          {/* Preview button — opens in new tab */}
          <Button variant="outline" size="sm" asChild>
            <a href={previewUrl} target="_blank" rel="noopener noreferrer">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </a>
          </Button>
          {/* Visit button — links to /site/{domain} */}
          <Button variant="outline" size="sm" asChild>
            <a href={`/site/${website.customDomain || website.domain}`} target="_blank" rel="noopener noreferrer">
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
              <Button
                variant="outline"
                size="sm"
                onClick={handleSyncFromProperty}
                disabled={isSyncing}
              >
                {isSyncing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Sync from Property
              </Button>
              <Button onClick={handleSavePages} disabled={isSaving} size="sm">
                {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                Save Pages
              </Button>
              <Dialog open={newPageDialog.isOpen} onOpenChange={(open) => setNewPageDialog(prev => ({ ...prev, isOpen: open }))}>
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
                        value={newPageDialog.title}
                        onChange={(e) => {
                          setNewPageDialog(prev => ({
                            ...prev,
                            title: e.target.value,
                            slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'),
                          }));
                        }}
                        placeholder="e.g., Spa & Wellness"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>URL Slug</Label>
                      <Input value={newPageDialog.slug} onChange={(e) => setNewPageDialog(prev => ({ ...prev, slug: e.target.value }))} placeholder="spa-wellness" />
                      <p className="text-xs text-muted-foreground">/{newPageDialog.slug || 'page-slug'}</p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setNewPageDialog({ isOpen: false, title: '', slug: '' })}>Cancel</Button>
                    <Button onClick={handleAddPage} disabled={!newPageDialog.title.trim() || !newPageDialog.slug.trim()}>Add Page</Button>
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
                            setPageDialog({
                              isOpen: true,
                              page,
                              title: page.title,
                              slug: page.slug,
                              published: page.published,
                            });
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
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{getSectionTypeLabel(section.type)}</span>
                              {!section.visible && (
                                <Badge variant="outline" className="text-xs">Hidden</Badge>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleOpenSectionEditor(page.id, section)}
                            title="Edit section content"
                          >
                            <Settings className="h-3.5 w-3.5" />
                          </Button>
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
          <Dialog open={pageDialog.isOpen} onOpenChange={(open) => setPageDialog(prev => ({ ...prev, isOpen: open }))}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Page</DialogTitle>
                <DialogDescription>Update page settings</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Page Title</Label>
                  <Input value={pageDialog.title} onChange={(e) => setPageDialog(prev => ({ ...prev, title: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input value={pageDialog.slug} onChange={(e) => setPageDialog(prev => ({ ...prev, slug: e.target.value }))} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={pageDialog.published} onCheckedChange={(checked) => setPageDialog(prev => ({ ...prev, published: checked }))} />
                  <Label>Published</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPageDialog(prev => ({ ...prev, isOpen: false, page: null }))}>Cancel</Button>
                <Button onClick={handleUpdatePage}>Save Changes</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Section Content Editor Dialog */}
          <Dialog open={sectionDialog.isOpen} onOpenChange={(open) => setSectionDialog(prev => ({ ...prev, isOpen: open }))}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Section: {getSectionTypeLabel(sectionDialog.sectionType)}</DialogTitle>
                <DialogDescription>
                  Modify the content for this {getSectionTypeLabel(sectionDialog.sectionType).toLowerCase()} section
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <SectionContentEditor
                  sectionType={sectionDialog.sectionType}
                  content={sectionDialog.content}
                  onChange={handleSectionContentChange}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSectionDialog(prev => ({ ...prev, isOpen: false }))}>Cancel</Button>
                <Button onClick={handleSaveSectionContent}>
                  <Save className="h-4 w-4 mr-2" />
                  Apply Changes
                </Button>
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
                      value={theme.primaryColor}
                      onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={theme.primaryColor}
                      onChange={(e) => setTheme(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="flex-1"
                    />
                  </div>
                  <div className="flex gap-2 mt-2">
                    {['#0d9488', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#1e3a5f', '#059669', '#18181b'].map((c) => (
                      <button
                        key={c}
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                          theme.primaryColor === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => setTheme(prev => ({ ...prev, primaryColor: c }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Secondary Color</Label>
                  <div className="flex gap-2 items-center">
                    <Input
                      type="color"
                      value={theme.secondaryColor}
                      onChange={(e) => setTheme(prev => ({ ...prev, secondaryColor: e.target.value }))}
                      className="w-12 h-10 p-1"
                    />
                    <Input
                      value={theme.secondaryColor}
                      onChange={(e) => setTheme(prev => ({ ...prev, secondaryColor: e.target.value }))}
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
                          theme.fontFamily === f.value
                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                            : 'hover:border-muted'
                        }`}
                        onClick={() => setTheme(prev => ({ ...prev, fontFamily: f.value }))}
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
                          theme.borderRadius === r
                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                            : 'hover:border-muted'
                        }`}
                        onClick={() => setTheme(prev => ({ ...prev, borderRadius: r }))}
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
                    value={theme.logoUrl}
                    onChange={(e) => setTheme(prev => ({ ...prev, logoUrl: e.target.value }))}
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Hero Image URL</Label>
                  <Input
                    value={theme.heroImageUrl}
                    onChange={(e) => setTheme(prev => ({ ...prev, heroImageUrl: e.target.value }))}
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

            {/* Live Preview iframe */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    Live Preview
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setPreviewKey(Date.now())}
                    title="Refresh preview"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {previewUrl ? (
                  <iframe
                    key={previewKey}
                    src={previewUrl}
                    className="w-full h-[600px] border rounded-lg bg-white"
                    title="Website Preview"
                    sandbox="allow-scripts allow-same-origin"
                  />
                ) : (
                  <div className="h-[600px] border rounded-lg flex items-center justify-center bg-muted/30">
                    <p className="text-sm text-muted-foreground">No preview available</p>
                  </div>
                )}
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
                <Input id="seoTitle" value={seo.title} onChange={(e) => setSeo(prev => ({ ...prev, title: e.target.value }))} />
                <p className="text-xs text-muted-foreground">{seo.title.length}/60 characters recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoDesc">Meta Description</Label>
                <Textarea id="seoDesc" value={seo.description} onChange={(e) => setSeo(prev => ({ ...prev, description: e.target.value }))} rows={3} />
                <p className="text-xs text-muted-foreground">{seo.description.length}/160 characters recommended</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoKeywords">Keywords</Label>
                <Input id="seoKeywords" value={seo.keywords} onChange={(e) => setSeo(prev => ({ ...prev, keywords: e.target.value }))} />
                <p className="text-xs text-muted-foreground">Comma-separated keywords for search engines</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoOgImage">Open Graph Image URL</Label>
                <Input id="seoOgImage" value={seo.ogImage} onChange={(e) => setSeo(prev => ({ ...prev, ogImage: e.target.value }))} placeholder="https://example.com/og-image.jpg" />
                <p className="text-xs text-muted-foreground">Image shown when sharing on social media (1200×630 recommended)</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="seoFavicon">Favicon URL</Label>
                <Input id="seoFavicon" value={seo.favicon} onChange={(e) => setSeo(prev => ({ ...prev, favicon: e.target.value }))} placeholder="https://example.com/favicon.ico" />
              </div>

              {/* Google Preview */}
              <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <p className="text-xs text-muted-foreground mb-1">Google Search Preview</p>
                <p className="text-blue-700 dark:text-blue-400 text-lg font-medium hover:underline cursor-pointer truncate">
                  {seo.title || 'Your Hotel Name'}
                </p>
                <p className="text-sm text-green-700 dark:text-green-500">{customDomain || website.domain}</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{seo.description || 'Add a meta description...'}</p>
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
                <Input id="gaId" value={analytics.gaId} onChange={(e) => setAnalytics(prev => ({ ...prev, gaId: e.target.value }))} placeholder="G-XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track website visitors and behavior with Google Analytics 4</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gtmId">Google Tag Manager ID</Label>
                <Input id="gtmId" value={analytics.gtmId} onChange={(e) => setAnalytics(prev => ({ ...prev, gtmId: e.target.value }))} placeholder="GTM-XXXXXXX" />
                <p className="text-xs text-muted-foreground">Manage all tracking tags from one place</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fbPixel">Facebook Pixel ID</Label>
                <Input id="fbPixel" value={analytics.fbPixel} onChange={(e) => setAnalytics(prev => ({ ...prev, fbPixel: e.target.value }))} placeholder="XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track conversions and build retargeting audiences</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="metaPixel">Meta Pixel ID</Label>
                <Input id="metaPixel" value={analytics.metaPixel} onChange={(e) => setAnalytics(prev => ({ ...prev, metaPixel: e.target.value }))} placeholder="XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Meta (Instagram + Facebook) conversion tracking</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedinInsight">LinkedIn Insight Tag</Label>
                <Input id="linkedinInsight" value={analytics.linkedinInsight} onChange={(e) => setAnalytics(prev => ({ ...prev, linkedinInsight: e.target.value }))} placeholder="XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track LinkedIn ad conversions and B2B analytics</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitterPixel">Twitter/X Pixel ID</Label>
                <Input id="twitterPixel" value={analytics.twitterPixel} onChange={(e) => setAnalytics(prev => ({ ...prev, twitterPixel: e.target.value }))} placeholder="XXXXXXXXXX" />
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
                    { name: 'Google Analytics', configured: !!analytics.gaId },
                    { name: 'Google Tag Manager', configured: !!analytics.gtmId },
                    { name: 'Facebook Pixel', configured: !!analytics.fbPixel },
                    { name: 'Meta Pixel', configured: !!analytics.metaPixel },
                    { name: 'LinkedIn Insight', configured: !!analytics.linkedinInsight },
                    { name: 'Twitter/X Pixel', configured: !!analytics.twitterPixel },
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
