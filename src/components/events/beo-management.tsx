'use client';

import { useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Printer,
  Download,
  Eye,
  Plus,
  Search,
  Calendar,
  Clock,
  Users,
  DollarSign,
  UtensilsCrossed,
  Monitor,
  Mic,
  Lightbulb,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Building2,
  Mail,
  Phone,
  Wine,
  RectangleHorizontal,
  ClipboardList,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type BEOStatus = 'draft' | 'under_review' | 'approved' | 'confirmed' | 'completed';

interface TimelineItem {
  time: string;
  activity: string;
  responsible: string;
  notes?: string;
}

interface MenuItem {
  name: string;
  description: string;
  dietaryTag: string;
  perPersonCost: number;
}

interface EquipmentItem {
  name: string;
  quantity: number;
  costPerUnit: number;
}

interface BEO {
  id: string;
  beoNumber: string;
  eventName: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  venue: string;
  clientName: string;
  contactEmail: string;
  contactPhone: string;
  functionType: 'wedding' | 'corporate' | 'social';
  expectedGuests: number;
  setupStyle: string;
  serviceStyle: 'plated' | 'buffet' | 'stations';
  dietaryRequirements: string[];
  menuItems: MenuItem[];
  barRequirements: string;
  equipment: EquipmentItem[];
  stageSetup: string;
  lightingSetup: string;
  floorPlanDescription: string;
  timeline: TimelineItem[];
  fnbMinimum: number;
  serviceChargePercent: number;
  taxPercent: number;
  status: BEOStatus;
  createdAt: string;
  updatedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const STATUS_CONFIG: Record<BEOStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', icon: Circle },
  under_review: { label: 'Under Review', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: AlertCircle },
  approved: { label: 'Approved', color: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400', icon: CheckCircle2 },
  confirmed: { label: 'Confirmed', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: CheckCircle2 },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400', icon: CheckCircle2 },
};

const STATUS_FLOW: BEOStatus[] = ['draft', 'under_review', 'approved', 'confirmed', 'completed'];

const FUNCTION_TYPES = [
  { value: 'wedding', label: 'Wedding', icon: '💒' },
  { value: 'corporate', label: 'Corporate', icon: '🏢' },
  { value: 'social', label: 'Social', icon: '🎉' },
];

const SETUP_STYLES = ['Banquet Rounds', 'Theater', 'Classroom', 'U-Shape', 'Cocktail', 'Boardroom', 'Custom'];

const SERVICE_STYLES = [
  { value: 'plated', label: 'Plated Service' },
  { value: 'buffet', label: 'Buffet' },
  { value: 'stations', label: 'Food Stations' },
];

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_BEOS: BEO[] = [
  {
    id: 'beo-001', beoNumber: 'BEO-2025-001', eventName: 'Anderson-Chen Wedding Reception',
    eventDate: '2025-08-15', startTime: '17:00', endTime: '23:00', venue: 'Grand Ballroom',
    clientName: 'Sarah Anderson & James Chen', contactEmail: 'sarah.anderson@email.com', contactPhone: '+1 (555) 234-5678',
    functionType: 'wedding', expectedGuests: 180, setupStyle: 'Banquet Rounds', serviceStyle: 'plated',
    dietaryRequirements: ['12 Vegetarian', '6 Gluten-Free', '3 Nut Allergies', '2 Vegan'],
    menuItems: [
      { name: 'Seared Filet Mignon', description: 'With truffle demi-glace and roasted vegetables', dietaryTag: 'GF Option', perPersonCost: 45 },
      { name: 'Pan-Roasted Salmon', description: 'With lemon beurre blanc and asparagus', dietaryTag: 'GF', perPersonCost: 38 },
      { name: 'Wild Mushroom Risotto', description: 'Truffle oil, aged parmesan, fresh herbs', dietaryTag: 'V', perPersonCost: 28 },
      { name: 'Caesar Salad', description: 'Romaine hearts, house croutons, anchovy dressing', dietaryTag: '', perPersonCost: 14 },
      { name: 'Wedding Cake (3-tier)', description: 'Vanilla sponge with buttercream, fresh berries', dietaryTag: 'V', perPersonCost: 12 },
    ],
    barRequirements: 'Open bar: Premium spirits, craft cocktails, wine selection, craft beer, sparkling water, soft drinks. Signature cocktail: "The Anderson" — elderflower gin fizz.',
    equipment: [
      { name: 'HD Projector', quantity: 1, costPerUnit: 350 },
      { name: '16ft Projection Screen', quantity: 1, costPerUnit: 200 },
      { name: 'Wireless Lavalier Mic', quantity: 3, costPerUnit: 75 },
      { name: 'PA Speaker System', quantity: 1, costPerUnit: 500 },
      { name: 'DJ Booth & Lighting', quantity: 1, costPerUnit: 800 },
      { name: 'Dance Floor (20x20)', quantity: 1, costPerUnit: 600 },
    ],
    stageSetup: '4x8ft raised platform at front of ballroom with backdrop draping and floral arrangements',
    lightingSetup: 'Warm ambient lighting, uplighting in gold/white, spotlight on stage, string lights over dance floor',
    floorPlanDescription: '18 round tables of 10, sweetheart table for bridal party at front, head table offset left, dance floor center-right, bar station back-right, gift table near entrance',
    timeline: [
      { time: '09:00', activity: 'Vendor setup begins', responsible: 'Events Team', notes: 'Florist, caterer, DJ arrival' },
      { time: '12:00', activity: 'Table setting & place cards', responsible: 'Banquet Team', notes: 'Verify dietary markers' },
      { time: '14:00', activity: 'AV & sound check', responsible: 'AV Team', notes: 'Test mic levels, slideshow' },
      { time: '15:30', activity: 'Final walkthrough with client', responsible: 'Event Manager', notes: 'Sarah Anderson confirmed' },
      { time: '16:30', activity: 'Guest arrival & cocktail hour', responsible: 'F&B Team', notes: 'Piano trio performs' },
      { time: '17:30', activity: 'Wedding party introduction', responsible: 'MC / DJ' },
      { time: '17:45', activity: 'First dance & parent dances', responsible: 'MC / DJ' },
      { time: '18:00', activity: 'Dinner service begins', responsible: 'F&B Captain' },
      { time: '19:30', activity: 'Toasts & speeches', responsible: 'MC' },
      { time: '20:00', activity: 'Cake cutting', responsible: 'F&B Team' },
      { time: '20:30', activity: 'Open dance floor', responsible: 'DJ' },
      { time: '22:30', activity: 'Last dance & sparkler exit', responsible: 'Events Team' },
      { time: '23:00', activity: 'Venue breakdown begins', responsible: 'Setup Team', notes: 'Overnight crew' },
    ],
    fnbMinimum: 12500, serviceChargePercent: 22, taxPercent: 8.5, status: 'approved',
    createdAt: '2025-05-20T10:00:00Z', updatedAt: '2025-07-10T14:30:00Z', approvedBy: 'Michael Torres', approvedAt: '2025-07-10T14:30:00Z',
  },
  {
    id: 'beo-002', beoNumber: 'BEO-2025-002', eventName: 'TechNova Annual Summit 2025',
    eventDate: '2025-09-22', startTime: '08:00', endTime: '18:00', venue: 'Convention Hall A',
    clientName: 'TechNova Inc.', contactEmail: 'events@technova.io', contactPhone: '+1 (555) 876-5432',
    functionType: 'corporate', expectedGuests: 250, setupStyle: 'Theater', serviceStyle: 'stations',
    dietaryRequirements: ['30 Vegetarian', '15 Vegan', '20 Gluten-Free', 'Halal options available'],
    menuItems: [
      { name: 'Continental Breakfast Station', description: 'Pastries, fruit, yogurt parfaits, coffee bar', dietaryTag: 'V Options', perPersonCost: 22 },
      { name: 'Gourmet Lunch Buffet', description: 'Carving station, pasta bar, salad station, dessert bar', dietaryTag: 'V/VG/GF Options', perPersonCost: 42 },
      { name: 'Afternoon Refreshments', description: 'Cookies, fruit, coffee, tea station', dietaryTag: 'V Options', perPersonCost: 10 },
    ],
    barRequirements: 'Coffee & tea stations throughout. No alcohol. Sparkling and still water at each station.',
    equipment: [
      { name: '4K Laser Projector', quantity: 2, costPerUnit: 500 },
      { name: '20ft LED Screen', quantity: 2, costPerUnit: 750 },
      { name: 'Wireless Presentation System', quantity: 1, costPerUnit: 400 },
      { name: 'Wireless Handheld Mic', quantity: 4, costPerUnit: 60 },
      { name: 'Wireless Lavalier Mic', quantity: 2, costPerUnit: 75 },
      { name: 'PA Speaker System', quantity: 2, costPerUnit: 500 },
      { name: 'Stage (16x8ft)', quantity: 1, costPerUnit: 1200 },
      { name: 'Live Streaming Kit', quantity: 1, costPerUnit: 350 },
      { name: 'Wi-Fi Access Point (Dedicated)', quantity: 4, costPerUnit: 100 },
    ],
    stageSetup: '16x8ft main stage with LED backdrop, podium center, two side monitors for presenter confidence',
    lightingSetup: 'Full stage wash, house lights dimmable, pin spots on podium, LED wall ambient colors',
    floorPlanDescription: 'Theater-style seating 250, two aisles, registration desk at entrance, breakout tables back of hall, 4 coffee stations, 2 water stations',
    timeline: [
      { time: '06:30', activity: 'Venue opens for setup', responsible: 'Events Team' },
      { time: '07:30', activity: 'AV & tech check', responsible: 'AV Team' },
      { time: '07:45', activity: 'Registration desk opens', responsible: 'Registration Staff' },
      { time: '08:00', activity: 'Breakfast service begins', responsible: 'F&B Team' },
      { time: '08:45', activity: 'Opening keynote', responsible: 'MC / AV Team' },
      { time: '10:00', activity: 'Panel Discussion 1', responsible: 'AV Team' },
      { time: '11:00', activity: 'Networking Break', responsible: 'F&B Team' },
      { time: '11:30', activity: 'Breakout Sessions', responsible: 'Events Team' },
      { time: '12:30', activity: 'Lunch Service', responsible: 'F&B Captain' },
      { time: '14:00', activity: 'Afternoon Sessions', responsible: 'AV Team' },
      { time: '16:00', activity: 'Afternoon Break', responsible: 'F&B Team' },
      { time: '16:30', activity: 'Closing Remarks', responsible: 'MC / AV Team' },
      { time: '17:00', activity: 'Reception & Networking', responsible: 'Events Team' },
      { time: '18:00', activity: 'Event concludes', responsible: 'Events Team' },
      { time: '18:30', activity: 'Breakdown begins', responsible: 'Setup Team' },
    ],
    fnbMinimum: 18500, serviceChargePercent: 22, taxPercent: 8.5, status: 'under_review',
    createdAt: '2025-06-15T09:00:00Z', updatedAt: '2025-08-01T11:00:00Z',
  },
  {
    id: 'beo-003', beoNumber: 'BEO-2025-003', eventName: 'Martinez 50th Birthday Gala',
    eventDate: '2025-10-05', startTime: '19:00', endTime: '01:00', venue: 'Rooftop Terrace',
    clientName: 'Roberto Martinez', contactEmail: 'rmartinez@family.com', contactPhone: '+1 (555) 345-6789',
    functionType: 'social', expectedGuests: 80, setupStyle: 'Cocktail', serviceStyle: 'stations',
    dietaryRequirements: ['5 Vegetarian', '3 Pescatarian', 'Kosher option available'],
    menuItems: [
      { name: 'Tapas Station', description: 'Assorted Spanish small plates, manchego, olives', dietaryTag: 'V Options', perPersonCost: 24 },
      { name: 'Carving Station', description: 'Slow-roasted prime rib with horseradish cream', dietaryTag: '', perPersonCost: 32 },
      { name: 'Sushi Bar', description: 'Chef-attended nigiri, sashimi, maki rolls', dietaryTag: '', perPersonCost: 28 },
      { name: 'Dessert Station', description: 'Chocolate fountain, mini pastries, gelato bar', dietaryTag: 'V Options', perPersonCost: 18 },
      { name: 'Premium Bar Package', description: 'Top-shelf liquor, champagne toast, signature cocktails', dietaryTag: '', perPersonCost: 45 },
    ],
    barRequirements: 'Full open bar with premium spirits. Signature cocktail: "Golden 50" — champagne, elderflower, gold leaf.',
    equipment: [
      { name: 'Wireless Mic System', quantity: 1, costPerUnit: 150 },
      { name: 'Bluetooth Speaker Set', quantity: 2, costPerUnit: 100 },
      { name: 'Photo Booth Setup', quantity: 1, costPerUnit: 450 },
      { name: 'Ambient String Lights', quantity: 1, costPerUnit: 300 },
    ],
    stageSetup: 'Small performance area (8x6ft) for live band setup',
    lightingSetup: 'Warm fairy lights, uplighting in warm amber/gold, spotlight on performance area, candles on tables',
    floorPlanDescription: 'Cocktail-style high-tops throughout, lounge furniture clusters, food stations along perimeter, bar station center-back, dance area front-center',
    timeline: [
      { time: '15:00', activity: 'Setup begins', responsible: 'Events Team' },
      { time: '17:00', activity: 'Live band sound check', responsible: 'AV Team' },
      { time: '18:30', activity: 'Final inspection', responsible: 'Event Manager' },
      { time: '19:00', activity: 'Guest arrival & cocktails', responsible: 'F&B Team' },
      { time: '20:00', activity: 'Welcome speech & toast', responsible: 'Host' },
      { time: '20:15', activity: 'Dinner stations open', responsible: 'F&B Captain' },
      { time: '21:30', activity: 'Live band performance', responsible: 'Entertainment' },
      { time: '22:30', activity: 'Birthday cake & surprise video', responsible: 'Events Team' },
      { time: '23:00', activity: 'Dance party & open bar', responsible: 'F&B Team' },
      { time: '00:30', activity: 'Last call', responsible: 'Bar Staff' },
      { time: '01:00', activity: 'Event concludes, breakdown', responsible: 'Setup Team' },
    ],
    fnbMinimum: 8200, serviceChargePercent: 20, taxPercent: 8.5, status: 'draft',
    createdAt: '2025-07-20T15:00:00Z', updatedAt: '2025-07-20T15:00:00Z',
  },
  {
    id: 'beo-004', beoNumber: 'BEO-2025-004', eventName: 'Greenfield Corp. Q3 Strategy Meeting',
    eventDate: '2025-08-28', startTime: '09:00', endTime: '17:00', venue: 'Executive Boardroom',
    clientName: 'Greenfield Corporation', contactEmail: 'admin@greenfield.co', contactPhone: '+1 (555) 987-6543',
    functionType: 'corporate', expectedGuests: 20, setupStyle: 'Boardroom', serviceStyle: 'plated',
    dietaryRequirements: ['4 Vegetarian', '2 Gluten-Free'],
    menuItems: [
      { name: 'Working Breakfast', description: 'Continental spread with hot options', dietaryTag: 'V Options', perPersonCost: 18 },
      { name: 'Three-Course Executive Lunch', description: 'Seasonal menu, choice of entree', dietaryTag: 'V/GF Options', perPersonCost: 55 },
      { name: 'Afternoon Tea Service', description: 'Finger sandwiches, scones, petit fours', dietaryTag: 'V Options', perPersonCost: 15 },
    ],
    barRequirements: 'Coffee, tea, sparkling water, and juice throughout the day. No alcohol.',
    equipment: [
      { name: '85" Smart Display', quantity: 1, costPerUnit: 200 },
      { name: 'Wireless Lavalier Mic', quantity: 2, costPerUnit: 75 },
      { name: 'Conference Phone System', quantity: 1, costPerUnit: 100 },
      { name: 'Video Conferencing Kit', quantity: 1, costPerUnit: 250 },
    ],
    stageSetup: 'No stage required — podium at head of table for presentations',
    lightingSetup: 'Natural light supplemented by adjustable overhead fluorescents, blackout option for presentations',
    floorPlanDescription: '20-seat boardroom configuration, oval table, presentation screen at far end, credenza for refreshments along left wall',
    timeline: [
      { time: '07:30', activity: 'Room setup & AV check', responsible: 'Events Team' },
      { time: '08:30', activity: 'Breakfast service', responsible: 'F&B Team' },
      { time: '09:00', activity: 'Meeting begins — CEO opening remarks', responsible: 'Facilitator' },
      { time: '10:30', activity: 'Morning break', responsible: 'F&B Team' },
      { time: '10:45', activity: 'Department presentations', responsible: 'Facilitator' },
      { time: '12:00', activity: 'Lunch service', responsible: 'F&B Captain' },
      { time: '13:00', activity: 'Afternoon strategy session', responsible: 'Facilitator' },
      { time: '15:00', activity: 'Afternoon tea break', responsible: 'F&B Team' },
      { time: '15:30', activity: 'Action items & closing', responsible: 'Facilitator' },
      { time: '17:00', activity: 'Meeting concludes', responsible: 'Events Team' },
    ],
    fnbMinimum: 3500, serviceChargePercent: 22, taxPercent: 8.5, status: 'confirmed',
    createdAt: '2025-06-01T08:00:00Z', updatedAt: '2025-08-15T16:00:00Z', approvedBy: 'Lisa Park', approvedAt: '2025-08-10T09:00:00Z',
  },
  {
    id: 'beo-005', beoNumber: 'BEO-2025-005', eventName: 'Rivera-Patel Mehndi Ceremony',
    eventDate: '2025-11-08', startTime: '16:00', endTime: '22:00', venue: 'Garden Pavilion',
    clientName: 'Priya Rivera & Arjun Patel', contactEmail: 'priya.r@email.com', contactPhone: '+1 (555) 567-8901',
    functionType: 'wedding', expectedGuests: 120, setupStyle: 'Custom', serviceStyle: 'stations',
    dietaryRequirements: ['All Vegetarian', '15 Vegan', 'Strictly no beef/pork in venue'],
    menuItems: [
      { name: 'Chaats & Starters Station', description: 'Samosa, paneer tikka, papdi chaat, bhel puri', dietaryTag: 'V/VG', perPersonCost: 18 },
      { name: 'Tandoor Station', description: 'Naan, garlic naan, tandoori vegetables, seekh kebab', dietaryTag: 'V Options', perPersonCost: 22 },
      { name: 'Main Course Buffet', description: 'Paneer butter masala, dal makhani, biryani, aloo gobi, raita', dietaryTag: 'V/VG', perPersonCost: 28 },
      { name: 'Dessert Station', description: 'Gulab jamun, ras malai, mango lassi, jalebi', dietaryTag: 'V', perPersonCost: 14 },
      { name: 'Mocktail Bar', description: 'Masala chai, mango lassi, rose sharbat, nimbu pani', dietaryTag: 'V', perPersonCost: 10 },
    ],
    barRequirements: 'No alcohol — full mocktail bar, chai station, traditional Indian beverages.',
    equipment: [
      { name: 'PA Speaker System', quantity: 1, costPerUnit: 500 },
      { name: 'Wireless Mic', quantity: 2, costPerUnit: 75 },
      { name: 'LED Uplighting (Warm)', quantity: 10, costPerUnit: 40 },
      { name: 'Mehndi Canopy Setup', quantity: 1, costPerUnit: 350 },
      { name: 'Portable Stage (10x8ft)', quantity: 1, costPerUnit: 800 },
    ],
    stageSetup: '10x8ft stage with traditional mandap-style canopy, decorated with marigolds and fairy lights',
    lightingSetup: 'Warm golden uplighting, string lights, lanterns, colored LED accents (saffron & fuchsia)',
    floorPlanDescription: 'Open lawn configuration, low seating with floor cushions for mehndi, buffet stations along left, stage at far end, photobooth area right of stage, dance circle center',
    timeline: [
      { time: '10:00', activity: 'Decor setup begins', responsible: 'Decor Team' },
      { time: '13:00', activity: 'Catering setup & food stations', responsible: 'F&B Team' },
      { time: '15:00', activity: 'Sound & lighting check', responsible: 'AV Team' },
      { time: '15:30', activity: 'Mehndi artist setup', responsible: 'Events Team' },
      { time: '16:00', activity: 'Guest arrival & mehndi begins', responsible: 'Events Team' },
      { time: '17:00', activity: 'Music & performances', responsible: 'Entertainment' },
      { time: '18:00', activity: 'Dinner stations open', responsible: 'F&B Captain' },
      { time: '19:30', activity: 'Family performances & games', responsible: 'MC' },
      { time: '20:30', activity: 'Dance floor opens', responsible: 'Entertainment' },
      { time: '21:30', activity: 'Favors & farewell', responsible: 'Events Team' },
      { time: '22:00', activity: 'Event concludes', responsible: 'Events Team' },
    ],
    fnbMinimum: 9200, serviceChargePercent: 20, taxPercent: 8.5, status: 'draft',
    createdAt: '2025-08-01T12:00:00Z', updatedAt: '2025-08-01T12:00:00Z',
  },
  {
    id: 'beo-006', beoNumber: 'BEO-2025-006', eventName: 'Lakeside Charity Gala 2025',
    eventDate: '2025-09-13', startTime: '18:00', endTime: '23:30', venue: 'Grand Ballroom',
    clientName: 'Lakeside Community Foundation', contactEmail: 'gala@lakesidecf.org', contactPhone: '+1 (555) 432-1098',
    functionType: 'social', expectedGuests: 200, setupStyle: 'Banquet Rounds', serviceStyle: 'plated',
    dietaryRequirements: ['25 Vegetarian', '12 Gluten-Free', '8 Dairy-Free', '4 Vegan', 'Kosher meals available'],
    menuItems: [
      { name: 'Canape Reception', description: 'Smoked salmon blinis, shrimp cocktail, bruschetta, cheese display', dietaryTag: 'V Options', perPersonCost: 20 },
      { name: 'Seasonal Salad', description: 'Mixed greens, goat cheese, candied pecans, balsamic vinaigrette', dietaryTag: 'VG Option', perPersonCost: 12 },
      { name: 'Herb-Crusted Chicken', description: 'With wild mushroom sauce, truffle mash, seasonal vegetables', dietaryTag: 'GF', perPersonCost: 38 },
      { name: 'Pan-Seared Sea Bass', description: 'With saffron risotto and beurre blanc', dietaryTag: 'GF', perPersonCost: 42 },
      { name: 'Deconstructed Cheesecake', description: 'Berry compote, vanilla cream, crumble', dietaryTag: 'V', perPersonCost: 16 },
    ],
    barRequirements: 'Premium open bar: Wine (red/white), champagne toast, craft cocktails, premium spirits, local craft beer, NA options.',
    equipment: [
      { name: '4K Projector', quantity: 1, costPerUnit: 400 },
      { name: '20ft Projection Screen', quantity: 1, costPerUnit: 250 },
      { name: 'Wireless Mic Set (Lav + Handheld)', quantity: 4, costPerUnit: 75 },
      { name: 'PA Speaker System', quantity: 1, costPerUnit: 500 },
      { name: 'Stage (12x8ft)', quantity: 1, costPerUnit: 900 },
      { name: 'Dance Floor (24x24)', quantity: 1, costPerUnit: 700 },
      { name: 'Silent Auction Displays', quantity: 4, costPerUnit: 50 },
    ],
    stageSetup: '12x8ft stage with pipe & drape backdrop, podium for MC, video wall for auction items',
    lightingSetup: 'Elegant uplighting in navy/gold, spotlight on stage, pin spots on auction tables, ambient candlelight on guest tables',
    floorPlanDescription: '20 round tables of 10, VIP table near stage, silent auction area in foyer, registration/greeting at entrance, photo wall, dance floor center',
    timeline: [
      { time: '12:00', activity: 'Full venue setup begins', responsible: 'Events Team' },
      { time: '15:00', activity: 'Catering setup & station prep', responsible: 'F&B Team' },
      { time: '16:00', activity: 'AV & sound check', responsible: 'AV Team' },
      { time: '16:30', activity: 'Silent auction item setup', responsible: 'Auction Team' },
      { time: '17:30', activity: 'Final walkthrough', responsible: 'Event Manager' },
      { time: '18:00', activity: 'VIP reception', responsible: 'F&B Team' },
      { time: '18:30', activity: 'General guest arrival', responsible: 'Registration' },
      { time: '19:00', activity: 'Welcome remarks & charity video', responsible: 'MC / AV' },
      { time: '19:30', activity: 'Dinner service begins', responsible: 'F&B Captain' },
      { time: '20:45', activity: 'Live auction', responsible: 'Auctioneer' },
      { time: '21:30', activity: 'Live entertainment', responsible: 'Entertainment' },
      { time: '22:00', activity: 'Dance floor & DJ', responsible: 'Entertainment' },
      { time: '23:00', activity: 'Closing remarks & thank you', responsible: 'MC' },
      { time: '23:30', activity: 'Event concludes', responsible: 'Events Team' },
    ],
    fnbMinimum: 16000, serviceChargePercent: 22, taxPercent: 8.5, status: 'completed',
    createdAt: '2025-04-10T10:00:00Z', updatedAt: '2025-09-14T08:00:00Z', approvedBy: 'David Kim', approvedAt: '2025-08-20T14:00:00Z',
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function BEOManagement() {
  const [beos, setBeos] = useState<BEO[]>(MOCK_BEOS);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedBEO, setSelectedBEO] = useState<BEO | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('list');
  const previewRef = useRef<HTMLDivElement>(null);

  // ─── Calculations ──────────────────────────────────────────────────────
  const calculateTotals = (beo: BEO) => {
    const menuTotal = beo.menuItems.reduce((sum, item) => sum + item.perPersonCost * beo.expectedGuests, 0);
    const equipmentTotal = beo.equipment.reduce((sum, eq) => sum + eq.quantity * eq.costPerUnit, 0);
    const subtotal = Math.max(menuTotal, beo.fnbMinimum) + equipmentTotal;
    const serviceCharge = subtotal * (beo.serviceChargePercent / 100);
    const tax = (subtotal + serviceCharge) * (beo.taxPercent / 100);
    const grandTotal = subtotal + serviceCharge + tax;
    return { menuTotal, equipmentTotal, subtotal, serviceCharge, tax, grandTotal, fnbActual: menuTotal };
  };

  // ─── Filters ───────────────────────────────────────────────────────────
  const filteredBeos = beos.filter(beo => {
    const matchSearch = beo.eventName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      beo.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      beo.beoNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus = statusFilter === 'all' || beo.status === statusFilter;
    const matchType = typeFilter === 'all' || beo.functionType === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  // ─── Status Stats ──────────────────────────────────────────────────────
  const statusCounts = STATUS_FLOW.reduce((acc, status) => {
    acc[status] = beos.filter(b => b.status === status).length;
    return acc;
  }, {} as Record<string, number>);

  // ─── Actions ───────────────────────────────────────────────────────────
  const handleStatusAdvance = (beo: BEO) => {
    const currentIdx = STATUS_FLOW.indexOf(beo.status);
    if (currentIdx < STATUS_FLOW.length - 1) {
      setBeos(prev => prev.map(b => {
        if (b.id === beo.id) {
          const newStatus = STATUS_FLOW[currentIdx + 1];
          return { ...b, status: newStatus, updatedAt: new Date().toISOString() };
        }
        return b;
      }));
      toast.success(`BEO ${beo.beoNumber} status advanced to ${STATUS_FLOW[currentIdx + 1].replace('_', ' ')}`);
    }
    setIsStatusDialogOpen(false);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportPDF = () => {
    toast.info('PDF export initiated. Document will download shortly.');
  };

  // ─── Render: Status Badge ──────────────────────────────────────────────
  const renderStatusBadge = (status: BEOStatus) => {
    const config = STATUS_CONFIG[status];
    return (
      <Badge className={cn('text-xs font-medium', config.color)}>
        {config.label}
      </Badge>
    );
  };

  // ─── Render: Status Progress ───────────────────────────────────────────
  const renderStatusProgress = (status: BEOStatus) => {
    const currentIdx = STATUS_FLOW.indexOf(status);
    return (
      <div className="flex items-center gap-1">
        {STATUS_FLOW.map((s, idx) => {
          const isActive = idx <= currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <div key={s} className="flex items-center">
              <div className={cn(
                'flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold transition-all',
                isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                isCurrent && 'ring-2 ring-primary/30 scale-110',
              )}>
                {isActive ? '✓' : idx + 1}
              </div>
              {idx < STATUS_FLOW.length - 1 && (
                <div className={cn('w-4 h-0.5', isActive && idx < currentIdx ? 'bg-primary' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render: BEO Preview Document ──────────────────────────────────────
  const renderBEOPreview = (beo: BEO) => {
    const totals = calculateTotals(beo);
    return (
      <div ref={previewRef} className="space-y-6 text-sm print:text-xs">
        {/* Document Header */}
        <div className="border-b-2 border-primary pb-4">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Banquet Event Order</h1>
              <p className="text-muted-foreground mt-1">StaySuite HospitalityOS</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-lg">{beo.beoNumber}</p>
              {renderStatusBadge(beo.status)}
              {beo.approvedBy && (
                <p className="text-xs text-muted-foreground mt-1">Approved by: {beo.approvedBy}</p>
              )}
            </div>
          </div>
        </div>

        {/* Event Header */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Event Details</h3>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{beo.eventName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.eventDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.startTime} — {beo.endTime}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.venue}</span>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold text-base">Client Information</h3>
            <div className="space-y-1.5">
              <div className="font-medium">{beo.clientName}</div>
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.contactEmail}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{beo.contactPhone}</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Function Details */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Users className="h-4 w-4" /> Function Details
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Type</div>
              <div className="font-medium capitalize">{FUNCTION_TYPES.find(t => t.value === beo.functionType)?.icon} {beo.functionType}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Expected Guests</div>
              <div className="font-medium">{beo.expectedGuests}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Setup Style</div>
              <div className="font-medium">{beo.setupStyle}</div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Service Style</div>
              <div className="font-medium capitalize">{beo.serviceStyle}</div>
            </div>
          </div>
          {beo.dietaryRequirements.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-muted-foreground mb-1">Dietary Requirements</div>
              <div className="flex flex-wrap gap-1.5">
                {beo.dietaryRequirements.map((d, i) => (
                  <Badge key={i} variant="outline" className="text-xs">{d}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Food & Beverage */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" /> Food & Beverage
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead className="hidden sm:table-cell">Description</TableHead>
                <TableHead className="text-center">Dietary</TableHead>
                <TableHead className="text-right">Per Person</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beo.menuItems.map((item, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">{item.description}</TableCell>
                  <TableCell className="text-center">
                    {item.dietaryTag ? <Badge variant="outline" className="text-[10px]">{item.dietaryTag}</Badge> : '—'}
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.perPersonCost)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(item.perPersonCost * beo.expectedGuests)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {beo.barRequirements && (
            <div className="mt-3 rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium mb-1">
                <Wine className="h-3.5 w-3.5" /> Bar Requirements
              </div>
              <p className="text-xs text-muted-foreground">{beo.barRequirements}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Equipment & AV */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Monitor className="h-4 w-4" /> Equipment & AV
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Equipment</TableHead>
                <TableHead className="text-center">Qty</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beo.equipment.map((eq, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{eq.name}</TableCell>
                  <TableCell className="text-center">{eq.quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(eq.costPerUnit)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(eq.quantity * eq.costPerUnit)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium mb-1">
                <RectangleHorizontal className="h-3.5 w-3.5" /> Stage Setup
              </div>
              <p className="text-xs text-muted-foreground">{beo.stageSetup}</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium mb-1">
                <Lightbulb className="h-3.5 w-3.5" /> Lighting Setup
              </div>
              <p className="text-xs text-muted-foreground">{beo.lightingSetup}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Floor Plan */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <ClipboardList className="h-4 w-4" /> Floor Plan / Room Setup
          </h3>
          <div className="rounded-lg border bg-muted/30 p-4">
            <p className="text-sm">{beo.floorPlanDescription}</p>
          </div>
        </div>

        <Separator />

        {/* Timeline */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Event Timeline
          </h3>
          <div className="space-y-2">
            {beo.timeline.map((item, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="shrink-0 text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                  {item.time}
                </div>
                <div className="border-l-2 border-primary/20 pl-3 pb-2">
                  <div className="font-medium text-sm">{item.activity}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.responsible} {item.notes && `— ${item.notes}`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Billing Summary */}
        <div>
          <h3 className="font-semibold text-base mb-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Billing Summary
          </h3>
          <div className="rounded-lg border p-4 space-y-2 max-w-sm ml-auto">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">F&B Actual</span>
              <span>{formatCurrency(totals.fnbActual)}</span>
            </div>
            {totals.fnbActual < beo.fnbMinimum && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">F&B Minimum (applied)</span>
                <span className="font-medium">{formatCurrency(beo.fnbMinimum)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Equipment Rental</span>
              <span>{formatCurrency(totals.equipmentTotal)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-sm font-medium">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Service Charge ({beo.serviceChargePercent}%)</span>
              <span>{formatCurrency(totals.serviceCharge)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({beo.taxPercent}%)</span>
              <span>{formatCurrency(totals.tax)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Grand Total</span>
              <span className="text-primary">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>

        {/* Document Footer */}
        <div className="border-t pt-4 text-xs text-muted-foreground text-center space-y-1">
          <p>Generated by StaySuite HospitalityOS &mdash; {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          <p>This document is confidential. Unauthorized distribution is prohibited.</p>
        </div>
      </div>
    );
  };

  // ─── Main Render ───────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" />
            BEO Management
          </h2>
          <p className="text-muted-foreground">Banquet Event Order document generation and tracking</p>
        </div>
        <Button className="print:hidden">
          <Plus className="h-4 w-4 mr-2" />
          New BEO
        </Button>
      </div>

      {/* Status Pipeline Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-sm">Status Pipeline</h3>
            <span className="text-xs text-muted-foreground">{beos.length} total BEOs</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {STATUS_FLOW.map(status => {
              const count = statusCounts[status] || 0;
              const config = STATUS_CONFIG[status];
              return (
                <div key={status} className="flex items-center gap-2 flex-1">
                  <div className={cn(
                    'rounded-lg p-3 flex-1 text-center border-2 cursor-pointer transition-all hover:shadow-md',
                    statusFilter === status ? 'ring-2 ring-primary/20 ' : '',
                    count > 0 ? config.color : 'bg-muted/50 text-muted-foreground opacity-60'
                  )} onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}>
                    <div className="text-lg font-bold">{count}</div>
                    <div className="text-[11px] font-medium">{config.label}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="list">
              <ClipboardList className="h-4 w-4 mr-1.5" />
              BEO List
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-1.5" />
              Document Preview
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-2 print:hidden">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search BEOs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-full sm:w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {STATUS_FLOW.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {FUNCTION_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* BEO List Tab */}
        <TabsContent value="list" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>BEO #</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead className="hidden lg:table-cell">Venue</TableHead>
                      <TableHead className="hidden sm:table-cell">Guests</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBeos.map(beo => (
                      <TableRow key={beo.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => { setSelectedBEO(beo); setActiveTab('preview'); }}>
                        <TableCell className="font-mono text-xs font-medium">{beo.beoNumber}</TableCell>
                        <TableCell>
                          <div className="font-medium">{beo.eventName}</div>
                          <div className="text-xs text-muted-foreground">{beo.clientName}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm">
                          <div>{beo.eventDate}</div>
                          <div className="text-muted-foreground">{beo.startTime} – {beo.endTime}</div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{beo.venue}</TableCell>
                        <TableCell className="hidden sm:table-cell font-medium">{beo.expectedGuests}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">
                            {FUNCTION_TYPES.find(t => t.value === beo.functionType)?.icon} {beo.functionType}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {renderStatusBadge(beo.status)}
                          <div className="mt-1">{renderStatusProgress(beo.status)}</div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedBEO(beo); setIsPreviewOpen(true); }} title="Preview">
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedBEO(beo); setIsStatusDialogOpen(true); }} title="Advance Status">
                              <ArrowRight className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { setSelectedBEO(beo); handlePrint(); }} title="Print">
                              <Printer className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleExportPDF()} title="Export PDF">
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredBeos.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
                          <p className="font-medium">No BEOs found</p>
                          <p className="text-xs">Try adjusting your filters</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Preview Tab */}
        <TabsContent value="preview" className="mt-4">
          {selectedBEO ? (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">Document Preview</CardTitle>
                  {renderStatusBadge(selectedBEO.status)}
                  <span className="font-mono text-sm text-muted-foreground">{selectedBEO.beoNumber}</span>
                </div>
                <div className="flex gap-2 print:hidden">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleExportPDF}>
                    <Download className="h-4 w-4 mr-2" />
                    Export PDF
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(selectedBEO.beoNumber);
                    toast.success('BEO number copied to clipboard');
                  }}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy #
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="max-h-[700px] overflow-y-auto">
                {renderBEOPreview(selectedBEO)}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FileText className="h-16 w-16 mb-4 opacity-30" />
                <h3 className="text-lg font-medium">Select a BEO to preview</h3>
                <p className="text-sm mt-1">Click on any BEO in the list to view its full document</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Status Advance Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Advance BEO Status</DialogTitle>
            <DialogDescription>
              Move <span className="font-mono font-medium">{selectedBEO?.beoNumber}</span> from{' '}
              <span className="font-medium">{STATUS_CONFIG[selectedBEO?.status || 'draft']?.label}</span> to the next stage.
            </DialogDescription>
          </DialogHeader>
          {selectedBEO && (
            <div className="py-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-lg border px-3 py-2 flex-1 text-center">
                  <div className="text-xs text-muted-foreground">Current</div>
                  {renderStatusBadge(selectedBEO.status)}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <div className="rounded-lg border px-3 py-2 flex-1 text-center">
                  <div className="text-xs text-muted-foreground">Next</div>
                  {renderStatusBadge(STATUS_FLOW[STATUS_FLOW.indexOf(selectedBEO.status) + 1] || 'completed')}
                </div>
              </div>
              {selectedBEO.status === 'under_review' && (
                <div className="space-y-2">
                  <Label>Approved By</Label>
                  <Input placeholder="Enter approver name" />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => selectedBEO && handleStatusAdvance(selectedBEO)}>
              <ArrowRight className="h-4 w-4 mr-2" />
              Advance Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Document Preview Dialog */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {selectedBEO?.beoNumber} — {selectedBEO?.eventName}
            </DialogTitle>
            <DialogDescription>Full BEO document preview</DialogDescription>
          </DialogHeader>
          {selectedBEO && renderBEOPreview(selectedBEO)}
          <DialogFooter className="print:hidden">
            <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>Close</Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button onClick={handleExportPDF}>
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
