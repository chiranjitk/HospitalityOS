'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Eraser, PenLine, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignaturePadProps {
  value: string | null;
  onChange: (signatureData: string | null) => void;
  label?: string;
  required?: boolean;
  disabled?: boolean;
  width?: number;
  height?: number;
}

export function SignaturePad({
  value,
  onChange,
  label = 'Guest Signature',
  required = false,
  disabled = false,
  width = 400,
  height = 200,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width, height });

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  // Responsive canvas sizing
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const containerWidth = entry.contentRect.width;
        if (containerWidth > 0) {
          const newWidth = Math.floor(containerWidth);
          const newHeight = Math.floor(newWidth * (height / width));
          setCanvasSize({ width: newWidth, height: newHeight });
        }
      }
    });

    resizeObserver.observe(container);
    return () => resizeObserver.disconnect();
  }, [width, height]);

  // Initialize canvas context
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasSize.width * dpr;
    canvas.height = canvasSize.height * dpr;
    canvas.style.width = `${canvasSize.width}px`;
    canvas.style.height = `${canvasSize.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#1a1a1a';

    // Fill white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    // Draw signature line at 75% height
    ctx.beginPath();
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(24, canvasSize.height * 0.78);
    ctx.lineTo(canvasSize.width - 24, canvasSize.height * 0.78);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw "Sign" label
    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('✍ Sign above this line', 24, canvasSize.height * 0.92);

    ctxRef.current = ctx;

    // Restore existing signature if provided
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvasSize.width, canvasSize.height);
        setHasSignature(true);
      };
      img.src = value;
    }
  }, [canvasSize, value]);

  const getPos = useCallback(
    (e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number;
      let clientY: number;

      if ('touches' in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const startDrawing = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (disabled) return;
      e.preventDefault();
      const pos = getPos(e);
      if (!pos) return;

      setIsDrawing(true);
      lastPosRef.current = pos;

      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.beginPath();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Draw a dot for click without drag
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.25, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();

      setHasSignature(true);
    },
    [disabled, getPos]
  );

  const draw = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing || disabled) return;
      e.preventDefault();

      const pos = getPos(e);
      if (!pos || !lastPosRef.current) return;

      const ctx = ctxRef.current;
      if (!ctx) return;

      ctx.beginPath();
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      lastPosRef.current = pos;
    },
    [isDrawing, disabled, getPos]
  );

  const stopDrawing = useCallback(() => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPosRef.current = null;

    // Capture the canvas data
    const canvas = canvasRef.current;
    if (canvas && hasSignature) {
      const dataUrl = canvas.toDataURL('image/png');
      onChange(dataUrl);
    }
  }, [isDrawing, hasSignature, onChange]);

  const clearSignature = useCallback(() => {
    if (disabled) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);

    // Redraw background and line
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

    ctx.beginPath();
    ctx.strokeStyle = '#d1d5db';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.moveTo(24, canvasSize.height * 0.78);
    ctx.lineTo(canvasSize.width - 24, canvasSize.height * 0.78);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.fillText('✍ Sign above this line', 24, canvasSize.height * 0.92);

    setHasSignature(false);
    onChange(null);
  }, [disabled, canvasSize, onChange]);

  return (
    <div className="space-y-2">
      {label && (
        <Label className="text-sm font-medium flex items-center gap-2">
          <PenLine className="h-4 w-4" />
          {label}
          {required && <span className="text-red-500">*</span>}
        </Label>
      )}

      <Card
        className={cn(
          'overflow-hidden transition-all duration-200',
          !hasSignature && required && 'ring-2 ring-amber-500/50',
          disabled && 'opacity-60'
        )}
      >
        <CardContent className="p-0">
          <div ref={containerRef} className="w-full">
            <canvas
              ref={canvasRef}
              className="w-full touch-none block cursor-crosshair"
              style={{ height: canvasSize.height }}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              aria-label="Signature drawing area"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs">
          {hasSignature ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-600 dark:text-emerald-400">Signature captured</span>
            </>
          ) : required ? (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-amber-600 dark:text-amber-400">Signature required</span>
            </>
          ) : (
            <span className="text-muted-foreground">
              Use mouse or touch to sign
            </span>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={clearSignature}
          disabled={disabled || !hasSignature}
          className="h-8 text-xs"
        >
          <Eraser className="h-3.5 w-3.5 mr-1.5" />
          Clear
        </Button>
      </div>
    </div>
  );
}
