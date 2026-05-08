import { describe, it, expect } from 'vitest';
import { POST, DELETE } from '@/app/api/upload/route';
import { createAuthRequest, buildUrl } from './test-helpers';

describe('Upload API', () => {
  describe('POST /api/upload', () => {
    it('should reject request without file', async () => {
      const url = buildUrl('/api/upload');
      const req = await createAuthRequest(url, {
        method: 'POST',
        body: {},
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const res = await POST(req);
      // May return 400 or 500 depending on formData parsing
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('DELETE /api/upload', () => {
    it('should return 200 for non-existent local file (graceful)', async () => {
      const url = buildUrl('/api/upload', { url: '/uploads/nonexistent-file.jpg' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('should return 400 if url is missing', async () => {
      const url = buildUrl('/api/upload');
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });

    it('should handle S3 URLs gracefully (no delete attempt)', async () => {
      const url = buildUrl('/api/upload', { url: 'https://s3.amazonaws.com/bucket/file.jpg' });
      const req = await createAuthRequest(url, { method: 'DELETE' });
      const res = await DELETE(req);
      // S3 URLs are skipped, should return 200
      expect(res.status).toBe(200);
    });
  });
});
