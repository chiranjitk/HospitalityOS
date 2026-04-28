import { getUserFromRequest } from '@/lib/auth-helpers';

export interface ChatAttachment {
  id: string;
  conversationId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  fileUrl: string;
  uploadedBy: string | null;
  createdAt: string;
}

const API_BASE = '/api/chat-conversations';

/**
 * Upload a file attachment to a chat conversation
 */
export async function uploadChatAttachment(
  file: File,
  conversationId: string
): Promise<ChatAttachment> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(
    `${API_BASE}/${conversationId}/attachments`,
    {
      method: 'POST',
      body: formData,
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to upload file');
  }

  return result.data;
}

/**
 * Get all attachments for a conversation
 */
export async function getChatAttachments(
  conversationId: string
): Promise<ChatAttachment[]> {
  const response = await fetch(
    `${API_BASE}/${conversationId}/attachments`
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to fetch attachments');
  }

  return result.data;
}

/**
 * Delete a chat attachment
 */
export async function deleteChatAttachment(
  attachmentId: string,
  conversationId: string
): Promise<void> {
  const response = await fetch(
    `${API_BASE}/${conversationId}/attachments?id=${attachmentId}`,
    {
      method: 'DELETE',
    }
  );

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.error?.message || 'Failed to delete attachment');
  }
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get icon name for file type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'file-text';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'table';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'music';
  return 'file';
}

/**
 * Check if a file type is image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}

/**
 * Get accepted file types for the file input
 */
export function getAcceptedFileTypes(): string {
  return 'image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv';
}

/**
 * Maximum file size in bytes (10MB)
 */
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
