'use client';

import { useTranslations } from 'next-intl';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  Plus,
  Calendar,
  DollarSign,
  Percent,
  Clock,
  TrendingUp,
  TrendingDown,
  Edit,
  Trash2,
  Copy,
  MoreHorizontal,
  CheckCircle,
  RefreshCw,
  Tag,
  Users,
  Zap,
  Globe,
  Timer,
  Sparkles,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';

// ============================================================
// Types
// ============================================================

type RuleType =
  | 'markup'
  | 'markdown'
  | 'discount_percentage'
  | 'discount_fixed'
  | 'surcharge_percentage'
  | 'surcharge_fixed'
  | 'early_bird'
  | 'last_minute'
  | 'long_stay'
  | 'weekend'
  | 'seasonal'
  | 'promo_code'
  | 'occupancy'
  | 'advance_booking'
  | 'channel';

interface PricingRuleConditions {
  minOccupancy?: number;
  maxOccupancy?: number;
  daysOfWeek?: string[];
  minLeadTime?: number;
  maxLeadTime?: number;
  minStay?: number;
  maxStay?: number;
  advanceBookingDaysMin?: number;
  advanceBookingDaysMax?: number;
  promoCode?: string;
  promoMaxUses?: number;
  bookingChannel?: string[];
}

interface PricingRule {
  id: string;
  name: string;
  type: RuleType;
  value: number;
  valueType: 'percentage' | 'fixed';
  conditions: PricingRuleConditions;
  priority: number;
  isActive: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  roomTypes: string[];
  description?: string;
}

interface PricingRuleStats {
  totalRules: number;
  activeRules: number;
  avgAdjustment: number;
  seasonalRules: number;
}

// ============================================================
// Constants
// ============================================================

const ALL_RULE_TYPES: { value: RuleType; label: string; group: string }[] = [
  { value: 'markup', label: 'Price Increase', group: 'Basic Adjustments' },
  { value: 'markdown', label: 'Price Decrease', group: 'Basic Adjustments' },
  { value: 'discount_percentage', label: 'Percentage Discount', group: 'Basic Adjustments' },
  { value: 'discount_fixed', label: 'Fixed Discount', group: 'Basic Adjustments' },
  { value: 'surcharge_percentage', label: 'Percentage Surcharge', group: 'Basic Adjustments' },
  { value: 'surcharge_fixed', label: 'Fixed Surcharge', group: 'Basic Adjustments' },
  { value: 'early_bird', label: 'Early Bird Discount', group: 'Time-Based' },
  { value: 'last_minute', label: 'Last Minute', group: 'Time-Based' },
  { value: 'advance_booking', label: 'Advance Booking', group: 'Time-Based' },
  { value: 'seasonal', label: 'Seasonal Rate', group: 'Time-Based' },
  { value: 'weekend', label: 'Weekend Adjustment', group: 'Time-Based' },
  { value: 'long_stay', label: 'Long Stay Discount', group: 'Stay-Based' },
  { value: 'occupancy', label: 'Occupancy Surcharge', group: 'Guest-Based' },
  { value: 'promo_code', label: 'Promo Code', group: 'Promotions' },
  { value: 'channel', label: 'Channel Adjustment', group: 'Promotions' },
];

const ruleTypeLabels: Record<string, string> = Object.fromEntries(
  ALL_RULE_TYPES.map(t => [t.value, t.label])
);

const ruleTypeColors: Record<string, string> = {
  markup: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  markdown: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  discount_percentage: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  discount_fixed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  surcharge_percentage: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  surcharge_fixed: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  early_bird: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300',
  last_minute: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300',
  advance_booking: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  seasonal: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  weekend: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
  long_stay: 'bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300',
  occupancy: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
  promo_code: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300',
  channel: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900 dark:text-cyan-300',
};

const BOOKING_CHANNELS = [
  { value: 'direct', label: 'Direct Website' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'booking_com', label: 'Booking.com' },
  { value: 'expedia', label: 'Expedia' },
  { value: 'airbnb', label: 'Airbnb' },
  { value: 'google_hotels', label: 'Google Hotels' },
  { value: 'agoda', label: 'Agoda' },
  { value: 'hotels_com', label: 'Hotels.com' },
  { value: 'ota_other', label: 'Other OTA' },
];

const DISCOUNT_TYPES: RuleType[] = ['markdown', 'discount_percentage', 'discount_fixed', 'early_bird', 'long_stay', 'promo_code', 'advance_booking'];

function generatePromoCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ============================================================
// RuleForm — extracted as a top-level component
// ============================================================

function RuleForm({ rule, onChange, onSave, onCancel, isSaving, currencySymbol }: {
  rule: Partial<PricingRule>;
  onChange: (rule: Partial<PricingRule>) => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  currencySymbol: string;
}) {
  const currentType = rule.type as RuleType;
  const conditions = rule.conditions || {};

  const updateCondition = (key: string, value: unknown) => {
    onChange({
      ...rule,
      conditions: { ...rule.conditions, [key]: value },
    });
  };

  const groups = useMemo(() => {
    const map = new Map<string, typeof ALL_RULE_TYPES>();
    for (const t of ALL_RULE_TYPES) {
      if (!map.has(t.group)) map.set(t.group, []);
      map.get(t.group)!.push(t);
    }
    return map;
  }, []);

  return (
    <div className="space-y-4 py-4">
      {/* Rule Name */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Rule Name</label>
        <Input
          placeholder="e.g., Summer Peak Season"
          value={rule.name || ''}
          onChange={(e) => onChange({ ...rule, name: e.target.value })}
        />
      </div>

      {/* Rule Type Selector with groups */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Rule Type</label>
        <Select
          value={rule.type}
          onValueChange={(value) => {
            const newType = value as RuleType;
            const defaults: Partial<PricingRule> = { type: newType };
            switch (newType) {
              case 'early_bird':
                defaults.value = 10;
                defaults.valueType = 'percentage';
                defaults.conditions = { ...conditions, advanceBookingDaysMin: 14 };
                break;
              case 'last_minute':
                defaults.value = 15;
                defaults.valueType = 'percentage';
                defaults.conditions = { ...conditions, advanceBookingDaysMax: 3 };
                break;
              case 'long_stay':
                defaults.value = 10;
                defaults.valueType = 'percentage';
                defaults.conditions = { ...conditions, minStay: 7 };
                break;
              case 'promo_code':
                defaults.value = 10;
                defaults.valueType = 'percentage';
                defaults.conditions = { ...conditions, promoCode: generatePromoCode(), promoMaxUses: 100 };
                break;
              case 'occupancy':
                defaults.value = 25;
                defaults.valueType = 'fixed';
                defaults.conditions = { ...conditions, minOccupancy: 2 };
                break;
              case 'advance_booking':
                defaults.value = 5;
                defaults.valueType = 'percentage';
                defaults.conditions = { ...conditions, advanceBookingDaysMin: 30, advanceBookingDaysMax: 90 };
                break;
              case 'channel':
                defaults.value = 10;
                defaults.valueType = 'percentage';
                defaults.conditions = { ...conditions, bookingChannel: [] };
                break;
              case 'weekend':
                defaults.value = 15;
                defaults.valueType = 'percentage';
                break;
              case 'seasonal':
                defaults.value = 20;
                defaults.valueType = 'percentage';
                break;
              default:
                defaults.value = 10;
                defaults.valueType = 'percentage';
                break;
            }
            onChange({ ...rule, ...defaults });
          }}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Array.from(groups.entries()).map(([group, types]) => (
              <React.Fragment key={group}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {group}
                </div>
                {types.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value}>
                    {rt.label}
                  </SelectItem>
                ))}
              </React.Fragment>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ---- Type-specific condition fields ---- */}

      {/* Early Bird */}
      {currentType === 'early_bird' && (
        <div className="space-y-2 rounded-md border border-sky-200 bg-sky-50/50 dark:border-sky-800 dark:bg-sky-950/30 p-3">
          <label className="text-xs font-medium flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
            <Clock className="h-3.5 w-3.5" />
            Early Bird Settings
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Book at least (days)</label>
              <Input
                type="number"
                min={1}
                value={conditions.advanceBookingDaysMin || ''}
                onChange={(e) => updateCondition('advanceBookingDaysMin', parseInt(e.target.value) || 7)}
                placeholder="14"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Discount Value (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={rule.value || ''}
                onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
                placeholder="10"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Guests who book at least {conditions.advanceBookingDaysMin || 14} days in advance get {rule.value || 10}% off.
          </p>
        </div>
      )}

      {/* Last Minute */}
      {currentType === 'last_minute' && (
        <div className="space-y-2 rounded-md border border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-950/30 p-3">
          <label className="text-xs font-medium flex items-center gap-1.5 text-rose-700 dark:text-rose-400">
            <Zap className="h-3.5 w-3.5" />
            Last Minute Settings
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Within (days)</label>
              <Input
                type="number"
                min={0}
                value={conditions.advanceBookingDaysMax || ''}
                onChange={(e) => updateCondition('advanceBookingDaysMax', parseInt(e.target.value) || 3)}
                placeholder="3"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">
                {rule.value > 0 ? 'Markup' : 'Discount'} Value (%)
              </label>
              <Input
                type="number"
                value={rule.value || ''}
                onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
                placeholder="Positive=markup, Negative=discount"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Applies to bookings made within {conditions.advanceBookingDaysMax || 3} days of check-in.
          </p>
        </div>
      )}

      {/* Long Stay */}
      {currentType === 'long_stay' && (
        <div className="space-y-2 rounded-md border border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30 p-3">
          <label className="text-xs font-medium flex items-center gap-1.5 text-teal-700 dark:text-teal-400">
            <Calendar className="h-3.5 w-3.5" />
            Long Stay Settings
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Minimum Nights</label>
              <Input
                type="number"
                min={1}
                value={conditions.minStay || ''}
                onChange={(e) => updateCondition('minStay', parseInt(e.target.value) || 7)}
                placeholder="7"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Discount (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={rule.value || ''}
                onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
                placeholder="10"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Stays of {conditions.minStay || 7}+ nights receive a {rule.value || 10}% discount.
          </p>
        </div>
      )}

      {/* Promo Code */}
      {currentType === 'promo_code' && (
        <div className="space-y-2 rounded-md border border-pink-200 bg-pink-50/50 dark:border-pink-800 dark:bg-pink-950/30 p-3">
          <label className="text-xs font-medium flex items-center gap-1.5 text-pink-700 dark:text-pink-400">
            <Tag className="h-3.5 w-3.5" />
            Promo Code Settings
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <label className="text-xs text-muted-foreground">Promo Code</label>
              <div className="flex gap-2">
                <Input
                  className="uppercase tracking-wider font-mono"
                  value={conditions.promoCode || ''}
                  onChange={(e) => updateCondition('promoCode', e.target.value.toUpperCase())}
                  placeholder="e.g., SUMMER25"
                  maxLength={12}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={() => updateCondition('promoCode', generatePromoCode())}
                  title="Auto-generate code"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Max Uses</label>
              <Input
                type="number"
                min={1}
                value={conditions.promoMaxUses || ''}
                onChange={(e) => updateCondition('promoMaxUses', parseInt(e.target.value) || undefined)}
                placeholder="Unlimited"
              />
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            <label className="text-xs text-muted-foreground">Discount Value (%)</label>
            <Input
              type="number"
              min={0}
              max={100}
              value={rule.value || ''}
              onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
              placeholder="10"
            />
          </div>
        </div>
      )}

      {/* Occupancy */}
      {currentType === 'occupancy' && (
        <div className="space-y-2 rounded-md border border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-950/30 p-3">
          <label className="text-xs font-medium flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
            <Users className="h-3.5 w-3.5" />
            Occupancy Surcharge Settings
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Threshold Guests</label>
              <Input
                type="number"
                min={1}
                value={conditions.minOccupancy || ''}
                onChange={(e) => updateCondition('minOccupancy', parseInt(e.target.value) || 2)}
                placeholder="2"
              />
              <p className="text-xs text-muted-foreground">Surcharge applies above this number</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Per-Person Surcharge</label>
              <Input
                type="number"
                min={0}
                value={rule.value || ''}
                onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
                placeholder="25"
              />
            </div>
          </div>
        </div>
      )}

      {/* Advance Booking */}
      {currentType === 'advance_booking' && (
        <div className="space-y-2 rounded-md border border-indigo-200 bg-indigo-50/50 dark:border-indigo-800 dark:bg-indigo-950/30 p-3">
          <label className="text-xs font-medium flex items-center gap-1.5 text-indigo-700 dark:text-indigo-400">
            <Timer className="h-3.5 w-3.5" />
            Advance Booking Settings
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Min Days</label>
              <Input
                type="number"
                min={0}
                value={conditions.advanceBookingDaysMin || ''}
                onChange={(e) => updateCondition('advanceBookingDaysMin', parseInt(e.target.value) || undefined)}
                placeholder="30"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Max Days</label>
              <Input
                type="number"
                min={0}
                value={conditions.advanceBookingDaysMax || ''}
                onChange={(e) => updateCondition('advanceBookingDaysMax', parseInt(e.target.value) || undefined)}
                placeholder="90"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Discount (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={rule.value || ''}
                onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
                placeholder="5"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Reward guests who plan ahead. Applies when booking {conditions.advanceBookingDaysMin || 0}–{conditions.advanceBookingDaysMax || '∞'} days in advance.
          </p>
        </div>
      )}

      {/* Channel */}
      {currentType === 'channel' && (
        <div className="space-y-2 rounded-md border border-cyan-200 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30 p-3">
          <label className="text-xs font-medium flex items-center gap-1.5 text-cyan-700 dark:text-cyan-400">
            <Globe className="h-3.5 w-3.5" />
            Channel Settings
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Channel</label>
              <Select
                value={(conditions.bookingChannel?.[0]) || ''}
                onValueChange={(value) => updateCondition('bookingChannel', [value])}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select channel" />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_CHANNELS.map(ch => (
                    <SelectItem key={ch.value} value={ch.value}>
                      {ch.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Adjustment Value</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={rule.valueType || 'percentage'}
                  onValueChange={(v) => onChange({ ...rule, valueType: v as 'percentage' | 'fixed' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="fixed">{currencySymbol}</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={rule.value || ''}
                  onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
                  placeholder={rule.valueType === 'percentage' ? '10' : '20'}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* General fields for types without specific panels */}
      {!['early_bird', 'last_minute', 'long_stay', 'promo_code', 'occupancy', 'advance_booking', 'channel'].includes(currentType) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Value Type</label>
            <Select
              value={rule.valueType}
              onValueChange={(value) => onChange({ ...rule, valueType: value as 'percentage' | 'fixed' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percentage">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Adjustment Value</label>
            <Input
              type="number"
              placeholder="Enter value"
              value={rule.value || ''}
              onChange={(e) => onChange({ ...rule, value: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
      )}

      {/* Priority + Effective From */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Priority</label>
          <Input
            type="number"
            placeholder="1 (higher = applied first)"
            value={rule.priority || ''}
            onChange={(e) => onChange({ ...rule, priority: parseInt(e.target.value) || 1 })}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Effective From</label>
          <Input
            type="date"
            value={rule.effectiveFrom || ''}
            onChange={(e) => onChange({ ...rule, effectiveFrom: e.target.value })}
          />
        </div>
      </div>

      {/* Effective To */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Effective To (Optional)</label>
        <Input
          type="date"
          value={rule.effectiveTo || ''}
          onChange={(e) => onChange({ ...rule, effectiveTo: e.target.value })}
        />
      </div>

      {/* Description */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Description</label>
        <Textarea
          placeholder="Describe this pricing rule"
          value={rule.description || ''}
          onChange={(e) => onChange({ ...rule, description: e.target.value })}
        />
      </div>

      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={onSave} disabled={isSaving} className="bg-emerald-600 hover:bg-emerald-700">
          {isSaving ? 'Saving...' : 'Save Rule'}
        </Button>
      </DialogFooter>
    </div>
  );
}

// ============================================================
// Main Component
// ============================================================

export function PricingRules() {
  const t = useTranslations('revenue');
  const { formatCurrency, currency } = useCurrency();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [stats, setStats] = useState<PricingRuleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<PricingRule | null>(null);
  const [newRule, setNewRule] = useState<Partial<PricingRule>>({
    name: '',
    type: 'markup',
    value: 10,
    valueType: 'percentage',
    isActive: true,
    priority: 1,
    effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
    roomTypes: [],
    conditions: {},
  });

  const fetchPricingRules = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/revenue/pricing-rules');
      const data = await response.json();

      if (data.success) {
        setRules(data.data || []);
        setStats(data.stats || {
          totalRules: 0,
          activeRules: 0,
          avgAdjustment: 0,
          seasonalRules: 0,
        });
      } else {
        toast.error('Failed to load pricing rules');
      }
    } catch (error) {
      console.error('Error fetching pricing rules:', error);
      toast.error('Failed to load pricing rules');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricingRules();
  }, [fetchPricingRules]);

  const toggleRuleActive = async (id: string) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;

    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, isActive: !rule.isActive }),
      });
      const data = await response.json();
      if (data.success) {
        setRules(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
        toast.success('Rule status updated');
      } else {
        toast.error('Failed to update rule');
      }
    } catch {
      toast.error('Failed to update rule');
    }
  };

  const deleteRule = async (id: string) => {
    try {
      const response = await fetch(`/api/revenue/pricing-rules?id=${id}`, { method: 'DELETE' });
      const data = await response.json();
      if (data.success) {
        setRules(prev => prev.filter(rule => rule.id !== id));
        toast.success('Rule deleted');
      } else {
        toast.error('Failed to delete rule');
      }
    } catch {
      toast.error('Failed to delete rule');
    }
  };

  const duplicateRule = async (rule: PricingRule) => {
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rule, name: `${rule.name} (Copy)` }),
      });
      const data = await response.json();
      if (data.success) {
        setRules(prev => [...prev, data.data]);
        toast.success('Rule duplicated');
      } else {
        toast.error('Failed to duplicate rule');
      }
    } catch {
      toast.error('Failed to duplicate rule');
    }
  };

  const createRule = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule),
      });
      const data = await response.json();
      if (data.success) {
        setRules(prev => [...prev, data.data]);
        setIsCreateOpen(false);
        resetForm();
        toast.success('Pricing rule created');
      } else {
        toast.error(data.error?.message || 'Failed to create rule');
      }
    } catch {
      toast.error('Failed to create rule');
    } finally {
      setIsSaving(false);
    }
  };

  const updateRule = async () => {
    if (!editingRule) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/revenue/pricing-rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRule),
      });
      const data = await response.json();
      if (data.success) {
        setRules(prev => prev.map(r => (r.id === editingRule.id ? data.data : r)));
        setEditingRule(null);
        toast.success('Pricing rule updated');
      } else {
        toast.error('Failed to update rule');
      }
    } catch {
      toast.error('Failed to update rule');
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setNewRule({
      name: '',
      type: 'markup',
      value: 10,
      valueType: 'percentage',
      isActive: true,
      priority: 1,
      effectiveFrom: format(new Date(), 'yyyy-MM-dd'),
      roomTypes: [],
      conditions: {},
    });
    setEditingRule(null);
  };

  const getConditionsDescription = (rule: PricingRule): string => {
    const c = rule.conditions || {};
    const parts: string[] = [];
    if (c.daysOfWeek && c.daysOfWeek.length > 0) parts.push(c.daysOfWeek.join(', '));
    if (c.minStay) parts.push(`${c.minStay}+ nights`);
    if (c.maxLeadTime) parts.push(`Within ${c.maxLeadTime} days`);
    if (c.advanceBookingDaysMin) parts.push(`${c.advanceBookingDaysMin}+ days advance`);
    if (c.promoCode) parts.push(`Code: ${c.promoCode}`);
    if (c.bookingChannel && c.bookingChannel.length > 0) parts.push(c.bookingChannel.join(', '));
    return parts.length > 0 ? parts.join(' · ') : 'All conditions';
  };

  if (isLoading || !stats) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="pt-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Pricing Rules</h2>
          <p className="text-muted-foreground">Automated pricing adjustments and strategies</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchPricingRules}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <Button onClick={() => setIsCreateOpen(true)} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="h-4 w-4" />
              Create Rule
            </Button>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Pricing Rule</DialogTitle>
                <DialogDescription>Set up an automated pricing adjustment rule</DialogDescription>
              </DialogHeader>
              <RuleForm
                rule={newRule}
                onChange={setNewRule}
                onSave={createRule}
                onCancel={() => { setIsCreateOpen(false); resetForm(); }}
                isSaving={isSaving}
                currencySymbol={currency.symbol}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950 dark:to-emerald-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">Total Rules</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">{stats.totalRules}</p>
              </div>
              <div className="p-3 rounded-full bg-emerald-200 dark:bg-emerald-800">
                <DollarSign className="h-6 w-6 text-emerald-700 dark:text-emerald-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950 dark:to-amber-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Active Rules</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">{stats.activeRules}</p>
              </div>
              <div className="p-3 rounded-full bg-amber-200 dark:bg-amber-800">
                <CheckCircle className="h-6 w-6 text-amber-700 dark:text-amber-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-violet-100 dark:from-violet-950 dark:to-violet-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-violet-700 dark:text-violet-400">Avg Adjustment</p>
                <p className="text-2xl font-bold text-violet-900 dark:text-violet-100">{stats.avgAdjustment}%</p>
              </div>
              <div className="p-3 rounded-full bg-violet-200 dark:bg-violet-800">
                <Percent className="h-6 w-6 text-violet-700 dark:text-violet-300" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-950 dark:to-cyan-900">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cyan-700 dark:text-cyan-400">Seasonal Rules</p>
                <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">{stats.seasonalRules}</p>
              </div>
              <div className="p-3 rounded-full bg-cyan-200 dark:bg-cyan-800">
                <Calendar className="h-6 w-6 text-cyan-700 dark:text-cyan-300" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rules List */}
      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Pricing Rules</CardTitle>
          <CardDescription>Manage automated pricing adjustments</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {rules.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <DollarSign className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No pricing rules yet</p>
              <p className="text-sm">Create your first pricing rule to get started</p>
            </div>
          ) : (
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rule Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Adjustment</TableHead>
                    <TableHead>Conditions</TableHead>
                    <TableHead>Effective Period</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => {
                    const isDiscount = DISCOUNT_TYPES.includes(rule.type);
                    return (
                      <TableRow key={rule.id} className={!rule.isActive ? 'opacity-60' : ''}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            {rule.description && (
                              <p className="text-xs text-muted-foreground">{rule.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={ruleTypeColors[rule.type] || 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'}>
                            {ruleTypeLabels[rule.type] || rule.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {isDiscount
                              ? <TrendingDown className="h-4 w-4 shrink-0 text-red-500 dark:text-red-400" />
                              : <TrendingUp className="h-4 w-4 shrink-0 text-emerald-500 dark:text-emerald-400" />}
                            <span className={isDiscount ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}>
                              {isDiscount ? '-' : '+'}{rule.value}{rule.valueType === 'percentage' ? '%' : currency.symbol}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs max-w-[180px] truncate">
                            {getConditionsDescription(rule)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p>{rule.effectiveFrom ? format(new Date(rule.effectiveFrom), 'MMM dd, yyyy') : '-'}</p>
                            {rule.effectiveTo && (
                              <p className="text-muted-foreground">to {format(new Date(rule.effectiveTo), 'MMM dd, yyyy')}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Switch checked={rule.isActive} onCheckedChange={() => toggleRuleActive(rule.id)} />
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setEditingRule(rule)}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => duplicateRule(rule)}>
                                <Copy className="h-4 w-4 mr-2" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600 dark:text-red-400" onClick={() => deleteRule(rule.id)}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editingRule} onOpenChange={() => setEditingRule(null)}>
        <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Pricing Rule</DialogTitle>
            <DialogDescription>Update the pricing rule settings</DialogDescription>
          </DialogHeader>
          {editingRule && (
            <RuleForm
              rule={editingRule}
              onChange={(rule) => setEditingRule(rule as PricingRule)}
              onSave={updateRule}
              onCancel={() => setEditingRule(null)}
              isSaving={isSaving}
              currencySymbol={currency.symbol}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
