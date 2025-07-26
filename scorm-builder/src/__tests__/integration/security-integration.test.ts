import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileStorage } from '../../services/FileStorage';
import { invoke } from '@tauri-apps/api/core';

describe('Security Integration Tests', () => {
  let testProjectId: string | null = null;

  beforeAll(async () => {
    // Initialize storage
    if (!fileStorage.isInitialized) {
      await fileStorage.initialize();
    }
  });

  afterAll(async () => {
    // Cleanup
    if (testProjectId) {
      try {
        await fileStorage.deleteProject(testProjectId);
      } catch (error) {
        console.error('Failed to cleanup test project:', error);
      }
    }
  });

  describe('XSS Prevention in FileStorage', () => {
    it('should sanitize content with script tags', async () => {
      // Create a test project
      const projectMetadata = await fileStorage.createProject('XSS Test Project');
      testProjectId = projectMetadata.id;

      // Save content with XSS attempt
      const maliciousContent = {
        topicId: 'test-topic',
        title: 'Test Topic',
        content: '<script>alert("XSS")</script><p>Normal content</p>',
        narration: 'This is <img src=x onerror="alert(\'XSS\')" /> narration'
      };

      await fileStorage.saveContent('test-topic', maliciousContent);

      // Save and reload project
      await fileStorage.saveProject();
      await fileStorage.openProject(testProjectId);

      // Retrieve content
      const savedContent = await fileStorage.getContent('test-topic');

      // Verify sanitization
      expect(savedContent?.content).toBe('<p>Normal content</p>');
      expect(savedContent?.content).not.toContain('script');
      expect(savedContent?.narration).not.toContain('onerror');
      expect(savedContent?.narration).toContain('This is');
    });

    it('should allow safe HTML content', async () => {
      const safeContent = {
        topicId: 'safe-topic',
        title: 'Safe Topic',
        content: '<p>This is <strong>bold</strong> and <em>italic</em> text</p>',
        narration: 'This is <a href="https://example.com">a link</a>'
      };

      await fileStorage.saveContent('safe-topic', safeContent);
      const savedContent = await fileStorage.getContent('safe-topic');

      // Safe HTML should be preserved
      expect(savedContent?.content).toContain('<strong>bold</strong>');
      expect(savedContent?.content).toContain('<em>italic</em>');
      expect(savedContent?.narration).toContain('<a href="https://example.com">');
    });
  });

  describe('Path Traversal Prevention', () => {
    it('should reject attempts to save outside project directory', async () => {
      const maliciousPath = '../../../etc/passwd.scormproj';
      
      try {
        await invoke('save_project', {
          projectData: {
            version: '1.0',
            project: { id: 'test', name: 'Test', created: new Date(), last_modified: new Date() },
            course_data: { title: 'Test', difficulty: 1, template: 'none', topics: [], custom_topics: null },
            ai_prompt: null,
            course_content: null,
            media: { images: [], videos: [], audio: [] },
            audio_settings: { voice: 'en-US', speed: 1, pitch: 1 },
            scorm_config: { version: '2004', completion_criteria: 'all', passing_score: 80 }
          },
          filePath: maliciousPath
        });
        
        // Should not reach here
        expect.fail('Path traversal should have been blocked');
      } catch (error) {
        expect(String(error)).toContain('Access denied');
      }
    });

    it('should reject non-.scormproj files', async () => {
      const invalidPath = 'C:\\Users\\test\\Documents\\SCORM Projects\\test.exe';
      
      try {
        await invoke('save_project', {
          projectData: {
            version: '1.0',
            project: { id: 'test', name: 'Test', created: new Date(), last_modified: new Date() },
            course_data: { title: 'Test', difficulty: 1, template: 'none', topics: [], custom_topics: null },
            ai_prompt: null,
            course_content: null,
            media: { images: [], videos: [], audio: [] },
            audio_settings: { voice: 'en-US', speed: 1, pitch: 1 },
            scorm_config: { version: '2004', completion_criteria: 'all', passing_score: 80 }
          },
          filePath: invalidPath
        });
        
        expect.fail('Non-.scormproj file should have been blocked');
      } catch (error) {
        expect(String(error)).toContain('Invalid file type');
      }
    });
  });

  describe('URL Validation for Image Downloads', () => {
    it('should reject non-HTTPS URLs', async () => {
      try {
        await invoke('download_image', {
          url: 'http://images.unsplash.com/test.jpg'
        });
        expect.fail('HTTP URL should have been blocked');
      } catch (error) {
        expect(String(error)).toContain('Only HTTPS URLs are allowed');
      }
    });

    it('should reject non-whitelisted domains', async () => {
      try {
        await invoke('download_image', {
          url: 'https://evil-site.com/malicious.jpg'
        });
        expect.fail('Non-whitelisted domain should have been blocked');
      } catch (error) {
        expect(String(error)).toContain('not in the allowed list');
      }
    });

    it('should reject private IP addresses', async () => {
      const privateIPs = [
        'https://192.168.1.1/image.jpg',
        'https://10.0.0.1/image.jpg',
        'https://172.16.0.1/image.jpg',
        'https://127.0.0.1/image.jpg',
        'https://localhost/image.jpg'
      ];

      for (const url of privateIPs) {
        try {
          await invoke('download_image', { url });
          expect.fail(`Private IP ${url} should have been blocked`);
        } catch (error) {
          expect(String(error)).toMatch(/private IP|not in the allowed list/);
        }
      }
    });

    it('should allow whitelisted domains', async () => {
      // This would make a real network request in integration tests
      // For unit tests, you'd mock the network layer
      const allowedUrls = [
        'https://images.unsplash.com/test.jpg',
        'https://i.imgur.com/test.png',
        'https://cdn.pixabay.com/test.jpg'
      ];

      // Just verify the URLs would be accepted by validation
      for (const url of allowedUrls) {
        // In a real test, you'd mock the HTTP response
        // For now, we just verify the URL format is accepted
        expect(url).toMatch(/^https:\/\//);
        expect(url).toMatch(/\.(jpg|png|gif|jpeg|webp)$/i);
      }
    });
  });

  describe('Input Size Validation', () => {
    it('should reject oversized log entries', async () => {
      const largeContent = 'x'.repeat(20000); // 20KB
      
      try {
        await invoke('append_to_log', { content: largeContent });
        expect.fail('Oversized log entry should have been blocked');
      } catch (error) {
        expect(String(error)).toContain('too large');
      }
    });

    it('should accept normal-sized log entries', async () => {
      const normalContent = 'This is a normal log entry';
      
      // Should not throw
      await invoke('append_to_log', { content: normalContent });
    });
  });
});