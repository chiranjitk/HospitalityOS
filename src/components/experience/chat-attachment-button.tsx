'use client';

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Paperclip, X, Loader2, FileText, Image as ImageIcon, Table, Video, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  uploadChatAttachment,
  formatFileSize,
  isImageFile,
  MAX_FILE_SIZE,
} from '@/lib/chat-attachments';
import type { ChatAttachment } from '@/lib/chat-attachments';

interface ChatAttachmentButtonProps {
  conversationId: string;
  onAttachmentUploaded?: (attachment: ChatAttachment) => void;
  disabled?: boolean;
}

export function getAttachmentIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon className="h-4 w-4" />;
  if (mimeType === 'application/pdf' || mimeType.includes('word') || mimeType.includes('document'))
    return <FileText className="h-4 w-4" />;
  if (mimeType.includes('sheet') || mimeType.includes('excel'))
    return <Table className="h-4 w-4" />;
  if (mimeType.startsWith('video/')) return <Video className="h-4 w-4" />;
  if (mimeType.startsWith('audio/')) return <Music className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function AttachmentPreview({ attachment }: { attachment: ChatAttachment }) {
  const [error, setError] = useState(false);

  if (isImageFile(attachment.mimeType) && !error) {
    return (
      <div className="relative inline-block max-w-[200px] rounded-lg overflow-hidden border">
        { }
        <img
          src={attachment.fileUrl}
          alt={attachment.fileName}
          className="max-h-40 object-cover rounded-lg"
          onError={() => setError(true)}
        />
        <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs px-2 py-1 truncate">
          {attachment.fileName}
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border bg-muted/50 max-w-[250px]">
      <div className="p-2 rounded bg-background">
        {getAttachmentIcon(attachment.mimeType)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{attachment.fileName}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(attachment.fileSize)}</p>
      </div>
      <a
        href={attachment.fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs text-primary hover:underline"
      >
        View
      </a>
    </div>
  );
}

export default function ChatAttachmentButton({
  conversationId,
  onAttachmentUploaded,
  disabled = false,
}: ChatAttachmentButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [preview, setPreview] = useState<{ file: File; url: string } | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      alert('File size exceeds 10MB limit');
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      setUploadProgress(30);

      const attachment = await uploadChatAttachment(file, conversationId);

      setUploadProgress(100);

      // Reset after a brief delay to show completion
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
        setPreview(null);
        onAttachmentUploaded?.(attachment);
      }, 500);
    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      setPreview(null);
      alert('Failed to upload file');
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
        onChange={handleFileSelect}
        className="hidden"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled || isUploading}
        title="Attach file"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Paperclip className="h-4 w-4" />
        )}
      </Button>

      {/* Upload progress overlay */}
      {isUploading && (
        <div className="absolute bottom-full right-0 mb-2 bg-background border rounded-lg shadow-lg p-3 min-w-[180px]">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="h-3 w-3 animate-spin" />
            <span className="text-xs font-medium">Uploading...</span>
            <span className="text-xs text-muted-foreground ml-auto">{uploadProgress}%</span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
