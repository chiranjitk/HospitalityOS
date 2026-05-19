'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import {
  ImagePlus,
  X,
  Upload,
  Loader2,
  ImageOff,
  Move,
  Star,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Cloud,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  GripVertical,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RoomImage {
  id: string;
  url: string;
  thumbnailUrl?: string;
  caption: string;
  category: string;
  isPrimary: boolean;
  sortOrder: number;
  width?: number;
  height?: number;
  fileSize?: number;
  otaSyncStatus?: string; // JSON string
}

interface RoomImageGalleryProps {
  roomId: string;
  images: RoomImage[];
  onImagesChange: (images: RoomImage[]) => void;
  maxImages?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const IMAGE_CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'bedroom', label: 'Bedroom' },
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'living_area', label: 'Living Area' },
  { value: 'view', label: 'View' },
  { value: 'exterior', label: 'Exterior' },
  { value: 'dining', label: 'Dining' },
  { value: 'amenities', label: 'Amenities' },
  { value: 'other', label: 'Other' },
] as const;

const CATEGORY_FILTERS = [
  { value: 'all', label: 'All' },
  ...IMAGE_CATEGORIES,
] as const;

const OTA_CHANNELS = [
  { id: 'booking_com', label: 'Booking.com' },
  { id: 'expedia', label: 'Expedia' },
  { id: 'airbnb', label: 'Airbnb' },
  { id: 'google_hotels', label: 'Google Hotels' },
  { id: 'make_my_trip', label: 'MakeMyTrip' },
] as const;

type SyncStatus = 'pending' | 'synced' | 'failed';

interface OtaSyncInfo {
  channelId: string;
  channelLabel: string;
  status: SyncStatus;
  lastSynced?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resizeImage = (file: File, maxWidth = 1920): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(maxWidth / img.width, maxWidth / img.height, 1);
      canvas.width = img.width * ratio;
      canvas.height = img.height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        },
        'image/jpeg',
        0.85,
      );
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};

const categoryLabel = (value: string) =>
  IMAGE_CATEGORIES.find((c) => c.value === value)?.label ?? value;

const categoryBadgeColor = (value: string): string => {
  switch (value) {
    case 'bedroom':
      return 'bg-purple-500/80 text-white';
    case 'bathroom':
      return 'bg-cyan-500/80 text-white';
    case 'living_area':
      return 'bg-teal-500/80 text-white';
    case 'view':
      return 'bg-sky-500/80 text-white';
    case 'exterior':
      return 'bg-emerald-500/80 text-white';
    case 'dining':
      return 'bg-orange-500/80 text-white';
    case 'amenities':
      return 'bg-pink-500/80 text-white';
    case 'other':
      return 'bg-slate-500/80 text-white';
    default:
      return 'bg-gray-500/80 text-white';
  }
};

const parseOtaSyncStatus = (jsonStr?: string): Record<string, SyncStatus> => {
  if (!jsonStr) return {};
  try {
    return JSON.parse(jsonStr);
  } catch {
    return {};
  }
};

let _nextId = 1;
const tempId = () => `temp-${Date.now()}-${_nextId++}`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RoomImageGallery({
  roomId,
  images,
  onImagesChange,
  maxImages = 20,
}: RoomImageGalleryProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Dialog states
  const [isOpen, setIsOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [otaDialogOpen, setOtaDialogOpen] = useState(false);

  // Upload state
  const [uploadingFiles, setUploadingFiles] = useState<
    Map<string, { name: string; progress: number }>
  >(new Map());
  const [isDragOver, setIsDragOver] = useState(false);

  // Filter
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Editing states
  const [editingCaptionId, setEditingCaptionId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const [editingCategoryImgId, setEditingCategoryImgId] = useState<string | null>(null);

  // Drag reorder
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // OTA sync state
  const [otaSyncInfo, setOtaSyncInfo] = useState<OtaSyncInfo[]>([]);
  const [otaLoading, setOtaLoading] = useState(false);
  const [otaSyncing, setOtaSyncing] = useState<string | null>(null); // channel id or 'all'

  // Sync to server flag
  const [saving, setSaving] = useState(false);

  // -----------------------------------------------------------------------
  // Computed
  // -----------------------------------------------------------------------

  const filteredImages =
    categoryFilter === 'all'
      ? images
      : images.filter((img) => img.category === categoryFilter);

  const lightboxImages = categoryFilter === 'all' ? images : filteredImages;

  const canPersist = roomId !== 'new';

  // -----------------------------------------------------------------------
  // Upload logic
  // -----------------------------------------------------------------------

  const uploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const remainingSlots = maxImages - images.length;
      const filesArray = Array.from(files).slice(0, remainingSlots);

      if (filesArray.length === 0) {
        if (remainingSlots <= 0) {
          toast({
            title: 'Limit reached',
            description: `Maximum ${maxImages} images allowed`,
            variant: 'destructive',
          });
        }
        return;
      }

      if (filesArray.length < Array.from(files).length) {
        toast({
          title: 'Limit reached',
          description: `Only ${remainingSlots} more image(s) can be added (max ${maxImages})`,
          variant: 'destructive',
        });
      }

      // Create upload tracking entries
      const uploadId = Date.now().toString();
      const newUploading = new Map(uploadingFiles);
      const fileIds: string[] = [];

      filesArray.forEach((file, i) => {
        const fid = `${uploadId}-${i}`;
        fileIds.push(fid);
        newUploading.set(fid, { name: file.name, progress: 0 });
      });
      setUploadingFiles(newUploading);

      const newImages: RoomImage[] = [];

      await Promise.allSettled(
        filesArray.map(async (file, i) => {
          const fid = fileIds[i];
          try {
            // Progress: resizing
            setUploadingFiles((prev) => {
              const m = new Map(prev);
              m.set(fid, { name: file.name, progress: 20 });
              return m;
            });

            // Client-side resize
            let blobToUpload: Blob;
            try {
              blobToUpload = await resizeImage(file);
            } catch {
              blobToUpload = file;
            }

            setUploadingFiles((prev) => {
              const m = new Map(prev);
              m.set(fid, { name: file.name, progress: 40 });
              return m;
            });

            // Upload to /api/upload
            const formData = new FormData();
            formData.append('file', blobToUpload, file.name.replace(/\.[^.]+$/, '.jpg'));
            formData.append('folder', 'rooms');
            if (canPersist) {
              formData.append('roomId', roomId);
            }

            setUploadingFiles((prev) => {
              const m = new Map(prev);
              m.set(fid, { name: file.name, progress: 60 });
              return m;
            });

            const uploadRes = await fetch('/api/upload', {
              method: 'POST',
              body: formData,
            });

            if (!uploadRes.ok) {
              throw new Error(`Upload failed (${uploadRes.status})`);
            }

            const uploadData = await uploadRes.json();
            if (!uploadData.success) {
              throw new Error(uploadData.error?.message || 'Upload failed');
            }

            setUploadingFiles((prev) => {
              const m = new Map(prev);
              m.set(fid, { name: file.name, progress: 80 });
              return m;
            });

            const imageUrl: string = uploadData.data.url;

            // If persistent room, also create the RoomImage record
            if (canPersist) {
              try {
                const imgRes = await fetch(`/api/rooms/${roomId}/images`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    url: imageUrl,
                    caption: '',
                    category: 'general',
                    isPrimary: images.length + newImages.length === 0,
                    sortOrder: images.length + newImages.length,
                  }),
                });
                if (imgRes.ok) {
                  const imgData = await imgRes.json();
                  if (imgData.success && imgData.data) {
                    newImages.push(imgData.data);
                  } else {
                    newImages.push({
                      id: tempId(),
                      url: imageUrl,
                      caption: '',
                      category: 'general',
                      isPrimary: images.length + newImages.length === 0,
                      sortOrder: images.length + newImages.length,
                    });
                  }
                } else {
                  newImages.push({
                    id: tempId(),
                    url: imageUrl,
                    caption: '',
                    category: 'general',
                    isPrimary: images.length + newImages.length === 0,
                    sortOrder: images.length + newImages.length,
                  });
                }
              } catch {
                newImages.push({
                  id: tempId(),
                  url: imageUrl,
                  caption: '',
                  category: 'general',
                  isPrimary: images.length + newImages.length === 0,
                  sortOrder: images.length + newImages.length,
                });
              }
            } else {
              // New room – keep local
              newImages.push({
                id: tempId(),
                url: imageUrl,
                caption: '',
                category: 'general',
                isPrimary: images.length + newImages.length === 0,
                sortOrder: images.length + newImages.length,
              });
            }

            setUploadingFiles((prev) => {
              const m = new Map(prev);
              m.set(fid, { name: file.name, progress: 100 });
              return m;
            });
          } catch (err) {
            console.error('Upload error for', file.name, err);
            toast({
              title: 'Upload failed',
              description: `Failed to upload ${file.name}`,
              variant: 'destructive',
            });
          } finally {
            // Remove from uploading map after a short delay
            setTimeout(() => {
              setUploadingFiles((prev) => {
                const m = new Map(prev);
                m.delete(fid);
                return m;
              });
            }, 600);
          }
        }),
      );

      if (newImages.length > 0) {
        onImagesChange([...images, ...newImages]);
        toast({
          title: 'Images uploaded',
          description: `${newImages.length} image(s) uploaded successfully`,
        });
      }
    },
    [images, maxImages, canPersist, roomId, toast, uploadingFiles],
  );

  // File input handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    uploadFiles(files);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Drag & drop for upload zone
  const handleUploadDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleUploadDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleUploadDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) uploadFiles(files);
    },
    [uploadFiles],
  );

  // -----------------------------------------------------------------------
  // Image mutations
  // -----------------------------------------------------------------------

  const updateImage = (id: string, patch: Partial<RoomImage>) => {
    const updated = images.map((img) =>
      img.id === id ? { ...img, ...patch } : img,
    );
    onImagesChange(updated);
  };

  const handleSetPrimary = async (id: string) => {
    const img = images.find((i) => i.id === id);
    if (!img || img.isPrimary) return;

    const updated = images.map((i) => ({
      ...i,
      isPrimary: i.id === id,
    }));

    // Reorder: primary first, then by sortOrder
    const sorted = [
      ...updated.filter((i) => i.isPrimary),
      ...updated
        .filter((i) => !i.isPrimary)
        .sort((a, b) => a.sortOrder - b.sortOrder),
    ].map((i, idx) => ({ ...i, sortOrder: idx }));

    onImagesChange(sorted);

    if (canPersist) {
      try {
        await fetch(`/api/rooms/${roomId}/images`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: sorted }),
        });
      } catch {
        // silent – state is already updated locally
      }
    }

    toast({ title: 'Primary image updated' });
  };

  const handleDeleteImage = async (id: string) => {
    const img = images.find((i) => i.id === id);
    if (!img) return;

    // Delete uploaded file
    try {
      await fetch(`/api/upload?url=${encodeURIComponent(img.url)}`, {
        method: 'DELETE',
      });
    } catch {
      // continue
    }

    const updated = images.filter((i) => i.id !== id);

    // If we deleted the primary, make the first remaining image primary
    if (img.isPrimary && updated.length > 0) {
      updated[0] = { ...updated[0], isPrimary: true };
    }

    // Re-sort
    const sorted = updated
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((i, idx) => ({ ...i, sortOrder: idx }));

    onImagesChange(sorted);

    if (canPersist) {
      try {
        await fetch(`/api/rooms/${roomId}/images`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId: id }),
        });
      } catch {
        // silent
      }
    }

    toast({ title: 'Image removed' });
  };

  // Caption editing
  const startEditCaption = (img: RoomImage) => {
    setEditingCaptionId(img.id);
    setCaptionDraft(img.caption);
  };

  const saveCaption = async () => {
    if (!editingCaptionId) return;
    updateImage(editingCaptionId, { caption: captionDraft });
    setEditingCaptionId(null);
    setCaptionDraft('');

    if (canPersist) {
      try {
        await fetch(`/api/rooms/${roomId}/images`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId: editingCaptionId, caption: captionDraft }),
        });
      } catch {
        // silent
      }
    }
  };

  const cancelCaption = () => {
    setEditingCaptionId(null);
    setCaptionDraft('');
  };

  // Category editing
  const handleCategoryChange = async (imgId: string, newCategory: string) => {
    updateImage(imgId, { category: newCategory });
    setEditingCategoryImgId(null);

    if (canPersist) {
      try {
        await fetch(`/api/rooms/${roomId}/images`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageId: imgId, category: newCategory }),
        });
      } catch {
        // silent
      }
    }
  };

  // -----------------------------------------------------------------------
  // Drag-to-reorder
  // -----------------------------------------------------------------------

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOverItem = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDropItem = async (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const reordered = [...filteredImages];
    const [draggedImg] = reordered.splice(draggedIndex, 1);
    reordered.splice(index, 0, draggedImg);

    // If we're in a filtered view, we need to merge back with full list
    let finalImages: RoomImage[];
    if (categoryFilter === 'all') {
      finalImages = reordered.map((img, i) => ({ ...img, sortOrder: i }));
    } else {
      // Keep non-filtered images in their positions, update filtered ones
      const nonFiltered = images.filter((img) => img.category !== categoryFilter);
      const reorderedIds = new Set(reordered.map((i) => i.id));
      const filteredOriginal = images.filter(
        (img) => img.category === categoryFilter || reorderedIds.has(img.id),
      );

      // Rebuild: interleave non-filtered and reordered filtered
      let sortIdx = 0;
      const reorderedMap = new Map(reordered.map((img) => [img.id, img]));
      finalImages = images.map((img) => {
        if (reorderedMap.has(img.id)) {
          const updated = { ...reorderedMap.get(img.id)!, sortOrder: sortIdx++ };
          return updated;
        }
        return { ...img, sortOrder: sortIdx++ };
      });
    }

    onImagesChange(finalImages);
    setDraggedIndex(null);
    setDragOverIndex(null);

    if (canPersist) {
      try {
        await fetch(`/api/rooms/${roomId}/images`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: finalImages }),
        });
      } catch {
        // silent
      }
    }
  };

  const handleDragEndItem = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // -----------------------------------------------------------------------
  // Batch save (reorder + any pending changes)
  // -----------------------------------------------------------------------

  const handleBatchSave = async () => {
    if (!canPersist) return;
    setSaving(true);
    try {
      await fetch(`/api/rooms/${roomId}/images`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images }),
      });
      toast({ title: 'Changes saved' });
    } catch {
      toast({
        title: 'Save failed',
        description: 'Could not save changes to server',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // OTA Sync
  // -----------------------------------------------------------------------

  const fetchOtaSyncInfo = async () => {
    if (!canPersist) return;
    setOtaLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/ota-sync`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          setOtaSyncInfo(data.data);
        }
      }
    } catch {
      // fallback to building from image sync status
    }

    // Build from local image data as fallback
    if (otaSyncInfo.length === 0) {
      const allSyncStatuses: Record<string, SyncStatus> = {};
      images.forEach((img) => {
        const parsed = parseOtaSyncStatus(img.otaSyncStatus);
        Object.entries(parsed).forEach(([ch, st]) => {
          if (!allSyncStatuses[ch] || st === 'failed') {
            allSyncStatuses[ch] = st as SyncStatus;
          } else if (st === 'synced' && allSyncStatuses[ch] !== 'failed') {
            allSyncStatuses[ch] = 'synced' as SyncStatus;
          }
        });
      });

      const built: OtaSyncInfo[] = OTA_CHANNELS.map((ch) => ({
        channelId: ch.id,
        channelLabel: ch.label,
        status: allSyncStatuses[ch.id] || 'pending',
      }));
      setOtaSyncInfo(built);
    }

    setOtaLoading(false);
  };

  const openOtaDialog = () => {
    setOtaDialogOpen(true);
    fetchOtaSyncInfo();
  };

  const syncChannel = async (channelId: string) => {
    if (!canPersist) return;
    setOtaSyncing(channelId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/ota-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: [channelId] }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOtaSyncInfo((prev) =>
            prev.map((s) =>
              s.channelId === channelId
                ? { ...s, status: 'synced' as SyncStatus, lastSynced: new Date().toISOString() }
                : s,
            ),
          );
          toast({
            title: 'Sync complete',
            description: `Images synced to ${OTA_CHANNELS.find((c) => c.id === channelId)?.label}`,
          });
        }
      }
    } catch {
      setOtaSyncInfo((prev) =>
        prev.map((s) =>
          s.channelId === channelId ? { ...s, status: 'failed' as SyncStatus } : s,
        ),
      );
      toast({
        title: 'Sync failed',
        description: `Failed to sync to ${OTA_CHANNELS.find((c) => c.id === channelId)?.label}`,
        variant: 'destructive',
      });
    } finally {
      setOtaSyncing(null);
    }
  };

  const syncAllChannels = async () => {
    if (!canPersist) return;
    setOtaSyncing('all');
    try {
      const res = await fetch(`/api/rooms/${roomId}/ota-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelIds: otaSyncInfo.map(c => c.channelId) }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setOtaSyncInfo((prev) =>
            prev.map((s) => ({
              ...s,
              status: 'synced' as SyncStatus,
              lastSynced: new Date().toISOString(),
            })),
          );
          toast({ title: 'All channels synced' });
        }
      }
    } catch {
      toast({
        title: 'Sync failed',
        description: 'Failed to sync to all channels',
        variant: 'destructive',
      });
    } finally {
      setOtaSyncing(null);
    }
  };

  // -----------------------------------------------------------------------
  // Lightbox helpers
  // -----------------------------------------------------------------------

  const openLightbox = (imgId: string) => {
    const idx = filteredImages.findIndex((i) => i.id === imgId);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const closeLightbox = () => setLightboxIndex(null);

  const lightboxPrev = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex(
      lightboxIndex > 0 ? lightboxIndex - 1 : filteredImages.length - 1,
    );
  };

  const lightboxNext = () => {
    if (lightboxIndex === null) return;
    setLightboxIndex(
      lightboxIndex < filteredImages.length - 1 ? lightboxIndex + 1 : 0,
    );
  };

  // Keyboard nav for lightbox
  useEffect(() => {
    if (lightboxIndex === null) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') lightboxPrev();
      if (e.key === 'ArrowRight') lightboxNext();
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxIndex, filteredImages.length]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const uploadingCount = uploadingFiles.size;

  const lightboxImage =
    lightboxIndex !== null ? filteredImages[lightboxIndex] : null;

  return (
    <>
      {/* Trigger Button */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <ImagePlus className="h-4 w-4" />
        {images.length > 0 ? `${images.length} Photos` : 'Add Photos'}
      </Button>

      {/* ================================================================= */}
      {/* Main Gallery Dialog                                                */}
      {/* ================================================================= */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Room Photos</DialogTitle>
            <DialogDescription>
              Upload and manage room photos. Drag to reorder. First image is the
              primary photo.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* ----------------------------------------------------------- */}
            {/* 1. Upload Area                                               */}
            {/* ----------------------------------------------------------- */}
            <div
              className={cn(
                'border-2 border-dashed rounded-lg p-6 text-center transition-colors relative',
                isDragOver
                  ? 'border-primary bg-primary/5'
                  : 'hover:border-primary/50 hover:bg-muted/50',
                uploadingCount > 0 && 'pointer-events-none opacity-80',
                images.length >= maxImages && 'pointer-events-none opacity-50',
              )}
              onDragOver={handleUploadDragOver}
              onDragLeave={handleUploadDragLeave}
              onDrop={handleUploadDrop}
              onClick={() => {
                if (uploadingCount === 0 && images.length < maxImages) {
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="hidden"
                onChange={handleFileSelect}
                disabled={uploadingCount > 0 || images.length >= maxImages}
              />

              {uploadingCount > 0 ? (
                <div className="space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground font-medium">
                    Uploading {uploadingCount} file
                    {uploadingCount > 1 ? 's' : ''}...
                  </p>
                  <div className="max-w-md mx-auto space-y-2">
                    {Array.from(uploadingFiles.entries()).map(([fid, info]) => (
                      <div key={fid} className="space-y-1">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate max-w-[200px]">
                            {info.name}
                          </span>
                          <span>{info.progress}%</span>
                        </div>
                        <Progress value={info.progress} className="h-1.5" />
                      </div>
                    ))}
                  </div>
                </div>
              ) : images.length >= maxImages ? (
                <div className="flex flex-col items-center gap-2">
                  <ImageOff className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Maximum {maxImages} images reached
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag & drop images here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, WebP, GIF · Max 5MB each · Images are auto-resized
                    to 1920px ({maxImages - images.length} slots remaining)
                  </p>
                </div>
              )}
            </div>

            {/* ----------------------------------------------------------- */}
            {/* 2. Category Filter Bar                                       */}
            {/* ----------------------------------------------------------- */}
            {images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORY_FILTERS.map((cat) => (
                  <Button
                    key={cat.value}
                    variant={categoryFilter === cat.value ? 'default' : 'outline'}
                    size="sm"
                    className="shrink-0 text-xs"
                    onClick={() => setCategoryFilter(cat.value)}
                  >
                    {cat.label}
                    {cat.value !== 'all' && (
                      <span className="ml-1 opacity-70">
                        ({images.filter((i) => i.category === cat.value).length})
                      </span>
                    )}
                    {cat.value === 'all' && (
                      <span className="ml-1 opacity-70">
                        ({images.length})
                      </span>
                    )}
                  </Button>
                ))}
              </div>
            )}

            {/* ----------------------------------------------------------- */}
            {/* 3. Image Grid                                                */}
            {/* ----------------------------------------------------------- */}
            {filteredImages.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {filteredImages.map((image, index) => (
                  <div
                    key={image.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOverItem(e, index)}
                    onDrop={(e) => handleDropItem(e, index)}
                    onDragEnd={handleDragEndItem}
                    className={cn(
                      'relative rounded-lg overflow-hidden border-2 group cursor-move bg-muted',
                      draggedIndex === index && 'opacity-50 border-primary',
                      dragOverIndex === index &&
                        draggedIndex !== null &&
                        draggedIndex !== index &&
                        'border-primary border-dashed',
                      image.isPrimary && 'ring-2 ring-yellow-400',
                    )}
                  >
                    {/* Thumbnail */}
                    <div
                      className="aspect-square relative overflow-hidden"
                      onClick={() => openLightbox(image.id)}
                    >
                      <img
                        src={image.thumbnailUrl || image.url}
                        alt={image.caption || `Room photo ${index + 1}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                    </div>

                    {/* Category badge (top-left) */}
                    <div className="absolute top-2 left-2 flex gap-1 items-center">
                      {image.isPrimary && (
                        <Badge className="bg-yellow-400 text-yellow-900 text-[10px] px-1.5 py-0 h-5 font-bold">
                          Primary
                        </Badge>
                      )}
                      {editingCategoryImgId === image.id ? (
                        <Select
                          value={image.category}
                          onValueChange={(val) => handleCategoryChange(image.id, val)}
                          onOpenChange={(open) => {
                            if (!open) setEditingCategoryImgId(null);
                          }}
                          open
                        >
                          <SelectTrigger
                            size="sm"
                            className="h-5 text-[10px] w-auto min-w-[80px] bg-black/70 border-white/20 text-white"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {IMAGE_CATEGORIES.map((cat) => (
                              <SelectItem key={cat.value} value={cat.value}>
                                {cat.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge
                          className={cn(
                            'text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:opacity-80',
                            categoryBadgeColor(image.category),
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingCategoryImgId(image.id);
                          }}
                        >
                          {categoryLabel(image.category)}
                        </Badge>
                      )}
                    </div>

                    {/* Hover actions (top-right) */}
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!image.isPrimary && (
                        <Button
                          size="icon"
                          variant="secondary"
                          className="h-7 w-7"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSetPrimary(image.id);
                          }}
                          title="Set as primary"
                          aria-label="Set as primary photo"
                        >
                          <Star className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditCaption(image);
                        }}
                        title="Edit caption"
                        aria-label="Edit caption"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteImage(image.id);
                        }}
                        title="Delete image"
                        aria-label="Delete photo"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Drag handle indicator (bottom-right) */}
                    <div className="absolute bottom-8 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <GripVertical className="h-4 w-4 text-white drop-shadow-md" />
                    </div>

                    {/* Caption area */}
                    <div className="p-2 bg-background">
                      {editingCaptionId === image.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={captionDraft}
                            onChange={(e) => setCaptionDraft(e.target.value)}
                            onBlur={saveCaption}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveCaption();
                              if (e.key === 'Escape') cancelCaption();
                            }}
                            placeholder="Add caption..."
                            className="h-7 text-xs"
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      ) : (
                        <p
                          className={cn(
                            'text-xs truncate cursor-pointer',
                            image.caption
                              ? 'text-foreground'
                              : 'text-muted-foreground italic',
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            startEditCaption(image);
                          }}
                          title={image.caption || 'Click to add caption'}
                        >
                          {image.caption || 'Add caption...'}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : images.length > 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <ImageOff className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">
                  No images in &ldquo;{categoryLabel(categoryFilter)}&rdquo; category
                </p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ImageOff className="h-12 w-12 mx-auto mb-4" />
                <p>No photos uploaded yet</p>
                <p className="text-sm">
                  Drag & drop or click the upload area to add photos
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="flex-row items-center justify-between gap-2 border-t pt-4">
            <div className="flex gap-2">
              {canPersist && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={openOtaDialog}
                >
                  <Cloud className="h-4 w-4" />
                  OTA Sync
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {canPersist && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBatchSave}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Save Changes
                </Button>
              )}
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Done
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* Lightbox                                                          */}
      {/* ================================================================= */}
      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={(open) => {
          if (!open) closeLightbox();
        }}
      >
        <DialogContent className="max-w-5xl p-0 overflow-hidden bg-black/95 border-none">
          {/* Close */}
          <button
            className="absolute top-4 right-4 z-10 text-white/80 hover:text-white transition-colors"
            onClick={closeLightbox}
            aria-label="Close lightbox"
          >
            <X className="h-6 w-6" />
          </button>

          {lightboxImage && (
            <div className="flex flex-col items-center">
              {/* Navigation arrows */}
              {filteredImages.length > 1 && (
                <>
                  <button
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white transition-colors p-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      lightboxPrev();
                    }}
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </button>
                  <button
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 text-white/70 hover:text-white transition-colors p-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      lightboxNext();
                    }}
                    aria-label="Next image"
                  >
                    <ChevronRight className="h-8 w-8" />
                  </button>
                </>
              )}

              {/* Image */}
              <img
                src={lightboxImage.url}
                alt={lightboxImage.caption || 'Room photo'}
                className="w-full h-auto max-h-[75vh] object-contain"
              />

              {/* Caption area */}
              <div className="w-full bg-black/80 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    {editingCaptionId === lightboxImage.id ? (
                      <Input
                        value={captionDraft}
                        onChange={(e) => setCaptionDraft(e.target.value)}
                        onBlur={saveCaption}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveCaption();
                          if (e.key === 'Escape') cancelCaption();
                        }}
                        placeholder="Add caption..."
                        className="text-white bg-white/10 border-white/20 placeholder:text-white/40"
                        autoFocus
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p
                        className="text-white/80 text-sm cursor-pointer hover:text-white transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditCaption(lightboxImage);
                        }}
                      >
                        {lightboxImage.caption || 'Click to add caption...'}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      className={cn(
                        'text-[10px]',
                        categoryBadgeColor(lightboxImage.category),
                      )}
                    >
                      {categoryLabel(lightboxImage.category)}
                    </Badge>
                    <span className="text-white/50 text-xs">
                      {lightboxIndex !== null
                        ? `${lightboxIndex + 1} / ${filteredImages.length}`
                        : ''}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ================================================================= */}
      {/* OTA Sync Dialog                                                   */}
      {/* ================================================================= */}
      <Dialog open={otaDialogOpen} onOpenChange={setOtaDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5" />
              OTA Image Sync
            </DialogTitle>
            <DialogDescription>
              Sync room images to online travel agency channels.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            {otaLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : otaSyncInfo.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Cloud className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No OTA channels configured</p>
              </div>
            ) : (
              <>
                {/* Channel list */}
                {otaSyncInfo.map((ch) => (
                  <div
                    key={ch.channelId}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      {ch.status === 'synced' ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : ch.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Clock className="h-5 w-5 text-amber-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{ch.channelLabel}</p>
                        {ch.lastSynced && (
                          <p className="text-xs text-muted-foreground">
                            Last synced:{' '}
                            {new Date(ch.lastSynced).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          ch.status === 'synced'
                            ? 'success'
                            : ch.status === 'failed'
                              ? 'destructive'
                              : 'warning'
                        }
                        className="text-[10px]"
                      >
                        {ch.status}
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1"
                        disabled={otaSyncing !== null}
                        onClick={() => syncChannel(ch.channelId)}
                      >
                        {otaSyncing === ch.channelId ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3 w-3" />
                        )}
                        Sync
                      </Button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>

          <DialogFooter className="flex-row justify-between gap-2">
            <div />
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={syncAllChannels}
                disabled={otaSyncing !== null || otaSyncInfo.length === 0}
                className="gap-2"
              >
                {otaSyncing === 'all' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOtaDialogOpen(false)}
              >
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
