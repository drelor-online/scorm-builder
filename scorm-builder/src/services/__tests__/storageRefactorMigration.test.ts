/**
 * Storage Refactor Migration Tests
 * Tests for migrating from IndexedDB + localStorage to file-based storage
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StorageRefactorMigration } from '../storageRefactorMigration';
import { PersistentStorage } from '../PersistentStorage';
import { FileMediaManager } from '../fileMediaManager';
import type { MediaReference } from '../../types/projectStructure';

// Mock dependencies
vi.mock('../PersistentStorage');
vi.mock('../fileMediaManager');
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

describe('StorageRefactorMigration', () => {
  let migration: StorageRefactorMigration;
  let mockPersistentStorage: PersistentStorage;
  let mockFileManager: FileMediaManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock instances
    mockPersistentStorage = new PersistentStorage();
    mockFileManager = new FileMediaManager('/test/project');
    
    // Setup basic mocks
    vi.mocked(mockPersistentStorage.initialize).mockResolvedValue(undefined);
    vi.mocked(mockFileManager.initializeProjectStructure).mockResolvedValue(undefined);
    vi.mocked(mockFileManager.saveMediaFile).mockResolvedValue(undefined);
    vi.mocked(mockFileManager.saveProjectFile).mockResolvedValue(undefined);
    vi.mocked(mockFileManager.scanMediaDirectory).mockResolvedValue([]);
    vi.mocked(mockPersistentStorage.deleteMedia).mockResolvedValue(undefined);
    
    // Mock getMediaDirectory to return proper paths
    vi.mocked(mockFileManager.getMediaDirectory).mockImplementation((type) => {
      const paths = {
        'audio': 'media/audio',
        'image': 'media/images',
        'video': 'media/video',
        'caption': 'captions'
      };
      return paths[type] || 'media/files';
    });
  });

  describe('Migration Process', () => {
    it('should migrate all media files from IndexedDB to file system', async () => {
      // Intent: All media stored in IndexedDB should be saved to disk with proper structure
      const mockMediaItems = [
        {
          id: 'audio-0001',
          blob: new Blob(['audio content'], { type: 'audio/mpeg' }),
          type: 'audio/mpeg',
          mediaType: 'audio' as const,
          metadata: { blockNumber: '0001', topicId: 'welcome' },
          timestamp: Date.now()
        },
        {
          id: 'caption-0001',
          blob: new Blob(['WEBVTT\n\n00:00.000 --> 00:05.000\nWelcome'], { type: 'text/vtt' }),
          type: 'text/vtt',
          mediaType: 'audio' as const, // Captions stored with audio mediaType
          metadata: { blockNumber: '0001', topicId: 'welcome' },
          timestamp: Date.now()
        },
        {
          id: 'image-safety-diagram',
          blob: new Blob(['image data'], { type: 'image/png' }),
          type: 'image/png',
          mediaType: 'image' as const,
          metadata: { topicId: 'electrical-hazards' },
          timestamp: Date.now()
        }
      ];

      // Mock getting all media from IndexedDB
      vi.mocked(mockPersistentStorage.getMediaForTopic).mockImplementation(async (topicId) => {
        if (topicId === '*') {
          return mockMediaItems;
        }
        return mockMediaItems.filter(item => item.metadata?.topicId === topicId);
      });

      migration = new StorageRefactorMigration(mockPersistentStorage, mockFileManager);
      const result = await migration.migrateMedia();

      // Verify all media was saved to files
      expect(mockFileManager.saveMediaFile).toHaveBeenCalledTimes(3);
      
      // Check audio file
      expect(mockFileManager.saveMediaFile).toHaveBeenCalledWith(
        mockMediaItems[0].blob,
        expect.objectContaining({
          id: 'audio-0001',
          filename: '0001-welcome.mp3',
          relativePath: 'media/audio/0001-welcome.mp3',
          type: 'audio'
        })
      );

      // Check caption file
      expect(mockFileManager.saveMediaFile).toHaveBeenCalledWith(
        mockMediaItems[1].blob,
        expect.objectContaining({
          id: 'caption-0001',
          filename: '0001-welcome.vtt',
          relativePath: 'captions/0001-welcome.vtt',
          type: 'caption'
        })
      );

      // Check image file (filename includes topicId prefix when provided)
      expect(mockFileManager.saveMediaFile).toHaveBeenCalledWith(
        mockMediaItems[2].blob,
        expect.objectContaining({
          id: 'image-safety-diagram',
          filename: 'electrical-hazards-safety-diagram.png',
          relativePath: 'media/images/electrical-hazards-safety-diagram.png',
          type: 'image'
        })
      );

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(3);
    });

    it('should continue migration even if some files fail', async () => {
      // Intent: Migration should be resilient to individual file failures
      const mockMediaItems = [
        {
          id: 'audio-0001',
          blob: new Blob(['audio 1'], { type: 'audio/mpeg' }),
          type: 'audio/mpeg',
          mediaType: 'audio' as const,
          metadata: { blockNumber: '0001' },
          timestamp: Date.now()
        },
        {
          id: 'audio-0002',
          blob: new Blob(['audio 2'], { type: 'audio/mpeg' }),
          type: 'audio/mpeg',
          mediaType: 'audio' as const,
          metadata: { blockNumber: '0002' },
          timestamp: Date.now()
        }
      ];

      vi.mocked(mockPersistentStorage.getMediaForTopic).mockResolvedValue(mockMediaItems);
      
      // First save succeeds, second fails
      vi.mocked(mockFileManager.saveMediaFile)
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Disk full'));

      migration = new StorageRefactorMigration(mockPersistentStorage, mockFileManager);
      const result = await migration.migrateMedia();

      expect(result.success).toBe(true);
      expect(result.migratedCount).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors![0]).toContain('audio-0002');
    });
  });

  describe('Content Migration', () => {
    it('should migrate JSON content to project files', async () => {
      // Intent: All content from localStorage should be saved to project.scormproj file
      const mockContent = {
        'welcome': { topicId: 'welcome', title: 'Welcome', content: 'Welcome content' },
        'objectives': { topicId: 'objectives', title: 'Learning Objectives', content: 'Objectives content' },
        'topic1': { topicId: 'topic1', title: 'Electrical Hazards', content: 'Topic content' }
      };

      const mockMetadata = {
        courseTitle: 'Electrical Safety',
        courseIdentifier: 'ES001',
        masteryScore: 80
      };

      // Mock content retrieval
      vi.mocked(mockPersistentStorage.getContent).mockImplementation(async (id) => {
        return mockContent[id] || null;
      });
      vi.mocked(mockPersistentStorage.getCourseMetadata).mockResolvedValue(mockMetadata);

      migration = new StorageRefactorMigration(mockPersistentStorage, mockFileManager);
      const result = await migration.migrateProjectContent(['welcome', 'objectives', 'topic1']);

      // Verify project file was saved
      expect(mockFileManager.saveProjectFile).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: mockMetadata,
          content: mockContent,
          mediaReferences: expect.any(Array)
        })
      );

      expect(result.success).toBe(true);
    });
  });

  describe('Filename Generation', () => {
    it('should generate correct filenames for different media types', async () => {
      // Intent: Filenames should follow the 0001-topicid.ext convention
      const testCases = [
        {
          input: { id: 'audio-0001', type: 'audio/mpeg', metadata: { blockNumber: '0001', topicId: 'welcome' } },
          expected: '0001-welcome.mp3'
        },
        {
          input: { id: 'caption-0002', type: 'text/vtt', metadata: { blockNumber: '0002', topicId: 'objectives' } },
          expected: '0002-objectives.vtt'
        },
        {
          input: { id: 'image-diagram', type: 'image/png', metadata: { topicId: 'safety' } },
          expected: 'safety-diagram.png'
        },
        {
          input: { id: 'audio-0003', type: 'audio/mpeg', metadata: { blockNumber: '0003' } },
          expected: '0003-audio.mp3'
        }
      ];

      migration = new StorageRefactorMigration(mockPersistentStorage, mockFileManager);

      for (const testCase of testCases) {
        const filename = migration.generateFilename(
          testCase.input.id,
          testCase.input.type,
          testCase.input.metadata
        );
        expect(filename).toBe(testCase.expected);
      }
    });
  });

  describe('Cleanup Process', () => {
    it('should clean up IndexedDB after successful migration', async () => {
      // Intent: After migration, old IndexedDB data should be removed
      const mockMediaItems = [{
        id: 'audio-0001',
        blob: new Blob(['audio'], { type: 'audio/mpeg' }),
        type: 'audio/mpeg',
        mediaType: 'audio' as const,
        metadata: { blockNumber: '0001' },
        timestamp: Date.now()
      }];

      vi.mocked(mockPersistentStorage.getMediaForTopic).mockResolvedValue(mockMediaItems);
      vi.mocked(mockFileManager.saveMediaFile).mockResolvedValue(undefined);

      migration = new StorageRefactorMigration(mockPersistentStorage, mockFileManager);
      
      // Enable cleanup
      const result = await migration.migrateMedia({ cleanupAfter: true });

      expect(result.success).toBe(true);
      expect(mockPersistentStorage.deleteMedia).toHaveBeenCalledWith('audio-0001');
    });

    it('should not clean up if migration fails', async () => {
      // Intent: Data should be preserved if migration encounters errors
      vi.mocked(mockPersistentStorage.getMediaForTopic).mockRejectedValue(new Error('DB error'));

      migration = new StorageRefactorMigration(mockPersistentStorage, mockFileManager);
      const result = await migration.migrateMedia({ cleanupAfter: true });

      expect(result.success).toBe(false);
      expect(mockPersistentStorage.deleteMedia).not.toHaveBeenCalled();
    });
  });

  describe('Progress Tracking', () => {
    it('should report progress during migration', async () => {
      // Intent: Progress callbacks should be called to update UI
      const mockMediaItems = Array.from({ length: 10 }, (_, i) => ({
        id: `audio-000${i}`,
        blob: new Blob([`audio ${i}`], { type: 'audio/mpeg' }),
        type: 'audio/mpeg',
        mediaType: 'audio' as const,
        metadata: { blockNumber: `000${i}` },
        timestamp: Date.now()
      }));

      vi.mocked(mockPersistentStorage.getMediaForTopic).mockResolvedValue(mockMediaItems);
      vi.mocked(mockFileManager.saveMediaFile).mockResolvedValue(undefined);

      const progressCallback = vi.fn();
      migration = new StorageRefactorMigration(mockPersistentStorage, mockFileManager);
      
      await migration.migrateMedia({ onProgress: progressCallback });

      // Check first call (starting phase with total 0)
      expect(progressCallback).toHaveBeenNthCalledWith(1, expect.objectContaining({
        current: 0,
        total: 0,
        phase: 'starting'
      }));

      // Check second call (migrating phase with correct total)
      expect(progressCallback).toHaveBeenNthCalledWith(2, expect.objectContaining({
        current: 0,
        total: 10,
        phase: 'migrating'
      }));

      // Check last call (complete phase)
      expect(progressCallback).toHaveBeenLastCalledWith(expect.objectContaining({
        current: 10,
        total: 10,
        phase: 'complete'
      }));
    });
  });
});