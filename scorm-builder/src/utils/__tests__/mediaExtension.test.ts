import { describe, it, expect } from 'vitest';
import { getMediaExtension, detectMediaTypeFromBlob } from '../mediaExtension';

describe('Media Extension Detection', () => {
  describe('getMediaExtension', () => {
    it('should extract extension from simple filenames', () => {
      expect(getMediaExtension('image.jpg')).toBe('jpg');
      expect(getMediaExtension('document.pdf')).toBe('pdf');
      expect(getMediaExtension('video.mp4')).toBe('mp4');
      expect(getMediaExtension('audio.mp3')).toBe('mp3');
    });

    it('should handle filenames with multiple dots', () => {
      expect(getMediaExtension('my.awesome.image.jpg')).toBe('jpg');
      expect(getMediaExtension('report.v2.final.pdf')).toBe('pdf');
    });

    it('should handle uppercase extensions', () => {
      expect(getMediaExtension('IMAGE.JPG')).toBe('jpg');
      expect(getMediaExtension('Document.PDF')).toBe('pdf');
      expect(getMediaExtension('Video.MP4')).toBe('mp4');
    });

    it('should handle no extension', () => {
      expect(getMediaExtension('README')).toBe('');
      expect(getMediaExtension('myfile')).toBe('');
    });

    it('should handle empty strings and null', () => {
      expect(getMediaExtension('')).toBe('');
      expect(getMediaExtension(null as any)).toBe('');
      expect(getMediaExtension(undefined as any)).toBe('');
    });

    it('should handle paths with directories', () => {
      expect(getMediaExtension('/path/to/image.jpg')).toBe('jpg');
      expect(getMediaExtension('C:\\Users\\file.pdf')).toBe('pdf');
      expect(getMediaExtension('../relative/path/audio.mp3')).toBe('mp3');
    });

    it('should handle hidden files', () => {
      expect(getMediaExtension('.gitignore')).toBe('gitignore');
      expect(getMediaExtension('.env.local')).toBe('local');
    });

    it('should handle query parameters and fragments', () => {
      expect(getMediaExtension('image.jpg?version=2')).toBe('jpg');
      expect(getMediaExtension('document.pdf#page=5')).toBe('pdf');
      expect(getMediaExtension('file.mp3?t=123#clip')).toBe('mp3');
    });
  });

  describe('detectMediaTypeFromBlob', () => {
    it('should detect image types', async () => {
      const jpegBlob = new Blob(['fake jpeg data'], { type: 'image/jpeg' });
      const result = await detectMediaTypeFromBlob(jpegBlob);
      expect(result.type).toBe('image');
      expect(result.extension).toBe('jpg');
    });

    it('should detect video types', async () => {
      const mp4Blob = new Blob(['fake mp4 data'], { type: 'video/mp4' });
      const result = await detectMediaTypeFromBlob(mp4Blob);
      expect(result.type).toBe('video');
      expect(result.extension).toBe('mp4');
    });

    it('should detect audio types', async () => {
      const mp3Blob = new Blob(['fake mp3 data'], { type: 'audio/mpeg' });
      const result = await detectMediaTypeFromBlob(mp3Blob);
      expect(result.type).toBe('audio');
      expect(result.extension).toBe('mp3');
    });

    it('should handle unknown mime types', async () => {
      const unknownBlob = new Blob(['unknown data'], { type: 'application/octet-stream' });
      const result = await detectMediaTypeFromBlob(unknownBlob);
      expect(result.type).toBe('unknown');
      expect(result.extension).toBe('bin');
    });

    it('should handle empty mime type', async () => {
      const noTypeBlob = new Blob(['data']);
      const result = await detectMediaTypeFromBlob(noTypeBlob);
      expect(result.type).toBe('unknown');
      expect(result.extension).toBe('bin');
    });

    it('should map common mime types to extensions', async () => {
      const cases = [
        { mime: 'image/png', type: 'image', ext: 'png' },
        { mime: 'image/gif', type: 'image', ext: 'gif' },
        { mime: 'image/webp', type: 'image', ext: 'webp' },
        { mime: 'video/webm', type: 'video', ext: 'webm' },
        { mime: 'audio/wav', type: 'audio', ext: 'wav' },
        { mime: 'audio/webm', type: 'audio', ext: 'webm' },
        { mime: 'application/pdf', type: 'document', ext: 'pdf' }
      ];

      for (const { mime, type, ext } of cases) {
        const blob = new Blob(['data'], { type: mime });
        const result = await detectMediaTypeFromBlob(blob);
        expect(result.type).toBe(type);
        expect(result.extension).toBe(ext);
      }
    });
  });
});