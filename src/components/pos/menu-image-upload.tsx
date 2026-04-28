'use client';

import { useTranslations } from 'next-intl';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Upload, X, Loader2, ImageIcon, Replace, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

interface MenuImageUploadProps {
  currentImageUrl?: string;
  onImageUploaded: (url: string) => void;
  onImageRemoved: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_WIDTH = 800;
const TARGET_QUALITY = 0.7; // ~200KB target

export default function MenuImageUpload({
  currentImageUrl,
  onImageUploaded,
  onImageRemoved,
}: MenuImageUploadProps) {
  const t = useTranslations('pos');
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl || null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Client-side image resize using canvas
  const resizeImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let w = img.width;
          let h = img.height;

          // Only resize if image is wider than MAX_WIDTH
          if (w > MAX_WIDTH) {
            h = Math.round((h * MAX_WIDTH) / w);
            w = MAX_WIDTH;
          }

          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          ctx.drawImage(img, 0, 0, w, h);

          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                reject(new Error('Canvas toBlob failed'));
              }
            },
            'image/jpeg',
            TARGET_QUALITY,
          );
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        reader.readAsDataURL(file);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
    });
  };

  const validateFile = (file: File): string | null => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return 'Only JPG, PNG, and WebP images are allowed';
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 5MB`;
    }
    return null;
  };

  const uploadFile = async (file: File) => {
    setError(null);

    // Validate
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      toast.error(validationError);
      return;
    }

    setUploading(true);
    setUploadProgress(10);

    try {
      let fileToUpload: Blob = file;

      // Resize if image is wider than 800px
      if (file.type.startsWith('image/')) {
        setUploadProgress(20);
        try {
          fileToUpload = await resizeImage(file);
          setUploadProgress(50);
        } catch {
          // If resize fails, use original file
          console.warn('Image resize failed, using original file');
          setUploadProgress(50);
        }
      }

      // Create FormData
      const formData = new FormData();
      formData.append('file', fileToUpload, file.name.replace(/\.[^.]+$/, '.jpg'));

      setUploadProgress(60);

      // Upload with progress simulation
      const res = await fetch('/api/menu-items/upload', {
        method: 'POST',
        body: formData,
      });

      setUploadProgress(90);

      const data = await res.json();

      if (data.success) {
        setPreview(data.data.url);
        setUploadProgress(100);
        onImageUploaded(data.data.url);
        toast.success('Image uploaded successfully');
      } else {
        setError(data.error?.message || 'Upload failed');
        toast.error(data.error?.message || 'Failed to upload image');
      }
    } catch {
      setError('Network error. Please try again.');
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      uploadFile(file);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadFile(file);
    }
    // Reset input so the same file can be selected again
    if (fileRef.current) {
      fileRef.current.value = '';
    }
  };

  const handleRemove = () => {
    setPreview(null);
    setError(null);
    onImageRemoved();
    toast.success('Image removed');
  };

  const handleClickZone = () => {
    if (preview && !uploading) return; // Don't open file picker if preview exists
    fileRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <Label>Menu Item Image</Label>

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Drop zone / Preview */}
      <div
        className={`relative border-2 border-dashed rounded-lg transition-all cursor-pointer overflow-hidden
          ${dragOver
            ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 scale-[1.01]'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30'}
          ${preview ? 'p-0' : 'p-6'}
        `}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClickZone}
      >
        {preview ? (
          /* Image Preview */
          <div className="relative group">
            <img
              src={preview}
              alt="Menu item preview"
              className="w-full h-52 object-cover rounded-lg"
            />
            {/* Hover overlay with actions */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                className="h-9 gap-1"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
              >
                <Replace className="h-4 w-4" />
                Replace
              </Button>
              <Button
                size="sm"
                variant="secondary"
                className="h-9 gap-1 bg-red-600 hover:bg-red-700 text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Remove
              </Button>
            </div>
            {/* Upload progress overlay */}
            {uploading && (
              <div className="absolute inset-0 bg-black/60 rounded-lg flex flex-col items-center justify-center gap-2">
                <Loader2 className="h-8 w-8 animate-spin text-white" />
                <p className="text-white text-sm font-medium">Uploading... {uploadProgress}%</p>
              </div>
            )}
          </div>
        ) : (
          /* Empty Drop Zone */
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            {uploading ? (
              <>
                <Loader2 className="h-10 w-10 animate-spin mb-3" />
                <p className="text-sm font-medium">Uploading...</p>
                <p className="text-xs mt-1">{uploadProgress}%</p>
              </>
            ) : (
              <>
                <ImageIcon className="h-10 w-10 mb-3 opacity-60" />
                <p className="text-sm font-medium">Drag & drop an image here</p>
                <p className="text-xs mt-1">or click to browse</p>
                <p className="text-xs mt-3 text-muted-foreground/70">
                  JPG, PNG, WebP · Max 5MB
                </p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload Status (below preview) */}
      {!preview && !uploading && (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          Choose Image
        </Button>
      )}

      {/* Success indicator */}
      {preview && !uploading && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle className="h-4 w-4" />
          <span>Image uploaded</span>
        </div>
      )}

      {/* Upload progress bar (outside of preview for non-preview mode) */}
      {uploading && !preview && (
        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full transition-all duration-300 rounded-full"
            style={{ width: `${uploadProgress}%` }}
          />
        </div>
      )}
    </div>
  );
}
