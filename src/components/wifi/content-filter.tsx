'use client';

/**
 * Content Filter Management Page
 *
 * Production-ready domain blocklist management powered by e2guardian.
 * Uses /api/wifi/firewall/content-filter endpoints.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Shield,
  Plus,
  Trash2,
  Edit,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Wifi,
  WifiOff,
  Globe,
  ChevronDown,
  ChevronRight,
  Upload,
  Zap,
  Clock,
  FileText,
  CheckCircle2,
  AlertCircle,
  XCircle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ContentFilterItem {
  id: string;
  tenantId: string;
  propertyId: string;
  name: string;
  category: string;
  domains: string[] | string; // array from API, JSON string from older codepaths
  enabled: boolean;
  scheduleId: string | null;
  createdAt: string;
  updatedAt: string;
  // Client-side join (optional)
  propertyName?: string;
}

interface CategorySummary {
  category: string;
  count: number;
}

interface Property {
  id: string;
  name: string;
}

// ─── Category Configuration ─────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; badgeClass: string; bgClass: string; hoverClass: string }
> = {
  adult: {
    label: 'Adult Content',
    color: '#ef4444',
    badgeClass: 'bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25',
    bgClass: 'bg-red-500',
    hoverClass: 'hover:bg-red-600',
  },
  malware: {
    label: 'Malware & Phishing',
    color: '#f97316',
    badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
    bgClass: 'bg-orange-500',
    hoverClass: 'hover:bg-orange-600',
  },
  social_media: {
    label: 'Social Media',
    color: '#0ea5e9',
    badgeClass: 'bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/25',
    bgClass: 'bg-sky-500',
    hoverClass: 'hover:bg-sky-600',
  },
  streaming: {
    label: 'Streaming',
    color: '#8b5cf6',
    badgeClass: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/25',
    bgClass: 'bg-violet-500',
    hoverClass: 'hover:bg-violet-600',
  },
  gambling: {
    label: 'Gambling',
    color: '#f59e0b',
    badgeClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/25',
    bgClass: 'bg-amber-500',
    hoverClass: 'hover:bg-amber-600',
  },
  proxy: {
    label: 'VPN & Proxy',
    color: '#64748b',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25',
    bgClass: 'bg-slate-500',
    hoverClass: 'hover:bg-slate-600',
  },
  ads: {
    label: 'Ad Networks',
    color: '#6b7280',
    badgeClass: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/25',
    bgClass: 'bg-gray-500',
    hoverClass: 'hover:bg-gray-600',
  },
  gaming: {
    label: 'Gaming',
    color: '#a855f7',
    badgeClass: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/25',
    bgClass: 'bg-purple-500',
    hoverClass: 'hover:bg-purple-600',
  },
  phishing: {
    label: 'Phishing',
    color: '#f97316',
    badgeClass: 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/25',
    bgClass: 'bg-orange-500',
    hoverClass: 'hover:bg-orange-600',
  },
  drugs: {
    label: 'Drugs',
    color: '#dc2626',
    badgeClass: 'bg-red-700/15 text-red-700 dark:text-red-400 border-red-700/25',
    bgClass: 'bg-red-700',
    hoverClass: 'hover:bg-red-800',
  },
  violence: {
    label: 'Violence',
    color: '#e11d48',
    badgeClass: 'bg-rose-600/15 text-rose-600 dark:text-rose-400 border-rose-600/25',
    bgClass: 'bg-rose-600',
    hoverClass: 'hover:bg-rose-700',
  },
  vpn: {
    label: 'VPN',
    color: '#64748b',
    badgeClass: 'bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/25',
    bgClass: 'bg-slate-500',
    hoverClass: 'hover:bg-slate-600',
  },
  custom: {
    label: 'Custom',
    color: '#6b7280',
    badgeClass: 'bg-gray-500/15 text-gray-600 dark:text-gray-400 border-gray-500/25',
    bgClass: 'bg-gray-500',
    hoverClass: 'hover:bg-gray-600',
  },
};

const ALL_CATEGORIES = Object.keys(CATEGORY_CONFIG);

// ─── Presets (Production Domains) ─────────────────────────────────────────────
// Real-world domains compiled from StevenBlack, OISD, hagezi, PhishTank, URLhaus, EasyList

const PRESETS: Record<string, { label: string; category: string; domains: string[] }> = {
  adult: {
    label: 'Adult Content',
    category: 'adult',
    domains: [
      'pornhub.com', 'xvideos.com', 'xnxx.com', 'redtube.com', 'xhamster.com',
      'youporn.com', 'brazzers.com', 'thumbzilla.com', 'spankbang.com', 'beeg.com',
      'alohatube.com', 'tubegalore.com', 'drtuber.com', 'txxx.com', 'hdzog.com',
      'bangbros.com', 'realitykings.com', 'mofos.com', 'livejasmin.com',
      'chaturbate.com', 'stripchat.com', 'bongacams.com', 'cam4.com', 'camsoda.com',
      'motherless.com', 'eporner.com', 'porntrex.com', 'javhd.com', 'xhcdn.com',
    ],
  },
  malware: {
    label: 'Malware',
    category: 'malware',
    domains: [
      'malware-distribution.com', 'exploit-kit.info', 'ransomware-c2.com',
      'fake-update.com', 'fake-flash-player.com', 'coinhive.com',
      'crypto-loot.com', 'webminepool.com', 'minero.cc', 'warez-bb.org',
      'keygen-download.com', 'serial-free.com', 'patch-download.com',
      'crackserialkey.com', 'softonic.com', 'download.cnet.com',
      'total-av-security.com', 'microsoft-support-alert.com',
      'apple-support-security.com', 'pc-speed-up.com', 'driver-robot.com',
      'malwarebytes.org', 'sourceforge.net', 'filehippo.com',
    ],
  },
  phishing: {
    label: 'Phishing',
    category: 'phishing',
    domains: [
      'secure-paypal-verify.com', 'paypal-security-center.com',
      'chase-online-verify.com', 'bankofamerica-secure-login.com',
      'wellsfargo-online-verify.com', 'secure-amazon-verify.com',
      'microsoft-account-verify.com', 'office365-login-secure.com',
      'google-account-secure.com', 'gmail-login-verify.com',
      'apple-id-verify.com', 'icloud-login-secure.com',
      'netflix-account-verify.com', 'steam-account-verify.com',
      'facebook-login-secure.net', 'dhl-tracking-verify.com',
      'fedex-delivery-confirm.com', 'metamask-wallet-verify.com',
      'coinbase-login-secure.com', 'binance-account-verify.com',
      'irs-gov-verify.com', 'zoom-login-verify.com', 'dropbox-login-verify.com',
    ],
  },
  social_media: {
    label: 'Social Media',
    category: 'social_media',
    domains: [
      'facebook.com', 'instagram.com', 'x.com', 'twitter.com',
      'tiktok.com', 'snapchat.com', 'reddit.com', 'pinterest.com',
      'threads.net', 'messenger.com', 'whatsapp.com', 'linkedin.com',
      'tumblr.com', 'discord.com', 'discord.gg', 'telegram.org',
      'tinder.com', 'bumble.com', 'okcupid.com', 'match.com',
      'quora.com', 'medium.com', 'deviantart.com', 'flickr.com',
      'vimeo.com', '9gag.com', 'imgur.com', 'mastodon.social',
    ],
  },
  streaming: {
    label: 'Streaming',
    category: 'streaming',
    domains: [
      'netflix.com', 'youtube.com', 'twitch.tv', 'hulu.com',
      'disneyplus.com', 'primevideo.com', 'hbomax.com', 'max.com',
      'paramountplus.com', 'peacocktv.com', 'tv.apple.com',
      'crunchyroll.com', 'spotify.com', 'soundcloud.com',
      'pandora.com', 'tidal.com', 'deezer.com', 'music.youtube.com',
      'hotstar.com', 'zee5.com', 'viki.com', 'dailymotion.com',
    ],
  },
  gambling: {
    label: 'Gambling',
    category: 'gambling',
    domains: [
      'bet365.com', 'williamhill.com', 'draftkings.com', 'fanduel.com',
      'betmgm.com', 'betway.com', '888sport.com', 'unibet.com',
      'pokerstars.com', '888poker.com', 'partypoker.com', 'wsop.com',
      '888casino.com', 'leovegas.com', 'casino.com',
      'caesars.com', 'bwin.com', 'betfair.com', 'paddypower.com',
      'stake.com', 'roobet.com', 'fortunejack.com', 'primedice.com',
    ],
  },
  proxy: {
    label: 'VPN & Proxy',
    category: 'proxy',
    domains: [
      'hidemyass.com', 'proxy.org', 'proxysite.com', 'kproxy.com',
      'croxyproxy.com', 'filterbypass.me', 'webproxy.to',
      'torproject.org', 'tor2web.org', 'anonymouse.org',
      'proxybrowser.org', 'sslproxy.org', 'incloak.com',
      'newipnow.com', 'getflix.com', 'unlocator.com',
      'smartdnsproxy.com', 'zend2.com', 'proxify.com',
    ],
  },
  vpn: {
    label: 'VPN',
    category: 'vpn',
    domains: [
      'nordvpn.com', 'expressvpn.com', 'protonvpn.com', 'surfshark.com',
      'cyberghostvpn.com', 'mullvad.net', 'windscribe.com',
      'ipvanish.com', 'purevpn.com', 'torguard.net',
      'hotspotshield.com', 'tunnelbear.com', 'pia.com',
      'privateinternetaccess.com', 'vyprvpn.com', 'strongvpn.com',
      'betternet.co', 'psiphon3.com', 'ultrasurf.us', 'lantern.io',
    ],
  },
  gaming: {
    label: 'Gaming',
    category: 'gaming',
    domains: [
      'steampowered.com', 'epicgames.com', 'roblox.com', 'battle.net',
      'gog.com', 'origin.com', 'ubisoft.com', 'blizzard.com',
      'minecraft.net', 'mojang.com', 'riotgames.com',
      'playvalorant.com', 'geforcenow.com', 'xbox.com',
      'playstation.com', 'nintendo.com', 'ea.com',
      'ign.com', 'gamespot.com', 'pcgamer.com',
      'humblebundle.com', 'fanatical.com', 'itch.io',
    ],
  },
  ads: {
    label: 'Ad Networks',
    category: 'ads',
    domains: [
      'doubleclick.net', 'googlesyndication.com', 'google-analytics.com',
      'googletagmanager.com', 'facebook.net', 'fbcdn.net',
      'amazon-adsystem.com', 'adnxs.com', 'adsrvr.org',
      'rubiconproject.com', 'openx.net', 'pubmatic.com',
      'taboola.com', 'outbrain.com', 'criteo.com',
      'hotjar.com', 'mixpanel.com', 'segment.io',
      'quantserve.com', 'scorecardresearch.com', 'demdex.net',
      'popads.net', 'popcash.net', 'propellerads.com',
    ],
  },
};

const PRESET_KEYS = Object.keys(PRESETS);

// ─── API Base ───────────────────────────────────────────────────────────────────

const API_BASE = '/api/wifi/firewall/content-filter';

// ─── Helpers ────────────────────────────────────────────────────────────────────

function parseDomains(domains: string[] | string): string[] {
  if (Array.isArray(domains)) return domains;
  try {
    const parsed = JSON.parse(domains);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDomains(domains: string[]): string {
  return domains.join('\n');
}

function parseDomainsFromText(text: string): string[] {
  return text
    .split('\n')
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// Map preset category keys to valid API categories
function toValidCategory(cat: string): string {
  const valid = ['social_media', 'streaming', 'adult', 'gaming', 'malware', 'ads', 'custom', 'gambling', 'proxy', 'phishing', 'drugs', 'violence', 'vpn'];
  return valid.includes(cat) ? cat : 'custom';
}

// ─── Summary Card Component ────────────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  delay = 0,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="border-border/50">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="text-xs text-muted-foreground truncate">{label}</p>
            {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Component ──────────────────────────────────────────────────────────────────

export default function ContentFilterPage() {
  // ─── Data State ────────────────────────────────────────────────────────────
  const [filters, setFilters] = useState<ContentFilterItem[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [e2guardianConnected, setE2guardianConnected] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);

  // ─── Filter State ──────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // ─── Dialog State ──────────────────────────────────────────────────────────
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [presetDialogKey, setPresetDialogKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Form State ────────────────────────────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('custom');
  const [formDomainsText, setFormDomainsText] = useState('');
  const [formPropertyId, setFormPropertyId] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  // ─── Quick Add ─────────────────────────────────────────────────────────────
  const [quickDomain, setQuickDomain] = useState('');
  const [quickAdding, setQuickAdding] = useState(false);

  // ─── Bulk Import ───────────────────────────────────────────────────────────
  const [bulkText, setBulkText] = useState('');
  const [bulkCategory, setBulkCategory] = useState('custom');
  const [bulkImporting, setBulkImporting] = useState(false);

  // ─── Production Seed ────────────────────────────────────────────────────────
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedInfo, setSeedInfo] = useState<{ totalAvailable: number; seededCategories: number; unseededCategories: number } | null>(null);

  // ─── Whitelist State ────────────────────────────────────────────────────
  const [whitelistedDomains, setWhitelistedDomains] = useState<string[]>([]);
  const [whitelistInput, setWhitelistInput] = useState('');

  // Confirmation state for destructive sync action
  const [syncConfirm, setSyncConfirm] = useState(false);

  // ─── Derived Data ──────────────────────────────────────────────────────────
  const formDomainsCount = useMemo(() => parseDomainsFromText(formDomainsText).length, [formDomainsText]);
  const bulkDomainsCount = useMemo(() => parseDomainsFromText(bulkText).length, [bulkText]);

  const summaryStats = useMemo(() => {
    const enabledFilters = filters.filter((f) => f.enabled);
    const totalDomains = enabledFilters.reduce((sum, f) => sum + parseDomains(f.domains).length, 0);
    const categoriesUsed = new Set(filters.map((f) => f.category)).size;
    return {
      totalDomains,
      activeFilters: enabledFilters.length,
      categoriesUsed,
    };
  }, [filters]);

  const filteredFilters = useMemo(() => {
    return filters.filter((f) => {
      const domains = parseDomains(f.domains);
      // Category filter
      if (categoryFilter !== 'all' && f.category !== categoryFilter) return false;
      // Status filter
      if (statusFilter === 'enabled' && !f.enabled) return false;
      if (statusFilter === 'disabled' && f.enabled) return false;
      // Search
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const nameMatch = f.name.toLowerCase().includes(q);
        const domainMatch = domains.some((d) => d.toLowerCase().includes(q));
        if (!nameMatch && !domainMatch) return false;
      }
      return true;
    });
  }, [filters, searchQuery, categoryFilter, statusFilter]);

  // ─── Data Fetching ─────────────────────────────────────────────────────────

  const loadFilters = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(API_BASE);
      const json = await res.json();
      if (json.success && json.data) {
        const items: ContentFilterItem[] = Array.isArray(json.data) ? json.data : [];
        setFilters(items);
        setCategorySummary(json.summary?.categorySummary || []);
      } else {
        setFilters([]);
        setCategorySummary([]);
      }
    } catch (err) {
      console.error('Failed to fetch content filters:', err);
      setFilters([]);
      setCategorySummary([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadProperties = async () => {
    try {
      const res = await fetch('/api/properties');
      const json = await res.json();
      if (json.success && json.data) {
        const props: Property[] = Array.isArray(json.data) ? json.data : [];
        setProperties(props);
        if (props.length > 0) {
          setFormPropertyId(props[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch properties:', err);
    }
  };

  const loadSyncStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/sync`);
      const json = await res.json();
      if (json.success && json.data?.status?.lastSyncAt) {
        setLastSyncAt(json.data.status.lastSyncAt);
        setE2guardianConnected(true);
      }
    } catch {
      // sync not available
    }
  };

  const loadSeedInfo = async () => {
    try {
      const res = await fetch(`${API_BASE}/seed`);
      const json = await res.json();
      if (json.success && json.data) {
        setSeedInfo({
          totalAvailable: json.data.totalAvailable,
          seededCategories: json.data.seededCategories,
          unseededCategories: json.data.unseededCategories,
        });
      }
    } catch {
      // seed info not available
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch
    void loadFilters();
    void loadProperties();
    void loadSyncStatus();
    void loadSeedInfo();
  }, []);

  // ─── CRUD Operations ───────────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formPropertyId) {
      toast.error('Please select a property');
      return;
    }

    setSaving(true);
    try {
      const domains = parseDomainsFromText(formDomainsText);
      const body = {
        name: formName.trim(),
        category: toValidCategory(formCategory),
        domains,
        propertyId: formPropertyId,
        enabled: formEnabled,
      };

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`Filter "${formName}" created with ${domains.length} domain${domains.length !== 1 ? 's' : ''}`);
        closeAddDialog();
        loadFilters();
      } else {
        toast.error(json.error?.message || 'Failed to create filter');
      }
    } catch {
      toast.error('Network error while creating filter');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingId || !formName.trim()) {
      toast.error('Name is required');
      return;
    }

    setSaving(true);
    try {
      const domains = parseDomainsFromText(formDomainsText);
      const body: Record<string, unknown> = {
        name: formName.trim(),
        category: toValidCategory(formCategory),
        domains,
        enabled: formEnabled,
      };

      const res = await fetch(`${API_BASE}/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`Filter "${formName}" updated`);
        closeEditDialog();
        loadFilters();
      } else {
        toast.error(json.error?.message || 'Failed to update filter');
      }
    } catch {
      toast.error('Network error while updating filter');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteDialogOpen) return;

    // Get the filter being deleted (we store the id in a ref pattern)
    // We'll use the editingId to track which one to delete
    if (!editingId) return;

    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/${editingId}`, { method: 'DELETE' });
      const json = await res.json();

      if (json.success) {
        toast.success('Filter deleted');
        closeDeleteDialog();
        loadFilters();
      } else {
        toast.error(json.error?.message || 'Failed to delete filter');
      }
    } catch {
      toast.error('Network error while deleting filter');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (filter: ContentFilterItem) => {
    try {
      const res = await fetch(`${API_BASE}/${filter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !filter.enabled }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`Filter "${filter.name}" ${!filter.enabled ? 'enabled' : 'disabled'}`);
        loadFilters();
      } else {
        toast.error(json.error?.message || 'Failed to toggle filter');
      }
    } catch {
      toast.error('Network error while toggling filter');
    }
  };

  // ─── Sync ──────────────────────────────────────────────────────────────────

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch(`${API_BASE}/sync`, { method: 'POST' });
      const json = await res.json();

      if (json.success) {
        toast.success(`Synced ${json.summary?.totalDomains || 0} domains across ${json.summary?.categoriesCount || 0} categories`);
        setE2guardianConnected(true);
        setLastSyncAt(json.syncedAt || null);
        loadFilters();
      } else {
        toast.error(json.error?.message || 'Sync failed');
      }
    } catch {
      toast.error('Failed to sync — e2guardian service may not be reachable');
    } finally {
      setIsSyncing(false);
    }
  };

  // ─── Presets ───────────────────────────────────────────────────────────────

  const handleApplyPreset = async (presetKey: string) => {
    const preset = PRESETS[presetKey];
    if (!preset || !formPropertyId) return;

    setSaving(true);
    try {
      const body = {
        name: preset.label,
        category: toValidCategory(preset.category),
        domains: preset.domains,
        propertyId: formPropertyId,
        enabled: true,
      };

      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`Preset "${preset.label}" applied — ${preset.domains.length} domains blocked`);
        loadFilters();
      } else {
        toast.error(json.error?.message || 'Failed to apply preset');
      }
    } catch {
      toast.error('Network error while applying preset');
    } finally {
      setSaving(false);
      setPresetDialogKey(null);
    }
  };

  // ─── Quick Add Domain ──────────────────────────────────────────────────────

  const handleQuickAdd = async () => {
    const domain = quickDomain.trim().toLowerCase();
    if (!domain || !formPropertyId) {
      if (!formPropertyId) toast.error('No property selected');
      return;
    }

    setQuickAdding(true);
    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Custom: ${domain}`,
          category: 'custom',
          domains: [domain],
          propertyId: formPropertyId,
          enabled: true,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`Domain "${domain}" added to blocklist`);
        setQuickDomain('');
        loadFilters();
      } else {
        toast.error(json.error?.message || 'Failed to add domain');
      }
    } catch {
      toast.error('Network error while adding domain');
    } finally {
      setQuickAdding(false);
    }
  };

  // ─── Bulk Import ───────────────────────────────────────────────────────────

  const handleBulkImport = async () => {
    const domains = parseDomainsFromText(bulkText);
    if (domains.length === 0) {
      toast.error('No domains to import');
      return;
    }
    if (!formPropertyId) {
      toast.error('Please select a property');
      return;
    }

    setBulkImporting(true);
    try {
      const res = await fetch(`${API_BASE}/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domains,
          category: toValidCategory(bulkCategory),
          propertyId: formPropertyId,
        }),
      });
      const json = await res.json();

      if (json.success) {
        toast.success(`Successfully imported ${domains.length} domains`);
        setBulkText('');
        setBulkDialogOpen(false);
        loadFilters();
      } else {
        toast.error(json.error?.message || 'Failed to import domains');
      }
    } catch {
      toast.error('Network error during bulk import');
    } finally {
      setBulkImporting(false);
    }
  };

  // ─── Production Seed Handler ──────────────────────────────────────────────

  const handleSeedProduction = async () => {
    if (!formPropertyId) {
      toast.error('No property selected');
      return;
    }

    setIsSeeding(true);
    try {
      const res = await fetch(`${API_BASE}/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: formPropertyId,
          skipExisting: true,
        }),
      });
      const json = await res.json();

      if (json.success) {
        const { totalAdded, totalSkipped, categoriesProcessed } = json.data;
        toast.success(
          `Production blocklists loaded: ${totalAdded} new domains, ${totalSkipped} existing, ${categoriesProcessed} categories processed`,
          { duration: 5000 },
        );
        if (json.data.syncResult?.success) {
          toast.info(`e2guardian synced: ${json.data.syncResult.domainsWritten} domains written`);
        }
        loadFilters();
        loadSeedInfo();
      } else {
        toast.error(json.error?.message || 'Failed to seed production domains');
      }
    } catch {
      toast.error('Network error while loading production blocklists');
    } finally {
      setIsSeeding(false);
    }
  };

  // ─── Dialog Helpers ────────────────────────────────────────────────────────

  const openAddDialog = () => {
    setFormName('');
    setFormCategory('custom');
    setFormDomainsText('');
    setFormEnabled(true);
    setAddDialogOpen(true);
  };

  const closeAddDialog = () => {
    setAddDialogOpen(false);
    setFormName('');
    setFormDomainsText('');
  };

  const openEditDialog = (filter: ContentFilterItem) => {
    setEditingId(filter.id);
    setFormName(filter.name);
    setFormCategory(filter.category);
    setFormDomainsText(formatDomains(parseDomains(filter.domains)));
    setFormPropertyId(filter.propertyId);
    setFormEnabled(filter.enabled);
    setEditDialogOpen(true);
  };

  const closeEditDialog = () => {
    setEditDialogOpen(false);
    setEditingId(null);
    setFormName('');
    setFormDomainsText('');
  };

  const openDeleteDialog = (filter: ContentFilterItem) => {
    setEditingId(filter.id);
    setFormName(filter.name);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setEditingId(null);
    setFormName('');
  };

  const toggleRowExpand = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ─── Render: Category Badge ────────────────────────────────────────────────

  const renderCategoryBadge = (category: string) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.custom;
    return (
      <Badge variant="outline" className={`${config.badgeClass} border text-xs font-medium`}>
        {config.label}
      </Badge>
    );
  };

  // ─── Render: Skeleton Loading ──────────────────────────────────────────────

  const renderSkeleton = () => (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      {/* Presets skeleton */}
      <Skeleton className="h-20 rounded-lg" />
      {/* Table skeleton */}
      <Skeleton className="h-64 rounded-lg" />
    </div>
  );

  // ─── Render: Empty State ───────────────────────────────────────────────────

  const renderEmpty = () => (
    <Card>
      <CardContent className="py-16 flex flex-col items-center justify-center text-center">
        <div className="rounded-full bg-muted/50 p-5 mb-4">
          <Shield className="h-10 w-10 text-muted-foreground/40" />
        </div>
        <h3 className="text-base font-medium text-foreground/80 mb-1">No content filters found</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          {searchQuery || categoryFilter !== 'all' || statusFilter !== 'all'
            ? 'Try adjusting your search or filter criteria.'
            : 'Add filters or apply presets to start blocking domains for your guest WiFi network.'}
        </p>
        {!searchQuery && categoryFilter === 'all' && statusFilter === 'all' && (
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1.5" /> Add Filter
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  // ─── Render: Quick Preset Buttons ──────────────────────────────────────────

  const renderPresets = () => (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-amber-500" />
            <p className="text-sm font-medium">Quick Presets</p>
            <span className="text-xs text-muted-foreground ml-1">One-click blocklist templates</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESET_KEYS.map((key) => {
              const preset = PRESETS[key];
              const config = CATEGORY_CONFIG[preset.category] || CATEGORY_CONFIG.custom;
              return (
                <TooltipProvider key={key} delayDuration={300}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className={`text-xs ${config.hoverClass} ${config.bgClass}/10 hover:text-white border-transparent`}
                        onClick={() => setPresetDialogKey(key)}
                        disabled={saving || !formPropertyId}
                      >
                        {preset.label}
                        <span className="ml-1 opacity-60">({preset.domains.length})</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Block {preset.domains.length} {preset.label.toLowerCase()} domains</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );

  // ─── Main Render ───────────────────────────────────────────────────────────

  if (isLoading) return renderSkeleton();

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col sm:flex-row justify-between gap-4"
        >
          <div>
            <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Content Filter
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage domain blocklists powered by e2guardian
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* e2guardian Status Badge */}
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-1 ${
                e2guardianConnected
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/25'
              }`}
            >
              {e2guardianConnected ? (
                <><Wifi className="h-3 w-3 mr-1" /> e2guardian Connected</>
              ) : (
                <><WifiOff className="h-3 w-3 mr-1" /> Not Connected</>
              )}
            </Badge>

            {/* Sync Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSyncConfirm(true)}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              Sync
            </Button>

            {/* Add Filter Button */}
            <Button size="sm" onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Filter
            </Button>
          </div>
        </motion.div>

        {/* ── Summary Cards ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            icon={Globe}
            label="Total Domains Blocked"
            value={summaryStats.totalDomains}
            sub="Across all enabled filters"
            delay={0.05}
          />
          <SummaryCard
            icon={ShieldCheck}
            label="Active Filters"
            value={summaryStats.activeFilters}
            sub={`of ${filters.length} total`}
            delay={0.1}
          />
          <SummaryCard
            icon={FileText}
            label="Categories Used"
            value={summaryStats.categoriesUsed}
            sub={`of ${ALL_CATEGORIES.length} available`}
            delay={0.15}
          />
          <SummaryCard
            icon={Clock}
            label="Last Synced"
            value={lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString() : 'Manual'}
            sub={lastSyncAt ? new Date(lastSyncAt).toLocaleDateString() : 'Click Sync to update e2guardian'}
            delay={0.2}
          />
        </div>

        {/* ── Production Blocklist Banner ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.18 }}
        >
          <Card className="border-primary/30 bg-gradient-to-r from-primary/5 via-primary/3 to-transparent">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 mt-0.5">
                    <ShieldCheck className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">Production Domain Blocklists</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {seedInfo
                        ? `${seedInfo.totalAvailable.toLocaleString()} curated domains across ${seedInfo.totalAvailable > 0 ? 12 : 0} categories — sourced from StevenBlack, OISD, hagezi, PhishTank, URLhaus, EasyList`
                        : 'Comprehensive domain blocklists compiled from industry-leading security sources'}
                    </p>
                    {seedInfo && seedInfo.seededCategories > 0 && (
                      <p className="text-xs text-primary mt-1">
                        <CheckCircle2 className="h-3 w-3 inline mr-1" />
                        {seedInfo.seededCategories} categories already loaded
                        {seedInfo.unseededCategories > 0 && ` · ${seedInfo.unseededCategories} remaining`}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleSeedProduction}
                  disabled={isSeeding || !formPropertyId || (seedInfo?.unseededCategories === 0 && seedInfo?.seededCategories > 0)}
                  className="shrink-0"
                >
                  {isSeeding ? (
                    <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Loading...</>
                  ) : seedInfo?.seededCategories > 0 && seedInfo?.unseededCategories === 0 ? (
                    <><CheckCircle2 className="h-4 w-4 mr-1.5" /> All Loaded</>
                  ) : (
                    <><Zap className="h-4 w-4 mr-1.5" /> Load Production Blocklists</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Quick Presets ──────────────────────────────────────────────── */}
        {renderPresets()}

        {/* ── Search & Filters Toolbar ───────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
        >
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or domain..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>

                {/* Category Dropdown */}
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-full sm:w-44 h-9">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {ALL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_CONFIG[cat]?.label || cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-36 h-9">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="enabled">Enabled</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Whitelisted Domains (Admin Override) ────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.28 }}
        >
          <Card className="border-border/50 border-primary/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Whitelisted Domains</span>
                  <Badge variant="secondary" className="text-xs tabular-nums font-mono bg-primary/10 text-primary border-primary/20">
                    {whitelistedDomains.length}
                  </Badge>
                </div>
                <span className="text-[10px] text-muted-foreground">Whitelisted domains bypass all category blocklists</span>
              </div>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="e.g. trusted-site.com"
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const domain = whitelistInput.trim().toLowerCase();
                        if (domain && !whitelistedDomains.includes(domain)) {
                          setWhitelistedDomains(prev => [...prev, domain]);
                          setWhitelistInput('');
                          toast.success(`Domain "${domain}" added to whitelist`);
                        } else if (whitelistedDomains.includes(domain)) {
                          toast.error('Domain already in whitelist');
                        }
                      }
                    }}
                    className="pl-9 h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    const domain = whitelistInput.trim().toLowerCase();
                    if (!domain) return;
                    if (whitelistedDomains.includes(domain)) {
                      toast.error('Domain already in whitelist');
                      return;
                    }
                    setWhitelistedDomains(prev => [...prev, domain]);
                    setWhitelistInput('');
                    toast.success(`Domain "${domain}" added to whitelist`);
                  }}
                  className="h-8 text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
              {whitelistedDomains.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {whitelistedDomains.map((domain) => (
                    <div
                      key={domain}
                      className="inline-flex items-center gap-1.5 bg-primary/5 border border-primary/15 rounded-md px-2.5 py-1"
                    >
                      <Globe className="h-3 w-3 text-primary/60" />
                      <span className="text-xs font-mono text-primary/80">{domain}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          setWhitelistedDomains(prev => prev.filter(d => d !== domain));
                          toast.success(`Domain "${domain}" removed from whitelist`);
                        }}
                      >
                        <XCircle className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Quick Add Domain ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
        >
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">Quick Add Domain</span>
              </div>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Type a domain and press Enter (e.g. example.com)"
                    value={quickDomain}
                    onChange={(e) => setQuickDomain(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleQuickAdd();
                    }}
                    className="pl-9 h-8 text-sm font-mono"
                    disabled={quickAdding || !formPropertyId}
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleQuickAdd}
                  disabled={quickAdding || !quickDomain.trim() || !formPropertyId}
                  className="h-8 text-xs"
                >
                  {quickAdding ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-3.5 w-3.5 mr-1" />
                  )}
                  Add
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBulkText('');
                    setBulkCategory('custom');
                    setBulkDialogOpen(true);
                  }}
                  disabled={!formPropertyId}
                  className="h-8 text-xs"
                >
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  Bulk Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Data Table ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
        >
          <Card className="border-border/50">
            <CardContent className="p-0">
              {filteredFilters.length === 0 ? (
                renderEmpty()
              ) : (
                <div className="max-h-[500px] overflow-auto custom-scrollbar">
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-8" />
                        <TableHead>Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-center">Domains</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead>Property</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence mode="popLayout">
                        {filteredFilters.map((filter) => {
                          const domains = parseDomains(filter.domains);
                          const isExpanded = expandedRows.has(filter.id);
                          const propertyName =
                            filter.propertyName ||
                            properties.find((p) => p.id === filter.propertyId)?.name ||
                            '—';
                          const config = CATEGORY_CONFIG[filter.category] || CATEGORY_CONFIG.custom;

                          return (
                            <React.Fragment key={filter.id}>
                              <TableRow className="group">
                                {/* Expand/Collapse */}
                                <TableCell className="w-8 px-2">
                                  {domains.length > 0 && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => toggleRowExpand(filter.id)}
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                    </Button>
                                  )}
                                </TableCell>

                                {/* Name */}
                                <TableCell>
                                  <span className="font-medium text-sm">{filter.name}</span>
                                </TableCell>

                                {/* Category */}
                                <TableCell>{renderCategoryBadge(filter.category)}</TableCell>

                                {/* Domains Count */}
                                <TableCell className="text-center">
                                  <Badge variant="secondary" className="text-xs tabular-nums font-mono">
                                    {domains.length}
                                  </Badge>
                                </TableCell>

                                {/* Status Switch */}
                                <TableCell className="text-center">
                                  <Switch
                                    checked={filter.enabled}
                                    onCheckedChange={() => handleToggle(filter)}
                                    aria-label={`Toggle ${filter.name}`}
                                  />
                                </TableCell>

                                {/* Property */}
                                <TableCell>
                                  <span className="text-xs text-muted-foreground">{propertyName}</span>
                                </TableCell>

                                {/* Created */}
                                <TableCell>
                                  <span className="text-xs text-muted-foreground">
                                    {formatDate(filter.createdAt)}
                                  </span>
                                </TableCell>

                                {/* Actions */}
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => openEditDialog(filter)}
                                    >
                                      <Edit className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                      onClick={() => openDeleteDialog(filter)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* Expanded Domains */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <TableRow className="bg-muted/30">
                                    <TableCell colSpan={8} className="py-1 px-8">
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="flex flex-wrap gap-x-4 gap-y-1 py-2">
                                          {domains.map((domain, idx) => (
                                            <span
                                              key={idx}
                                              className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground"
                                            >
                                              <span
                                                className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                                                style={{ backgroundColor: config.color }}
                                              />
                                              {domain}
                                            </span>
                                          ))}
                                        </div>
                                      </motion.div>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </AnimatePresence>
                            </React.Fragment>
                          );
                        })}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Add/Edit Dialog ────────────────────────────────────────────── */}
        <Dialog
          open={addDialogOpen || editDialogOpen}
          onOpenChange={(open) => {
            if (!open) {
              if (addDialogOpen) closeAddDialog();
              else closeEditDialog();
            }
          }}
        >
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {addDialogOpen ? 'Add Content Filter' : 'Edit Content Filter'}
              </DialogTitle>
              <DialogDescription>
                {addDialogOpen
                  ? 'Create a new domain blocklist filter for your WiFi network.'
                  : 'Update the content filter settings and domain list.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="filter-name">Name *</Label>
                <Input
                  id="filter-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Social Media Block"
                />
              </div>

              {/* Category + Property */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select value={formCategory} onValueChange={setFormCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {CATEGORY_CONFIG[cat]?.label || cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Property</Label>
                  <Select value={formPropertyId} onValueChange={setFormPropertyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select property" />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Domains Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="filter-domains">Domains</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formDomainsCount} domain{formDomainsCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <Textarea
                  id="filter-domains"
                  value={formDomainsText}
                  onChange={(e) => setFormDomainsText(e.target.value)}
                  placeholder={"One domain per line:\nfacebook.com\ninstagram.com\ntwitter.com"}
                  className="font-mono text-sm min-h-[120px] resize-y"
                />
                <p className="text-xs text-muted-foreground">
                  Enter one domain per line. Supports bulk paste.
                </p>
              </div>

              {/* Enabled Switch */}
              <div className="flex items-center space-x-3 pt-1">
                <Switch
                  id="filter-enabled"
                  checked={formEnabled}
                  onCheckedChange={setFormEnabled}
                />
                <Label htmlFor="filter-enabled" className="text-sm cursor-pointer">
                  Enable this filter
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  if (addDialogOpen) closeAddDialog();
                  else closeEditDialog();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={addDialogOpen ? handleCreate : handleUpdate}
                disabled={saving || !formName.trim()}
              >
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                {addDialogOpen ? 'Create Filter' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Delete Confirmation Dialog ─────────────────────────────────── */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => !open && closeDeleteDialog()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Content Filter</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>&quot;{formName}&quot;</strong>? This will remove
                all {formName && editingId ? parseDomains(filters.find((f) => f.id === editingId)?.domains || '[]').length : 0} blocked domain(s) from the filter.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Preset Confirmation Dialog ─────────────────────────────────── */}
        <AlertDialog open={!!presetDialogKey} onOpenChange={(open) => !open && setPresetDialogKey(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply Preset: {presetDialogKey ? PRESETS[presetDialogKey]?.label : ''}</AlertDialogTitle>
              <AlertDialogDescription>
                {presetDialogKey && (
                  <>
                    This will create a new content filter called{' '}
                    <strong>&quot;{PRESETS[presetDialogKey].label}&quot;</strong> with{' '}
                    <strong>{PRESETS[presetDialogKey].domains.length}</strong> pre-configured domains.
                    {properties.length > 0 && (
                      <span className="block mt-2 text-muted-foreground">
                        Property: <strong>{properties.find((p) => p.id === formPropertyId)?.name || formPropertyId}</strong>
                      </span>
                    )}
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => presetDialogKey && handleApplyPreset(presetDialogKey)}
                disabled={saving || !formPropertyId}
              >
                {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Apply Preset
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* ── Bulk Import Dialog ─────────────────────────────────────────── */}
        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Bulk Import Domains</DialogTitle>
              <DialogDescription>
                Paste a list of domains (one per line) to import as a single content filter.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Category Select */}
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={bulkCategory} onValueChange={setBulkCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_CONFIG[cat]?.label || cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Bulk Domains Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label>Domains</Label>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {bulkDomainsCount} domain{bulkDomainsCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <Textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Paste domains here, one per line:\nexample.com\nanother-site.org\ndomain.net"}
                  className="font-mono text-sm min-h-[200px] resize-y"
                />
              </div>

              {/* Progress Indicator */}
              {bulkImporting && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Importing {bulkDomainsCount} domains...</span>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setBulkDialogOpen(false)}
                disabled={bulkImporting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkImport}
                disabled={bulkImporting || bulkDomainsCount === 0}
              >
                {bulkImporting && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Import {bulkDomainsCount} Domain{bulkDomainsCount !== 1 ? 's' : ''}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      {/* ── Sync Confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={syncConfirm} onOpenChange={setSyncConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sync blocklists to e2guardian?</AlertDialogTitle>
            <AlertDialogDescription>
              This will push all active content filter blocklists to the e2guardian service.
              Filtering changes take effect immediately for all connected users.
              {summaryStats.totalDomains > 0 && (
                <span className="block mt-2 text-muted-foreground">
                  {summaryStats.totalDomains} domains across {summaryStats.activeFilters} active filter{summaryStats.activeFilters !== 1 ? 's' : ''} will be synced.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSync} disabled={isSyncing}>
              {isSyncing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Sync Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
