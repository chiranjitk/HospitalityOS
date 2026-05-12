'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Upload,
  X,
  FileText,
  Image as ImageIcon,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export interface KYCDocument {
  id: string;
  type: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  base64Data: string;
  uploadedAt: Date;
  previewUrl?: string;
}

interface KYCDocumentUploadProps {
  documents: KYCDocument[];
  onDocumentsChange: (documents: KYCDocument[]) => void;
  disabled?: boolean;
}

const DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID' },
  { value: 'drivers_license', label: 'Driver License' },
  { value: 'visa', label: 'Visa' },
];

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentTypeLabel(type: string): string {
  return DOCUMENT_TYPES.find(t => t.value === type)?.label || type;
}

export function KYCDocumentUpload({
  documents,
  onDocumentsChange,
  disabled = false,
}: KYCDocumentUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState<string>('passport');
  const [isDragging, setIsDragging] = useState(false);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Please upload PDF, JPG, PNG, or WEBP files.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 10MB limit.';
    }
    return null;
  }, []);

  const processFile = useCallback(
    (file: File) => {
      const error = validateFile(file);
      if (error) {
        toast({ title: 'Upload Error', description: error, variant: 'destructive' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const base64Data = e.target?.result as string;
        if (!base64Data) return;

        const newDoc: KYCDocument = {
          id: crypto.randomUUID(),
          type: selectedType,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          base64Data,
          uploadedAt: new Date(),
          previewUrl: file.type.startsWith('image/') ? base64Data : undefined,
        };

        onDocumentsChange([...documents, newDoc]);
        toast({
          title: 'Document Added',
          description: `${file.name} uploaded as ${getDocumentTypeLabel(selectedType)}`,
        });
      };
      reader.readAsDataURL(file);
    },
    [documents, selectedType, onDocumentsChange, toast, validateFile]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      Array.from(files).forEach(processFile);

      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled) setIsDragging(true);
    },
    [disabled]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);
      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        Array.from(files).forEach(processFile);
      }
    },
    [disabled, processFile]
  );

  const removeDocument = useCallback(
    (docId: string) => {
      onDocumentsChange(documents.filter(d => d.id !== docId));
      toast({ title: 'Document Removed', description: 'Document has been removed.' });
    },
    [documents, onDocumentsChange, toast]
  );

  return (
    <div className="space-y-4">
      {/* Document Type Selector + Upload Area */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Document Type</Label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select value={selectedType} onValueChange={setSelectedType} disabled={disabled}>
            <SelectTrigger>
              <SelectValue placeholder="Select document type" />
            </SelectTrigger>
            <SelectContent>
              {DOCUMENT_TYPES.map(type => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            onClick={() => fileInputRef.current?.click()}
            className="h-10"
          >
            <Upload className="h-4 w-4 mr-2" />
            Choose File
          </Button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={handleFileSelect}
          disabled={disabled}
          multiple
        />
      </div>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-200 cursor-pointer',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/30',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        onClick={() => !disabled && fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) fileInputRef.current?.click();
          }
        }}
        aria-label="Drop files here or click to upload"
      >
        <div className="flex flex-col items-center gap-2">
          <div
            className={cn(
              'p-3 rounded-full transition-colors',
              isDragging ? 'bg-primary/10' : 'bg-muted'
            )}
          >
            <Upload
              className={cn(
                'h-6 w-6 transition-colors',
                isDragging ? 'text-primary' : 'text-muted-foreground'
              )}
            />
          </div>
          <p className="text-sm font-medium">
            {isDragging ? 'Drop files here...' : 'Drag & drop files here'}
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, JPG, PNG, WEBP &middot; Max 10MB
          </p>
        </div>
      </div>

      {/* Uploaded Documents List */}
      {documents.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Uploaded Documents ({documents.length})
          </Label>
          <ScrollArea className="max-h-64">
            <div className="space-y-2 pr-2">
              {documents.map(doc => (
                <Card key={doc.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      {/* Preview / Icon */}
                      <div className="h-12 w-12 rounded-md overflow-hidden shrink-0 bg-muted flex items-center justify-center border">
                        {doc.previewUrl ? (
                          <img
                            src={doc.previewUrl}
                            alt={doc.fileName}
                            className="h-full w-full object-cover"
                          />
                        ) : doc.mimeType === 'application/pdf' ? (
                          <FileText className="h-6 w-6 text-red-500" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {getDocumentTypeLabel(doc.type)}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {formatFileSize(doc.fileSize)}
                          </span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" />
                            {doc.uploadedAt.toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Status + Delete */}
                      <div className="flex items-center gap-2 shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-500"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeDocument(doc.id);
                          }}
                          disabled={disabled}
                          aria-label={`Remove ${doc.fileName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Empty state hint */}
      {documents.length === 0 && (
        <div className="flex items-center gap-2 p-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>No documents uploaded yet. Select a type and upload a KYC document.</span>
        </div>
      )}
    </div>
  );
}
