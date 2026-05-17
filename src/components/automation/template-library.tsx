'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Zap, Mail, Bell, Star, Gift, AlertTriangle, CheckCircle, Copy,
  Loader2, Search, CreditCard, Users, Crown, CalendarDays, XCircle,
  TrendingUp, Heart, Award, ThumbsDown, Calendar, Send
} from 'lucide-react';
import { toast } from 'sonner';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  triggerEvent: string;
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
  isSystem: boolean;
  usageCount: number;
  isActive: boolean;
  icon: string | null;
}

interface SystemTemplate {
  name: string;
  description: string;
  category: string;
  triggerEvent: string;
  triggerConditions: Record<string, unknown> | null;
  actions: Array<{ type: string; config?: Record<string, unknown> }>;
  icon: string;
  alreadyInstalled: boolean;
  existingId: string | null;
  usageCount: number;
  isActive: boolean;
  isSystem: boolean;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  Mail: <Mail className="h-5 w-5" />,
  Heart: <Heart className="h-5 w-5" />,
  Crown: <Crown className="h-5 w-5" />,
  AlertTriangle: <AlertTriangle className="h-5 w-5" />,
  ThumbsDown: <ThumbsDown className="h-5 w-5" />,
  Gift: <Gift className="h-5 w-5" />,
  TrendingUp: <TrendingUp className="h-5 w-5" />,
  XCircle: <XCircle className="h-5 w-5" />,
  CalendarDays: <CalendarDays className="h-5 w-5" />,
  CreditCard: <CreditCard className="h-5 w-5" />,
  Award: <Award className="h-5 w-5" />,
  Users: <Users className="h-5 w-5" />,
  Star: <Star className="h-5 w-5" />,
  Bell: <Bell className="h-5 w-5" />,
  Send: <Send className="h-5 w-5" />,
  Calendar: <Calendar className="h-5 w-5" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  pre_arrival: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-300',
  post_stay: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
  check_in: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  check_out: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  housekeeping: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  billing: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
  marketing: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  vip: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
};

const CATEGORY_LABELS: Record<string, string> = {
  pre_arrival: 'Pre-Arrival',
  post_stay: 'Post-Stay',
  check_in: 'Check-In',
  check_out: 'Check-Out',
  housekeeping: 'Housekeeping',
  billing: 'Billing',
  marketing: 'Marketing',
  vip: 'VIP',
};

export default function TemplateLibrary() {
  const [systemTemplates, setSystemTemplates] = useState<SystemTemplate[]>([]);
  const [customTemplates, setCustomTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('system');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [installing, setInstalling] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '', description: '', category: 'marketing', triggerEvent: 'scheduled.daily',
    actions: [{ type: 'send_email', config: {} }],
  });
  const [addActionType, setAddActionType] = useState('send_email');

  const fetchSystemTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/automations/templates/system?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.success) setSystemTemplates(json.data);
    } catch {
      toast.error('Failed to load system templates');
    }
  }, [selectedCategory, searchQuery]);

  const fetchCustomTemplates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.set('isSystem', 'false');
      if (selectedCategory !== 'all') params.set('category', selectedCategory);
      if (searchQuery) params.set('search', searchQuery);
      const res = await fetch(`/api/automations/templates?${params}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.success) setCustomTemplates(json.data);
    } catch {
      toast.error('Failed to load custom templates');
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchSystemTemplates(), fetchCustomTemplates()]);
      setLoading(false);
    };
    load();
  }, [fetchSystemTemplates, fetchCustomTemplates]);

  const handleInstall = async (templateName: string) => {
    try {
      setInstalling(templateName);
      const res = await fetch('/api/automations/templates/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateName }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`"${templateName}" installed successfully`);
        fetchSystemTemplates();
      } else {
        toast.error(json.error?.message || 'Failed to install');
      }
    } catch {
      toast.error('Failed to install template');
    } finally {
      setInstalling(null);
    }
  };

  const handleCreateCustom = async () => {
    if (!newTemplate.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    try {
      const res = await fetch('/api/automations/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Custom template created');
        setCreateDialogOpen(false);
        setNewTemplate({ name: '', description: '', category: 'marketing', triggerEvent: 'scheduled.daily', actions: [{ type: 'send_email', config: {} }] });
        fetchCustomTemplates();
      } else {
        toast.error(json.error?.message || 'Failed to create');
      }
    } catch {
      toast.error('Failed to create template');
    }
  };

  const handleAddAction = () => {
    setNewTemplate(p => ({
      ...p,
      actions: [...p.actions, { type: addActionType, config: {} }],
    }));
  };

  const handleRemoveAction = (index: number) => {
    setNewTemplate(p => ({
      ...p,
      actions: p.actions.filter((_, i) => i !== index),
    }));
  };

  const getTemplateIcon = (iconName: string) => {
    return ICON_MAP[iconName] || <Zap className="h-5 w-5" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const categories = ['all', ...Object.keys(CATEGORY_LABELS)];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Automation Template Library</h1>
          <p className="text-muted-foreground">Pre-built and custom automation templates for your hotel workflows</p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="gap-2">
          <Zap className="h-4 w-4" /> Create Custom Template
        </Button>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat === 'all' ? 'All' : CATEGORY_LABELS[cat] || cat}
            </Button>
          ))}
        </div>
      </div>

      {/* System Templates Tab */}
      <div>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="system">
              <Star className="h-4 w-4 mr-2" /> System Templates ({systemTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="custom">
              <Copy className="h-4 w-4 mr-2" /> Custom Templates ({customTemplates.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="system" className="mt-4">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {systemTemplates.map((template, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/15 p-2.5 text-primary">
                        {getTemplateIcon(template.icon)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{template.name}</CardTitle>
                        <Badge className={`${CATEGORY_COLORS[template.category] || 'bg-gray-100 text-gray-800'} text-xs`} variant="secondary">
                          {CATEGORY_LABELS[template.category] || template.category}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <CardDescription className="text-sm line-clamp-2">
                      {template.description}
                    </CardDescription>

                    {/* Trigger */}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="truncate">{template.triggerEvent.replace(/_/g, ' ').replace(/\./g, ' → ')}</span>
                    </div>

                    {/* Actions */}
                    <div className="space-y-1">
                      {template.actions.slice(0, 3).map((action, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <CheckCircle className="h-3 w-3 text-primary shrink-0" />
                          <span className="truncate">{action.type.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                      {template.actions.length > 3 && (
                        <p className="text-xs text-muted-foreground pl-5">+{template.actions.length - 3} more actions</p>
                      )}
                    </div>

                    {/* Install Button */}
                    <Button
                      className="w-full"
                      variant={template.alreadyInstalled ? 'outline' : 'default'}
                      size="sm"
                      onClick={() => !template.alreadyInstalled && handleInstall(template.name)}
                      disabled={template.alreadyInstalled || installing === template.name}
                    >
                      {installing === template.name ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Installing...</>
                      ) : template.alreadyInstalled ? (
                        <><CheckCircle className="h-4 w-4 mr-2" />Installed</>
                      ) : (
                        <><Copy className="h-4 w-4 mr-2" />Activate Template</>
                      )}
                    </Button>

                    {template.usageCount > 0 && (
                      <p className="text-xs text-muted-foreground text-center">Used {template.usageCount} time(s)</p>
                    )}
                  </CardContent>
                </Card>
              ))}

              {systemTemplates.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Zap className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">No templates found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="custom" className="mt-4">
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
              {customTemplates.map((template) => (
                <Card key={template.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/15 p-2.5 text-primary">
                        {getTemplateIcon(template.icon || 'Zap')}
                      </div>
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">{template.name}</CardTitle>
                        <Badge className={`${CATEGORY_COLORS[template.category] || 'bg-gray-100 text-gray-800'} text-xs`} variant="secondary">
                          {CATEGORY_LABELS[template.category] || template.category}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {template.description && (
                      <CardDescription className="text-sm line-clamp-2">{template.description}</CardDescription>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                      <span className="truncate">{template.triggerEvent.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{template.actions.length} action(s)</span>
                      <span>Used {template.usageCount}x</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {customTemplates.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  <Copy className="h-12 w-12 mx-auto mb-4 opacity-40" />
                  <p className="text-lg font-medium">No custom templates yet</p>
                  <p className="text-sm">Create your own automation templates</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Custom Template Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Custom Template</DialogTitle>
            <DialogDescription>Define a custom automation workflow</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <label className="text-sm font-medium">Template Name</label>
              <Input value={newTemplate.name} onChange={(e) => setNewTemplate(p => ({ ...p, name: e.target.value }))} placeholder="My Custom Automation" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea value={newTemplate.description} onChange={(e) => setNewTemplate(p => ({ ...p, description: e.target.value }))} placeholder="What this automation does..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Category</label>
                <Select value={newTemplate.category} onValueChange={(v) => setNewTemplate(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Trigger Event</label>
                <Input value={newTemplate.triggerEvent} onChange={(e) => setNewTemplate(p => ({ ...p, triggerEvent: e.target.value }))} placeholder="e.g., guest.check_in" />
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Actions</label>
                <Button variant="outline" size="sm" onClick={handleAddAction} className="gap-1">
                  <Zap className="h-3 w-3" /> Add
                </Button>
              </div>
              <Select value={addActionType} onValueChange={setAddActionType}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="send_email">Send Email</SelectItem>
                  <SelectItem value="send_sms">Send SMS</SelectItem>
                  <SelectItem value="send_notification">Send Notification</SelectItem>
                  <SelectItem value="create_task">Create Task</SelectItem>
                  <SelectItem value="add_tag">Add Tag</SelectItem>
                  <SelectItem value="update_booking">Update Booking</SelectItem>
                </SelectContent>
              </Select>
              <div className="space-y-2">
                {newTemplate.actions.map((action, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm flex-1">{action.type.replace(/_/g, ' ')}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => handleRemoveAction(index)}>
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateCustom}>Create Template</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
