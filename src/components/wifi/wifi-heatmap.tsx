'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  MapPin,
  Upload,
  Wifi,
  Signal,
  SignalHigh,
  SignalMedium,
  SignalLow,
  SignalZero,
  Eye,
  EyeOff,
  Layers,
  BarChart3,
  Settings,
  Info,
  Plus,
  Trash2,
  RefreshCw,
  Loader2,
} from 'lucide-react';

// ─── Signal Quality Constants ────────────────────────────────────
const SIGNAL_COLORS = {
  excellent: '#22c55e',
  good: '#eab308',
  fair: '#f97316',
  weak: '#ef4444',
} as const;

const SIGNAL_LABELS: Record<string, string> = {
  excellent: 'Excellent (> -50 dBm)',
  good: 'Good (-50 to -65 dBm)',
  fair: 'Fair (-65 to -75 dBm)',
  weak: 'Weak (< -75 dBm)',
};

function classifySignal(rssi: number): string {
  if (rssi > -50) return 'excellent';
  if (rssi >= -65) return 'good';
  if (rssi >= -75) return 'fair';
  return 'weak';
}

function getSignalColor(rssi: number): string {
  return SIGNAL_COLORS[classifySignal(rssi) as keyof typeof SIGNAL_COLORS] || SIGNAL_COLORS.weak;
}

function coverageRadius(rssi: number): number {
  if (rssi > -50) return 18;
  if (rssi >= -65) return 14;
  if (rssi >= -75) return 10;
  return 7;
}

// ─── Default Demo SVG Floor Plan ─────────────────────────────────
const DEMO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" fill="none">
  <rect width="800" height="600" fill="#f8fafc" stroke="#94a3b8" stroke-width="2"/>
  <!-- Lobby -->
  <rect x="20" y="20" width="360" height="200" fill="#fefce8" stroke="#94a3b8" stroke-width="1.5" rx="4"/>
  <text x="200" y="130" font-family="sans-serif" font-size="16" fill="#71717a" text-anchor="middle">Lobby</text>
  <!-- Restaurant -->
  <rect x="420" y="20" width="360" height="180" fill="#f0fdf4" stroke="#94a3b8" stroke-width="1.5" rx="4"/>
  <text x="600" y="120" font-family="sans-serif" font-size="16" fill="#71717a" text-anchor="middle">Restaurant</text>
  <!-- Corridor F1 -->
  <rect x="20" y="240" width="760" height="60" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/>
  <text x="400" y="275" font-family="sans-serif" font-size="12" fill="#71717a" text-anchor="middle">Corridor - Floor 1</text>
  <!-- Rooms Row 1 -->
  <rect x="20" y="320" width="120" height="80" fill="#eff6ff" stroke="#94a3b8" stroke-width="1" rx="3"/>
  <text x="80" y="365" font-family="sans-serif" font-size="11" fill="#71717a" text-anchor="middle">Room 101</text>
  <rect x="150" y="320" width="120" height="80" fill="#eff6ff" stroke="#94a3b8" stroke-width="1" rx="3"/>
  <text x="210" y="365" font-family="sans-serif" font-size="11" fill="#71717a" text-anchor="middle">Room 102</text>
  <rect x="280" y="320" width="120" height="80" fill="#eff6ff" stroke="#94a3b8" stroke-width="1" rx="3"/>
  <text x="340" y="365" font-family="sans-serif" font-size="11" fill="#71717a" text-anchor="middle">Room 103</text>
  <rect x="410" y="320" width="120" height="80" fill="#eff6ff" stroke="#94a3b8" stroke-width="1" rx="3"/>
  <text x="470" y="365" font-family="sans-serif" font-size="11" fill="#71717a" text-anchor="middle">Room 104</text>
  <rect x="540" y="320" width="120" height="80" fill="#eff6ff" stroke="#94a3b8" stroke-width="1" rx="3"/>
  <text x="600" y="365" font-family="sans-serif" font-size="11" fill="#71717a" text-anchor="middle">Room 105</text>
  <rect x="670" y="320" width="110" height="80" fill="#eff6ff" stroke="#94a3b8" stroke-width="1" rx="3"/>
  <text x="725" y="365" font-family="sans-serif" font-size="11" fill="#71717a" text-anchor="middle">Room 106</text>
  <!-- Conference -->
  <rect x="20" y="420" width="250" height="170" fill="#fdf4ff" stroke="#94a3b8" stroke-width="1.5" rx="4"/>
  <text x="145" y="515" font-family="sans-serif" font-size="14" fill="#71717a" text-anchor="middle">Conference A</text>
  <!-- Gym -->
  <rect x="290" y="420" width="200" height="170" fill="#fff7ed" stroke="#94a3b8" stroke-width="1.5" rx="4"/>
  <text x="390" y="515" font-family="sans-serif" font-size="14" fill="#71717a" text-anchor="middle">Gym</text>
  <!-- Pool -->
  <rect x="510" y="420" width="270" height="170" fill="#ecfeff" stroke="#94a3b8" stroke-width="1.5" rx="4"/>
  <text x="645" y="515" font-family="sans-serif" font-size="14" fill="#71717a" text-anchor="middle">Pool Area</text>
</svg>`;

// ─── Demo AP Data ────────────────────────────────────────────────
const DEMO_APS = [
  { id: 'demo-1', apName: 'AP-Lobby-01', apMac: '00:1A:2B:3C:4D:01', apX: 25, apY: 12, signalStrength: -42, clientCount: 23, band: '5', channel: 36, frequency: 5180, noiseFloor: -92, snr: 50 },
  { id: 'demo-2', apName: 'AP-Lobby-02', apMac: '00:1A:2B:3C:4D:02', apX: 60, apY: 12, signalStrength: -38, clientCount: 18, band: '5', channel: 40, frequency: 5200, noiseFloor: -90, snr: 52 },
  { id: 'demo-3', apName: 'AP-Corridor-F1', apMac: '00:1A:2B:3C:4D:03', apX: 35, apY: 43, signalStrength: -55, clientCount: 8, band: '2.4', channel: 6, frequency: 2437, noiseFloor: -88, snr: 33 },
  { id: 'demo-4', apName: 'AP-Corridor-F2', apMac: '00:1A:2B:3C:4D:04', apX: 78, apY: 43, signalStrength: -58, clientCount: 5, band: '2.4', channel: 1, frequency: 2412, noiseFloor: -89, snr: 31 },
  { id: 'demo-5', apName: 'AP-Pool-Area', apMac: '00:1A:2B:3C:4D:05', apX: 74, apY: 82, signalStrength: -62, clientCount: 12, band: '5', channel: 149, frequency: 5745, noiseFloor: -91, snr: 29 },
  { id: 'demo-6', apName: 'AP-Restaurant', apMac: '00:1A:2B:3C:4D:06', apX: 68, apY: 10, signalStrength: -70, clientCount: 3, band: '2.4', channel: 11, frequency: 2462, noiseFloor: -85, snr: 15 },
  { id: 'demo-7', apName: 'AP-Conference-A', apMac: '00:1A:2B:3C:4D:07', apX: 15, apY: 75, signalStrength: -48, clientCount: 15, band: '5', channel: 44, frequency: 5220, noiseFloor: -91, snr: 43 },
  { id: 'demo-8', apName: 'AP-Gym', apMac: '00:1A:2B:3C:4D:08', apX: 46, apY: 75, signalStrength: -78, clientCount: 1, band: '2.4', channel: 3, frequency: 2422, noiseFloor: -82, snr: 4 },
];

// ─── Types ───────────────────────────────────────────────────────
interface APReading {
  id: string;
  apName: string;
  apMac: string | null;
  apX: number;
  apY: number;
  signalStrength: number;
  clientCount: number;
  band: string;
  channel: number | null;
  frequency: number | null;
  noiseFloor: number | null;
  snr: number | null;
  quality?: string;
  coverageRadius?: number;
  floorPlanId?: string | null;
}

interface FloorPlan {
  id: string;
  floorName: string;
  floorNumber: number;
  width: number;
  height: number;
  svgData?: string;
  _count?: { readings: number };
}

interface CoverageStats {
  totalAps: number;
  excellent: number;
  good: number;
  fair: number;
  weak: number;
  avgSignal: number;
  totalClients: number;
  coveragePercent: number;
}

// ─── Component ───────────────────────────────────────────────────
export default function WifiHeatmap() {
  // State
  const [properties, setProperties] = useState<{ id: string; name: string }[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [floorPlans, setFloorPlans] = useState<FloorPlan[]>([]);
  const [selectedFloorPlanId, setSelectedFloorPlanId] = useState('');
  const [readings, setReadings] = useState<APReading[]>([]);
  const [isDemo, setIsDemo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedBand, setSelectedBand] = useState('all');
  const [showCoverage, setShowCoverage] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [coverageOpacity, setCoverageOpacity] = useState([0.35]);
  const [activeTab, setActiveTab] = useState('heatmap');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [svgUploadText, setSvgUploadText] = useState('');
  const [floorNameInput, setFloorNameInput] = useState('Floor 1');
  const [floorNumberInput, setFloorNumberInput] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [selectedAp, setSelectedAp] = useState<APReading | null>(null);
  const [svgData, setSvgData] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch properties
  useEffect(() => {
    async function fetchProperties() {
      try {
        const res = await fetch('/api/wifi/heatmap/floor-plans?propertyId=dummy');
        if (res.ok) {
          // Get properties list from existing API
          const propRes = await fetch('/api/wifi/gateway-radius');
          if (propRes.ok) {
            const propData = await propRes.json();
            // Extract unique properties from gateways
            const propMap = new Map<string, string>();
            if (propData.data) {
              propData.data.forEach((g: { propertyId: string; propertyName?: string; property?: { name: string } }) => {
                if (g.propertyId && !propMap.has(g.propertyId)) {
                  propMap.set(g.propertyId, g.propertyName || g.property?.name || g.propertyId);
                }
              });
            }
            const propList = Array.from(propMap.entries()).map(([id, name]) => ({ id, name }));
            setProperties(propList);
            if (propList.length > 0) {
              setSelectedPropertyId(propList[0].id);
            }
          }
        }
      } catch {
        // If no properties, show demo mode
      }
    }
    fetchProperties();
  }, []);

  // Fetch floor plans when property changes
  useEffect(() => {
    if (!selectedPropertyId) return;
    async function fetchFloorPlans() {
      try {
        const res = await fetch(`/api/wifi/heatmap/floor-plans?propertyId=${selectedPropertyId}`);
        if (res.ok) {
          const data = await res.json();
          setFloorPlans(data.data || []);
          if (data.data && data.data.length > 0) {
            setSelectedFloorPlanId(data.data[0].id);
          } else {
            setSelectedFloorPlanId('');
          }
        }
      } catch {
        setFloorPlans([]);
        setSelectedFloorPlanId('');
      }
    }
    fetchFloorPlans();
  }, [selectedPropertyId]);

  // Fetch readings
  const fetchReadings = useCallback(async () => {
    if (!selectedPropertyId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ propertyId: selectedPropertyId });
      if (selectedBand !== 'all') params.set('band', selectedBand);
      if (selectedFloorPlanId) params.set('floorPlanId', selectedFloorPlanId);
      const res = await fetch(`/api/wifi/heatmap?${params}`);
      if (res.ok) {
        const data = await res.json();
        const enriched = (data.data || []).map((r: APReading) => ({
          ...r,
          quality: classifySignal(r.signalStrength),
          coverageRadius: coverageRadius(r.signalStrength),
        }));
        setReadings(enriched);
        setIsDemo(data.isDemo || false);
      }
    } catch {
      // Fall back to demo data
      const demoEnriched = DEMO_APS.map(r => ({
        ...r,
        quality: classifySignal(r.signalStrength),
        coverageRadius: coverageRadius(r.signalStrength),
      }));
      setReadings(demoEnriched);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }, [selectedPropertyId, selectedBand, selectedFloorPlanId]);

  useEffect(() => {
    fetchReadings();
  }, [fetchReadings]);

  // Get SVG data
  const currentSvgData = (() => {
    if (selectedFloorPlanId && floorPlans.length > 0) {
      const fp = floorPlans.find(f => f.id === selectedFloorPlanId);
      if (fp && (fp as FloorPlan & { svgData?: string }).svgData) {
        return (fp as FloorPlan & { svgData?: string }).svgData!;
      }
    }
    return svgData || DEMO_SVG;
  })();

  // Compute stats
  const stats: CoverageStats = (() => {
    const filtered = readings.filter(r =>
      selectedBand === 'all' || r.band === selectedBand
    );
    const excellent = filtered.filter(r => r.quality === 'excellent').length;
    const good = filtered.filter(r => r.quality === 'good').length;
    const fair = filtered.filter(r => r.quality === 'fair').length;
    const weak = filtered.filter(r => r.quality === 'weak').length;
    const total = filtered.length;
    const avgSignal = total > 0
      ? Math.round(filtered.reduce((sum, r) => sum + r.signalStrength, 0) / total)
      : 0;
    const totalClients = filtered.reduce((sum, r) => sum + r.clientCount, 0);
    const covered = excellent + good + fair;
    const coveragePercent = total > 0 ? Math.round((covered / total) * 100) : 0;
    return { totalAps: total, excellent, good, fair, weak, avgSignal, totalClients, coveragePercent };
  })();

  // Handle SVG file upload
  const handleSvgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setSvgUploadText(text);
    };
    reader.readAsText(file);
  };

  // Handle upload floor plan
  const handleUploadFloorPlan = async () => {
    if (!svgUploadText || !selectedPropertyId) return;
    setUploading(true);
    try {
      const res = await fetch('/api/wifi/heatmap/floor-plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          propertyId: selectedPropertyId,
          floorName: floorNameInput,
          floorNumber: floorNumberInput,
          svgData: svgUploadText,
        }),
      });
      if (res.ok) {
        setUploadDialogOpen(false);
        setSvgUploadText('');
        // Refresh floor plans
        const fpRes = await fetch(`/api/wifi/heatmap/floor-plans?propertyId=${selectedPropertyId}`);
        if (fpRes.ok) {
          const fpData = await fpRes.json();
          setFloorPlans(fpData.data || []);
          if (fpData.data && fpData.data.length > 0) {
            setSelectedFloorPlanId(fpData.data[0].id);
          }
        }
      }
    } catch {
      // silently fail
    } finally {
      setUploading(false);
    }
  };

  // Handle delete floor plan
  const handleDeleteFloorPlan = async (fpId: string) => {
    if (!fpId || !selectedPropertyId) return;
    try {
      const res = await fetch(`/api/wifi/heatmap/floor-plans/${fpId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        const fpRes = await fetch(`/api/wifi/heatmap/floor-plans?propertyId=${selectedPropertyId}`);
        if (fpRes.ok) {
          const fpData = await fpRes.json();
          setFloorPlans(fpData.data || []);
          setSelectedFloorPlanId('');
        }
      }
    } catch {
      // silently fail
    }
  };

  // ─── Render Coverage Overlay ─────────────────────────────────
  const renderCoverageOverlay = () => {
    const filtered = readings.filter(r =>
      selectedBand === 'all' || r.band === selectedBand
    );
    return (
      <g>
        {/* Radial gradient definitions */}
        <defs>
          {filtered.map(ap => {
            const color = getSignalColor(ap.signalStrength);
            const qual = classifySignal(ap.signalStrength);
            const r = ap.coverageRadius || coverageRadius(ap.signalStrength);
            return (
              <radialGradient
                key={`grad-${ap.id}`}
                id={`grad-${ap.id}`}
                cx="50%"
                cy="50%"
                r="50%"
              >
                <stop offset="0%" stopColor={color} stopOpacity={coverageOpacity[0]} />
                <stop offset="40%" stopColor={color} stopOpacity={coverageOpacity[0] * 0.7} />
                <stop offset="70%" stopColor={color} stopOpacity={coverageOpacity[0] * 0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </radialGradient>
            );
          })}
        </defs>

        {/* Coverage circles */}
        {showCoverage && filtered.map(ap => {
          const r = ap.coverageRadius || coverageRadius(ap.signalStrength);
          return (
            <circle
              key={`cov-${ap.id}`}
              cx={`${ap.apX}%`}
              cy={`${ap.apY}%`}
              r={`${r}%`}
              fill={`url(#grad-${ap.id})`}
              className="transition-all duration-300 cursor-pointer"
              onClick={() => setSelectedAp(ap)}
              style={{ transform: 'scale(5.6)', transformOrigin: 'center' }}
            />
          );
        })}

        {/* AP markers */}
        {filtered.map(ap => {
          const color = getSignalColor(ap.signalStrength);
          return (
            <g
              key={`marker-${ap.id}`}
              className="cursor-pointer"
              onClick={() => setSelectedAp(ap)}
            >
              {/* Outer ring */}
              <circle
                cx={`${ap.apX}%`}
                cy={`${ap.apY}%`}
                r="10"
                fill="white"
                stroke={color}
                strokeWidth="2.5"
                className="drop-shadow-md"
              />
              {/* Inner dot */}
              <circle
                cx={`${ap.apX}%`}
                cy={`${ap.apY}%`}
                r="4"
                fill={color}
              />
              {/* WiFi icon indicator */}
              <text
                x={`${ap.apX}%`}
                y={`${ap.apY + 2.5}%`}
                textAnchor="middle"
                fontSize="7"
                fill={color}
                fontWeight="bold"
              >
                {ap.clientCount}
              </text>

              {/* Labels */}
              {showLabels && (
                <g>
                  <rect
                    x={`${ap.apX}%`}
                    y={`${ap.apY + 3}%`}
                    width="auto"
                    height="16"
                    rx="3"
                    fill="rgba(0,0,0,0.75)"
                    transform={`translate(${ap.apName.length * -2.8}, 0)`}
                  />
                  <text
                    x={`${ap.apX}%`}
                    y={`${ap.apY + 4.8}%`}
                    textAnchor="middle"
                    fontSize="9"
                    fill="white"
                    fontWeight="500"
                  >
                    {ap.apName}
                  </text>
                  <text
                    x={`${ap.apX}%`}
                    y={`${ap.apY + 7}%`}
                    textAnchor="middle"
                    fontSize="8"
                    fill="rgba(255,255,255,0.8)"
                  >
                    {ap.signalStrength} dBm · {ap.band} GHz
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </g>
    );
  };

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6 text-primary" />
            WiFi Heatmap & Coverage
          </h2>
          <p className="text-muted-foreground mt-1">
            Visualize wireless signal coverage across your property floors
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isDemo && (
            <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
              Demo Mode
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={fetchReadings} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </Button>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Upload className="h-4 w-4 mr-1" />
                Upload Floor Plan
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Upload SVG Floor Plan</DialogTitle>
                <DialogDescription>
                  Upload an SVG file representing your floor plan. AP positions will be overlaid on top.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Floor Name</Label>
                    <input
                      type="text"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={floorNameInput}
                      onChange={e => setFloorNameInput(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Floor Number</Label>
                    <input
                      type="number"
                      min="1"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={floorNumberInput}
                      onChange={e => setFloorNumberInput(parseInt(e.target.value) || 1)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SVG File</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg"
                    onChange={handleSvgUpload}
                    className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                  />
                  {svgUploadText && (
                    <p className="text-xs text-green-600 flex items-center gap-1">
                      <Wifi className="h-3 w-3" />
                      SVG loaded ({Math.round(svgUploadText.length / 1024)} KB)
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUploadFloorPlan} disabled={!svgUploadText || uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  Upload
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Property & Floor Selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        {properties.length > 0 && (
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue placeholder="Select Property" />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {floorPlans.length > 0 && (
          <Select value={selectedFloorPlanId} onValueChange={setSelectedFloorPlanId}>
            <SelectTrigger className="w-full sm:w-48">
              <SelectValue placeholder="Select Floor" />
            </SelectTrigger>
            <SelectContent>
              {floorPlans.map(fp => (
                <SelectItem key={fp.id} value={fp.id}>
                  {fp.floorName} (F{fp.floorNumber})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Floor Plan Viewer */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Floor Plan View</CardTitle>
                  <CardDescription>
                    {readings.length} access point{readings.length !== 1 ? 's' : ''} detected
                  </CardDescription>
                </div>
                <Tabs value={activeTab} onValueChange={setActiveTab}>
                  <TabsList className="h-8">
                    <TabsTrigger value="heatmap" className="text-xs px-2">
                      <Layers className="h-3 w-3 mr-1" />
                      Heatmap
                    </TabsTrigger>
                    <TabsTrigger value="aplist" className="text-xs px-2">
                      <Wifi className="h-3 w-3 mr-1" />
                      AP List
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardHeader>
            <CardContent>
              {activeTab === 'heatmap' ? (
                <div className="relative rounded-lg border bg-white overflow-hidden">
                  <svg
                    viewBox="0 0 800 600"
                    className="w-full h-auto"
                    style={{ minHeight: '300px' }}
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    {/* Floor plan background */}
                    <g dangerouslySetInnerHTML={{ __html: currentSvgData }} />

                    {/* Coverage overlay */}
                    {!loading && renderCoverageOverlay()}

                    {/* Loading indicator */}
                    {loading && (
                      <rect x="0" y="0" width="800" height="600" fill="rgba(255,255,255,0.8)" />
                    )}
                  </svg>
                  {loading && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                  )}
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium">AP Name</th>
                        <th className="text-left p-3 font-medium">Signal</th>
                        <th className="text-left p-3 font-medium">Band</th>
                        <th className="text-left p-3 font-medium">Clients</th>
                        <th className="text-left p-3 font-medium">SNR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {readings
                        .filter(r => selectedBand === 'all' || r.band === selectedBand)
                        .map(ap => {
                          const qual = classifySignal(ap.signalStrength);
                          return (
                            <tr
                              key={ap.id}
                              className="border-t cursor-pointer hover:bg-muted/50"
                              onClick={() => setSelectedAp(ap)}
                            >
                              <td className="p-3 font-medium">{ap.apName}</td>
                              <td className="p-3">
                                <Badge
                                  variant="outline"
                                  style={{
                                    borderColor: SIGNAL_COLORS[qual as keyof typeof SIGNAL_COLORS],
                                    color: SIGNAL_COLORS[qual as keyof typeof SIGNAL_COLORS],
                                  }}
                                >
                                  {ap.signalStrength} dBm
                                </Badge>
                              </td>
                              <td className="p-3">{ap.band} GHz</td>
                              <td className="p-3">{ap.clientCount}</td>
                              <td className="p-3">{ap.snr ?? '-'}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Controls */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Controls
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Band selector */}
              <div className="space-y-2">
                <Label className="text-sm">Band</Label>
                <Select value={selectedBand} onValueChange={setSelectedBand}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Bands</SelectItem>
                    <SelectItem value="2.4">2.4 GHz</SelectItem>
                    <SelectItem value="5">5 GHz</SelectItem>
                    <SelectItem value="6">6 GHz</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Show/Hide coverage */}
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  {showCoverage ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  Coverage Zones
                </Label>
                <Switch checked={showCoverage} onCheckedChange={setShowCoverage} />
              </div>

              {/* Show/Hide labels */}
              <div className="flex items-center justify-between">
                <Label className="text-sm flex items-center gap-2">
                  {showLabels ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  AP Labels
                </Label>
                <Switch checked={showLabels} onCheckedChange={setShowLabels} />
              </div>

              {/* Opacity slider */}
              <div className="space-y-2">
                <Label className="text-sm">Coverage Opacity: {Math.round(coverageOpacity[0] * 100)}%</Label>
                <Slider
                  value={coverageOpacity}
                  onValueChange={setCoverageOpacity}
                  min={0.05}
                  max={0.7}
                  step={0.05}
                />
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Coverage Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-2 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{stats.totalAps}</p>
                  <p className="text-xs text-muted-foreground">Total APs</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted">
                  <p className="text-2xl font-bold">{stats.coveragePercent}%</p>
                  <p className="text-xs text-muted-foreground">Coverage</p>
                </div>
              </div>
              <div className="text-center p-2 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{stats.avgSignal} dBm</p>
                <p className="text-xs text-muted-foreground">Avg Signal</p>
              </div>

              {/* Signal Distribution */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Signal Distribution</p>
                <div className="space-y-1.5">
                  {(['excellent', 'good', 'fair', 'weak'] as const).map(qual => {
                    const count = stats[qual];
                    const pct = stats.totalAps > 0 ? Math.round((count / stats.totalAps) * 100) : 0;
                    return (
                      <div key={qual} className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: SIGNAL_COLORS[qual] }}
                        />
                        <span className="text-xs capitalize flex-1">{qual}</span>
                        <span className="text-xs font-medium">{count}</span>
                        <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: SIGNAL_COLORS[qual],
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="text-center p-2 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{stats.totalClients}</p>
                <p className="text-xs text-muted-foreground">Total Clients</p>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Info className="h-4 w-4" />
                Signal Legend
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {Object.entries(SIGNAL_LABELS).map(([qual, label]) => (
                <div key={qual} className="flex items-center gap-2">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ backgroundColor: SIGNAL_COLORS[qual as keyof typeof SIGNAL_COLORS] }}
                  />
                  <span className="text-xs">{label}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Floor Plans List */}
          {floorPlans.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Floor Plans
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {floorPlans.map(fp => (
                  <div
                    key={fp.id}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${selectedFloorPlanId === fp.id ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
                    onClick={() => setSelectedFloorPlanId(fp.id)}
                  >
                    <div>
                      <p className="text-sm font-medium">{fp.floorName}</p>
                      <p className="text-xs text-muted-foreground">
                        F{fp.floorNumber} · {fp._count?.readings || 0} readings
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFloorPlan(fp.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* AP Detail Dialog */}
      <Dialog open={!!selectedAp} onOpenChange={() => setSelectedAp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wifi className="h-5 w-5" />
              {selectedAp?.apName}
            </DialogTitle>
            <DialogDescription>
              Access point signal details
            </DialogDescription>
          </DialogHeader>
          {selectedAp && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">Signal Strength</p>
                  <p className="text-xl font-bold" style={{ color: getSignalColor(selectedAp.signalStrength) }}>
                    {selectedAp.signalStrength} dBm
                  </p>
                  <Badge
                    variant="outline"
                    className="mt-1"
                    style={{
                      borderColor: getSignalColor(selectedAp.signalStrength),
                      color: getSignalColor(selectedAp.signalStrength),
                    }}
                  >
                    {classifySignal(selectedAp.signalStrength)}
                  </Badge>
                </div>
                <div className="p-3 rounded-lg bg-muted text-center">
                  <p className="text-xs text-muted-foreground mb-1">Connected Clients</p>
                  <p className="text-xl font-bold">{selectedAp.clientCount}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">MAC Address</span>
                  <span className="font-mono">{selectedAp.apMac || 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Band</span>
                  <span>{selectedAp.band} GHz</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Channel</span>
                  <span>{selectedAp.channel ?? 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Frequency</span>
                  <span>{selectedAp.frequency ? `${selectedAp.frequency} MHz` : 'N/A'}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Noise Floor</span>
                  <span>{selectedAp.noiseFloor ?? 'N/A'} dBm</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-muted-foreground">SNR</span>
                  <span className="font-medium">{selectedAp.snr ?? 'N/A'} dB</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground">Position X</span>
                  <p className="font-medium">{selectedAp.apX.toFixed(1)}%</p>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground">Position Y</span>
                  <p className="font-medium">{selectedAp.apY.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
