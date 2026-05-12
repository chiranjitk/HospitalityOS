'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download, Key, Building2, User, DoorOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface DigitalKeyQRProps {
  keyId: string;
  keySecret?: string;
  guestName?: string;
  roomNumber?: string;
}

interface KeyData {
  keyId: string;
  keySecret: string;
  maskedSecret: string;
  guestName: string;
  roomNumber: string;
  roomType: string;
  floor: number;
  hotelName: string;
  confirmationCode: string;
  validFrom: string;
  validTo: string;
}

// Simple CSS-based barcode generation
function CSSBarcode({ data }: { data: string }) {
  // Generate pseudo-random bar pattern from data string
  const bars: { width: number; color: string }[] = [];
  for (let i = 0; i < data.length; i++) {
    const charCode = data.charCodeAt(i);
    bars.push(
      { width: (charCode % 3) + 1, color: '#1a1a1a' },
      { width: (charCode % 2) + 1, color: 'transparent' }
    );
  }
  // Add guard bars
  bars.unshift({ width: 2, color: '#1a1a1a' }, { width: 1, color: 'transparent' });
  bars.push({ width: 2, color: '#1a1a1a' }, { width: 1, color: 'transparent' });

  return (
    <div className="flex items-end justify-center h-16 gap-0">
      {bars.map((bar, i) => (
        <div
          key={i}
          style={{
            width: `${bar.width * 2}px`,
            height: '100%',
            backgroundColor: bar.color,
          }}
        />
      ))}
    </div>
  );
}

// Simple QR code data URI - encoded as a grid pattern
function generateQRPattern(data: string): string[][] {
  const size = 21; // Simple 21x21 grid (version 1 QR)
  const grid: string[][] = [];

  // Initialize grid
  for (let i = 0; i < size; i++) {
    grid[i] = [];
    for (let j = 0; j < size; j++) {
      grid[i][j] = 'white';
    }
  }

  // Draw finder patterns (3 corners)
  const drawFinder = (row: number, col: number) => {
    for (let i = 0; i < 7; i++) {
      for (let j = 0; j < 7; j++) {
        if (i === 0 || i === 6 || j === 0 || j === 6 || (i >= 2 && i <= 4 && j >= 2 && j <= 4)) {
          grid[row + i][col + j] = 'black';
        }
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  // Encode data as pattern in remaining cells
  let dataIndex = 0;
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      // Skip finder patterns
      if ((i < 8 && j < 8) || (i < 8 && j >= size - 8) || (i >= size - 8 && j < 8)) continue;
      if (i === size - 8 && j === 8) continue; // Timing pattern area

      const charCode = data.charCodeAt(dataIndex % data.length);
      if (charCode % 2 === 0) {
        grid[i][j] = 'black';
      }
      dataIndex++;
    }
  }

  return grid;
}

export default function DigitalKeyQR({ keyId, keySecret, guestName, roomNumber }: DigitalKeyQRProps) {
  const { toast } = useToast();
  const [keyData, setKeyData] = useState<KeyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (guestName && roomNumber && keySecret) {
      // Use provided props
      setKeyData({
        keyId,
        keySecret,
        maskedSecret: keySecret.substring(0, 4) + '****' + keySecret.substring(keySecret.length - 4),
        guestName,
        roomNumber,
        roomType: '',
        floor: 0,
        hotelName: 'StaySuite Hotel',
        confirmationCode: keyId,
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      });
      setIsLoading(false);
    } else {
      // Fetch from API
      fetchKeyData();
    }
  }, [keyId, guestName, roomNumber, keySecret]);

  const fetchKeyData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/digital-keys/${keyId}/qr`);
      const result = await response.json();

      if (result.success) {
        setKeyData(result.data);
      } else {
        toast({
          title: 'Error',
          description: result.error?.message || 'Failed to load key data',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching key data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load key data',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    const cardEl = document.getElementById('digital-key-card');
    if (!cardEl) return;

    try {
      // Create a canvas from the card element
      const canvas = document.createElement('canvas');
      const scale = 2;
      canvas.width = cardEl.offsetWidth * scale;
      canvas.height = cardEl.offsetHeight * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(scale, scale);

      // Use a simple approach - create an SVG export
      const svgData = new XMLSerializer().serializeToString(cardEl);
      const blob = new Blob([svgData], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `digital-key-${keyData?.roomNumber || 'key'}.svg`;
      a.click();
      URL.revokeObjectURL(url);

      toast({ title: 'Success', description: 'Key card downloaded' });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to download key card',
        variant: 'destructive',
      });
    }
  };

  const qrData = keyData ? `KEY:${keyData.keyId}:${keyData.keySecret.substring(0, 8)}` : '';
  const qrGrid = generateQRPattern(qrData);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!keyData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Key className="h-12 w-12 mx-auto mb-4" />
        <p>Unable to load key data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="h-4 w-4 mr-2" />
          Download Key Card
        </Button>
      </div>

      {/* Digital Key Card */}
      <div
        id="digital-key-card"
        className="max-w-sm mx-auto bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-2xl p-6 text-white shadow-2xl"
      >
        {/* Hotel Branding */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-primary/20">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h3 className="font-bold text-lg">{keyData.hotelName || 'StaySuite Hotel'}</h3>
            <p className="text-xs text-gray-400">Digital Room Key</p>
          </div>
        </div>

        {/* Guest Info */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-300">Guest</span>
            <span className="ml-auto font-semibold">{keyData.guestName}</span>
          </div>
          <div className="flex items-center gap-2">
            <DoorOpen className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-300">Room</span>
            <span className="ml-auto font-semibold text-xl">{keyData.roomNumber}</span>
          </div>
          {keyData.roomType && (
            <div className="text-right text-xs text-gray-400">{keyData.roomType}</div>
          )}
        </div>

        {/* QR Code */}
        <div className="bg-white rounded-xl p-4 mb-4">
          <div className="grid gap-[1px] mx-auto w-fit" style={{ gridTemplateColumns: `repeat(21, 1fr)` }}>
            {qrGrid.map((row, i) =>
              row.map((cell, j) => (
                <div
                  key={`${i}-${j}`}
                  className="w-[6px] h-[6px] sm:w-[8px] sm:h-[8px]"
                  style={{ backgroundColor: cell === 'black' ? '#1a1a1a' : '#ffffff' }}
                />
              ))
            )}
          </div>
        </div>

        {/* Key Code */}
        <div className="bg-white/5 rounded-lg p-3 mb-4">
          <div className="text-xs text-gray-400 mb-1">Key Code</div>
          <div className="font-mono text-lg tracking-widest text-center">
            {keyData.maskedSecret}
          </div>
        </div>

        {/* Validity */}
        <div className="flex justify-between text-xs text-gray-400 border-t border-white/10 pt-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider">Valid From</div>
            <div className="font-medium text-gray-300">
              {format(new Date(keyData.validFrom), 'MMM d, yyyy')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider">Valid To</div>
            <div className="font-medium text-gray-300">
              {format(new Date(keyData.validTo), 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        {/* Barcode */}
        <div className="mt-4 pt-3 border-t border-white/10">
          <CSSBarcode data={qrData} />
          <div className="text-center text-[10px] text-gray-500 mt-1 font-mono tracking-wider">
            {qrData}
          </div>
        </div>
      </div>
    </div>
  );
}
