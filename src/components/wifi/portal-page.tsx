'use client';

// ═══════════════════════════════════════════════════════════════════════════════
// Captive Portal — Powerful Portal Designer with Templates, Layouts & Live Preview
// ═══════════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Palette,
  Plus,
  Edit2,
  Trash2,
  Copy,
  Eye,
  Settings,
  Lock,
  Unlock,
  Smartphone,
  Ticket,
  Building,
  User,
  Zap,
  Monitor,
  CheckCircle2,
  XCircle,
  Save,
  RotateCcw,
  AlertTriangle,
  Printer,
  QrCode,
  UserRound,
  Wifi,
  Mail,
  Calendar,
  Clock,
  ScanLine,
  Layout,
  Type,
  Image,
  ImagePlus,
  Loader2,
  FormInput,
  Sparkles,
  Tablet,
  Star,
  MapPin,
  Phone,
  Globe,
  Instagram,
  Facebook,
  Twitter,
  Coffee,
  Waves,
  Dumbbell,
  UtensilsCrossed,
  Car,
  ArrowRight,
  ArrowRightLeft,
  Layers,
  Wand2,
  ShieldCheck,
  Download,
  Upload,
  ArrowDownToLine,
  ArrowUpFromLine,
  Router,
  RefreshCw,
  Undo2,
  Redo2,
  ChevronUp,
  ChevronDown,
  BarChart3,
  ExternalLink,
  PlusCircle,
  MinusCircle,
  Languages,
  Megaphone,
  MessageSquare,
  Thermometer,
  FileText,
  GripVertical,
  CalendarDays,
  Linkedin,
  Youtube,
  MessageCircle,
  Tv,
  Wine,
  Baby,
  Plane,
  Bath,
  Shirt,
  Music,
  Camera,
  Umbrella,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { usePropertyId } from '@/hooks/use-property';
import dynamic from 'next/dynamic';

const PrintCard = dynamic(() => import('@/components/wifi/print-card').then(m => ({ default: m.PrintCard as any })), { ssr: false });
const PortalWhitelist = dynamic(() => import('@/components/wifi/portal-whitelist'), { ssr: false });
const PortalMappings = dynamic(() => import('@/components/wifi/portal-mappings-tab'), { ssr: false });

// ═══════════════════════════════════════════════════════════════════════════════
// Static Config — Credential Format Mapping
// ═══════════════════════════════════════════════════════════════════════════════

type CredentialCategory = 'room' | 'name' | 'contact' | 'email' | 'document' | 'booking' | 'custom';

const CREDENTIAL_FORMAT_MAP: Record<string, CredentialCategory> = {
  room_random: 'room', room_only: 'room', lastname_room: 'room',
  firstinitial_lastname_room: 'room', lastname_firstinitial_room: 'room',
  firstinitial_lastname: 'name', lastname_random: 'name',
  mobile: 'contact', last4_mobile: 'contact', mobile_random: 'contact',
  email_prefix: 'email', passport: 'document', booking_id: 'booking', custom_prefix: 'custom',
};

interface AutoFields {
  firstName: boolean; lastName: boolean; roomNumber: boolean;
  phone: boolean; email: boolean; passport: boolean; bookingId: boolean;
  username: boolean; password: boolean; voucherCode: boolean; terms: boolean;
}

function getAutoFields(category: CredentialCategory): AutoFields {
  const base: AutoFields = { firstName: false, lastName: false, roomNumber: false, phone: false, email: false, passport: false, bookingId: false, username: true, password: true, voucherCode: false, terms: true };
  switch (category) {
    case 'room': return { ...base, roomNumber: true };
    case 'name': return { ...base, firstName: true, lastName: true };
    case 'contact': return { ...base, phone: true };
    case 'email': return { ...base, email: true };
    case 'document': return { ...base, passport: true };
    case 'booking': return { ...base, bookingId: true };
    default: return base;
  }
}

// Auth flow → default field configuration (auto-suggests when admin changes auth flow)
const AUTH_FLOW_FIELD_DEFAULTS: Record<string, AutoFields> = {
  pms_credentials: { firstName: false, lastName: false, roomNumber: false, phone: false, email: false, passport: false, bookingId: false, username: true, password: true, voucherCode: false, terms: true },
  room_number:     { firstName: false, lastName: true,  roomNumber: true,  phone: false, email: false, passport: false, bookingId: false, username: false, password: false, voucherCode: false, terms: true },
  voucher:         { firstName: false, lastName: false, roomNumber: false, phone: false, email: false, passport: false, bookingId: false, username: false, password: false, voucherCode: true, terms: true },
  sms_otp:         { firstName: false, lastName: false, roomNumber: false, phone: true,  email: false, passport: false, bookingId: false, username: false, password: false, voucherCode: false, terms: true },
  open_access:     { firstName: false, lastName: false, roomNumber: false, phone: false, email: false, passport: false, bookingId: false, username: false, password: false, voucherCode: false, terms: true },
};

const CREDENTIAL_CATEGORY_LABELS: Record<CredentialCategory, string> = {
  room: 'Room-Based', name: 'Name-Based', contact: 'Contact-Based',
  email: 'Email-Based', document: 'Document-Based', booking: 'Booking-Based', custom: 'Custom',
};

// ═══════════════════════════════════════════════════════════════════════════════
// Template System — 8 Pre-Built Hotel Themes
// ═══════════════════════════════════════════════════════════════════════════════

interface DesignSettings {
  layoutType: 'centered' | 'split_left' | 'split_right' | 'card' | 'full_bleed';
  backgroundType: 'solid' | 'gradient' | 'image';
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  backgroundOverlay: number;
  fontFamily: string;
  headingFontFamily: string;
  formStyle: 'rounded' | 'square' | 'glass' | 'pill' | 'minimal';
  inputStyle: 'rounded' | 'square' | 'pill' | 'underline';
  buttonStyle: 'filled' | 'outlined' | 'gradient' | 'pill' | 'rounded';
  buttonSize: 'small' | 'medium' | 'large';
  cardShadow: 'none' | 'small' | 'medium' | 'large';
  animationType: 'none' | 'fade' | 'slide_up' | 'zoom';
  logoSize: 'small' | 'medium' | 'large';
  welcomeMessage: string;
  hotelName: string;
  hotelAddress: string;
  hotelPhone: string;
  hotelWebsite: string;
  showHotelInfo: boolean;
  amenities: string[];
  showAmenities: boolean;
  showSocialMedia: boolean;
  socialLinks: Array<{ platform: string; url: string }>;
  showClock: boolean;
  showWeather: boolean;
  promotionTitle: string;
  promotionDesc: string;
  showPromotion: boolean;
  // Feature 1: Multi-Language
  enableMultiLanguage: boolean;
  languages: string[];
  defaultLanguage: string;
  translations: Record<string, Record<string, string>>;
  // Feature 2: Marketing Opt-In
  marketingOptIn: { enabled: boolean; emailConsent: boolean; phoneConsent: boolean; consentText: string };
  // Feature 3: Carousel
  useCarouselMode: boolean;
  promotions: Array<{ title: string; description: string; imageUrl: string; linkUrl: string; bgColor: string }>;
  // Feature 4: Survey
  surveyConfig: { enabled: boolean; question: string; options: string[]; thankYouMessage: string };
  // Feature 5: Weather
  weatherLocation: string;
  // Feature 6: Terms
  termsText: string;
  termsUrl: string;
  // Feature 7: Custom Amenities
  customAmenities: Array<{ name: string; icon: string }>;
  // Feature 9: Content Block Order
  contentBlockOrder: string[];
  // Feature 14: Scheduling
  scheduleConfig: { enabled: boolean; schedules: Array<{ name: string; days: boolean[]; startTime: string; endTime: string }> };
}

const DEFAULT_CONTENT_BLOCKS = ['promotion', 'logo', 'title', 'hotelInfo', 'form', 'amenities', 'social', 'clock', 'weather'];

const DEFAULT_SETTINGS: DesignSettings = {
  layoutType: 'centered', backgroundType: 'solid',
  gradientFrom: '#0f766e', gradientTo: '#134e4a', gradientAngle: 135,
  backgroundOverlay: 40, fontFamily: 'Inter', headingFontFamily: 'Inter',
  formStyle: 'rounded', inputStyle: 'rounded', buttonStyle: 'filled',
  buttonSize: 'medium', cardShadow: 'medium', animationType: 'fade', logoSize: 'large',
  welcomeMessage: 'Enjoy your stay with us',
  hotelName: 'StaySuite Hotel', hotelAddress: '123 Hospitality Ave', hotelPhone: '+1-555-0100', hotelWebsite: 'www.staysuite.com',
  showHotelInfo: false,
  amenities: ['Free WiFi', 'Swimming Pool', 'Spa & Wellness', 'Restaurant', 'Fitness Center', 'Room Service'],
  showAmenities: false, showSocialMedia: false,
  socialLinks: [{ platform: 'instagram', url: '' }, { platform: 'facebook', url: '' }, { platform: 'twitter', url: '' },
    { platform: 'linkedin', url: '' }, { platform: 'youtube', url: '' }, { platform: 'tripadvisor', url: '' }, { platform: 'whatsapp', url: '' }, { platform: 'tiktok', url: '' }],
  showClock: false, showWeather: false,
  promotionTitle: 'Special Offer', promotionDesc: 'Book 3 nights, get the 4th free!', showPromotion: false,
  // Feature 1: Multi-Language
  enableMultiLanguage: false, languages: ['en'], defaultLanguage: 'en', translations: {},
  // Feature 2: Marketing Opt-In
  marketingOptIn: { enabled: false, emailConsent: true, phoneConsent: false, consentText: 'I agree to receive promotional offers and updates from the hotel' },
  // Feature 3: Carousel
  useCarouselMode: false, promotions: [{ title: 'Special Offer', description: 'Book 3 nights, get the 4th free!', imageUrl: '', linkUrl: '', bgColor: '#f59e0b' }],
  // Feature 4: Survey
  surveyConfig: { enabled: false, question: 'How was your stay?', options: ['Excellent', 'Good', 'Average', 'Poor'], thankYouMessage: 'Thank you for your feedback!' },
  // Feature 5: Weather
  weatherLocation: '',
  // Feature 6: Terms
  termsText: '', termsUrl: '',
  // Feature 7: Custom Amenities
  customAmenities: [],
  // Feature 9: Content Block Order
  contentBlockOrder: [...DEFAULT_CONTENT_BLOCKS],
  // Feature 14: Scheduling
  scheduleConfig: { enabled: false, schedules: [] },
};

interface PortalTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  design: Partial<DesignSettings>;
  colors: { bg: string; text: string; accent: string; gradientFrom?: string; gradientTo?: string };
  preview: string; // CSS gradient for thumbnail
}

const PORTAL_TEMPLATES: PortalTemplate[] = [
  {
    id: 'luxury', name: 'Luxury Hotel', category: 'Premium', description: 'Dark elegance with gold accents and serif typography',
    design: { layoutType: 'split_left', backgroundType: 'solid', fontFamily: 'Inter', headingFontFamily: 'Playfair Display', formStyle: 'glass', inputStyle: 'underline', buttonStyle: 'pill', buttonSize: 'large', cardShadow: 'large', animationType: 'fade' },
    colors: { bg: '#1a1a2e', text: '#f5f5f5', accent: '#d4af37', gradientFrom: '#1a1a2e', gradientTo: '#16213e' },
    preview: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  },
  {
    id: 'resort', name: 'Modern Resort', category: 'Premium', description: 'Vibrant tropical gradients with rounded playful elements',
    design: { layoutType: 'centered', backgroundType: 'gradient', gradientFrom: '#0ea5e9', gradientTo: '#8b5cf6', gradientAngle: 135, fontFamily: 'Poppins', headingFontFamily: 'Poppins', formStyle: 'pill', inputStyle: 'pill', buttonStyle: 'pill', buttonSize: 'large', cardShadow: 'large', animationType: 'zoom' },
    colors: { bg: '#0ea5e9', text: '#ffffff', accent: '#8b5cf6', gradientFrom: '#0ea5e9', gradientTo: '#8b5cf6' },
    preview: 'linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 100%)',
  },
  {
    id: 'business', name: 'Business Hotel', category: 'Corporate', description: 'Clean, professional look with sharp lines',
    design: { layoutType: 'card', backgroundType: 'solid', fontFamily: 'Inter', headingFontFamily: 'Inter', formStyle: 'square', inputStyle: 'rounded', buttonStyle: 'rounded', buttonSize: 'medium', cardShadow: 'medium', animationType: 'fade' },
    colors: { bg: '#f8fafc', text: '#1e293b', accent: '#2563eb', gradientFrom: '#f8fafc', gradientTo: '#e2e8f0' },
    preview: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
  },
  {
    id: 'boutique', name: 'Boutique Hotel', category: 'Lifestyle', description: 'Warm earth tones with artistic, unique personality',
    design: { layoutType: 'split_right', backgroundType: 'gradient', gradientFrom: '#92400e', gradientTo: '#78350f', gradientAngle: 160, fontFamily: 'Lato', headingFontFamily: 'Merriweather', formStyle: 'rounded', inputStyle: 'rounded', buttonStyle: 'filled', buttonSize: 'medium', cardShadow: 'large', animationType: 'slide_up' },
    colors: { bg: '#92400e', text: '#fef3c7', accent: '#f59e0b', gradientFrom: '#92400e', gradientTo: '#78350f' },
    preview: 'linear-gradient(135deg, #92400e 0%, #78350f 100%)',
  },
  {
    id: 'beach', name: 'Beach Resort', category: 'Lifestyle', description: 'Ocean-inspired blues with sandy warm accents',
    design: { layoutType: 'full_bleed', backgroundType: 'gradient', gradientFrom: '#0369a1', gradientTo: '#065f46', gradientAngle: 180, fontFamily: 'Open Sans', headingFontFamily: 'Montserrat', formStyle: 'glass', inputStyle: 'rounded', buttonStyle: 'pill', buttonSize: 'large', cardShadow: 'none', animationType: 'fade' },
    colors: { bg: '#0369a1', text: '#ffffff', accent: '#22d3ee', gradientFrom: '#0369a1', gradientTo: '#065f46' },
    preview: 'linear-gradient(180deg, #0369a1 0%, #065f46 100%)',
  },
  {
    id: 'mountain', name: 'Mountain Lodge', category: 'Lifestyle', description: 'Forest greens with cozy warm wood tones',
    design: { layoutType: 'card', backgroundType: 'gradient', gradientFrom: '#14532d', gradientTo: '#1c1917', gradientAngle: 150, fontFamily: 'Lato', headingFontFamily: 'Merriweather', formStyle: 'rounded', inputStyle: 'rounded', buttonStyle: 'rounded', buttonSize: 'medium', cardShadow: 'large', animationType: 'fade' },
    colors: { bg: '#14532d', text: '#fefce8', accent: '#a3e635', gradientFrom: '#14532d', gradientTo: '#1c1917' },
    preview: 'linear-gradient(150deg, #14532d 0%, #1c1917 100%)',
  },
  {
    id: 'urban', name: 'City Hotel', category: 'Modern', description: 'Sleek dark theme with neon accent highlights',
    design: { layoutType: 'centered', backgroundType: 'solid', fontFamily: 'Inter', headingFontFamily: 'Inter', formStyle: 'minimal', inputStyle: 'underline', buttonStyle: 'filled', buttonSize: 'medium', cardShadow: 'none', animationType: 'slide_up' },
    colors: { bg: '#09090b', text: '#fafafa', accent: '#06b6d4', gradientFrom: '#09090b', gradientTo: '#18181b' },
    preview: 'linear-gradient(135deg, #09090b 0%, #18181b 100%)',
  },
  {
    id: 'minimal', name: 'Clean Minimal', category: 'Modern', description: 'Ultra-clean white design with subtle teal accents',
    design: { layoutType: 'centered', backgroundType: 'solid', fontFamily: 'Inter', headingFontFamily: 'Inter', formStyle: 'rounded', inputStyle: 'rounded', buttonStyle: 'filled', buttonSize: 'medium', cardShadow: 'small', animationType: 'none' },
    colors: { bg: '#ffffff', text: '#18181b', accent: '#0d9488', gradientFrom: '#ffffff', gradientTo: '#f0fdfa' },
    preview: 'linear-gradient(135deg, #ffffff 0%, #f0fdfa 100%)',
  },
];

// ── Layout Options ────────────────────────────────────────────────────────────

const LAYOUT_OPTIONS = [
  { value: 'centered' as const, label: 'Centered', desc: 'Form centered on background' },
  { value: 'split_left' as const, label: 'Split Left', desc: 'Image left, form right' },
  { value: 'split_right' as const, label: 'Split Right', desc: 'Form left, image right' },
  { value: 'card' as const, label: 'Floating Card', desc: 'Card floating over background' },
  { value: 'full_bleed' as const, label: 'Full Bleed', desc: 'Full-screen image with overlay' },
];

const FONT_OPTIONS = [
  { value: 'Inter', label: 'Inter', style: 'font-sans' },
  { value: 'Poppins', label: 'Poppins', style: 'font-sans' },
  { value: 'Montserrat', label: 'Montserrat', style: 'font-sans' },
  { value: 'Open Sans', label: 'Open Sans', style: 'font-sans' },
  { value: 'Lato', label: 'Lato', style: 'font-sans' },
  { value: 'Roboto', label: 'Roboto', style: 'font-sans' },
  { value: 'Playfair Display', label: 'Playfair Display', style: 'font-serif' },
  { value: 'Merriweather', label: 'Merriweather', style: 'font-serif' },
];

const FORM_STYLES = [
  { value: 'rounded' as const, label: 'Rounded' },
  { value: 'square' as const, label: 'Square' },
  { value: 'glass' as const, label: 'Glass' },
  { value: 'pill' as const, label: 'Pill' },
  { value: 'minimal' as const, label: 'Minimal' },
];

const INPUT_STYLES = [
  { value: 'rounded' as const, label: 'Rounded' },
  { value: 'square' as const, label: 'Square' },
  { value: 'pill' as const, label: 'Pill' },
  { value: 'underline' as const, label: 'Underline' },
];

const BUTTON_STYLES = [
  { value: 'filled' as const, label: 'Filled' },
  { value: 'outlined' as const, label: 'Outlined' },
  { value: 'gradient' as const, label: 'Gradient' },
  { value: 'pill' as const, label: 'Pill' },
  { value: 'rounded' as const, label: 'Rounded' },
];

const AMENITY_ICONS: Record<string, typeof Wifi> = {
  'Free WiFi': Wifi, 'Swimming Pool': Waves, 'Spa & Wellness': Sparkles,
  'Restaurant': UtensilsCrossed, 'Fitness Center': Dumbbell, 'Room Service': Coffee,
  'Parking': Car, 'Concierge': Star,
};

// ── New Feature Constants ──────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English', flag: '🇬🇧' },
  { value: 'es', label: 'Español', flag: '🇪🇸' },
  { value: 'fr', label: 'Français', flag: '🇫🇷' },
  { value: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { value: 'zh', label: '中文', flag: '🇨🇳' },
  { value: 'ja', label: '日本語', flag: '🇯🇵' },
  { value: 'ko', label: '한국어', flag: '🇰🇷' },
  { value: 'ar', label: 'العربية', flag: '🇸🇦' },
  { value: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { value: 'pt', label: 'Português', flag: '🇧🇷' },
  { value: 'ru', label: 'Русский', flag: '🇷🇺' },
  { value: 'it', label: 'Italiano', flag: '🇮🇹' },
  { value: 'nl', label: 'Nederlands', flag: '🇳🇱' },
  { value: 'th', label: 'ไทย', flag: '🇹🇭' },
  { value: 'vi', label: 'Tiếng Việt', flag: '🇻🇳' },
  { value: 'tr', label: 'Türkçe', flag: '🇹🇷' },
];

const CUSTOM_AMENITY_ICONS: Record<string, typeof Wifi> = {
  Wifi, Waves, Sparkles, UtensilsCrossed, Dumbbell, Coffee, Car, Star,
  Tv, Wine, Baby, Plane, Bath, Shirt, Music, Camera, Umbrella,
};

const CUSTOM_AMENITY_ICON_OPTIONS = [
  { value: 'Wifi', label: 'WiFi' },
  { value: 'Waves', label: 'Pool' },
  { value: 'Sparkles', label: 'Spa' },
  { value: 'UtensilsCrossed', label: 'Restaurant' },
  { value: 'Dumbbell', label: 'Gym' },
  { value: 'Coffee', label: 'Room Service' },
  { value: 'Car', label: 'Parking' },
  { value: 'Star', label: 'Concierge' },
  { value: 'Tv', label: 'TV' },
  { value: 'Wine', label: 'Wine Bar' },
  { value: 'Baby', label: 'Kids Club' },
  { value: 'Plane', label: 'Airport Shuttle' },
  { value: 'Bath', label: 'Bathtub' },
  { value: 'Shirt', label: 'Laundry' },
  { value: 'Music', label: 'Music' },
  { value: 'Camera', label: 'Photo' },
  { value: 'Umbrella', label: 'Beach' },
];

const SOCIAL_PLATFORM_OPTIONS = [
  { value: 'instagram', label: 'Instagram', icon: Instagram, color: 'text-pink-500 dark:text-pink-400' },
  { value: 'facebook', label: 'Facebook', icon: Facebook, color: 'text-blue-600 dark:text-blue-400' },
  { value: 'twitter', label: 'Twitter / X', icon: Twitter, color: 'text-sky-500 dark:text-sky-400' },
  { value: 'linkedin', label: 'LinkedIn', icon: Linkedin, color: 'text-blue-700 dark:text-blue-300' },
  { value: 'youtube', label: 'YouTube', icon: Youtube, color: 'text-red-500 dark:text-red-400' },
  { value: 'tripadvisor', label: 'TripAdvisor', icon: MessageCircle, color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'whatsapp', label: 'WhatsApp', icon: Smartphone, color: 'text-green-500 dark:text-green-400' },
  { value: 'tiktok', label: 'TikTok', icon: Tv, color: 'text-gray-800 dark:text-gray-200' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CONTENT_BLOCK_LABELS: Record<string, string> = {
  promotion: 'Promotion', logo: 'Logo', title: 'Title', hotelInfo: 'Hotel Info',
  form: 'Login Form', amenities: 'Amenities', social: 'Social Media',
  clock: 'Clock', weather: 'Weather',
};

// ── Tab Definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: 'portals', label: 'Portal Instances', icon: Monitor },
  { id: 'mappings', label: 'Pool Mappings', icon: ArrowRightLeft },
  { id: 'designer', label: 'Portal Designer', icon: Palette },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'vouchers', label: 'Voucher Designer', icon: Ticket },
  { id: 'print-cards', label: 'Print Cards', icon: Printer },
  { id: 'whitelist', label: 'Walled Garden', icon: ShieldCheck },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ── Designer Sub-Tab Definitions ──────────────────────────────────────────────

const DESIGNER_SUBTABS = [
  { id: 'templates', label: 'Templates', icon: Sparkles },
  { id: 'layout', label: 'Layout', icon: Layout },
  { id: 'background', label: 'Background', icon: Image },
  { id: 'typography', label: 'Typography', icon: Type },
  { id: 'formstyle', label: 'Form & Button', icon: FormInput },
  { id: 'content', label: 'Content', icon: Layers },
  { id: 'fields', label: 'Fields', icon: Settings },
  { id: 'advanced', label: 'Advanced', icon: Wand2 },
] as const;

type DesignerSubTab = (typeof DESIGNER_SUBTABS)[number]['id'];

// ── Auth Flow Options ─────────────────────────────────────────────────────────

const AUTH_FLOW_OPTIONS = [
  { value: 'pms_credentials', label: 'PMS Credentials', icon: User, color: 'text-teal-500 dark:text-teal-400' },
  { value: 'room_number', label: 'Room Number', icon: Building, color: 'text-emerald-500 dark:text-emerald-400' },
  { value: 'voucher', label: 'Voucher', icon: Ticket, color: 'text-amber-500 dark:text-amber-400' },
  { value: 'sms_otp', label: 'SMS OTP', icon: Smartphone, color: 'text-rose-500 dark:text-rose-400' },
  { value: 'open_access', label: 'Open Access', icon: Unlock, color: 'text-gray-500' },
] as const;

const VOUCHER_TEMPLATES = [
  { value: 'default', label: 'Default', desc: 'Clean white card with teal accent' },
  { value: 'elegant', label: 'Elegant', desc: 'Subtle gradients with refined borders' },
  { value: 'minimal', label: 'Minimal', desc: 'Ultra-clean with minimal elements' },
  { value: 'luxury', label: 'Luxury', desc: 'Dark background with gold accents' },
] as const;

const FIELD_DEFINITIONS: Array<{ key: keyof AutoFields; label: string; icon: typeof User; group: string }> = [
  { key: 'firstName', label: 'First Name', icon: User, group: 'Guest Identity' },
  { key: 'lastName', label: 'Last Name', icon: User, group: 'Guest Identity' },
  { key: 'roomNumber', label: 'Room Number', icon: Building, group: 'Guest Identity' },
  { key: 'phone', label: 'Phone Number', icon: Smartphone, group: 'Guest Identity' },
  { key: 'email', label: 'Email Address', icon: Mail, group: 'Guest Identity' },
  { key: 'passport', label: 'Passport / ID', icon: ScanLine, group: 'Guest Identity' },
  { key: 'bookingId', label: 'Booking ID', icon: Calendar, group: 'Guest Identity' },
  { key: 'username', label: 'Username', icon: User, group: 'Credentials' },
  { key: 'password', label: 'Password', icon: Lock, group: 'Credentials' },
  { key: 'voucherCode', label: 'Voucher Code', icon: Ticket, group: 'Credentials' },
  { key: 'terms', label: 'Terms & Conditions', icon: Settings, group: 'Legal' },
];

// ═══════════════════════════════════════════════════════════════════════════════
// API Helpers
// ═══════════════════════════════════════════════════════════════════════════════

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const result = await res.json();
    if (result.success) return result.data as T;
    return null;
  } catch (e) {
    console.error('API fetch error:', e);
    return null;
  }
}

async function apiMutate<T>(url: string, options?: RequestInit): Promise<{ data: T | null; error: string | null }> {
  try {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
    const result = await res.json();
    if (result.success) return { data: result.data as T, error: null };
    return { data: null, error: result.error?.message || 'Request failed' };
  } catch (e) {
    console.error('API mutate error:', e);
    return { data: null, error: (e as Error).message || 'Network error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export default function PortalPage() {
  const [activeTab, setActiveTab] = useState<TabId>('portals');
  const [portalOptions, setPortalOptions] = useState<Array<{ id: string; name: string }>>([]);
  const activeTabRef = useRef<HTMLButtonElement>(null);

  // Auto-scroll tab bar to active tab
  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeTab]);

  const fetchPortalOptions = useCallback(async () => {
    const data = await apiFetch<any[]>('/api/wifi/portal/instances');
    if (data) setPortalOptions(data.map((p: any) => ({ id: p.id, name: p.name })));
  }, []);

  useEffect(() => { void fetchPortalOptions(); }, [fetchPortalOptions]); // eslint-disable-line react-hooks/set-state-in-effect

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Captive Portal</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Design stunning guest login experiences, manage portal instances, and print WiFi vouchers
        </p>
      </div>
      <div className="relative border-b border-border">
        {/* Left fade indicator */}
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-r from-background to-transparent hidden" id="tab-fade-left" />
        {/* Right fade indicator */}
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 z-10 bg-gradient-to-l from-background to-transparent" id="tab-fade-right" />
        <ScrollArea className="w-full" id="tab-scroll-area">
          <div className="flex gap-1 min-w-max px-1" id="tab-scroll-inner">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button key={tab.id} ref={tab.id === activeTab ? activeTabRef : null} onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all duration-150 whitespace-nowrap',
                    isActive ? 'border-teal-500 text-teal-600 dark:text-teal-400'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                  )}>
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>
      <div className="mt-4">
        {activeTab === 'portals' && <PortalListTab onPortalsChanged={fetchPortalOptions} />}
        {activeTab === 'mappings' && <PoolMappingsTab />}
        {activeTab === 'designer' && <PortalDesignerTab portalOptions={portalOptions} />}
        {activeTab === 'analytics' && <AnalyticsTab />}
        {activeTab === 'vouchers' && <VoucherDesignerTab portalOptions={portalOptions} />}
        {activeTab === 'print-cards' && <PrintCardsTab />}
        {activeTab === 'whitelist' && <WhitelistTab />}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 1: Portal Zones (Zone-Based Routing with Seamless Roaming)
// ═══════════════════════════════════════════════════════════════════════════════

interface PortalZone {
  id: string;
  name: string;
  slug: string;
  enabled: boolean;
  isDefault: boolean;
  authMethod: string;
  roamingMode: string;
  allowsRoamingFrom: string[];
  maxBandwidthDown: number;
  maxBandwidthUp: number;
  bandwidthPolicy: string;
  nasIdentifier: string;
  ssidList: string[];
  sessionTimeout: number;
  idleTimeout: number;
  maxConcurrent: number;
  _count: { portalMappings: number; authMethods: number; portalPages: number };
}

const EMPTY_ZONE = {
  name: '', slug: '', authMethod: 'voucher', roamingMode: 'auth_origin',
  allowsRoamingFrom: [] as string[], maxBandwidthDown: 5, maxBandwidthUp: 1,
  bandwidthPolicy: 'zone', nasIdentifier: '', ssidList: [] as string[],
  maxConcurrent: 200, sessionTimeout: 1440, idleTimeout: 30,
};

const AUTH_METHODS = [
  { value: 'voucher', label: 'Voucher Code', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { value: 'room_number', label: 'Room Number', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { value: 'pms_credentials', label: 'PMS Credentials', color: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  { value: 'sms_otp', label: 'SMS OTP', color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  { value: 'open_access', label: 'Open Access', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  { value: 'social', label: 'Social Login', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { value: 'mac_auth', label: 'MAC Auth', color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
];

const ROAMING_MODES = [
  { value: 'auth_origin', label: 'Auth Origin', desc: 'Primary auth zone — guests start here', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  { value: 'seamless', label: 'Seamless', desc: 'Inherit sessions from allowed zones', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/30' },
  { value: 'reauth', label: 'Re-Auth', desc: 'Must authenticate independently', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 dark:bg-rose-950/30' },
];

function RoamingBadge({ mode }: { mode: string }) {
  const m = ROAMING_MODES.find(r => r.value === mode) || ROAMING_MODES[0];
  return <Badge variant="outline" className={cn('text-[10px] font-semibold gap-1', m.bg, m.color)}>{mode === 'auth_origin' ? '🔑' : mode === 'seamless' ? '🔗' : '🔒'} {m.label}</Badge>;
}

// ── Zone Form Content (shared between add/edit) ──────────────────────────────────
// Receives form state via props to avoid re-renders from component creation during render

function ZoneFormContent({ form, setForm, zones, editZone, ssidInput, setSsidInput }: {
  form: typeof EMPTY_ZONE; setForm: React.Dispatch<React.SetStateAction<typeof EMPTY_ZONE>>;
  zones: PortalZone[]; editZone: PortalZone | null;
  ssidInput: string; setSsidInput: React.Dispatch<React.SetStateAction<string>>;
}) {
  const addSsid = () => {
    const s = ssidInput.trim();
    if (s && !form.ssidList.includes(s)) { setForm(f => ({ ...f, ssidList: [...f.ssidList, s] })); setSsidInput(''); }
  };
  const removeSsid = (s: string) => setForm(f => ({ ...f, ssidList: f.ssidList.filter(x => x !== s) }));
  const toggleRoamingFrom = (slug: string) => {
    setForm(f => ({ ...f, allowsRoamingFrom: f.allowsRoamingFrom.includes(slug) ? f.allowsRoamingFrom.filter(s => s !== slug) : [...f.allowsRoamingFrom, slug] }));
  };

  return (
    <div className="grid gap-4 py-4 pr-4">
      <div className="space-y-2"><Label>Zone Name *</Label><Input placeholder="Lobby WiFi" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
      <div className="space-y-2">
        <Label>URL Slug *</Label>
        <Input placeholder="lobby" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.replace(/[^a-z0-9_-]/gi, '').toLowerCase() }))} className="font-mono" />
        <p className="text-[10px] text-muted-foreground">Portal URL: connect.hotel.com/<span className="font-mono text-foreground">{form.slug || '...'}</span></p>
      </div>
      <Separator />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Auth Method</Label>
          <Select value={form.authMethod} onValueChange={v => setForm(f => ({ ...f, authMethod: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{AUTH_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Roaming Mode</Label>
          <Select value={form.roamingMode} onValueChange={v => setForm(f => ({ ...f, roamingMode: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{ROAMING_MODES.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          {form.roamingMode === 'seamless' && <p className="text-[10px] text-muted-foreground">Allow sessions from other zones to roam in</p>}
        </div>
      </div>
      {form.roamingMode === 'seamless' && (
        <div className="space-y-2">
          <Label>Allow Roaming From</Label>
          <p className="text-[10px] text-muted-foreground">Select which zones can seamlessly roam into this zone</p>
          <div className="flex flex-wrap gap-2">
            {zones.filter(z => z.roamingMode === 'auth_origin' && z.id !== editZone?.id).map(z => (
              <button key={z.id} onClick={() => toggleRoamingFrom(z.slug)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  form.allowsRoamingFrom.includes(z.slug) ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950/30 dark:border-blue-700 dark:text-blue-300' : 'border-border text-muted-foreground hover:bg-muted'
                )}>
                {form.allowsRoamingFrom.includes(z.slug) && '✓ '}{z.name} (/{z.slug})
              </button>
            ))}
            {zones.filter(z => z.roamingMode === 'auth_origin' && z.id !== editZone?.id).length === 0 && (
              <p className="text-xs text-muted-foreground italic">No auth_origin zones available</p>
            )}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <Label>Bandwidth Limits (Mbps)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1"><p className="text-[10px] text-muted-foreground">Download</p><Input type="number" value={form.maxBandwidthDown} onChange={e => setForm(f => ({ ...f, maxBandwidthDown: parseInt(e.target.value) || 5 }))} /></div>
          <div className="space-y-1"><p className="text-[10px] text-muted-foreground">Upload</p><Input type="number" value={form.maxBandwidthUp} onChange={e => setForm(f => ({ ...f, maxBandwidthUp: parseInt(e.target.value) || 1 }))} /></div>
        </div>
        {form.roamingMode === 'seamless' && (
          <div className="space-y-1 mt-2">
            <Label className="text-xs">Roaming Bandwidth Policy</Label>
            <Select value={form.bandwidthPolicy} onValueChange={v => setForm(f => ({ ...f, bandwidthPolicy: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="zone">Use this zone&apos;s limits</SelectItem>
                <SelectItem value="origin">Keep origin zone limits</SelectItem>
                <SelectItem value="minimum">Use minimum of both</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      <Separator />
      <div className="space-y-2">
        <Label>SSIDs</Label>
        <p className="text-[10px] text-muted-foreground">WiFi network names that map to this zone</p>
        <div className="flex gap-2">
          <Input placeholder="Hotel_Guest" value={ssidInput} onChange={e => setSsidInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addSsid())} />
          <Button type="button" variant="outline" size="sm" onClick={addSsid}><Plus className="h-3.5 w-3.5" /></Button>
        </div>
        {form.ssidList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {form.ssidList.map(s => (
              <Badge key={s} variant="secondary" className="gap-1 text-xs">
                <Wifi className="h-3 w-3" />{s}
                <button onClick={() => removeSsid(s)} className="ml-0.5 hover:text-destructive"><XCircle className="h-3 w-3" /></button>
              </Badge>
            ))}
          </div>
        )}
      </div>
      {form.roamingMode === 'auth_origin' && (
        <div className="space-y-2">
          <Label>NAS Identifier (optional)</Label>
          <Input placeholder="staysuite-lobby-v10" value={form.nasIdentifier} onChange={e => setForm(f => ({ ...f, nasIdentifier: e.target.value }))} className="font-mono" />
          <p className="text-[10px] text-muted-foreground">Auto-filled if blank: staysuite-{form.slug}-v&lt;vlan&gt;</p>
        </div>
      )}
      <Separator />
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2"><Label>Max Concurrent</Label><Input type="number" value={form.maxConcurrent} onChange={e => setForm(f => ({ ...f, maxConcurrent: parseInt(e.target.value) || 200 }))} /></div>
        <div className="space-y-2"><Label>Session (min)</Label><Input type="number" value={form.sessionTimeout} onChange={e => setForm(f => ({ ...f, sessionTimeout: parseInt(e.target.value) || 1440 }))} /></div>
        <div className="space-y-2"><Label>Idle (min)</Label><Input type="number" value={form.idleTimeout} onChange={e => setForm(f => ({ ...f, idleTimeout: parseInt(e.target.value) || 30 }))} /></div>
      </div>
    </div>
  );
}

function PortalListTab({ onPortalsChanged }: { onPortalsChanged?: () => void }) {
  const [zones, setZones] = useState<PortalZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editZone, setEditZone] = useState<PortalZone | null>(null);
  const [form, setForm] = useState({ ...EMPTY_ZONE });
  const [ssidInput, setSsidInput] = useState('');
  const { toast } = useToast();
  const { propertyId } = usePropertyId();

  const fetchPortals = useCallback(async () => {
    setLoading(true);
    const data = await apiFetch<any[]>('/api/wifi/portal/instances');
    if (data) {
      setZones(data.map((p: any) => ({
        id: p.id, name: p.name, slug: p.slug || '', enabled: p.enabled ?? true, isDefault: p.isDefault ?? false,
        authMethod: p.authMethod || 'voucher', roamingMode: p.roamingMode || 'auth_origin',
        allowsRoamingFrom: JSON.parse(p.allowsRoamingFrom || '[]'),
        maxBandwidthDown: Math.round((p.maxBandwidthDown || 5242880) / 1048576),
        maxBandwidthUp: Math.round((p.maxBandwidthUp || 1048576) / 1048576),
        bandwidthPolicy: p.bandwidthPolicy || 'zone',
        nasIdentifier: p.nasIdentifier || '',
        ssidList: JSON.parse(p.ssidList || '[]'),
        sessionTimeout: Math.round((p.sessionTimeout || 86400) / 60),
        idleTimeout: Math.round((p.idleTimeout || 3600) / 60),
        maxConcurrent: p.maxConcurrent || 1000,
        _count: p._count || { portalMappings: 0, authMethods: 0, portalPages: 0 },
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchPortals(); }, [fetchPortals]); // eslint-disable-line react-hooks/set-state-in-effect

  const toggleEnabled = async (id: string) => {
    const zone = zones.find(z => z.id === id);
    if (!zone) return;
    const { error } = await apiMutate(`/api/wifi/portal/instances/${id}`, { method: 'PUT', body: JSON.stringify({ enabled: !zone.enabled }) });
    if (!error) {
      setZones(prev => prev.map(z => z.id === id ? { ...z, enabled: !z.enabled } : z));
      toast({ title: 'Zone updated', description: `${zone.name} ${!zone.enabled ? 'enabled' : 'disabled'}` });
      onPortalsChanged?.();
    } else { toast({ title: 'Error', description: error, variant: 'destructive' }); }
  };

  const toggleDefault = async (id: string) => {
    const zone = zones.find(z => z.id === id);
    if (!zone) return;
    const { error } = await apiMutate(`/api/wifi/portal/instances/${id}`, { method: 'PUT', body: JSON.stringify({ isDefault: !zone.isDefault }) });
    if (!error) {
      // Setting as default unsets others — update all zones locally
      setZones(prev => prev.map(z => ({ ...z, isDefault: z.id === id ? !z.isDefault : false })));
      toast({ title: 'Default portal updated', description: `${zone.name} ${!zone.isDefault ? 'set as' : 'removed from'} default` });
      onPortalsChanged?.();
    } else { toast({ title: 'Error', description: error, variant: 'destructive' }); }
  };

  const deleteZone = async (id: string) => {
    const { error } = await apiMutate(`/api/wifi/portal/instances/${id}`, { method: 'DELETE' });
    if (!error) { toast({ title: 'Zone deleted' }); await fetchPortals(); onPortalsChanged?.(); }
    else { toast({ title: 'Error', description: error || 'Failed', variant: 'destructive' }); }
  };

  const openAdd = () => {
    setForm({ ...EMPTY_ZONE });
    setSsidInput('');
    setAddOpen(true);
  };

  const openEdit = (zone: PortalZone) => {
    setEditZone(zone);
    setForm({
      name: zone.name, slug: zone.slug, authMethod: zone.authMethod, roamingMode: zone.roamingMode,
      allowsRoamingFrom: [...zone.allowsRoamingFrom], maxBandwidthDown: zone.maxBandwidthDown,
      maxBandwidthUp: zone.maxBandwidthUp, bandwidthPolicy: zone.bandwidthPolicy,
      nasIdentifier: zone.nasIdentifier, ssidList: [...zone.ssidList],
      maxConcurrent: zone.maxConcurrent, sessionTimeout: zone.sessionTimeout, idleTimeout: zone.idleTimeout,
    });
    setSsidInput('');
    setEditOpen(true);
  };

  const createZone = async () => {
    if (!form.name || !form.slug) return;
    const { error } = await apiMutate('/api/wifi/portal/instances', {
      method: 'POST', body: JSON.stringify({
        propertyId: propertyId || 'default', name: form.name, slug: form.slug,
        authMethod: form.authMethod, roamingMode: form.roamingMode,
        allowsRoamingFrom: JSON.stringify(form.allowsRoamingFrom),
        maxBandwidthDown: form.maxBandwidthDown * 1048576,
        maxBandwidthUp: form.maxBandwidthUp * 1048576,
        bandwidthPolicy: form.bandwidthPolicy,
        nasIdentifier: form.nasIdentifier || undefined,
        ssidList: JSON.stringify(form.ssidList),
        maxConcurrent: form.maxConcurrent,
        sessionTimeout: form.sessionTimeout * 60,
        idleTimeout: form.idleTimeout * 60,
        enabled: true,
      }),
    });
    if (!error) { toast({ title: 'Zone created', description: `${form.name} — /${form.slug}` }); await fetchPortals(); onPortalsChanged?.(); setAddOpen(false); }
    else { toast({ title: 'Error', description: error || 'Failed', variant: 'destructive' }); }
  };

  const updateZone = async () => {
    if (!editZone || !form.name || !form.slug) return;
    const { error } = await apiMutate(`/api/wifi/portal/instances/${editZone.id}`, {
      method: 'PUT', body: JSON.stringify({
        name: form.name, slug: form.slug, authMethod: form.authMethod, roamingMode: form.roamingMode,
        allowsRoamingFrom: JSON.stringify(form.allowsRoamingFrom),
        maxBandwidthDown: form.maxBandwidthDown * 1048576,
        maxBandwidthUp: form.maxBandwidthUp * 1048576,
        bandwidthPolicy: form.bandwidthPolicy,
        nasIdentifier: form.nasIdentifier || undefined,
        ssidList: JSON.stringify(form.ssidList),
        maxConcurrent: form.maxConcurrent,
        sessionTimeout: form.sessionTimeout * 60,
        idleTimeout: form.idleTimeout * 60,
      }),
    });
    if (!error) { toast({ title: 'Zone updated', description: `${form.name} saved` }); await fetchPortals(); onPortalsChanged?.(); setEditOpen(false); }
    else { toast({ title: 'Error', description: error || 'Failed', variant: 'destructive' }); }
  };

  if (loading) {
    return (<div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-10 w-48" /><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-52 w-full" /><Skeleton className="h-52 w-full" /><Skeleton className="h-52 w-full" /></div></div>);
  }

  const roamingZones = zones.filter(z => z.roamingMode === 'seamless');

  return (
    <div className="space-y-6">
      {/* Server Config Banner */}
      <div className="flex items-center justify-between rounded-lg border p-4 bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/40"><Zap className="h-5 w-5 text-teal-600 dark:text-teal-400" /></div>
          <div>
            <p className="font-medium text-sm">Portal Server Active</p>
            <p className="text-xs text-muted-foreground">Single server serves all zones via slug routing. Configure SSL & domain in <span className="font-mono text-foreground">Network → Portal Settings</span></p>
          </div>
        </div>
        <Badge variant="outline" className="border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:bg-emerald-950/30 gap-1">
          <CheckCircle2 className="h-3 w-3" /> Running
        </Badge>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{zones.length} zone{zones.length !== 1 ? 's' : ''} configured
            {roamingZones.length > 0 && <span className="ml-2 text-blue-600 dark:text-blue-400">· {roamingZones.length} seamless roaming</span>}
          </p>
        </div>
        <Button onClick={openAdd} className="bg-teal-600 hover:bg-teal-700"><Plus className="h-4 w-4 mr-2" />Add Zone</Button>
      </div>

      {/* Zone Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {zones.map(zone => {
          const authDef = AUTH_METHODS.find(a => a.value === zone.authMethod);
          const roamingDefs = zone.allowsRoamingFrom.map(slug => zones.find(z => z.slug === slug)).filter(Boolean) as PortalZone[];
          return (
            <Card key={zone.id} className={cn(!zone.enabled && 'opacity-50')}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', zone.enabled ? 'bg-teal-50 dark:bg-teal-900/30' : 'bg-gray-100 dark:bg-gray-800')}>
                      <Globe className={cn('h-5 w-5', zone.enabled ? 'text-teal-600 dark:text-teal-400' : 'text-gray-400')} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{zone.name}</CardTitle>
                      <p className="text-xs text-muted-foreground font-mono">/{zone.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RoamingBadge mode={zone.roamingMode} />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Auth & Bandwidth Row */}
                <div className="flex items-center gap-2 flex-wrap">
                  {authDef && <Badge variant="secondary" className={cn('text-[10px]', authDef.color)}>{authDef.label}</Badge>}
                  <Badge variant="outline" className="text-[10px]">↓ {zone.maxBandwidthDown} Mbps</Badge>
                  <Badge variant="outline" className="text-[10px]">↑ {zone.maxBandwidthUp} Mbps</Badge>
                </div>

                {/* SSIDs */}
                {zone.ssidList.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {zone.ssidList.slice(0, 3).map(s => (
                      <span key={s} className="text-[10px] bg-muted rounded px-1.5 py-0.5 font-mono">{s}</span>
                    ))}
                    {zone.ssidList.length > 3 && <span className="text-[10px] text-muted-foreground">+{zone.ssidList.length - 3} more</span>}
                  </div>
                )}

                {/* Roaming Connections */}
                {roamingDefs.length > 0 && (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 p-2">
                    <p className="text-[10px] text-blue-600 dark:text-blue-400 font-medium mb-1">🔗 Seamless from:</p>
                    <div className="flex gap-1 flex-wrap">
                      {roamingDefs.map(rz => (
                        <span key={rz.id} className="text-[10px] bg-white dark:bg-blue-950/40 rounded px-1.5 py-0.5 border border-blue-200 dark:border-blue-800">{rz.name}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Timeouts */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-muted/50 p-1.5"><div className="text-sm font-bold">{zone.sessionTimeout}m</div><div className="text-[10px] text-muted-foreground">Session</div></div>
                  <div className="rounded-lg bg-muted/50 p-1.5"><div className="text-sm font-bold">{zone.idleTimeout}m</div><div className="text-[10px] text-muted-foreground">Idle</div></div>
                  <div className="rounded-lg bg-muted/50 p-1.5"><div className="text-sm font-bold">{zone.maxConcurrent}</div><div className="text-[10px] text-muted-foreground">Max</div></div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Label className="text-xs text-muted-foreground">Active</Label>
                      <Switch checked={zone.enabled} onCheckedChange={() => toggleEnabled(zone.id)} />
                    </div>
                    <Separator orientation="vertical" className="h-4" />
                    <div className="flex items-center gap-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              'h-7 px-2 text-xs gap-1',
                              zone.isDefault
                                ? 'text-amber-600 dark:text-amber-400 font-medium'
                                : 'text-muted-foreground'
                            )}
                            onClick={() => toggleDefault(zone.id)}
                          >
                            <Star className={cn('h-3.5 w-3.5', zone.isDefault && 'fill-amber-400 text-amber-400')} />
                            Default
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {zone.isDefault
                            ? 'This portal is shown when no IP subnet matches'
                            : 'Set as default fallback portal'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(zone)}><Edit2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip>
                    <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 dark:text-red-400" onClick={() => deleteZone(zone.id)}><Trash2 className="h-3.5 w-3.5" /></Button></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {zones.length === 0 && (
        <Card className="border-dashed"><CardContent className="py-12 flex flex-col items-center gap-3 text-muted-foreground">
          <Globe className="h-10 w-10 opacity-30" /><p className="text-sm font-medium">No portal zones yet</p>
          <p className="text-xs">Create zones for different areas — lobby, pool, gym, conference — each with unique branding and auth</p>
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={openAdd}><Plus className="h-4 w-4 mr-2" />Create First Zone</Button>
        </CardContent></Card>
      )}

      {/* Add Zone Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader><DialogTitle>Add Portal Zone</DialogTitle><DialogDescription>Create a new zone — each area gets its own portal design, auth method, and bandwidth limits</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[60vh]"><ZoneFormContent form={form} setForm={setForm} zones={zones} editZone={null} ssidInput={ssidInput} setSsidInput={setSsidInput} /></ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button onClick={createZone} disabled={!form.name || !form.slug} className="bg-teal-600 hover:bg-teal-700">Create Zone</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Zone Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-lg max-h-[85vh]">
          <DialogHeader><DialogTitle>Edit Zone — {editZone?.name}</DialogTitle><DialogDescription>Update zone configuration for /{editZone?.slug}</DialogDescription></DialogHeader>
          <ScrollArea className="max-h-[60vh]"><ZoneFormContent form={form} setForm={setForm} zones={zones} editZone={editZone} ssidInput={ssidInput} setSsidInput={setSsidInput} /></ScrollArea>
          <DialogFooter><Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button><Button onClick={updateZone} disabled={!form.name || !form.slug} className="bg-teal-600 hover:bg-teal-700">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 2: Powerful Portal Designer
// ═══════════════════════════════════════════════════════════════════════════════

interface PortalPageDesign {
  authFlow: string;
  title: string; subtitle: string; logoUrl: string;
  backgroundType: 'solid' | 'gradient' | 'image';
  backgroundColor: string; backgroundImageUrl: string;
  brandColor: string; textColor: string;
  fields: AutoFields;
  socialLogin: { google: boolean; facebook: boolean; apple: boolean };
  customCSS: string; customHTML: string;
  settings: DesignSettings;
}

interface AaaConfig { usernameFormat: string; passwordFormat: string; credentialPrintOnVoucher?: boolean; credentialShowInPortal?: boolean; }

const DEFAULT_DESIGN: PortalPageDesign = {
  authFlow: 'pms_credentials',
  title: 'Welcome to StaySuite', subtitle: 'Connect to our high-speed WiFi network',
  logoUrl: '', backgroundType: 'solid', backgroundColor: '#0f766e', backgroundImageUrl: '',
  brandColor: '#14b8a6', textColor: '#ffffff',
  fields: getAutoFields('custom'), socialLogin: { google: false, facebook: false, apple: false },
  customCSS: '/* Custom CSS */', customHTML: '<div class="legal-footer"><p>&copy; 2025 StaySuite Hospitality</p></div>',
  settings: { ...DEFAULT_SETTINGS },
};

function fieldsAreEqual(a: AutoFields, b: AutoFields): boolean {
  return Object.keys(a).every((k) => a[k as keyof AutoFields] === b[k as keyof AutoFields]);
}

function getBackgroundCSS(design: PortalPageDesign): string {
  const s = design.settings;
  if (s.backgroundType === 'gradient') {
    return `linear-gradient(${s.gradientAngle}deg, ${s.gradientFrom}, ${s.gradientTo})`;
  }
  if (s.backgroundType === 'image' && design.backgroundImageUrl) {
    return `url(${design.backgroundImageUrl}) center/cover`;
  }
  return design.backgroundColor;
}

function getFormClasses(s: DesignSettings): string {
  let cls = '';
  if (s.formStyle === 'glass') cls += 'bg-white/10 backdrop-blur-xl border border-white/20 ';
  else if (s.formStyle === 'card') cls += 'bg-white shadow-xl ';
  else if (s.formStyle === 'minimal') cls += 'bg-transparent ';
  else cls += 'bg-white/10 backdrop-blur-md ';
  if (s.cardShadow === 'large') cls += 'shadow-2xl ';
  else if (s.cardShadow === 'medium') cls += 'shadow-xl ';
  else if (s.cardShadow === 'small') cls += 'shadow-lg ';
  else cls += '';
  if (s.formStyle === 'pill') cls += 'rounded-3xl ';
  else if (s.formStyle === 'rounded') cls += 'rounded-2xl ';
  else if (s.formStyle === 'square') cls += 'rounded-none ';
  else cls += 'rounded-2xl ';
  return cls;
}

function getInputClasses(s: DesignSettings): string {
  const bg = s.formStyle === 'glass' || s.formStyle === 'minimal' ? 'bg-white/10 border-white/20' : 'bg-white/90 border-gray-200';
  if (s.inputStyle === 'pill') return `${bg} rounded-full px-4 py-2.5 text-xs`;
  if (s.inputStyle === 'square') return `${bg} rounded-none px-3 py-2.5 text-xs`;
  if (s.inputStyle === 'underline') return `${bg} border-0 border-b-2 px-1 py-2 text-xs bg-transparent border-white/30`;
  return `${bg} rounded-lg px-3 py-2.5 text-xs`;
}

function getButtonClasses(s: DesignSettings): string {
  const isGlass = s.formStyle === 'glass' || s.formStyle === 'minimal';
  let cls = 'font-semibold transition-all ';
  if (s.buttonSize === 'large') cls += 'px-6 py-3 text-sm ';
  else if (s.buttonSize === 'small') cls += 'px-4 py-2 text-xs ';
  else cls += 'px-5 py-2.5 text-sm ';

  if (s.buttonStyle === 'pill') cls += 'rounded-full ';
  else if (s.buttonStyle === 'rounded') cls += 'rounded-lg ';
  else cls += 'rounded-lg ';

  if (s.buttonStyle === 'gradient') cls += `bg-gradient-to-r from-[${s.gradientFrom}] to-[${s.gradientTo}] text-white `;
  else if (s.buttonStyle === 'outlined') cls += isGlass ? 'border-2 border-white/40 text-white hover:bg-white/10 ' : 'border-2 border-teal-500 text-teal-500 dark:text-teal-400 hover:bg-teal-50 ';
  else cls += 'text-white hover:opacity-90 ';
  return cls;
}

// ── Portal Designer Tab ───────────────────────────────────────────────────────

function PortalDesignerTab({ portalOptions }: { portalOptions: Array<{ id: string; name: string }> }) {
  const { toast } = useToast();
  const { propertyId } = usePropertyId();
  const [selectedPortalId, setSelectedPortalId] = useState<string>(portalOptions[0]?.id || '');
  const [aaaConfig, setAaaConfig] = useState<AaaConfig | null>(null);
  const [credentialCategory, setCredentialCategory] = useState<CredentialCategory>('custom');
  const [autoFields, setAutoFields] = useState<AutoFields>(getAutoFields('custom'));
  const [design, setDesign] = useState<PortalPageDesign>({ ...DEFAULT_DESIGN, settings: { ...DEFAULT_SETTINGS } });
  const [savedPageId, setSavedPageId] = useState<string | null>(null);
  const [isOverride, setIsOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [subTab, setSubTab] = useState<DesignerSubTab>('templates');
  const [previewDevice, setPreviewDevice] = useState<'phone' | 'tablet' | 'desktop'>('phone');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  // ── Design History for Undo/Redo (Feature 11) ──────────────────────────────
  const [history, setHistory] = useState<PortalPageDesign[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isUndoRedoRef = useRef(false);

  const pushHistory = useCallback((snapshot: PortalPageDesign) => {
    setHistory((prev) => {
      const idx = historyIndex;
      const newHistory = prev.slice(0, idx + 1).concat(JSON.parse(JSON.stringify(snapshot)));
      if (newHistory.length > 20) newHistory.shift();
      return newHistory;
    });
    setHistoryIndex((prev) => Math.min(prev + 1, 19));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    isUndoRedoRef.current = true;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setDesign(JSON.parse(JSON.stringify(history[newIndex])));
    setTimeout(() => { isUndoRedoRef.current = false; }, 50);
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    isUndoRedoRef.current = true;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setDesign(JSON.parse(JSON.stringify(history[newIndex])));
    setTimeout(() => { isUndoRedoRef.current = false; }, 50);
  }, [historyIndex, history]);

  // Push initial design to history on first load
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
      isUndoRedoRef.current = true;
      setHistory([JSON.parse(JSON.stringify(design))]);
      setHistoryIndex(0);
      setTimeout(() => { isUndoRedoRef.current = false; }, 50);
    }
  }, [design]);

  // Push to history on design change (but not during undo/redo)
  useEffect(() => {
    if (!isUndoRedoRef.current && history.length > 0) {
      pushHistory(design);
    }
  }, [design]);

  // ── Export/Import Handlers (Feature 12) ────────────────────────────────────
  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(design, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portal-design-${selectedPortalId || 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Design exported', description: 'Portal design downloaded as JSON' });
  }, [design, selectedPortalId, toast]);

  const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = JSON.parse(ev.target?.result as string);
        if (imported && imported.settings) {
          setDesign({ ...DEFAULT_DESIGN, ...imported, settings: { ...DEFAULT_SETTINGS, ...imported.settings } });
          toast({ title: 'Design imported', description: 'Portal design loaded from JSON' });
        } else {
          toast({ title: 'Invalid file', description: 'The file does not contain a valid portal design', variant: 'destructive' });
        }
      } catch {
        toast({ title: 'Import failed', description: 'Could not parse the JSON file', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    if (importInputRef.current) importInputRef.current.value = '';
  }, [toast]);

  // ── Actual Size Preview (Feature 13) ───────────────────────────────────────
  const openActualSizePreview = useCallback(() => {
    const win = window.open('', '_blank', 'width=device-width,height=device-height');
    if (!win) return;
    const bg = getBackgroundCSS(design);
    win.document.write(`<!DOCTYPE html><html><head><title>Portal Preview</title><link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Poppins:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Open+Sans:wght@400;600;700&family=Lato:wght@400;600;700&family=Roboto:wght@400;600;700&family=Merriweather:wght@400;600;700&display=swap" rel="stylesheet"></head><body style="margin:0;padding:0;background:${bg};color:${design.textColor};font-family:${design.settings.fontFamily}"><div style="text-align:center;padding:40px"><h1>${design.title}</h1><p>${design.subtitle}</p></div><p style="text-align:center;margin-top:40px;opacity:0.5;font-size:12px">Actual-size preview — close this tab to return</p></body></html>`);
    win.document.close();
  }, [design]);

  // ── Load data when portal changes ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedPortalId) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      const config = await apiFetch<AaaConfig>('/api/wifi/aaa-config');
      if (!cancelled && config) {
        setAaaConfig(config);
        const cat = CREDENTIAL_FORMAT_MAP[config.usernameFormat] || 'custom';
        setCredentialCategory(cat);
        setAutoFields(getAutoFields(cat));
      }
      const pageData = await apiFetch<any>(`/api/wifi/portal/pages?portalId=${selectedPortalId}`);
      if (!cancelled && pageData && (Array.isArray(pageData) ? pageData.length > 0 : true)) {
        const pd = Array.isArray(pageData) ? pageData[0] : pageData;
        if (pd) {
          setSavedPageId(pd.id || null);
          const settings: DesignSettings = {
            ...DEFAULT_SETTINGS,
            ...(typeof pd.designSettings === 'string' ? JSON.parse(pd.designSettings || '{}') : pd.designSettings || {}),
          };
          setDesign({
            authFlow: pd.authFlow || 'pms_credentials',
            title: pd.title || DEFAULT_DESIGN.title, subtitle: pd.subtitle || DEFAULT_DESIGN.subtitle,
            logoUrl: pd.logoUrl || '', backgroundType: (typeof pd.designSettings === 'string' ? JSON.parse(pd.designSettings || '{}') : pd.designSettings || {}).backgroundType || 'solid',
            backgroundColor: pd.backgroundColor || '#0f766e', backgroundImageUrl: pd.backgroundImage || '',
            brandColor: pd.accentColor || '#14b8a6', textColor: pd.textColor || '#ffffff',
            fields: typeof pd.formFields === 'string' ? JSON.parse(pd.formFields) : (pd.formFields || getAutoFields('custom')),
            socialLogin: typeof pd.socialProviders === 'string' ? JSON.parse(pd.socialProviders) : { google: false, facebook: false, apple: false },
            customCSS: pd.customCss || '', customHTML: pd.customHtml || '', settings,
          });
          const newAuto = getAutoFields(CREDENTIAL_FORMAT_MAP[config?.usernameFormat || ''] || 'custom');
          setIsOverride(!fieldsAreEqual(typeof pd.formFields === 'string' ? JSON.parse(pd.formFields) : (pd.formFields || getAutoFields('custom')), newAuto));
        }
      } else if (!cancelled) {
        const cat = CREDENTIAL_FORMAT_MAP[config?.usernameFormat || ''] || 'custom';
        setDesign((prev) => ({ ...prev, fields: getAutoFields(cat), settings: { ...DEFAULT_SETTINGS } }));
        setSavedPageId(null);
        setIsOverride(false);
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [selectedPortalId]);

  const updateDesign = useCallback((partial: Partial<PortalPageDesign>) => {
    setDesign((prev) => {
      const next = { ...prev, ...partial };
      // When auth flow changes, auto-populate recommended fields
      if (partial.authFlow && partial.authFlow !== prev.authFlow) {
        const flowDefaults = AUTH_FLOW_FIELD_DEFAULTS[partial.authFlow];
        if (flowDefaults) {
          next.fields = { ...flowDefaults };
          setIsOverride(false);
        }
      }
      if (partial.fields) setIsOverride(!fieldsAreEqual(partial.fields, autoFields));
      return next;
    });
  }, [autoFields]);

  const updateSettings = useCallback((partial: Partial<DesignSettings>) => {
    setDesign((prev) => ({ ...prev, settings: { ...prev.settings, ...partial } }));
  }, []);

  const applyTemplate = useCallback((template: PortalTemplate) => {
    setDesign((prev) => ({
      ...prev,
      backgroundColor: template.colors.bg,
      brandColor: template.colors.accent,
      textColor: template.colors.text,
      settings: { ...prev.settings, ...template.design, gradientFrom: template.colors.gradientFrom || prev.settings.gradientFrom, gradientTo: template.colors.gradientTo || prev.settings.gradientTo, backgroundType: template.design.backgroundType || 'solid' },
    }));
    toast({ title: 'Template applied', description: `${template.name} theme has been applied` });
  }, [toast]);

  const toggleField = useCallback((key: keyof AutoFields) => {
    setDesign((prev) => {
      const next = { ...prev, fields: { ...prev.fields, [key]: !prev.fields[key] } };
      setIsOverride(!fieldsAreEqual(next.fields, autoFields));
      return next;
    });
  }, [autoFields]);

  const toggleSocial = useCallback((provider: 'google' | 'facebook' | 'apple') => {
    setDesign((prev) => ({ ...prev, socialLogin: { ...prev.socialLogin, [provider]: !prev.socialLogin[provider] } }));
  }, []);

  const resetToPolicy = useCallback(() => {
    setDesign((prev) => ({ ...prev, fields: { ...autoFields } }));
    setIsOverride(false);
    toast({ title: 'Reset to policy', description: 'Form fields synced with credential policy' });
  }, [autoFields, toast]);

  const handleSave = useCallback(async () => {
    if (!selectedPortalId) return;
    setSaving(true);
    const payload = {
      portalId: selectedPortalId, propertyId: propertyId || 'default',
      title: design.title, subtitle: design.subtitle, logoUrl: design.logoUrl,
      backgroundImage: design.backgroundImageUrl, backgroundColor: design.backgroundColor,
      textColor: design.textColor, brandColor: design.brandColor,
      authFlow: design.authFlow,
      formFields: design.fields, socialLogin: design.socialLogin,
      customCSS: design.customCSS, customHTML: design.customHTML,
      designSettings: design.settings,
    };
    try {
      if (savedPageId) {
        const { error } = await apiMutate(`/api/wifi/portal/pages/${savedPageId}`, { method: 'PUT', body: JSON.stringify(payload) });
        if (error) toast({ title: 'Save failed', description: error, variant: 'destructive' });
        else toast({ title: 'Saved', description: 'Portal design updated successfully' });
      } else {
        const { data, error } = await apiMutate<any>('/api/wifi/portal/pages', { method: 'POST', body: JSON.stringify(payload) });
        if (error) toast({ title: 'Save failed', description: error, variant: 'destructive' });
        else if (data) { setSavedPageId(data.id || null); toast({ title: 'Saved', description: 'Portal design created successfully' }); }
      }
    } catch { toast({ title: 'Save failed', description: 'Unexpected error', variant: 'destructive' }); }
    setSaving(false);
  }, [selectedPortalId, propertyId, design, savedPageId, toast]);

  const visibleFields = useMemo(() => FIELD_DEFINITIONS.filter((f) => design.fields[f.key]), [design.fields]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (<div className="space-y-4"><Skeleton className="h-10 w-full max-w-md" /><div className="grid grid-cols-1 lg:grid-cols-5 gap-6"><Skeleton className="h-[700px] col-span-2" /><Skeleton className="h-[700px] col-span-3" /></div></div>);
  }

  if (!selectedPortalId || portalOptions.length === 0) {
    return (<Card className="border-dashed"><CardContent className="py-16 flex flex-col items-center gap-4 text-muted-foreground">
      <Layout className="h-12 w-12 opacity-30" /><p className="text-base font-medium">No portal instances available</p>
      <p className="text-sm">Create a portal instance first, then come back to design its login page</p>
    </CardContent></Card>);
  }

  return (
    <div className="space-y-4">
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Select value={selectedPortalId} onValueChange={setSelectedPortalId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select portal..." /></SelectTrigger>
            <SelectContent>{portalOptions.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}</SelectContent>
          </Select>
          {aaaConfig && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={cn('gap-1.5 cursor-default', isOverride ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300')}>
                  {isOverride ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                  {isOverride ? 'Custom Override' : 'Synced with Policy'}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{isOverride ? 'Form fields differ from credential policy defaults' : `Auto-configured from ${CREDENTIAL_CATEGORY_LABELS[credentialCategory]} format`}</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div className="flex gap-2">
          {isOverride && <Button variant="outline" size="sm" onClick={resetToPolicy}><RotateCcw className="h-4 w-4 mr-1.5" />Sync to Policy</Button>}
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={undo} disabled={historyIndex <= 0}><Undo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Undo</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={redo} disabled={historyIndex >= history.length - 1}><Redo2 className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Redo</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={handleExport}><Download className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Export Design</TooltipContent></Tooltip>
          <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => importInputRef.current?.click()}><Upload className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent>Import Design</TooltipContent></Tooltip>
          <input ref={importInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1.5" />{saving ? 'Saving...' : 'Save'}</Button>
        </div>
      </div>

      {/* ── Split Pane: Preview (left 2/5) + Controls (right 3/5) ───────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: Live Preview ──────────────────────────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden lg:sticky lg:top-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4" />Live Preview</CardTitle>
                <div className="flex items-center gap-1">
                  <Tooltip><TooltipTrigger asChild><button onClick={openActualSizePreview} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground transition-colors"><ExternalLink className="h-3.5 w-3.5" /></button></TooltipTrigger><TooltipContent>Actual Size Preview</TooltipContent></Tooltip>
                  <div className="bg-muted rounded-lg p-0.5">
                    {[{ v: 'phone' as const, icon: Smartphone }, { v: 'tablet' as const, icon: Tablet }, { v: 'desktop' as const, icon: Monitor }].map(({ v, icon: Ic }) => (
                      <button key={v} onClick={() => setPreviewDevice(v)} className={cn('p-1.5 rounded-md transition-colors', previewDevice === v ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                        <Ic className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 flex justify-center bg-muted/30 min-h-[400px] lg:min-h-[620px]">
              {/* Device Frame */}
              <div className={cn(
                'relative bg-gray-900 shadow-2xl overflow-hidden',
                previewDevice === 'phone' ? 'w-[240px] sm:w-[280px] h-[480px] sm:h-[560px] rounded-[36px] border-4 border-gray-800' : '',
                previewDevice === 'tablet' ? 'w-[320px] sm:w-[420px] h-[480px] sm:h-[580px] rounded-[20px] border-3 border-gray-800' : '',
                previewDevice === 'desktop' ? 'w-full h-[480px] sm:h-[580px] rounded-lg border-2 border-gray-700' : '',
              )}>
                {/* Notch (phone only) */}
                {previewDevice === 'phone' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-gray-900 rounded-b-xl z-10" />}
                {/* Screen Content */}
                <div className="w-full h-full overflow-y-auto" style={{ background: getBackgroundCSS(design), color: design.textColor }}>
                  <PortalPreviewContent design={design} visibleFields={visibleFields} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Right: Designer Controls ──────────────────────────────────────── */}
        <div className="lg:col-span-3 space-y-0">
          {/* Sub-Tab Navigation */}
          <div className="border rounded-lg bg-card">
            <div className="flex overflow-x-auto bg-muted/50 px-2 pt-2">
              {DESIGNER_SUBTABS.map((st) => {
                const Icon = st.icon;
                const isActive = subTab === st.id;
                return (
                  <button key={st.id} onClick={() => setSubTab(st.id)}
                    className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-t-lg whitespace-nowrap transition-all border-b-2',
                      isActive ? 'bg-card text-foreground border-teal-500' : 'text-muted-foreground border-transparent hover:text-foreground'
                    )}>
                    <Icon className="h-3.5 w-3.5" />{st.label}
                  </button>
                );
              })}
            </div>

            <div className="overflow-y-auto max-h-[70vh] overscroll-contain">
              <div className="p-5 space-y-5">
                {/* ── Templates Sub-Tab ──────────────────────────────────────── */}
                {subTab === 'templates' && (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="h-4 w-4 text-amber-500 dark:text-amber-400" />Choose a Template</h3>
                      <p className="text-xs text-muted-foreground mt-1">Start with a professionally designed theme, then customize every detail</p>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {PORTAL_TEMPLATES.map((tmpl) => (
                        <button key={tmpl.id} onClick={() => applyTemplate(tmpl)}
                          className={cn('group relative rounded-xl overflow-hidden border-2 transition-all hover:shadow-lg text-left',
                            design.settings.layoutType === tmpl.design.layoutType && design.backgroundColor === tmpl.colors.bg
                              ? 'border-teal-500 ring-2 ring-teal-500/20' : 'border-border hover:border-teal-300'
                          )}>
                          {/* Thumbnail */}
                          <div className="h-28 relative" style={{ background: tmpl.preview }}>
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-white/90 p-3">
                              <Building className="h-6 w-6 opacity-60" />
                              <div className="text-[10px] font-semibold text-center">{tmpl.name}</div>
                            </div>
                            {design.settings.layoutType === tmpl.design.layoutType && design.backgroundColor === tmpl.colors.bg && (
                              <div className="absolute top-2 right-2 bg-teal-500 rounded-full p-0.5"><CheckCircle2 className="h-3 w-3 text-white" /></div>
                            )}
                          </div>
                          <div className="p-3 bg-card">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-xs font-semibold">{tmpl.name}</p>
                                <p className="text-[10px] text-muted-foreground">{tmpl.category}</p>
                              </div>
                              <div className="flex gap-1">
                                <div className="w-3 h-3 rounded-full border border-gray-300" style={{ background: tmpl.colors.bg }} />
                                <div className="w-3 h-3 rounded-full border border-gray-300" style={{ background: tmpl.colors.accent }} />
                              </div>
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">{tmpl.description}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Layout Sub-Tab ─────────────────────────────────────────── */}
                {subTab === 'layout' && (
                  <div className="space-y-4">
                    <div><h3 className="text-sm font-semibold">Page Layout</h3><p className="text-xs text-muted-foreground mt-1">Choose how the login form is positioned on the page</p></div>
                    <div className="grid grid-cols-1 gap-2">
                      {LAYOUT_OPTIONS.map((lo) => (
                        <button key={lo.value} onClick={() => updateSettings({ layoutType: lo.value })}
                          className={cn('flex items-center gap-4 p-3 rounded-lg border-2 transition-all text-left',
                            design.settings.layoutType === lo.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>
                          <LayoutMiniPreview layout={lo.value} />
                          <div><p className="text-sm font-medium">{lo.label}</p><p className="text-xs text-muted-foreground">{lo.desc}</p></div>
                        </button>
                      ))}
                    </div>
                    {/* Auth Flow */}
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Authentication Flow</h3><p className="text-xs text-muted-foreground mt-1">How guests authenticate on the portal</p></div>
                    <div className="grid grid-cols-1 gap-2">
                      {AUTH_FLOW_OPTIONS.map((af) => {
                        const Icon = af.icon;
                        return (
                          <button key={af.value} onClick={() => {
                            updateDesign({ authFlow: af.value });
                            toast({ title: `${af.label} selected`, description: 'Form fields auto-configured. Customize in the Fields tab.', duration: 3000 });
                          }}
                            className={cn('flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                              design.authFlow === af.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                            )}>
                            <Icon className={cn('h-5 w-5', af.color)} />
                            <div><p className="text-sm font-medium">{af.label}</p></div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── Background Sub-Tab ─────────────────────────────────────── */}
                {subTab === 'background' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold">Background Type</h3></div>
                    <div className="grid grid-cols-3 gap-2">
                      {[{ v: 'solid' as const, l: 'Solid Color' }, { v: 'gradient' as const, l: 'Gradient' }, { v: 'image' as const, l: 'Image URL' }].map((bt) => (
                        <button key={bt.v} onClick={() => updateSettings({ backgroundType: bt.v })}
                          className={cn('p-3 rounded-lg border-2 text-center text-xs font-medium transition-all',
                            design.settings.backgroundType === bt.v ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{bt.l}</button>
                      ))}
                    </div>
                    {design.settings.backgroundType === 'solid' && (
                      <div className="space-y-2"><Label className="text-xs">Background Color</Label>
                        <div className="flex items-center gap-3"><input type="color" value={design.backgroundColor} onChange={(e) => updateDesign({ backgroundColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.backgroundColor} onChange={(e) => updateDesign({ backgroundColor: e.target.value })} className="flex-1 font-mono text-xs" /></div>
                      </div>
                    )}
                    {design.settings.backgroundType === 'gradient' && (
                      <div className="space-y-4">
                        <div className="space-y-2"><Label className="text-xs">From Color</Label><div className="flex items-center gap-3"><input type="color" value={design.settings.gradientFrom} onChange={(e) => updateSettings({ gradientFrom: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.settings.gradientFrom} onChange={(e) => updateSettings({ gradientFrom: e.target.value })} className="flex-1 font-mono text-xs" /></div></div>
                        <div className="space-y-2"><Label className="text-xs">To Color</Label><div className="flex items-center gap-3"><input type="color" value={design.settings.gradientTo} onChange={(e) => updateSettings({ gradientTo: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.settings.gradientTo} onChange={(e) => updateSettings({ gradientTo: e.target.value })} className="flex-1 font-mono text-xs" /></div></div>
                        <div className="space-y-2"><Label className="text-xs">Angle: {design.settings.gradientAngle}&deg;</Label><input type="range" min="0" max="360" value={design.settings.gradientAngle} onChange={(e) => updateSettings({ gradientAngle: parseInt(e.target.value) })} className="w-full accent-teal-500" /></div>
                      </div>
                    )}
                    {design.settings.backgroundType === 'image' && (
                      <div className="space-y-3">
                        {/* Upload area */}
                        <div className="space-y-2">
                          <Label className="text-xs">Background Image</Label>
                          <div className="relative group">
                            {design.backgroundImageUrl ? (
                              <div className="relative rounded-lg overflow-hidden border">
                                <img src={design.backgroundImageUrl} alt="Background preview" className="w-full h-32 object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <button type="button" onClick={() => bgInputRef.current?.click()} className="px-3 py-1.5 bg-white text-gray-800 rounded-md text-xs font-medium hover:bg-gray-100 transition-colors">
                                    Replace
                                  </button>
                                  <button type="button" onClick={() => updateDesign({ backgroundImageUrl: '' })} className="px-3 py-1.5 bg-red-500 text-white rounded-md text-xs font-medium hover:bg-red-600 transition-colors">
                                    Remove
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button type="button" onClick={() => bgInputRef.current?.click()} className="w-full h-32 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1.5 text-muted-foreground hover:text-foreground hover:border-teal-400 transition-colors cursor-pointer">
                                <ImagePlus className="w-5 h-5" />
                                <span className="text-xs font-medium">Upload Background Image</span>
                                <span className="text-[10px]">JPG, PNG, WebP up to 10MB</span>
                              </button>
                            )}
                            <input ref={bgInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              setBgUploading(true);
                              try {
                                const fd = new FormData();
                                fd.append('file', file);
                                fd.append('folder', 'portal-backgrounds');
                                const res = await fetch('/api/upload', { method: 'POST', body: fd });
                                const result = await res.json();
                                if (result.success && result.data?.url) {
                                  updateDesign({ backgroundImageUrl: result.data.url });
                                  toast({ title: 'Background uploaded', description: 'Image set as portal background' });
                                } else {
                                  toast({ title: 'Upload failed', description: result.error?.message || 'Failed to upload image', variant: 'destructive' });
                                }
                              } catch { toast({ title: 'Upload failed', description: 'Network error', variant: 'destructive' }); }
                              setBgUploading(false);
                              if (bgInputRef.current) bgInputRef.current.value = '';
                            }} />
                            {bgUploading && (
                              <div className="absolute inset-0 rounded-lg bg-background/60 backdrop-blur-sm flex items-center justify-center">
                                <Loader2 className="w-5 h-5 animate-spin text-teal-500" />
                              </div>
                            )}
                          </div>
                        </div>
                        {/* URL fallback */}
                        <div className="space-y-2">
                          <Label className="text-xs">Or paste Image URL</Label>
                          <Input placeholder="https://example.com/hotel-bg.jpg" value={design.backgroundImageUrl} onChange={(e) => updateDesign({ backgroundImageUrl: e.target.value })} className="text-xs" />
                        </div>
                        <div className="space-y-2"><Label className="text-xs">Overlay Opacity: {design.settings.backgroundOverlay}%</Label><input type="range" min="0" max="90" value={design.settings.backgroundOverlay} onChange={(e) => updateSettings({ backgroundOverlay: parseInt(e.target.value) })} className="w-full accent-teal-500" /></div>
                      </div>
                    )}
                    <Separator />
                    {/* Brand & Text Colors */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><Label className="text-xs">Brand / Accent Color</Label><div className="flex items-center gap-3"><input type="color" value={design.brandColor} onChange={(e) => updateDesign({ brandColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.brandColor} onChange={(e) => updateDesign({ brandColor: e.target.value })} className="flex-1 font-mono text-xs" /></div></div>
                      <div className="space-y-2"><Label className="text-xs">Text Color</Label><div className="flex items-center gap-3"><input type="color" value={design.textColor} onChange={(e) => updateDesign({ textColor: e.target.value })} className="w-10 h-10 rounded-lg cursor-pointer border-0" /><Input value={design.textColor} onChange={(e) => updateDesign({ textColor: e.target.value })} className="flex-1 font-mono text-xs" /></div></div>
                    </div>
                  </div>
                )}

                {/* ── Typography Sub-Tab ─────────────────────────────────────── */}
                {subTab === 'typography' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><Type className="h-4 w-4" />Typography</h3><p className="text-xs text-muted-foreground mt-1">Choose fonts that match your hotel brand</p></div>
                    <div className="space-y-2"><Label className="text-xs">Body Font</Label>
                      <Select value={design.settings.fontFamily} onValueChange={(v) => updateSettings({ fontFamily: v })}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{FONT_OPTIONS.map((f) => (<SelectItem key={f.value} value={f.value} className={f.style}>{f.label}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label className="text-xs">Heading Font</Label>
                      <Select value={design.settings.headingFontFamily} onValueChange={(v) => updateSettings({ headingFontFamily: v })}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{FONT_OPTIONS.map((f) => (<SelectItem key={f.value} value={f.value} className={f.style}>{f.label}</SelectItem>))}</SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                {/* ── Form & Button Style Sub-Tab ────────────────────────────── */}
                {subTab === 'formstyle' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><FormInput className="h-4 w-4" />Form Style</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {FORM_STYLES.map((fs) => (
                        <button key={fs.value} onClick={() => updateSettings({ formStyle: fs.value })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all',
                            design.settings.formStyle === fs.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{fs.label}</button>
                      ))}
                    </div>
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Input Style</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {INPUT_STYLES.map((is) => (
                        <button key={is.value} onClick={() => updateSettings({ inputStyle: is.value })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all',
                            design.settings.inputStyle === is.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{is.label}</button>
                      ))}
                    </div>
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Button Style</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {BUTTON_STYLES.map((bs) => (
                        <button key={bs.value} onClick={() => updateSettings({ buttonStyle: bs.value })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all',
                            design.settings.buttonStyle === bs.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{bs.label}</button>
                      ))}
                    </div>
                    <div><h3 className="text-sm font-semibold mt-2">Button Size</h3></div>
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as const).map((sz) => (
                        <button key={sz} onClick={() => updateSettings({ buttonSize: sz })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all capitalize',
                            design.settings.buttonSize === sz ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{sz}</button>
                      ))}
                    </div>
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Animation</h3></div>
                    <div className="grid grid-cols-2 gap-2">
                      {([['none', 'None'], ['fade', 'Fade In'], ['slide_up', 'Slide Up'], ['zoom', 'Zoom']] as const).map(([v, l]) => (
                        <button key={v} onClick={() => updateSettings({ animationType: v })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all',
                            design.settings.animationType === v ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{l}</button>
                      ))}
                    </div>
                    <Separator />
                    {/* Feature 10: Card Shadow Control */}
                    <div><h3 className="text-sm font-semibold">Card Shadow</h3></div>
                    <div className="grid grid-cols-4 gap-2">
                      {(['none', 'small', 'medium', 'large'] as const).map((sz) => (
                        <button key={sz} onClick={() => updateSettings({ cardShadow: sz })}
                          className={cn('p-3 rounded-lg border-2 text-xs font-medium transition-all capitalize',
                            design.settings.cardShadow === sz ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                          )}>{sz}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Content Sub-Tab ────────────────────────────────────────── */}
                {subTab === 'content' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><Layers className="h-4 w-4" />Content Sections</h3><p className="text-xs text-muted-foreground mt-1">Add rich content to engage guests</p></div>

                    {/* ── Feature 1: Multi-Language Portal ─────────────────────── */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold flex items-center gap-1.5"><Languages className="h-3.5 w-3.5" />Multi-Language</Label><Switch checked={design.settings.enableMultiLanguage} onCheckedChange={(v) => updateSettings({ enableMultiLanguage: v })} /></div>
                      {design.settings.enableMultiLanguage && (<>
                        <div className="space-y-2"><Label className="text-xs">Available Languages</Label>
                          <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                            {LANGUAGE_OPTIONS.map((lang) => (
                              <div key={lang.value} className={cn('flex items-center gap-2 p-1.5 rounded-lg border text-xs cursor-pointer transition-all',
                                design.settings.languages.includes(lang.value) ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300'
                              )} onClick={() => {
                                const curr = design.settings.languages;
                                updateSettings({ languages: curr.includes(lang.value) ? curr.filter((l) => l !== lang.value) : [...curr, lang.value] });
                              }}>
                                <span>{lang.flag}</span>
                                <span className="truncate">{lang.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-2"><Label className="text-xs">Default Language</Label>
                          <Select value={design.settings.defaultLanguage} onValueChange={(v) => updateSettings({ defaultLanguage: v })}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{LANGUAGE_OPTIONS.filter((l) => design.settings.languages.includes(l.value)).map((l) => <SelectItem key={l.value} value={l.value}>{l.flag} {l.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                        {/* Translation inputs for each non-default language */}
                        {design.settings.languages.filter((l) => l !== design.settings.defaultLanguage).map((langCode) => {
                          const langOpt = LANGUAGE_OPTIONS.find((l) => l.value === langCode);
                          if (!langOpt) return null;
                          const langTranslations = design.settings.translations?.[langCode] || {};
                          const updateTranslation = (key: string, value: string) => {
                            const current = { ...(design.settings.translations || {}) };
                            current[langCode] = { ...(current[langCode] || {}), [key]: value };
                            updateSettings({ translations: current });
                          };
                          return (
                            <div key={langCode} className="space-y-2 p-3 rounded-xl border border-border bg-muted/20">
                              <p className="text-xs font-semibold flex items-center gap-1.5">{langOpt.flag} {langOpt.label} <span className="text-muted-foreground font-normal">translations</span></p>
                              <div className="space-y-1.5">
                                <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Title</Label><Input value={langTranslations.title || ''} onChange={(e) => updateTranslation('title', e.target.value)} placeholder={design.title || 'Welcome'} className="text-xs h-8" /></div>
                                <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Subtitle</Label><Input value={langTranslations.subtitle || ''} onChange={(e) => updateTranslation('subtitle', e.target.value)} placeholder={design.subtitle || 'Connect to WiFi'} className="text-xs h-8" /></div>
                                <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Welcome Message</Label><Input value={langTranslations.welcomeMessage || ''} onChange={(e) => updateTranslation('welcomeMessage', e.target.value)} placeholder={design.welcomeMessage || 'Enjoy your stay'} className="text-xs h-8" /></div>
                                <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Hotel Name</Label><Input value={langTranslations.hotelName || ''} onChange={(e) => updateTranslation('hotelName', e.target.value)} placeholder={design.hotelName} className="text-xs h-8" /></div>
                                <div className="space-y-1"><Label className="text-[11px] text-muted-foreground">Hotel Address</Label><Input value={langTranslations.hotelAddress || ''} onChange={(e) => updateTranslation('hotelAddress', e.target.value)} placeholder={design.hotelAddress} className="text-xs h-8" /></div>
                              </div>
                            </div>
                          );
                        })}
                      </>)}
                    </div>
                    <Separator />

                    {/* Branding Content */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Branding</Label></div>
                      <div className="space-y-2"><Label className="text-xs">Portal Title</Label><Input value={design.title} onChange={(e) => updateDesign({ title: e.target.value })} className="text-xs" /></div>
                      <div className="space-y-2"><Label className="text-xs">Subtitle</Label><Input value={design.subtitle} onChange={(e) => updateDesign({ subtitle: e.target.value })} className="text-xs" /></div>
                      {/* Logo Upload */}
                      <div className="space-y-2">
                        <Label className="text-xs">Portal Logo</Label>
                        <div className="flex items-start gap-3">
                          {design.logoUrl ? (
                            <div className="relative group shrink-0">
                              <img src={design.logoUrl} alt="Logo preview" className="w-12 h-12 rounded-xl object-contain border border-border bg-muted/30" />
                              <button type="button" onClick={() => updateDesign({ logoUrl: '' })} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity">✕</button>
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded-xl border-2 border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0 bg-muted/10"><ImagePlus className="w-4 h-4 text-muted-foreground/50" /></div>
                          )}
                          <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={async (e) => {
                              const file = e.target.files?.[0]; if (!file) return; setLogoUploading(true);
                              try { const fd = new FormData(); fd.append('file', file); fd.append('folder', 'portal-logos'); const res = await fetch('/api/upload', { method: 'POST', body: fd }); const json = await res.json(); if (json.success) { updateDesign({ logoUrl: json.data.url }); toast({ title: 'Logo uploaded' }); } else { toast({ title: 'Upload failed', description: json.error?.message || 'Please try again', variant: 'destructive' }); } } catch { toast({ title: 'Upload failed', description: 'Network error', variant: 'destructive' }); } finally { setLogoUploading(false); if (logoInputRef.current) logoInputRef.current.value = ''; }
                            }} />
                            <div className="flex gap-1.5">
                              <Button type="button" size="sm" variant="outline" disabled={logoUploading} onClick={() => logoInputRef.current?.click()} className="text-xs h-7 px-2">{logoUploading ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <ImagePlus className="w-3 h-3 mr-1" />}{logoUploading ? 'Uploading…' : 'Upload'}</Button>
                              <Button type="button" size="sm" variant="ghost" onClick={() => { const url = prompt('Enter logo URL:'); if (url) updateDesign({ logoUrl: url }); }} className="text-xs h-7 px-2 text-muted-foreground">Use URL</Button>
                            </div>
                          </div>
                        </div>
                      </div>
                      {/* Logo Size */}
                      <div className="space-y-2"><Label className="text-xs">Logo Size</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {([['small', 'Small (40px)'], ['medium', 'Medium (56px)'], ['large', 'Large (72px)']] as const).map(([v, l]) => (
                            <button key={v} onClick={() => updateSettings({ logoSize: v })} className={cn('p-2 rounded-lg border-2 text-xs font-medium transition-all text-center', design.settings.logoSize === v ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300')}>{l}</button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-2"><Label className="text-xs">Welcome Message</Label><Textarea value={design.settings.welcomeMessage} onChange={(e) => updateSettings({ welcomeMessage: e.target.value })} className="text-xs" rows={2} /></div>
                      <div className="flex items-center justify-between"><Label className="text-xs">Show Clock</Label><Switch checked={design.settings.showClock} onCheckedChange={(v) => updateSettings({ showClock: v })} /></div>
                      {/* Feature 5: Weather Widget */}
                      <div className="flex items-center justify-between"><Label className="text-xs flex items-center gap-1.5"><Thermometer className="h-3.5 w-3.5" />Show Weather</Label><Switch checked={design.settings.showWeather} onCheckedChange={(v) => updateSettings({ showWeather: v })} /></div>
                      {design.settings.showWeather && (
                        <div className="space-y-2"><Label className="text-xs">City / Location</Label><Input value={design.settings.weatherLocation} onChange={(e) => updateSettings({ weatherLocation: e.target.value })} placeholder="e.g. Paris, London, New York" className="text-xs" /><p className="text-[10px] text-muted-foreground">Used by the weather API to show current conditions</p></div>
                      )}
                    </div>
                    <Separator />

                    {/* Hotel Info */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Hotel Information</Label><Switch checked={design.settings.showHotelInfo} onCheckedChange={(v) => updateSettings({ showHotelInfo: v })} /></div>
                      {design.settings.showHotelInfo && (<>
                        <div className="space-y-2"><Label className="text-xs">Hotel Name</Label><Input value={design.settings.hotelName} onChange={(e) => updateSettings({ hotelName: e.target.value })} className="text-xs" /></div>
                        <div className="space-y-2"><Label className="text-xs">Address</Label><Input value={design.settings.hotelAddress} onChange={(e) => updateSettings({ hotelAddress: e.target.value })} className="text-xs" /></div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2"><Label className="text-xs">Phone</Label><Input value={design.settings.hotelPhone} onChange={(e) => updateSettings({ hotelPhone: e.target.value })} className="text-xs" /></div>
                          <div className="space-y-2"><Label className="text-xs">Website</Label><Input value={design.settings.hotelWebsite} onChange={(e) => updateSettings({ hotelWebsite: e.target.value })} className="text-xs" /></div>
                        </div>
                      </>)}
                    </div>
                    <Separator />

                    {/* Amenities + Feature 7: Custom Amenities */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Amenities</Label><Switch checked={design.settings.showAmenities} onCheckedChange={(v) => updateSettings({ showAmenities: v })} /></div>
                      {design.settings.showAmenities && (<>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.keys(AMENITY_ICONS).map((am) => (
                            <div key={am} className={cn('flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all', design.settings.amenities.includes(am) ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300')} onClick={() => { const curr = design.settings.amenities; updateSettings({ amenities: curr.includes(am) ? curr.filter((a) => a !== am) : [...curr, am] }); }}>
                              {React.createElement(AMENITY_ICONS[am], { className: 'h-3.5 w-3.5 text-teal-500 dark:text-teal-400 flex-shrink-0' })}<span className="truncate">{am}</span>
                            </div>
                          ))}
                          {/* Custom Amenities */}
                          {design.settings.customAmenities.map((ca, i) => {
                            const CIcon = CUSTOM_AMENITY_ICONS[ca.icon] || Star;
                            return (
                              <div key={`custom-${i}`} className="flex items-center gap-2 p-2 rounded-lg border border-teal-500 bg-teal-50/50 dark:bg-teal-950/20 text-xs">
                                {React.createElement(CIcon, { className: 'h-3.5 w-3.5 text-teal-500 dark:text-teal-400 flex-shrink-0' })}
                                <span className="truncate flex-1">{ca.name}</span>
                                <button onClick={() => updateSettings({ customAmenities: design.settings.customAmenities.filter((_, idx) => idx !== i) })} className="text-destructive hover:text-destructive/80 flex-shrink-0"><XCircle className="h-3 w-3" /></button>
                              </div>
                            );
                          })}
                          <button onClick={() => updateSettings({ customAmenities: [...design.settings.customAmenities, { name: 'Custom Amenity', icon: 'Star' }] })} className="flex items-center justify-center gap-1 p-2 rounded-lg border-2 border-dashed text-xs text-muted-foreground hover:text-foreground hover:border-teal-300 transition-all"><PlusCircle className="h-3.5 w-3.5" />Add Custom</button>
                        </div>
                        {/* Edit custom amenity names */}
                        {design.settings.customAmenities.map((ca, i) => (
                          <div key={`edit-custom-${i}`} className="flex items-center gap-2">
                            <Input value={ca.name} onChange={(e) => {
                              const updated = [...design.settings.customAmenities]; updated[i] = { ...updated[i], name: e.target.value };
                              updateSettings({ customAmenities: updated });
                            }} className="text-xs flex-1" placeholder="Amenity name" />
                            <Select value={ca.icon} onValueChange={(v) => {
                              const updated = [...design.settings.customAmenities]; updated[i] = { ...updated[i], icon: v };
                              updateSettings({ customAmenities: updated });
                            }}><SelectTrigger className="text-xs w-32"><SelectValue /></SelectTrigger><SelectContent>{CUSTOM_AMENITY_ICON_OPTIONS.map((opt) => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select>
                          </div>
                        ))}
                      </>)}
                    </div>
                    <Separator />

                    {/* Feature 6: Terms & Conditions Editor */}
                    <div className="space-y-3">
                      <Label className="text-xs font-semibold flex items-center gap-1.5"><FileText className="h-3.5 w-3.5" />Terms & Conditions</Label>
                      <div className="space-y-2"><Label className="text-xs">Terms Text</Label><Textarea value={design.settings.termsText} onChange={(e) => updateSettings({ termsText: e.target.value })} className="text-xs" rows={3} placeholder="Enter your terms and conditions text..." /></div>
                      <div className="space-y-2"><Label className="text-xs">Terms URL</Label><Input value={design.settings.termsUrl} onChange={(e) => updateSettings({ termsUrl: e.target.value })} className="text-xs" placeholder="https://hotel.com/terms" /></div>
                      <p className="text-[10px] text-muted-foreground">Enable the &quot;Show Terms Checkbox&quot; in the Fields tab to display a terms agreement on the portal.</p>
                    </div>
                    <Separator />

                    {/* Feature 3: Promotions (Single + Carousel) */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Promotions</Label><Switch checked={design.settings.showPromotion} onCheckedChange={(v) => updateSettings({ showPromotion: v })} /></div>
                      {design.settings.showPromotion && (<>
                        <div className="flex items-center justify-between"><Label className="text-xs">Carousel Mode</Label><Switch checked={design.settings.useCarouselMode} onCheckedChange={(v) => updateSettings({ useCarouselMode: v })} /></div>
                        {!design.settings.useCarouselMode ? (
                          <>
                            <div className="space-y-2"><Label className="text-xs">Promotion Title</Label><Input value={design.settings.promotionTitle} onChange={(e) => updateSettings({ promotionTitle: e.target.value })} className="text-xs" /></div>
                            <div className="space-y-2"><Label className="text-xs">Description</Label><Textarea value={design.settings.promotionDesc} onChange={(e) => updateSettings({ promotionDesc: e.target.value })} className="text-xs" rows={2} /></div>
                          </>
                        ) : (
                          <>
                            {design.settings.promotions.map((slide, i) => (
                              <div key={i} className="rounded-lg border p-3 space-y-2 relative">
                                <div className="flex items-center justify-between">
                                  <p className="text-xs font-semibold">Slide {i + 1}</p>
                                  <button onClick={() => updateSettings({ promotions: design.settings.promotions.filter((_, idx) => idx !== i) })} className="text-destructive hover:text-destructive/80"><MinusCircle className="h-3.5 w-3.5" /></button>
                                </div>
                                <div className="space-y-1.5">
                                  <Input value={slide.title} onChange={(e) => { const updated = [...design.settings.promotions]; updated[i] = { ...updated[i], title: e.target.value }; updateSettings({ promotions: updated }); }} className="text-xs" placeholder="Title" />
                                  <Textarea value={slide.description} onChange={(e) => { const updated = [...design.settings.promotions]; updated[i] = { ...updated[i], description: e.target.value }; updateSettings({ promotions: updated }); }} className="text-xs" rows={2} placeholder="Description" />
                                  <div className="grid grid-cols-2 gap-2">
                                    <Input value={slide.imageUrl} onChange={(e) => { const updated = [...design.settings.promotions]; updated[i] = { ...updated[i], imageUrl: e.target.value }; updateSettings({ promotions: updated }); }} className="text-xs" placeholder="Image URL" />
                                    <Input value={slide.linkUrl} onChange={(e) => { const updated = [...design.settings.promotions]; updated[i] = { ...updated[i], linkUrl: e.target.value }; updateSettings({ promotions: updated }); }} className="text-xs" placeholder="Link URL" />
                                  </div>
                                  <div className="flex items-center gap-2"><Label className="text-[10px] text-muted-foreground">BG Color</Label><input type="color" value={slide.bgColor} onChange={(e) => { const updated = [...design.settings.promotions]; updated[i] = { ...updated[i], bgColor: e.target.value }; updateSettings({ promotions: updated }); }} className="w-6 h-6 rounded cursor-pointer border-0" /></div>
                                </div>
                              </div>
                            ))}
                            <Button variant="outline" size="sm" onClick={() => updateSettings({ promotions: [...design.settings.promotions, { title: '', description: '', imageUrl: '', linkUrl: '', bgColor: '#f59e0b' }] })} className="text-xs w-full"><PlusCircle className="h-3.5 w-3.5 mr-1.5" />Add Slide</Button>
                          </>
                        )}
                      </>)}
                    </div>
                    <Separator />

                    {/* Feature 2: Marketing Opt-In */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold flex items-center gap-1.5"><Megaphone className="h-3.5 w-3.5" />Marketing Consent</Label><Switch checked={design.settings.marketingOptIn.enabled} onCheckedChange={(v) => updateSettings({ marketingOptIn: { ...design.settings.marketingOptIn, enabled: v } })} /></div>
                      {design.settings.marketingOptIn.enabled && (<>
                        <div className="flex items-center justify-between"><Label className="text-xs">Email Marketing</Label><Switch checked={design.settings.marketingOptIn.emailConsent} onCheckedChange={(v) => updateSettings({ marketingOptIn: { ...design.settings.marketingOptIn, emailConsent: v } })} /></div>
                        <div className="flex items-center justify-between"><Label className="text-xs">SMS Marketing</Label><Switch checked={design.settings.marketingOptIn.phoneConsent} onCheckedChange={(v) => updateSettings({ marketingOptIn: { ...design.settings.marketingOptIn, phoneConsent: v } })} /></div>
                        <div className="space-y-2"><Label className="text-xs">Consent Text (GDPR-style)</Label><Textarea value={design.settings.marketingOptIn.consentText} onChange={(e) => updateSettings({ marketingOptIn: { ...design.settings.marketingOptIn, consentText: e.target.value } })} className="text-xs" rows={2} /></div>
                      </>)}
                    </div>
                    <Separator />

                    {/* Feature 8: More Social Platforms */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold">Social Media</Label><Switch checked={design.settings.showSocialMedia} onCheckedChange={(v) => updateSettings({ showSocialMedia: v })} /></div>
                      {design.settings.showSocialMedia && (
                        <div className="space-y-2">
                          {SOCIAL_PLATFORM_OPTIONS.map((sp) => {
                            const SIcon = sp.icon;
                            return (
                              <div key={sp.value} className="flex items-center gap-2">
                                <SIcon className={cn('h-4 w-4 flex-shrink-0', sp.color)} />
                                <Input placeholder={`${sp.label} URL`} value={design.settings.socialLinks.find((s) => s.platform === sp.value)?.url || ''} onChange={(e) => {
                                  const links = design.settings.socialLinks.filter((s) => s.platform !== sp.value);
                                  links.push({ platform: sp.value, url: e.target.value });
                                  updateSettings({ socialLinks: links });
                                }} className="text-xs" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <Separator />

                    {/* Feature 4: Guest Survey */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5" />Guest Survey</Label><Switch checked={design.settings.surveyConfig.enabled} onCheckedChange={(v) => updateSettings({ surveyConfig: { ...design.settings.surveyConfig, enabled: v } })} /></div>
                      {design.settings.surveyConfig.enabled && (<>
                        <div className="space-y-2"><Label className="text-xs">Survey Question</Label><Input value={design.settings.surveyConfig.question} onChange={(e) => updateSettings({ surveyConfig: { ...design.settings.surveyConfig, question: e.target.value } })} className="text-xs" /></div>
                        <div className="space-y-2"><Label className="text-xs">Rating Options (one per line)</Label><Textarea value={design.settings.surveyConfig.options.join('\n')} onChange={(e) => updateSettings({ surveyConfig: { ...design.settings.surveyConfig, options: e.target.value.split('\n').filter(Boolean) } })} className="text-xs" rows={3} /></div>
                        <div className="space-y-2"><Label className="text-xs">Thank You Message</Label><Input value={design.settings.surveyConfig.thankYouMessage} onChange={(e) => updateSettings({ surveyConfig: { ...design.settings.surveyConfig, thankYouMessage: e.target.value } })} className="text-xs" /></div>
                      </>)}
                    </div>
                    <Separator />

                    {/* Feature 9: Content Block Reordering */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs font-semibold flex items-center gap-1.5"><GripVertical className="h-3.5 w-3.5" />Content Block Order</Label>
                        <Button variant="ghost" size="sm" className="text-[10px] h-6 px-2" onClick={() => updateSettings({ contentBlockOrder: [...DEFAULT_CONTENT_BLOCKS] })}>Reset to Default</Button>
                      </div>
                      <div className="space-y-1">
                        {design.settings.contentBlockOrder.map((block, i) => (
                          <div key={block} className="flex items-center gap-2 p-2 rounded-lg border text-xs">
                            <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <span className="flex-1 font-medium">{CONTENT_BLOCK_LABELS[block] || block}</span>
                            <div className="flex gap-0.5">
                              <button onClick={() => { const arr = [...design.settings.contentBlockOrder]; if (i > 0) { [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]; updateSettings({ contentBlockOrder: arr }); } }} className="p-0.5 rounded hover:bg-muted disabled:opacity-30" disabled={i === 0}><ChevronUp className="h-3.5 w-3.5" /></button>
                              <button onClick={() => { const arr = [...design.settings.contentBlockOrder]; if (i < arr.length - 1) { [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]; updateSettings({ contentBlockOrder: arr }); } }} className="p-0.5 rounded hover:bg-muted disabled:opacity-30" disabled={i === design.settings.contentBlockOrder.length - 1}><ChevronDown className="h-3.5 w-3.5" /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── Fields Sub-Tab ─────────────────────────────────────────── */}
                {subTab === 'fields' && (
                  <div className="space-y-5">
                    <div>
                      <h3 className="text-sm font-semibold flex items-center gap-2"><Settings className="h-4 w-4" />Form Fields</h3>
                      <p className="text-xs text-muted-foreground mt-1">Toggle fields shown on the guest login form. Changing auth flow auto-configures defaults.</p>
                    </div>
                    {isOverride && (
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                        <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                        <span>Fields differ from credential policy defaults. <button onClick={resetToPolicy} className="underline font-semibold">Reset to policy</button></span>
                      </div>
                    )}
                    {['Guest Identity', 'Credentials', 'Legal'].map((group) => (
                      <div key={group}>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{group}</p>
                        <div className="space-y-1">
                          {FIELD_DEFINITIONS.filter((f) => f.group === group).map((f) => {
                            const Icon = f.icon;
                            const isOn = design.fields[f.key];
                            return (
                              <div key={f.key} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                                <div className="flex items-center gap-2.5">
                                  <Icon className={cn('h-4 w-4', isOn ? 'text-teal-500 dark:text-teal-400' : 'text-muted-foreground/50')} />
                                  <span className={cn('text-xs font-medium', isOn ? 'text-foreground' : 'text-muted-foreground')}>{f.label}</span>
                                </div>
                                <Switch checked={isOn} onCheckedChange={() => toggleField(f.key)} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <Separator />
                    <div><h3 className="text-sm font-semibold">Social Login</h3></div>
                    <div className="space-y-1">
                      {([['google', 'Google'], ['facebook', 'Facebook'], ['apple', 'Apple']] as const).map(([k, l]) => (
                        <div key={k} className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors">
                          <span className="text-xs font-medium">{l}</span>
                          <Switch checked={design.socialLogin[k]} onCheckedChange={() => toggleSocial(k)} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Advanced Sub-Tab ───────────────────────────────────────── */}
                {subTab === 'advanced' && (
                  <div className="space-y-5">
                    <div><h3 className="text-sm font-semibold flex items-center gap-2"><Wand2 className="h-4 w-4" />Advanced Settings</h3><p className="text-xs text-muted-foreground mt-1">For developers and advanced customization</p></div>
                    <div className="space-y-2"><Label className="text-xs">Custom CSS</Label><Textarea value={design.customCSS} onChange={(e) => updateDesign({ customCSS: e.target.value })} className="font-mono text-xs min-h-[120px]" placeholder="/* Custom CSS */" /></div>
                    <div className="space-y-2"><Label className="text-xs">Custom HTML Injection</Label><Textarea value={design.customHTML} onChange={(e) => updateDesign({ customHTML: e.target.value })} className="font-mono text-xs min-h-[100px]" placeholder="<div>Custom HTML</div>" /></div>
                    <Separator />
                    <div className="flex items-center justify-between p-3 rounded-lg border">
                      <div><p className="text-xs font-medium">Show Hotel Branding</p><p className="text-[10px] text-muted-foreground">Powered by branding at bottom</p></div>
                      <Switch checked={true} disabled />
                    </div>
                    <Separator />
                    {/* Feature 14: Portal Scheduling */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between"><Label className="text-xs font-semibold flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />Portal Scheduling</Label><Switch checked={design.settings.scheduleConfig.enabled} onCheckedChange={(v) => updateSettings({ scheduleConfig: { ...design.settings.scheduleConfig, enabled: v } })} /></div>
                      {design.settings.scheduleConfig.enabled && (<>
                        <p className="text-[10px] text-muted-foreground">Define time-based schedules for different portal content or designs.</p>
                        {design.settings.scheduleConfig.schedules.map((sched, i) => (
                          <div key={i} className="rounded-lg border p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1"><Input value={sched.name} onChange={(e) => { const updated = [...design.settings.scheduleConfig.schedules]; updated[i] = { ...updated[i], name: e.target.value }; updateSettings({ scheduleConfig: { ...design.settings.scheduleConfig, schedules: updated } }); }} className="text-xs" placeholder="Schedule name" /></div>
                              <button onClick={() => updateSettings({ scheduleConfig: { ...design.settings.scheduleConfig, schedules: design.settings.scheduleConfig.schedules.filter((_, idx) => idx !== i) } })} className="text-destructive hover:text-destructive/80 ml-2"><MinusCircle className="h-3.5 w-3.5" /></button>
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {DAY_LABELS.map((day, di) => (
                                <button key={day} onClick={() => { const updated = [...design.settings.scheduleConfig.schedules]; const newDays = [...updated[i].days]; newDays[di] = !newDays[di]; updated[i] = { ...updated[i], days: newDays }; updateSettings({ scheduleConfig: { ...design.settings.scheduleConfig, schedules: updated } }); }}
                                  className={cn('px-2 py-1 rounded text-[10px] font-medium border transition-all', sched.days[di] ? 'bg-teal-500 text-white border-teal-500' : 'border-border text-muted-foreground hover:border-teal-300')}>{day}</button>
                              ))}
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">Start Time</Label><Input type="time" value={sched.startTime} onChange={(e) => { const updated = [...design.settings.scheduleConfig.schedules]; updated[i] = { ...updated[i], startTime: e.target.value }; updateSettings({ scheduleConfig: { ...design.settings.scheduleConfig, schedules: updated } }); }} className="text-xs" /></div>
                              <div className="space-y-1"><Label className="text-[10px] text-muted-foreground">End Time</Label><Input type="time" value={sched.endTime} onChange={(e) => { const updated = [...design.settings.scheduleConfig.schedules]; updated[i] = { ...updated[i], endTime: e.target.value }; updateSettings({ scheduleConfig: { ...design.settings.scheduleConfig, schedules: updated } }); }} className="text-xs" /></div>
                            </div>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" onClick={() => { const newSched = { name: '', days: [true, true, true, true, true, true, true], startTime: '09:00', endTime: '18:00' }; updateSettings({ scheduleConfig: { ...design.settings.scheduleConfig, schedules: [...design.settings.scheduleConfig.schedules, newSched] } }); }} className="text-xs w-full"><PlusCircle className="h-3.5 w-3.5 mr-1.5" />Add Schedule</Button>
                      </>)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Live Preview Content — Renders inside the device frame
// ═══════════════════════════════════════════════════════════════════════════════

function PortalPreviewContent({ design, visibleFields }: { design: PortalPageDesign; visibleFields: typeof FIELD_DEFINITIONS }) {
  const s = design.settings;
  const isDark = s.backgroundType === 'solid' && design.backgroundColor.match(/^#[0-3]/);
  const isGlass = s.formStyle === 'glass' || s.formStyle === 'minimal';
  const inputCls = getInputClasses(s);
  const btnCls = getButtonClasses(s);
  const formCls = getFormClasses(s);

  return (
    <div className="flex flex-col items-center px-4 py-8 gap-4" style={{ fontFamily: s.fontFamily }}>
      {/* Promotion Banner */}
      {s.showPromotion && (
        <div className={cn('w-full max-w-[240px] rounded-lg p-2.5 text-center', isGlass ? 'bg-amber-500/20 border border-amber-400/30' : 'bg-amber-500/90')}>
          <p className="text-[10px] font-bold text-amber-100">{s.promotionTitle}</p>
          <p className="text-[9px] text-amber-200/80 mt-0.5">{s.promotionDesc}</p>
        </div>
      )}

      {/* Logo */}
      {(() => {
        const logoPx = s.logoSize === 'small' ? 'w-8 h-8' : s.logoSize === 'medium' ? 'w-10 h-10' : 'w-12 h-12';
        return design.logoUrl ? (
          <img src={design.logoUrl} alt="Logo" className={cn(logoPx, 'rounded-xl object-cover bg-white/20 shadow-lg')} />
        ) : (
          <div className={cn(logoPx, 'rounded-xl flex items-center justify-center', isGlass ? 'bg-white/10' : 'bg-white/20')}>
            <Building className={cn(s.logoSize === 'small' ? 'h-3 w-3' : s.logoSize === 'medium' ? 'h-4 w-4' : 'h-5 w-5', 'opacity-70')} />
          </div>
        );
      })()}

      {/* Title & Subtitle */}
      <div className="text-center">
        <h1 className="text-base font-bold" style={{ fontFamily: s.headingFontFamily }}>{design.title}</h1>
        <p className="text-[11px] opacity-80 mt-1">{design.subtitle}</p>
        {s.welcomeMessage && <p className="text-[10px] opacity-60 mt-1 italic">{s.welcomeMessage}</p>}
      </div>

      {/* Hotel Info */}
      {s.showHotelInfo && (
        <div className="w-full max-w-[240px] space-y-1 text-center">
          <p className="text-[10px] font-semibold">{s.hotelName}</p>
          <div className="flex items-center justify-center gap-1 text-[9px] opacity-70"><MapPin className="h-2.5 w-2.5" />{s.hotelAddress}</div>
          <div className="flex items-center justify-center gap-3 text-[9px] opacity-70">
            <span className="flex items-center gap-0.5"><Phone className="h-2.5 w-2.5" />{s.hotelPhone}</span>
            <span className="flex items-center gap-0.5"><Globe className="h-2.5 w-2.5" />{s.hotelWebsite}</span>
          </div>
        </div>
      )}

      {/* Form */}
      <div className={cn('w-full max-w-[240px] p-4 space-y-3', formCls)}>
        {/* Auth Flow Indicator */}
        <div className="flex items-center gap-1.5">
          <Wifi className={cn('h-3.5 w-3.5', isGlass ? 'text-white/60' : 'text-gray-400')} />
          <span className="text-[10px] font-semibold opacity-70 uppercase tracking-wider">
            {design.authFlow === 'room_number' ? 'Enter Room' : design.authFlow === 'voucher' ? 'Enter Voucher' : design.authFlow === 'sms_otp' ? 'OTP Login' : design.authFlow === 'open_access' ? 'Free Access' : 'Sign In'}
          </span>
        </div>

        {/* Fields */}
        {visibleFields.map((f) => {
          const Icon = f.icon;
          const isCredential = f.key === 'username' || f.key === 'password';
          const isVoucher = f.key === 'voucherCode';
          const placeholder = isCredential
            ? f.key === 'username' ? 'Username' : 'Password'
            : isVoucher ? 'XXXXX-XXXXX'
            : f.key === 'roomNumber' ? 'Room Number'
            : f.key === 'phone' ? 'Phone Number'
            : f.key === 'email' ? 'Email Address'
            : f.key === 'terms' ? '' : f.label;
          if (f.key === 'terms') {
            return (
              <label key={f.key} className="flex items-start gap-2 text-[9px] opacity-70 cursor-pointer">
                <div className={cn('w-3.5 h-3.5 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center', isGlass ? 'border-white/30' : 'border-gray-300')}>
                  <CheckCircle2 className="h-2.5 w-2.5 text-teal-500 dark:text-teal-400" />
                </div>
                <span>I agree to the <span className="underline">Terms & Conditions</span></span>
              </label>
            );
          }
          return (
            <div key={f.key} className="relative">
              {!isCredential && !isVoucher && <Icon className={cn('absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 opacity-40', isGlass ? 'text-white/50' : 'text-gray-400')} />}
              <div className={cn(
                isCredential ? '' : !isCredential && !isVoucher ? 'pl-7' : '',
                isVoucher ? 'text-center font-mono font-bold tracking-wider uppercase text-[10px]' : '',
                inputCls, isGlass ? 'text-white placeholder:text-white/40' : 'text-gray-800 placeholder:text-gray-400', 'w-full outline-none flex items-center'
              )}>
                <span className="opacity-50">{placeholder}</span>
              </div>
            </div>
          );
        })}

        {/* Social Login */}
        {(design.socialLogin.google || design.socialLogin.facebook || design.socialLogin.apple) && (
          <div className="flex gap-2 pt-1">
            {design.socialLogin.google && <div className={cn('flex-1 py-1.5 rounded text-center text-[9px] font-medium', isGlass ? 'bg-white/10 border border-white/20' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>Google</div>}
            {design.socialLogin.facebook && <div className={cn('flex-1 py-1.5 rounded text-center text-[9px] font-medium', isGlass ? 'bg-white/10 border border-white/20' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>Facebook</div>}
            {design.socialLogin.apple && <div className={cn('flex-1 py-1.5 rounded text-center text-[9px] font-medium', isGlass ? 'bg-white/10 border border-white/20' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>Apple</div>}
          </div>
        )}

        {/* Connect Button */}
        <div className={cn(btnCls, 'w-full text-center cursor-pointer')} style={{ background: design.brandColor }}>
          <span className="flex items-center justify-center gap-1.5">
            <Wifi className="h-3.5 w-3.5" />Connect
            <ArrowRight className="h-3 w-3 ml-1" />
          </span>
        </div>
      </div>

      {/* Amenities */}
      {s.showAmenities && s.amenities.length > 0 && (
        <div className="w-full max-w-[240px]">
          <div className="grid grid-cols-3 gap-1.5">
            {s.amenities.slice(0, 6).map((am) => {
              const AmIcon = AMENITY_ICONS[am] || Star;
              return (
                <div key={am} className={cn('flex flex-col items-center gap-0.5 p-1.5 rounded', isGlass ? 'bg-white/5' : 'bg-black/5')}>
                  <AmIcon className={cn('h-3 w-3', isGlass ? 'text-white/60' : 'text-gray-500')} />
                  <span className="text-[7px] text-center leading-tight opacity-70">{am}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Social Links */}
      {s.showSocialMedia && (
        <div className="flex items-center gap-3">
          {s.socialLinks.filter((l) => l.url).map((l) => {
            const SIcon = l.platform === 'instagram' ? Instagram : l.platform === 'facebook' ? Facebook : Twitter;
            return <SIcon key={l.platform} className="h-3.5 w-3.5 opacity-50 hover:opacity-100 cursor-pointer transition-opacity" />;
          })}
        </div>
      )}

      {/* Clock */}
      {s.showClock && (
        <div className="flex items-center gap-1 text-[10px] opacity-50">
          <Clock className="h-3 w-3" />
          <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      )}

      {/* Weather */}
      {s.showWeather && (
        <div className="flex items-center gap-1 text-[10px] opacity-50">
          <Thermometer className="h-3 w-3" />
          <span>{s.weatherLocation ? `${s.weatherLocation} — 22°C` : 'Weather — set location'}</span>
        </div>
      )}

      {/* Survey */}
      {s.surveyConfig?.enabled && (
        <div className={cn('w-full max-w-[240px] rounded-lg p-2.5 space-y-1.5', isGlass ? 'bg-white/10 border border-white/20' : 'bg-black/5 border')}>
          <p className="text-[9px] font-semibold opacity-70">{s.surveyConfig.question}</p>
          <div className="flex gap-1 flex-wrap">
            {s.surveyConfig.options.slice(0, 4).map((opt) => (
              <span key={opt} className="text-[7px] px-1.5 py-0.5 rounded-full border opacity-50">{opt}</span>
            ))}
          </div>
        </div>
      )}

      {/* Marketing Opt-In */}
      {s.marketingOptIn?.enabled && (
        <div className="w-full max-w-[240px] flex items-center gap-1.5 text-[8px] opacity-50">
          <Megaphone className="h-2.5 w-2.5 flex-shrink-0" />
          <span>{s.marketingOptIn.consentText || 'Receive promotional offers'}</span>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-[8px] opacity-30 mt-2">
        <p>Powered by StaySuite Hospitality OS</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Mini Layout Preview — Visual thumbnail for layout selection
// ═══════════════════════════════════════════════════════════════════════════════

function LayoutMiniPreview({ layout }: { layout: string }) {
  const outerCls = 'w-12 h-8 rounded border border-gray-300 relative overflow-hidden';
  const formCls = 'absolute bg-teal-500/30 border border-teal-400/50 rounded-sm';

  switch (layout) {
    case 'centered':
      return (
        <div className={outerCls} style={{ background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)' }}>
          <div className={cn(formCls, 'w-6 h-4 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded')} />
        </div>
      );
    case 'split_left':
      return (
        <div className={outerCls}>
          <div className="absolute left-0 top-0 w-5 h-full bg-gradient-to-br from-teal-400/30 to-emerald-400/30" />
          <div className={cn(formCls, 'right-1 top-1/2 -translate-y-1/2 w-5 h-5')} />
        </div>
      );
    case 'split_right':
      return (
        <div className={outerCls}>
          <div className={cn(formCls, 'left-1 top-1/2 -translate-y-1/2 w-5 h-5')} />
          <div className="absolute right-0 top-0 w-5 h-full bg-gradient-to-br from-teal-400/30 to-emerald-400/30" />
        </div>
      );
    case 'card':
      return (
        <div className={outerCls} style={{ background: 'linear-gradient(135deg, #e2e8f0, #cbd5e1)' }}>
          <div className={cn(formCls, 'w-7 h-5 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-md')} />
        </div>
      );
    case 'full_bleed':
      return (
        <div className={outerCls}>
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/30 to-blue-500/30" />
          <div className={cn(formCls, 'w-7 h-4 left-1/2 bottom-1.5 -translate-x-1/2 backdrop-blur bg-white/20')} />
        </div>
      );
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 3: Voucher Designer
// ═══════════════════════════════════════════════════════════════════════════════

interface VoucherEntry {
  id: string;
  code: string;
  planId: string;
  planName?: string;
  planSpeed?: string;
  status: string;
  isUsed: boolean;
  validFrom: string;
  validUntil: string;
  issuedTo?: string | null;
  issuedAt?: string | null;
  guestId?: string | null;
  bookingId?: string | null;
  notes?: string | null;
  createdAt: string;
}

interface VoucherStats {
  total: number;
  active: number;
  used: number;
  expired: number;
  revoked: number;
}

function VoucherDesignerTab({ portalOptions }: { portalOptions: Array<{ id: string; name: string }> }) {
  const [subView, setSubView] = useState<'designer' | 'list'>('designer');
  const [template, setTemplate] = useState('default');
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [guests, setGuests] = useState<any[]>([]);
  const { propertyId } = usePropertyId();
  const { toast } = useToast();

  // ── Voucher list state ──
  const [vouchers, setVouchers] = useState<VoucherEntry[]>([]);
  const [voucherStats, setVoucherStats] = useState<VoucherStats>({ total: 0, active: 0, used: 0, expired: 0, revoked: 0 });
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherSearch, setVoucherSearch] = useState('');
  const [voucherStatusFilter, setVoucherStatusFilter] = useState('all');
  const [voucherPage, setVoucherPage] = useState(0);
  const PAGE_SIZE = 20;

  // ── Generate dialog state ──
  const [genOpen, setGenOpen] = useState(false);
  const [genPlanId, setGenPlanId] = useState('');
  const [genQuantity, setGenQuantity] = useState(10);
  const [genValidityDays, setGenValidityDays] = useState(1);
  const [genNotes, setGenNotes] = useState('');
  const [genSaving, setGenSaving] = useState(false);

  // ── Issue dialog state ──
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueVoucher, setIssueVoucher] = useState<VoucherEntry | null>(null);
  const [issueTo, setIssueTo] = useState('');
  const [issueSaving, setIssueSaving] = useState(false);

  // ── Voucher preview state ──
  const [previewVoucher, setPreviewVoucher] = useState<VoucherEntry | null>(null);

  const [plans, setPlans] = useState<Array<{ id: string; name: string; downloadSpeed?: number; uploadSpeed?: number; validityDays?: number; price?: number }>>([]);

  // Load today's check-ins for voucher card preview
  useEffect(() => {
    async function load() {
      setLoading(true);
      const data = await apiFetch<any>(`/api/wifi/portal/vouchers?propertyId=${propertyId || 'default'}`);
      const v = data?.vouchers;
      if (v && Array.isArray(v)) {
        setGuests(v);
        if (v.length > 0) setSelectedGuest(v[0]);
      } else { setGuests([]); }
      setLoading(false);
    }
    void load();
  }, [propertyId]);

  // Load plans for generate dialog
  useEffect(() => {
    apiFetch<any[]>('/api/wifi/plans').then(data => {
      if (data) setPlans(data.map((p: any) => ({ id: p.id, name: p.name, downloadSpeed: p.downloadSpeed, uploadSpeed: p.uploadSpeed, validityDays: p.validityDays, price: p.price })));
    });
  }, []);

  // Fetch vouchers list
  const fetchVouchers = useCallback(async () => {
    setVoucherLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      params.set('offset', String(voucherPage * PAGE_SIZE));
      if (voucherStatusFilter !== 'all') params.set('status', voucherStatusFilter);
      if (voucherSearch) params.set('search', voucherSearch);
      if (propertyId) params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/vouchers?${params.toString()}`);
      const result = await res.json();
      if (result.success) {
        setVouchers((result.data || []).map((v: any) => ({
          id: v.id, code: v.code, planId: v.planId, planName: v.plan?.name || '—',
          planSpeed: v.plan ? `${v.plan.downloadSpeed || 0}/${v.plan.uploadSpeed || 0} Mbps` : '',
          status: v.status, isUsed: v.isUsed,
          validFrom: v.validFrom, validUntil: v.validUntil,
          issuedTo: v.issuedTo, issuedAt: v.issuedAt, guestId: v.guestId, bookingId: v.bookingId,
          notes: v.notes, createdAt: v.createdAt,
        })));
        // Stats
        const summary = result.summary?.byStatus || {};
        setVoucherStats({
          total: result.pagination?.total || 0,
          active: summary.active || 0,
          used: summary.used || 0,
          expired: summary.expired || 0,
          revoked: summary.revoked || 0,
        });
      }
    } catch (e) { console.error('Voucher fetch error:', e); }
    setVoucherLoading(false);
  }, [propertyId, voucherPage, voucherStatusFilter, voucherSearch]);

  useEffect(() => {
    if (subView === 'list') void fetchVouchers();
  }, [subView, fetchVouchers]);

  // Generate vouchers
  const handleGenerate = async () => {
    if (!genPlanId) { toast({ title: 'Error', description: 'Select a WiFi plan', variant: 'destructive' }); return; }
    setGenSaving(true);
    const { error } = await apiMutate('/api/wifi/vouchers', {
      method: 'POST',
      body: JSON.stringify({ planId: genPlanId, quantity: genQuantity, validityDays: genValidityDays, notes: genNotes || undefined }),
    });
    setGenSaving(false);
    if (error) { toast({ title: 'Generation Failed', description: error, variant: 'destructive' }); return; }
    toast({ title: 'Vouchers Generated', description: `${genQuantity} voucher(s) created successfully` });
    setGenOpen(false); setGenQuantity(10); setGenValidityDays(1); setGenNotes('');
    setSubView('list');
  };

  // Issue voucher
  const handleIssue = async () => {
    if (!issueVoucher || !issueTo.trim()) return;
    setIssueSaving(true);
    const { error } = await apiMutate('/api/wifi/vouchers', {
      method: 'PUT',
      body: JSON.stringify({ id: issueVoucher.id, action: 'issue', issuedTo: issueTo.trim() }),
    });
    setIssueSaving(false);
    if (error) { toast({ title: 'Issue Failed', description: error, variant: 'destructive' }); return; }
    toast({ title: 'Voucher Issued', description: `Issued to ${issueTo.trim()}` });
    setIssueOpen(false); setIssueTo(''); fetchVouchers();
  };

  // Revoke voucher
  const handleRevoke = async (voucher: VoucherEntry) => {
    const res = await fetch(`/api/wifi/vouchers?id=${voucher.id}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) { toast({ title: 'Revoked', description: `Voucher ${voucher.code} revoked` }); fetchVouchers(); }
    else toast({ title: 'Error', description: result.error?.message || 'Failed to revoke', variant: 'destructive' });
  };

  // Copy code
  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: 'Copied', description: `${code} copied to clipboard` });
  };

  const handlePrint = (guest: any) => {
    setSelectedGuest(guest);
    toast({ title: 'Printing voucher', description: `Voucher for ${guest.guestName} sent to printer` });
  };

  const voucherStyle = useMemo(() => {
    switch (template) {
      case 'luxury': return { bg: 'bg-gray-900', text: 'text-amber-50', accent: 'text-amber-400 dark:text-amber-300', border: 'border-amber-600/30', cardBg: 'bg-gray-800' };
      case 'elegant': return { bg: 'bg-gradient-to-br from-slate-50 to-slate-100', text: 'text-slate-800', accent: 'text-teal-600 dark:text-teal-400', border: 'border-teal-200', cardBg: 'bg-white' };
      case 'minimal': return { bg: 'bg-white', text: 'text-gray-800', accent: 'text-teal-500 dark:text-teal-400', border: 'border-gray-200', cardBg: 'bg-white' };
      default: return { bg: 'bg-white', text: 'text-gray-800', accent: 'text-teal-600 dark:text-teal-400', border: 'border-teal-100', cardBg: 'bg-white' };
    }
  }, [template]);

  return (
    <div className="space-y-4">
      {/* Sub-view toggle */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        <button onClick={() => setSubView('designer')} className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5', subView === 'designer' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          <Eye className="h-3.5 w-3.5" /> Card Designer
        </button>
        <button onClick={() => setSubView('list')} className={cn('px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1.5', subView === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
          <Ticket className="h-3.5 w-3.5" /> Manage Vouchers
        </button>
      </div>

      {subView === 'designer' && (
        <>
          {/* Template Selector */}
          <div className="flex items-center gap-3 flex-wrap">
            <Label className="text-sm font-medium">Template:</Label>
            <div className="flex gap-2">
              {VOUCHER_TEMPLATES.map((vt) => (
                <Tooltip key={vt.value}>
                  <TooltipTrigger asChild>
                    <button onClick={() => setTemplate(vt.value)} className={cn('px-3 py-1.5 rounded-lg border-2 text-xs font-medium transition-all', template === vt.value ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20' : 'border-border hover:border-teal-300')}>{vt.label}</button>
                  </TooltipTrigger>
                  <TooltipContent>{vt.desc}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <Button size="sm" onClick={() => { if (selectedGuest) handlePrint(selectedGuest); }} className="ml-auto"><Printer className="h-4 w-4 mr-1.5" />Print Selected</Button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Guests Table */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Today&apos;s Check-ins</CardTitle></CardHeader>
              <CardContent>
                {loading ? (<div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>) : guests.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No check-ins today</p>
                ) : (
                  <div className="max-h-96 overflow-y-auto">
                    <Table>
                      <TableHeader><TableRow><TableHead className="text-xs">Guest</TableHead><TableHead className="text-xs">Room</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs w-10"></TableHead></TableRow></TableHeader>
                      <TableBody>
                        {guests.map((g: any) => (
                          <TableRow key={g.id} className={cn('cursor-pointer hover:bg-muted/50', selectedGuest?.id === g.id && 'bg-muted')} onClick={() => setSelectedGuest(g)}>
                            <TableCell className="text-xs font-medium py-2">{g.guestName}</TableCell>
                            <TableCell className="text-xs py-2 font-mono">{g.roomNumber}</TableCell>
                            <TableCell className="text-xs py-2">
                              <Badge variant="secondary" className={cn('text-[10px]', g.status === 'active' || g.wifiStatus === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}>
                                {g.status === 'active' || g.wifiStatus === 'active' ? 'Online' : 'Pending'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handlePrint(g); }}>
                                <Printer className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
            {/* Voucher Preview */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Eye className="h-4 w-4" />Voucher Preview</CardTitle></CardHeader>
              <CardContent className="flex justify-center p-6">
                {selectedGuest ? (
                  <div className={cn('w-[300px] rounded-xl border p-6 space-y-4 shadow-lg', voucherStyle.bg, voucherStyle.border)}>
                    <div className="text-center space-y-1">
                      <Building className={cn('h-8 w-8 mx-auto', voucherStyle.accent)} />
                      <h3 className={cn('text-lg font-bold', voucherStyle.text)}>StaySuite Hotel</h3>
                      <p className={cn('text-xs opacity-60', voucherStyle.text)}>WiFi Access Credentials</p>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <div className={cn('grid grid-cols-2 gap-3 text-xs', voucherStyle.text)}>
                        <div><p className="opacity-50 text-[10px] uppercase">Guest</p><p className="font-semibold">{selectedGuest.guestName}</p></div>
                        <div><p className="opacity-50 text-[10px] uppercase">Room</p><p className="font-semibold font-mono">{selectedGuest.roomNumber}</p></div>
                        <div><p className="opacity-50 text-[10px] uppercase">Network</p><p className="font-semibold">{selectedGuest.ssid}</p></div>
                        <div><p className="opacity-50 text-[10px] uppercase">Valid Until</p><p className="font-semibold">{selectedGuest.validUntil}</p></div>
                      </div>
                    </div>
                    <Separator />
                    <div className={cn('rounded-lg p-4 text-center space-y-2', template === 'luxury' ? 'bg-gray-700' : 'bg-muted/50')}>
                      <p className={cn('text-[10px] font-semibold uppercase tracking-wider opacity-50', voucherStyle.text)}>WiFi Credentials</p>
                      <div className="space-y-1.5">
                        <div><p className={cn('text-[10px] opacity-50', voucherStyle.text)}>Username</p><p className={cn('text-sm font-mono font-bold', voucherStyle.text)}>{selectedGuest.username || '—'}</p></div>
                        <div><p className={cn('text-[10px] opacity-50', voucherStyle.text)}>Password</p><p className={cn('text-sm font-mono font-bold tracking-wider', voucherStyle.accent)}>{selectedGuest.password || '—'}</p></div>
                      </div>
                    </div>
                    <div className="flex justify-center">
                      <div className={cn('w-20 h-20 rounded-lg flex items-center justify-center', template === 'luxury' ? 'bg-gray-700' : 'bg-muted/30')}>
                        <QrCode className={cn('h-10 w-10', voucherStyle.accent)} />
                      </div>
                    </div>
                    <p className={cn('text-center text-[9px] opacity-40', voucherStyle.text)}>Scan QR code or enter credentials manually</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <UserRound className="h-12 w-12 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Select a guest to preview</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {subView === 'list' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Total', value: voucherStats.total, color: 'text-foreground' },
              { label: 'Active', value: voucherStats.active, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'Used', value: voucherStats.used, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Expired', value: voucherStats.expired, color: 'text-amber-600 dark:text-amber-400' },
              { label: 'Revoked', value: voucherStats.revoked, color: 'text-rose-600 dark:text-rose-400' },
            ].map(s => (
              <Card key={s.label}><CardContent className="p-3 text-center">
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent></Card>
            ))}
          </div>
          {/* Actions bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={() => setGenOpen(true)}><Plus className="h-4 w-4 mr-1.5" />Generate Vouchers</Button>
            <Button size="sm" variant="outline" onClick={() => void fetchVouchers()} disabled={voucherLoading}><RefreshCw className={cn('h-4 w-4 mr-1.5', voucherLoading && 'animate-spin')} />Refresh</Button>
            <div className="ml-auto flex items-center gap-2">
              <Input placeholder="Search codes..." value={voucherSearch} onChange={e => { setVoucherSearch(e.target.value); setVoucherPage(0); }} className="h-8 w-40 text-xs" />
              <Select value={voucherStatusFilter} onValueChange={v => { setVoucherStatusFilter(v); setVoucherPage(0); }}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Voucher Table */}
          <Card>
            <CardContent className="p-0">
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead className="text-xs">Code</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Plan</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Valid Until</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Issued To</TableHead>
                    <TableHead className="text-xs text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {voucherLoading ? Array.from({ length: 5 }).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-8 w-full" /></TableCell></TableRow>)
                    : vouchers.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-12 text-muted-foreground text-sm">No vouchers found</TableCell></TableRow>
                    : vouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell><button onClick={() => copyCode(v.code)} className="font-mono text-xs font-semibold hover:text-teal-600 dark:hover:text-teal-400 flex items-center gap-1.5" title="Click to copy"><Copy className="h-3 w-3 text-muted-foreground" />{v.code}</button></TableCell>
                        <TableCell className="text-xs hidden sm:table-cell"><div><p className="font-medium">{v.planName}</p><p className="text-[10px] text-muted-foreground">{v.planSpeed}</p></div></TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={v.status === 'active' ? 'default' : 'secondary'} className={cn('text-[10px]', v.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : v.status === 'used' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : v.status === 'revoked' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300')}>
                            {v.status.charAt(0).toUpperCase() + v.status.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs hidden md:table-cell text-muted-foreground">{v.validUntil ? new Date(v.validUntil).toLocaleDateString() : '—'}</TableCell>
                        <TableCell className="text-xs hidden md:table-cell">{v.issuedTo || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {v.status === 'active' && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setIssueVoucher(v); setIssueOpen(true); }}><User className="h-3 w-3 mr-1" />Issue</Button>}
                            {v.status === 'active' && <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => handleRevoke(v)}><XCircle className="h-3 w-3 mr-1" />Revoke</Button>}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          {/* Pagination */}
          {voucherStats.total > PAGE_SIZE && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Showing {voucherPage * PAGE_SIZE + 1}–{Math.min((voucherPage + 1) * PAGE_SIZE, voucherStats.total)} of {voucherStats.total}</p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={voucherPage === 0} onClick={() => setVoucherPage(p => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={(voucherPage + 1) * PAGE_SIZE >= voucherStats.total} onClick={() => setVoucherPage(p => p + 1)}>Next</Button>
              </div>
            </div>
          )}

          {/* Generate Dialog */}
          <Dialog open={genOpen} onOpenChange={setGenOpen}>
            <DialogContent><DialogHeader><DialogTitle>Generate Voucher Codes</DialogTitle><DialogDescription>Create batch WiFi voucher codes linked to a plan. Codes are auto-generated and provisioned in RADIUS.</DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>WiFi Plan *</Label>
                  <Select value={genPlanId} onValueChange={setGenPlanId}><SelectTrigger><SelectValue placeholder="Select a plan" /></SelectTrigger><SelectContent>{plans.map(p => <SelectItem key={p.id} value={p.id}>{p.name} — {p.downloadSpeed || 0}/{p.uploadSpeed || 0} Mbps, {p.validityDays || 1}d</SelectItem>)}</SelectContent></Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Quantity</Label><Input type="number" min={1} max={500} value={genQuantity} onChange={e => setGenQuantity(parseInt(e.target.value) || 1)} /></div>
                  <div className="space-y-2"><Label>Validity (days)</Label><Input type="number" min={1} max={365} value={genValidityDays} onChange={e => setGenValidityDays(parseInt(e.target.value) || 1)} /></div>
                </div>
                <div className="space-y-2"><Label>Notes (optional)</Label><Input value={genNotes} onChange={e => setGenNotes(e.target.value)} placeholder="e.g. Front desk batch" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGenOpen(false)}>Cancel</Button>
                <Button onClick={handleGenerate} disabled={genSaving || !genPlanId} className="bg-teal-600 hover:bg-teal-700 text-white">{genSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Generate {genQuantity} Voucher(s)</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Issue Dialog */}
          <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
            <DialogContent><DialogHeader><DialogTitle>Issue Voucher</DialogTitle><DialogDescription>Record physical distribution of voucher <span className="font-mono font-semibold">{issueVoucher?.code}</span></DialogDescription></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Issued To *</Label><Input value={issueTo} onChange={e => setIssueTo(e.target.value)} placeholder="Guest name or recipient" /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancel</Button>
                <Button onClick={handleIssue} disabled={issueSaving || !issueTo.trim()} className="bg-teal-600 hover:bg-teal-700 text-white">{issueSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Issue Voucher</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 5: Walled Garden / Portal Whitelist
// ═══════════════════════════════════════════════════════════════════════════════

function PoolMappingsTab() {
  return <PortalMappings />;
}

function WhitelistTab() {
  return <PortalWhitelist />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Feature 15: Analytics Tab — Guest Data Analytics Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsTab() {
  const [subTab, setSubTab] = useState<'overview' | 'live' | 'auth'>('overview');

  const SUBTABS = [
    { id: 'overview' as const, label: 'Overview', icon: BarChart3 },
    { id: 'live' as const, label: 'Live Monitor', icon: Monitor },
    { id: 'auth' as const, label: 'Auth Insights', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1 w-fit">
        {SUBTABS.map((st) => {
          const Icon = st.icon;
          return (
            <button
              key={st.id}
              onClick={() => setSubTab(st.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                subTab === st.id
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {st.label}
            </button>
          );
        })}
      </div>

      {subTab === 'overview' && <AnalyticsOverview />}
      {subTab === 'live' && <AnalyticsLiveMonitor />}
      {subTab === 'auth' && <AnalyticsAuthInsights />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Tab 1: Overview — Period-based analytics (existing functionality)
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsOverview() {
  const { propertyId } = usePropertyId();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{
    summary: {
      totalSessions: number;
      activeSessions: number;
      uniqueDevices: number;
      avgDurationMin: number;
      growthPercent: number;
      totalDataMB: number;
      totalVouchersUsed: number;
    };
    authDistribution: Array<{ method: string; count: number; pct: number }>;
    peakHours: Array<{ hour: number; sessions: number }>;
  } | null>(null);

  const fetchAnalytics = useCallback(async (p: 'today' | 'week' | 'month') => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ period: p });
      if (propertyId && propertyId !== 'default') params.set('propertyId', propertyId);
      const res = await fetch(`/api/wifi/portal/analytics?${params.toString()}`);
      const result = await res.json();
      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error?.message || 'Failed to load analytics');
      }
    } catch (e) {
      console.error('Analytics fetch error:', e);
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void fetchAnalytics(period); // eslint-disable-line react-hooks/set-state-in-effect
  }, [period, fetchAnalytics]);

  const periodLabels: Array<{ value: 'today' | 'week' | 'month'; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
  ];

  const authMethodLabels: Record<string, string> = {
    voucher: 'Voucher Code',
    room_number: 'Room Number',
    pms_credentials: 'PMS Credentials',
    sms_otp: 'SMS OTP',
    open_access: 'Open Access',
    social: 'Social Login',
    mac_auth: 'MAC Auth',
  };

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-3 w-64 mt-2" />
          </div>
          <div className="flex gap-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-24" /></div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-16 w-full rounded-lg" /></CardContent></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardContent className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</CardContent></Card>
          <Card><CardContent className="p-4"><Skeleton className="h-36 w-full rounded-lg" /></CardContent></Card>
        </div>
      </div>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (error && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-teal-500" />Guest Analytics Dashboard</h3>
            <p className="text-xs text-muted-foreground mt-1">Track portal usage, authentication methods, and guest engagement</p>
          </div>
        </div>
        <Card className="border-destructive/50">
          <CardContent className="p-6 flex flex-col items-center gap-3 text-center">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => void fetchAnalytics(period)}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = data?.summary;
  const peakHoursFiltered = (data?.peakHours || []).filter(h => h.hour >= 6 && h.hour <= 23);
  const maxHourCount = Math.max(...peakHoursFiltered.map(h => h.sessions), 1);
  const hasData = summary && summary.totalSessions > 0;

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><BarChart3 className="h-4 w-4 text-teal-500" />Guest Analytics</h3>
          <p className="text-xs text-muted-foreground mt-1">WiFi portal usage, authentication patterns, and bandwidth insights</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {periodLabels.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                period === p.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* No data state */}
      {!hasData && !loading && (
        <Card>
          <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
            <div className="p-3 rounded-full bg-muted"><Wifi className="h-6 w-6 text-muted-foreground" /></div>
            <div>
              <p className="text-sm font-medium">No data yet</p>
              <p className="text-xs text-muted-foreground mt-1">WiFi sessions will appear here once guests connect through the captive portal.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Total Sessions</p>
                    <p className="text-2xl font-bold mt-1">{summary!.totalSessions.toLocaleString()}</p>
                    <div className={cn('flex items-center gap-1 text-[10px] mt-1', summary!.growthPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                      {summary!.growthPercent >= 0 ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {Math.abs(summary!.growthPercent)}% vs prev {period === 'today' ? 'day' : period}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"><Wifi className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Active Now</p>
                    <p className="text-2xl font-bold mt-1">{summary!.activeSessions.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Currently online</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"><User className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Unique Devices</p>
                    <p className="text-2xl font-bold mt-1">{summary!.uniqueDevices.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Distinct MAC addresses</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"><Smartphone className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Avg Duration</p>
                    <p className="text-2xl font-bold mt-1">{summary!.avgDurationMin > 0 ? `${summary!.avgDurationMin}m` : '—'}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{summary!.totalDataMB > 0 ? `${summary!.totalDataMB.toLocaleString()} MB used` : 'No data'}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"><Clock className="h-5 w-5" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Auth Methods Distribution */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Authentication Methods</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {data!.authDistribution.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No authentication data available for this period.</p>
                )}
                {data!.authDistribution.map((am) => (
                  <div key={am.method} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{authMethodLabels[am.method] || am.method}</span>
                      <span className="text-muted-foreground">{am.count} ({am.pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${am.pct}%` }} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Peak Usage Hours */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Peak Usage Hours</CardTitle></CardHeader>
              <CardContent>
                {peakHoursFiltered.every(h => h.sessions === 0) ? (
                  <p className="text-xs text-muted-foreground italic py-8 text-center">No hourly data available for this period.</p>
                ) : (
                  <div className="flex items-end gap-[2px] h-32">
                    {peakHoursFiltered.map((h) => (
                      <div key={h.hour} className="flex-1 flex flex-col items-center gap-1 group">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className="w-full bg-teal-500/80 rounded-t-sm transition-all hover:bg-teal-500 cursor-default min-h-[2px]"
                              style={{ height: `${(h.sessions / maxHourCount) * 100}%` }}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-[10px]">
                            <p>{h.hour}:00 — {h.sessions} sessions</p>
                          </TooltipContent>
                        </Tooltip>
                        <span className="text-[8px] text-muted-foreground">{h.hour}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bandwidth Summary */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1.5"><Zap className="h-4 w-4" />Bandwidth Usage</CardTitle></CardHeader>
              <CardContent className="flex flex-col items-center py-4 gap-3">
                <div className="text-center">
                  <p className="text-3xl font-bold">{summary!.totalDataMB.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground mt-1">Total data consumed</p>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 w-full text-center">
                  <div>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Download className="h-3.5 w-3.5 text-teal-500" />Sessions
                    </div>
                    <p className="text-lg font-semibold">{summary!.totalSessions.toLocaleString()}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                      <Ticket className="h-3.5 w-3.5 text-amber-500" />Vouchers Used
                    </div>
                    <p className="text-lg font-semibold">{summary!.totalVouchersUsed.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Session Status Donut */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Session Status</CardTitle></CardHeader>
              <CardContent className="space-y-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="relative w-20 h-20 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                      {summary!.totalSessions > 0 && (
                        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8"
                          strokeDasharray={`${(summary!.activeSessions / summary!.totalSessions) * 251} 251`}
                          strokeLinecap="round" className="text-teal-500" />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold">{summary!.activeSessions}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                      <span>Active: <span className="font-semibold">{summary!.activeSessions}</span></span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full bg-muted" />
                      <span>Completed: <span className="font-semibold">{summary!.totalSessions - summary!.activeSessions}</span></span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{summary!.totalSessions.toLocaleString()} total sessions this {period}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Tab 2: Live Monitor — Real-time session monitoring with captive-redirect metrics
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsLiveMonitor() {
  const { propertyId } = usePropertyId();
  const REFRESH_INTERVAL = 10000; // 10s
  const [liveStats, setLiveStats] = useState<{
    totalActive: number;
    currentActive: number;
    perNas: Array<{ nasIp: string; nasIdentifier: string; count: number }>;
    totalDownload: number;
    totalUpload: number;
  } | null>(null);
  const [captiveMetrics, setCaptiveMetrics] = useState<{
    totalRedirects: number;
    totalCooldownSkips: number;
    totalRateLimited: number;
    totalWhitelistSkips: number;
    totalHttpsRedirects: number;
    peakActiveConnections: number;
    bytesSent: number;
    cooldownCacheSize: number;
    whitelistSize: number;
    perOsRedirects: Record<string, number>;
    serverIPs: string[];
    uptime: number;
  } | null>(null);
  const [authStats, setAuthStats] = useState<{
    totalAuths: number;
    acceptCount: number;
    rejectCount: number;
    successRate: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);

  // Fetch all realtime data
  const fetchLive = useCallback(async () => {
    try {
      const queryParams = propertyId && propertyId !== 'default' ? `?propertyId=${propertyId}` : '';

      const [sessionsRes, authRes, captiveRes] = await Promise.all([
        fetch(`/api/wifi/radius?action=live-sessions-stats${queryParams}`).catch(() => null),
        fetch(`/api/wifi/radius?action=auth-logs-stats${queryParams}`).catch(() => null),
        // Captive-redirect metrics from the mini service on port 8888 (proxied)
        fetch('/api/captive-redirect/metrics').catch(() => null),
      ]);

      if (sessionsRes && sessionsRes.ok) {
        const sessionsResult = await sessionsRes.json();
        if (sessionsResult.success) setLiveStats(sessionsResult.data);
      }
      if (authRes && authRes.ok) {
        const authResult = await authRes.json();
        if (authResult.success) setAuthStats(authResult.data);
      }
      if (captiveRes && captiveRes.ok) {
        const captiveResult = await captiveRes.json();
        if (captiveResult.success) setCaptiveMetrics(captiveResult.data);
      }

      setLastRefresh(new Date());
      setLoading(false);
    } catch (e) {
      console.error('Live monitor fetch error:', e);
      setLoading(false);
    }
  }, [propertyId]);

  // Auto-refresh
  useEffect(() => {
    void fetchLive();
    const interval = setInterval(() => {
      void fetchLive();
    }, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchLive]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => prev <= 1 ? REFRESH_INTERVAL / 1000 : prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatUptime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const successRate = authStats ? authStats.successRate : 0;

  return (
    <div className="space-y-5">
      {/* Header with live badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Monitor className="h-4 w-4 text-emerald-500" />
            Realtime Monitor
          </h3>
          <Badge variant="outline" className="border-emerald-500/50 text-emerald-600 dark:text-emerald-400 gap-1.5 text-[10px]">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            LIVE
          </Badge>
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-[10px] text-muted-foreground">
              Updated {lastRefresh.toLocaleTimeString()} · next in {countdown}s
            </span>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => void fetchLive()}>
            <RefreshCw className="h-3 w-3 mr-1" />Refresh
          </Button>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-4"><Skeleton className="h-20 w-full rounded-lg" /></CardContent></Card>
          ))}
        </div>
      )}

      {/* Live KPI Cards */}
      {!loading && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Active Sessions */}
            <Card className="border-emerald-200 dark:border-emerald-900/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Active Sessions</p>
                    <p className="text-3xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
                      {liveStats?.totalActive ?? 0}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">Real-time connected</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <Wifi className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Auth Success Rate */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Auth Success Rate</p>
                    <p className="text-3xl font-bold mt-1">
                      <span className={successRate >= 80 ? 'text-emerald-600 dark:text-emerald-400' : successRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-rose-600 dark:text-rose-400'}>
                        {authStats ? `${successRate}%` : '—'}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {authStats ? `${authStats.acceptCount} accepted, ${authStats.rejectCount} rejected` : 'No data'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Realtime Bandwidth */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Live Bandwidth</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <ArrowDownToLine className="h-3.5 w-3.5 text-teal-500" />
                      <p className="text-lg font-bold">{liveStats ? formatBytes(liveStats.totalDownload) : '—'}</p>
                    </div>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <ArrowUpFromLine className="h-3 w-3.5 text-amber-500" />
                      <p className="text-sm font-semibold text-muted-foreground">{liveStats ? formatBytes(liveStats.totalUpload) : '—'}</p>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                    <Zap className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Captive Portal Redirects */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Portal Redirects</p>
                    <p className="text-3xl font-bold mt-1">
                      {captiveMetrics ? captiveMetrics.totalRedirects.toLocaleString() : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {captiveMetrics
                        ? `${captiveMetrics.peakActiveConnections} peak conns · ${formatBytes(captiveMetrics.bytesSent)} sent`
                        : 'Captive service offline'}
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300">
                    <Router className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* NAS Distribution */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Router className="h-4 w-4" />NAS / Access Point Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(!liveStats || liveStats.perNas.length === 0) ? (
                  <p className="text-xs text-muted-foreground italic py-6 text-center">No active NAS devices detected.</p>
                ) : (
                  <div className="space-y-2">
                    {liveStats.perNas.map((nas) => {
                      const maxCount = Math.max(...liveStats.perNas.map(n => n.count), 1);
                      return (
                        <div key={nas.nasIp} className="flex items-center gap-3">
                          <div className="min-w-[100px] text-xs font-mono text-muted-foreground truncate">{nas.nasIp}</div>
                          <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                              style={{ width: `${(nas.count / maxCount) * 100}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-2 min-w-[60px] justify-end">
                            <span className="text-xs font-semibold">{nas.count}</span>
                            {nas.nasIdentifier && (
                              <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">{nas.nasIdentifier}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Captive Portal Service Status */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                  <Globe className="h-4 w-4" />Captive Portal Service
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {captiveMetrics ? (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Status</span>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/50 text-emerald-600 dark:text-emerald-400">Online</Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Uptime</span>
                      <span className="text-xs font-mono font-medium">{formatUptime(captiveMetrics.uptime)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">HTTPS Redirects</span>
                      <span className="text-xs font-semibold">{captiveMetrics.totalHttpsRedirects.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Rate Limited</span>
                      <span className="text-xs font-semibold">{captiveMetrics.totalRateLimited.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Cooldown Skips</span>
                      <span className="text-xs font-semibold">{captiveMetrics.totalCooldownSkips.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Whitelisted</span>
                      <span className="text-xs font-semibold">{captiveMetrics.whitelistSize}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Cache Entries</span>
                      <span className="text-xs font-semibold">{captiveMetrics.cooldownCacheSize.toLocaleString()}</span>
                    </div>
                    <Separator />
                    {/* Per-OS breakdown */}
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wider">Redirects by OS</p>
                      {Object.entries(captiveMetrics.perOsRedirects).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([os, count]) => (
                        <div key={os} className="flex items-center justify-between py-0.5">
                          <span className="text-[11px] text-muted-foreground">{os}</span>
                          <span className="text-[11px] font-semibold">{count}</span>
                        </div>
                      ))}
                      {Object.keys(captiveMetrics.perOsRedirects).length === 0 && (
                        <p className="text-[10px] text-muted-foreground italic">No data yet</p>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6 text-center">
                    <AlertTriangle className="h-6 w-6 text-amber-500" />
                    <p className="text-xs text-muted-foreground">Captive portal redirect service is not reachable.</p>
                    <p className="text-[10px] text-muted-foreground">Verify the mini-service is running on port 8888.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Auth Log Mini-Table */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4" />Authentication Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              {authStats ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{authStats.totalAuths.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Total Attempts</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30">
                    <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{authStats.acceptCount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Accepted</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30">
                    <p className="text-2xl font-bold text-rose-600 dark:text-rose-400">{authStats.rejectCount.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Rejected</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-muted/50">
                    <p className="text-2xl font-bold">{authStats.successRate}%</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Success Rate</p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">No auth data available.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Sub-Tab 3: Auth Insights — Authentication analytics deep dive
// ═══════════════════════════════════════════════════════════════════════════════

function AnalyticsAuthInsights() {
  const { propertyId } = usePropertyId();
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{
    summary: {
      totalSessions: number;
      activeSessions: number;
      uniqueDevices: number;
      avgDurationMin: number;
      growthPercent: number;
      totalDataMB: number;
      totalVouchersUsed: number;
    };
    authDistribution: Array<{ method: string; count: number; pct: number }>;
    peakHours: Array<{ hour: number; sessions: number }>;
  } | null>(null);
  const [authStats, setAuthStats] = useState<{
    totalAuths: number;
    acceptCount: number;
    rejectCount: number;
    successRate: number;
    last24hTrend: number;
  } | null>(null);

  const fetchData = useCallback(async (p: 'today' | 'week' | 'month') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ period: p });
      if (propertyId && propertyId !== 'default') params.set('propertyId', propertyId);

      const [analyticsRes, authRes] = await Promise.all([
        fetch(`/api/wifi/portal/analytics?${params.toString()}`).catch(() => null),
        fetch(`/api/wifi/radius?action=auth-logs-stats&${params.toString()}`).catch(() => null),
      ]);

      if (analyticsRes && analyticsRes.ok) {
        const analyticsResult = await analyticsRes.json();
        if (analyticsResult.success) setData(analyticsResult.data);
      }

      if (authRes && authRes.ok) {
        const authResult = await authRes.json();
        if (authResult.success) setAuthStats(authResult.data);
      }
    } catch (e) {
      console.error('Auth insights fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [propertyId]);

  useEffect(() => {
    void fetchData(period); // eslint-disable-line react-hooks/set-state-in-effect
  }, [period, fetchData]);

  const periodLabels: Array<{ value: 'today' | 'week' | 'month'; label: string }> = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
  ];

  const authMethodLabels: Record<string, string> = {
    voucher: 'Voucher Code',
    room_number: 'Room Number',
    pms_credentials: 'PMS Credentials',
    sms_otp: 'SMS OTP',
    open_access: 'Open Access',
    social: 'Social Login',
    mac_auth: 'MAC Auth',
  };

  const authMethodIcons: Record<string, string> = {
    voucher: '🎫',
    room_number: '🏨',
    pms_credentials: '🔐',
    sms_otp: '📱',
    open_access: '🔓',
    social: '🌐',
    mac_auth: '💻',
  };

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-2"><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-20" /><Skeleton className="h-8 w-24" /></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card><CardContent className="p-4"><Skeleton className="h-48 w-full rounded-lg" /></CardContent></Card>
          <Card><CardContent className="p-4"><Skeleton className="h-48 w-full rounded-lg" /></CardContent></Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-teal-500" />Authentication Insights</h3>
          <p className="text-xs text-muted-foreground mt-1">Deep dive into authentication methods, success rates, and trends</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {periodLabels.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-md transition-all',
                period === p.value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Auth Stats KPI Row */}
      {authStats && (
        <div className="grid grid-cols-3 gap-4">
          <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{authStats.acceptCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Successful Auths</p>
            </CardContent>
          </Card>
          <Card className="bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-rose-600 dark:text-rose-400">{authStats.rejectCount.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">Failed Auths</p>
            </CardContent>
          </Card>
          <Card className="bg-teal-50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-900/50">
            <CardContent className="p-4 text-center">
              <div className="flex items-center justify-center gap-2">
                <p className="text-3xl font-bold text-teal-600 dark:text-teal-400">{authStats.successRate}%</p>
                {authStats.last24hTrend !== 0 && (
                  <span className={cn('text-xs font-medium', authStats.last24hTrend > 0 ? 'text-emerald-500' : 'text-rose-500')}>
                    {authStats.last24hTrend > 0 ? '↑' : '↓'} {Math.abs(authStats.last24hTrend)}%
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Success Rate (24h trend)</p>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auth Method Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Login Methods Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!data || data.authDistribution.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-8 text-center">No authentication data for this period.</p>
            ) : (
              data.authDistribution
                .sort((a, b) => b.count - a.count)
                .map((am) => (
                  <div key={am.method} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="text-lg w-8 text-center flex-shrink-0">{authMethodIcons[am.method] || '❓'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium truncate">{authMethodLabels[am.method] || am.method}</span>
                        <span className="text-xs font-semibold ml-2">{am.count} <span className="text-muted-foreground font-normal">({am.pct}%)</span></span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${am.pct}%` }} />
                      </div>
                    </div>
                  </div>
                ))
            )}
          </CardContent>
        </Card>

        {/* Success Rate Donut + Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Auth Success vs Failure</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-4 gap-4">
            {authStats && authStats.totalAuths > 0 ? (
              <>
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10" className="text-rose-200 dark:text-rose-900/50" />
                    {authStats.acceptCount > 0 && (
                      <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="10"
                        strokeDasharray={`${(authStats.acceptCount / authStats.totalAuths) * 251} 251`}
                        strokeLinecap="round" className="text-emerald-500"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-lg font-bold">{authStats.successRate}%</span>
                    <span className="text-[9px] text-muted-foreground">Success</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6 w-full">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <div>
                      <p className="text-xs font-semibold">{authStats.acceptCount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Accepted</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-rose-200 dark:bg-rose-900/50" />
                    <div>
                      <p className="text-xs font-semibold">{authStats.rejectCount.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">Rejected</p>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground italic py-8">No authentication attempts recorded.</p>
            )}
          </CardContent>
        </Card>

        {/* Peak Hours with Auth Context */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Session Distribution by Hour</CardTitle>
          </CardHeader>
          <CardContent>
            {!data || data.peakHours.every(h => h.sessions === 0) ? (
              <p className="text-xs text-muted-foreground italic py-8 text-center">No hourly data available for this period.</p>
            ) : (
              <div className="flex items-end gap-[2px] h-36">
                {data.peakHours.filter(h => h.hour >= 5 && h.hour <= 24).map((h) => {
                  const maxSessions = Math.max(...data!.peakHours.map(ph => ph.sessions), 1);
                  const isNow = h.hour === new Date().getHours();
                  return (
                    <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={cn(
                              'w-full rounded-t-sm transition-all hover:opacity-80 cursor-default min-h-[2px]',
                              isNow ? 'bg-emerald-500 ring-1 ring-emerald-300 dark:ring-emerald-700' : 'bg-teal-400/60'
                            )}
                            style={{ height: `${(h.sessions / maxSessions) * 100}%` }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-[10px]">
                          <p>{h.hour}:00 — {h.sessions} sessions</p>
                          {isNow && <p className="text-emerald-400">← Current hour</p>}
                        </TooltipContent>
                      </Tooltip>
                      <span className={cn('text-[8px]', isNow ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-muted-foreground')}>{h.hour}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Tab 4: Print WiFi Cards
// ═══════════════════════════════════════════════════════════════════════════════

function PrintCardsTab() {
  const [hotelName, setHotelName] = useState('StaySuite Hotel');
  const [guestName, setGuestName] = useState('');
  const [roomNumber, setRoomNumber] = useState('');
  const [ssid, setSsid] = useState('HotelWiFi');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validUntil, setValidUntil] = useState('');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Configuration Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Printer className="h-4 w-4" />Card Configuration</CardTitle>
          <p className="text-xs text-muted-foreground">Fill in the details to generate a printable WiFi login card</p>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Hotel Name</Label><Input value={hotelName} onChange={e => setHotelName(e.target.value)} placeholder="StaySuite Hotel" /></div>
            <div className="space-y-2"><Label>Network (SSID)</Label><Input value={ssid} onChange={e => setSsid(e.target.value)} placeholder="HotelWiFi" /></div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Guest Name</Label><Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="John Smith" /></div>
            <div className="space-y-2"><Label>Room Number</Label><Input value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="301" /></div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Username *</Label><Input value={username} onChange={e => setUsername(e.target.value)} placeholder="guest301" /></div>
            <div className="space-y-2"><Label>Password *</Label><Input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" /></div>
          </div>
          <Separator />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Valid From</Label><Input type="date" value={validFrom} onChange={e => setValidFrom(e.target.value)} /></div>
            <div className="space-y-2"><Label>Valid Until</Label><Input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Live Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" />Card Preview</CardTitle>
          <p className="text-xs text-muted-foreground">Preview the card before printing</p>
        </CardHeader>
        <CardContent>
          {username && password ? (
            <PrintCard
              hotelName={hotelName}
              guestName={guestName || undefined}
              roomNumber={roomNumber || undefined}
              ssid={ssid}
              username={username}
              password={password}
              validFrom={validFrom || undefined}
              validUntil={validUntil || undefined}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-4 rounded-full bg-muted/50 mb-4"><QrCode className="h-10 w-10 text-muted-foreground" /></div>
              <p className="text-sm text-muted-foreground">Enter username and password to preview the card</p>
              <p className="text-xs text-muted-foreground mt-1">The card includes a QR code for easy WiFi connection</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
