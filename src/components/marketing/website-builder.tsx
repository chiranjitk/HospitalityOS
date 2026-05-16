'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  type LucideIcon,
} from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  color: string;
  features: string[];
  icon: LucideIcon;
  popular?: boolean;
}

const templates: Template[] = [
  { id: 'modern', name: 'Modern', description: 'Clean, contemporary design with bold typography', color: 'from-teal-500 to-cyan-500', features: ['Hero slider', 'Animations', 'Responsive'], icon: Sparkles, popular: true },
  { id: 'classic', name: 'Classic', description: 'Elegant, timeless design with refined details', color: 'from-amber-500 to-orange-500', features: ['Traditional layout', 'Photo gallery', 'Reviews'], icon: Star },
  { id: 'boutique', name: 'Boutique', description: 'Unique, artistic design for boutique properties', color: 'from-violet-500 to-purple-500', features: ['Storytelling', 'Visual focus', 'Instagram feed'], icon: Layout },
  { id: 'resort', name: 'Resort', description: 'Immersive design showcasing resort amenities', color: 'from-emerald-500 to-green-500', features: ['Full-width images', 'Activity cards', 'Booking widget'], icon: Globe },
  { id: 'minimal', name: 'Minimal', description: 'Stripped-down, fast-loading minimalist design', color: 'from-gray-500 to-slate-600', features: ['Fast loading', 'Simple nav', 'CTA focused'], icon: Layout },
];

const fontOptions = [
  { value: 'inter', label: 'Inter' },
  { value: 'playfair', label: 'Playfair Display' },
  { value: 'lato', label: 'Lato' },
  { value: 'montserrat', label: 'Montserrat' },
  { value: 'roboto', label: 'Roboto' },
  { value: 'merriweather', label: 'Merriweather' },
];

export default function WebsiteBuilder() {
  const [selectedTemplate, setSelectedTemplate] = useState('modern');
  const [primaryColor, setPrimaryColor] = useState('#0d9488');
  const [font, setFont] = useState('inter');
  const [seoTitle, setSeoTitle] = useState('Grand Hotel — Luxury Accommodation in Downtown');
  const [seoDescription, setSeoDescription] = useState('Experience world-class hospitality at Grand Hotel. Book direct for the best rates on luxury rooms, suites, and packages.');
  const [seoKeywords, setSeoKeywords] = useState('luxury hotel, downtown hotel, grand hotel, book direct, best rates');
  const [gaId, setGaId] = useState('G-4X2K8M9N1P');
  const [fbPixel, setFbPixel] = useState('384756291847562');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isPublished, setIsPublished] = useState(true);

  const handlePublish = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      setIsPublished(true);
    }, 2000);
  };

  const handleLogoUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {};
    input.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Globe className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            Website Builder
          </h2>
          <p className="text-muted-foreground">
            Build and customize your property website with beautiful templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={isPublished ? 'default' : 'secondary'} className={isPublished ? 'bg-emerald-100 text-emerald-700 dark:text-emerald-300' : ''}>
            <CheckCircle className="h-3 w-3 mr-1" />
            {isPublished ? 'Published' : 'Draft'}
          </Badge>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            size="sm"
            className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white"
            onClick={handlePublish}
            disabled={isPublishing}
          >
            {isPublishing ? 'Publishing...' : 'Publish'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="templates">
        <TabsList className="grid w-full grid-cols-4 max-w-[500px]">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        {/* Templates Tab */}
        <TabsContent value="templates" className="mt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => {
              const TemplateIcon = template.icon;
              const isSelected = selectedTemplate === template.id;
              return (
                <Card
                  key={template.id}
                  className={`border-2 cursor-pointer transition-all hover:shadow-lg ${
                    isSelected
                      ? 'border-teal-500 shadow-md shadow-teal-500/20'
                      : 'border-transparent hover:border-muted'
                  }`}
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <CardContent className="p-0">
                    {/* Preview Area */}
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

                    {/* Info */}
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-1">
                        <TemplateIcon className="h-4 w-4 text-muted-foreground" />
                        <h3 className="font-semibold">{template.name}</h3>
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

        {/* Appearance Tab */}
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
                    {['#0d9488', '#8b5cf6', '#ec4899', '#f59e0b', '#ef4444', '#3b82f6'].map((c) => (
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
                  <Label>Font Family</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {fontOptions.map((f) => (
                      <button
                        key={f.value}
                        className={`p-3 rounded-lg border text-left text-sm transition-colors ${
                          font === f.value
                            ? 'border-teal-500 bg-teal-50 dark:bg-teal-950'
                            : 'hover:border-muted'
                        }`}
                        onClick={() => setFont(f.value)}
                      >
                        <span className="font-medium" style={{ fontFamily: f.value }}>{f.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Hotel Logo</Label>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/30 transition-colors cursor-pointer" onClick={handleLogoUpload}>
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">Click to upload logo</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG or SVG, max 500KB</p>
                  </div>
                </div>

                <Button className="w-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
                  Save Appearance
                </Button>
              </CardContent>
            </Card>

            {/* Preview Panel */}
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
                      <div className="bg-white dark:bg-gray-700 rounded px-3 py-1 text-xs text-muted-foreground">
                        www.grandhotel.com
                      </div>
                    </div>
                  </div>
                  {/* Preview content */}
                  <div className="p-4" style={{ fontFamily: font }}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded" style={{ backgroundColor: primaryColor }} />
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="flex-1" />
                      <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-3 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-8 w-20 rounded text-white text-xs flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                        Book Now
                      </div>
                    </div>
                    <div className="h-24 rounded-lg mb-4" style={{ background: `linear-gradient(135deg, ${primaryColor}88, ${primaryColor}44)` }} />
                    <div className="space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
                    </div>
                    <div className="grid grid-cols-3 gap-2 mt-4">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="bg-gray-50 dark:bg-gray-800 rounded p-2">
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

        {/* SEO Tab */}
        <TabsContent value="seo" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                SEO Settings
              </CardTitle>
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
              {/* Google Preview */}
              <div className="p-4 border rounded-lg bg-gray-50 dark:bg-gray-900">
                <p className="text-xs text-muted-foreground mb-1">Google Search Preview</p>
                <p className="text-blue-700 dark:text-blue-400 text-lg font-medium hover:underline cursor-pointer truncate">
                  {seoTitle || 'Your Hotel Name'}
                </p>
                <p className="text-sm text-green-700 dark:text-green-500">www.grandhotel.com</p>
                <p className="text-sm text-muted-foreground line-clamp-2">{seoDescription || 'Add a meta description...'}</p>
              </div>
              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
                Save SEO Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4">
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                Analytics & Tracking
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="gaId">Google Analytics ID</Label>
                <Input id="gaId" value={gaId} onChange={(e) => setGaId(e.target.value)} placeholder="G-XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track website visitors and behavior with Google Analytics 4</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="fbPixel">Facebook Pixel ID</Label>
                <Input id="fbPixel" value={fbPixel} onChange={(e) => setFbPixel(e.target.value)} placeholder="XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Track conversions and build retargeting audiences</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="gtmId">Google Tag Manager ID (Optional)</Label>
                <Input id="gtmId" placeholder="GTM-XXXXXXX" />
                <p className="text-xs text-muted-foreground">Manage all tracking tags from one place</p>
              </div>
              <div className="p-4 rounded-lg border border-dashed bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Code className="h-4 w-4 text-muted-foreground" />
                  <p className="text-sm font-medium">Tracking Status</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Google Analytics</span>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Facebook Pixel</span>
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">Connected</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Google Tag Manager</span>
                    <Badge className="bg-muted text-muted-foreground">Not configured</Badge>
                  </div>
                </div>
              </div>
              <Button className="bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-white">
                Save Analytics Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
