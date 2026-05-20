import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { existsSync } from 'fs';

const UPLOAD_DIR = process.env.UPLOAD_DIR || /*turbopackIgnore: true*/ path.join(process.cwd(), 'upload');

/** Supported input MIME types */
const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpeg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface ProcessedImage {
  /** Original URL: /api/files/{folder}/{filename} */
  url: string;
  /** Thumbnail URL: /api/files/{folder}/thumbs/{filename} */
  thumbnailUrl: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}

/**
 * Process a single uploaded image:
 *  - Generate a thumbnail (max 300x300, cover, 80% quality JPEG)
 *  - Generate a medium variant (max 1200x900, inside, 85% quality JPEG)
 *  - Extract image metadata
 */
export async function processImage(
  filePath: string,
  folder: string,
  filename: string,
): Promise<ProcessedImage> {
  // ---- Metadata first (with fallback) ----
  const metadata = await getImageMetadata(filePath);

  // ---- Ensure thumbnail directory exists ----
  const thumbsDir = path.join(UPLOAD_DIR, folder, 'thumbs');
  if (!existsSync(thumbsDir)) {
    await fs.mkdir(thumbsDir, { recursive: true });
  }

  // ---- Generate thumbnail ----
  const thumbPath = path.join(thumbsDir, filename);
  try {
    await sharp(filePath)
      .resize(300, 300, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toFile(thumbPath);
  } catch (err) {
    console.error('[image-processing] Thumbnail generation failed, copying original as fallback:', err);
    // Fallback: copy the original file as the "thumbnail"
    try {
      await fs.copyFile(filePath, thumbPath);
    } catch (copyErr) {
      console.error('[image-processing] Fallback thumbnail copy also failed:', copyErr);
    }
  }

  // ---- Generate medium variant ----
  // Replace extension with .jpg for medium output consistency
  const parsed = path.parse(filename);
  const mediumFilename = `${parsed.name}-medium.jpg`;
  const mediumPath = path.join(UPLOAD_DIR, folder, mediumFilename);

  try {
    await sharp(filePath)
      .resize(1200, 900, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toFile(mediumPath);
  } catch (err) {
    console.error('[image-processing] Medium variant generation failed:', err);
    // Fallback: copy original as medium
    try {
      await fs.copyFile(filePath, mediumPath);
    } catch (copyErr) {
      console.error('[image-processing] Fallback medium copy also failed:', copyErr);
    }
  }

  // ---- Build URLs ----
  const url = `/api/files/${folder}/${filename}`;
  const thumbnailUrl = `/api/files/${folder}/thumbs/${filename}`;

  return {
    url,
    thumbnailUrl,
    width: metadata.width,
    height: metadata.height,
    fileSize: metadata.fileSize,
    mimeType: metadata.mimeType,
  };
}

/**
 * Generate a thumbnail Buffer from an existing Buffer.
 * Useful for bulk-upload scenarios where the file is already in memory.
 * Always outputs JPEG (80% quality).
 */
export async function generateThumbnail(buffer: Buffer): Promise<Buffer> {
  try {
    const thumbBuffer = await sharp(buffer)
      .resize(300, 300, { fit: 'cover', withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();

    return thumbBuffer;
  } catch (err) {
    console.error('[image-processing] generateThumbnail failed, returning original buffer:', err);
    // Return the original buffer as fallback so callers don't break
    return buffer;
  }
}

/**
 * Get image dimensions and basic metadata.
 * Falls back to sensible defaults when Sharp cannot read the file.
 */
export async function getImageMetadata(filePath: string): Promise<{
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
}> {
  // Default fallback values
  const fallback = {
    width: 0,
    height: 0,
    fileSize: 0,
    mimeType: 'image/jpeg',
  };

  try {
    // Read file size from filesystem
    let fileSize = 0;
    try {
      const stat = await fs.stat(filePath);
      fileSize = stat.size;
    } catch {
      // file may not exist or be unreadable
    }

    // Use Sharp to extract image metadata
    const sharpMeta = await sharp(filePath).metadata();

    // Determine MIME type from format
    const format = sharpMeta.format; // e.g. 'jpeg', 'png', 'webp'
    let mimeType = 'image/jpeg'; // default
    if (format === 'png') {
      mimeType = 'image/png';
    } else if (format === 'webp') {
      mimeType = 'image/webp';
    } else if (format === 'jpeg' || format === 'jpg') {
      mimeType = 'image/jpeg';
    }

    // Validate that the input format is supported
    if (mimeType && !SUPPORTED_MIME_TYPES[mimeType]) {
      console.warn(`[image-processing] Unsupported MIME type "${mimeType}" for ${filePath}, defaulting to image/jpeg`);
      mimeType = 'image/jpeg';
    }

    return {
      width: sharpMeta.width ?? 0,
      height: sharpMeta.height ?? 0,
      fileSize,
      mimeType,
    };
  } catch (err) {
    console.error('[image-processing] getImageMetadata failed, returning fallback:', err);
    // Attempt to at least get the file size even when Sharp fails
    try {
      const stat = await fs.stat(filePath);
      fallback.fileSize = stat.size;
    } catch {
      // ignore
    }
    return fallback;
  }
}
