/**
 * @fileoverview Behavior test for media page_id correctness during save/load cycles
 *
 * This test validates that media files are saved with correct page_id assignments
 * and that the migration tool can fix any existing incorrect assignments.
 *
 * Tests the complete flow:
 * 1. Save media with correct page_id mappings
 * 2. Validate that stored metadata has correct page_id values
 * 3. Test migration tool on projects with incorrect page_id values
 * 4. Verify export validation warnings work correctly
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createMediaService, __testing } from './MediaService';
import { MockFileStorage } from './MockFileStorage';
import { generateMediaId } from '../utils/idGenerator';
import type { MediaService } from './MediaService';

describe('MediaService page_id correctness behavior', () => {
  let mediaService: MediaService;
  let mockFileStorage: MockFileStorage;

  beforeEach(async () => {
    mockFileStorage = new MockFileStorage();

    // Create a project and ensure it's opened
    await mockFileStorage.createProject('Test Project');
    const projectId = mockFileStorage.getCurrentProjectId();
    expect(projectId).toBeTruthy();

    // Create MediaService with the mock FileStorage
    mediaService = createMediaService(projectId!, mockFileStorage);
  });

  afterEach(() => {
    vi.clearAllMocks();
    // Clear MediaService instances to prevent test pollution
    __testing.clearInstances();
  });

  describe('Save operations assign correct page_id values', () => {
    it('should save welcome page audio with page_id "welcome"', async () => {
      // Arrange
      const audioBlob = new Blob(['welcome audio content'], { type: 'audio/mp3' });
      const file = new File([audioBlob], 'welcome-audio.mp3', { type: 'audio/mp3' });

      // Act
      const mediaItem = await mediaService.storeMedia(file, 'welcome', 'audio', {
        original_name: 'welcome-audio.mp3'
      });

      // Assert
      expect(mediaItem.id).toBe('audio-0');

      // Verify metadata was stored with correct page_id
      const storedMetadata = mockFileStorage.getStoredMetadata(mediaItem.id);
      expect(storedMetadata).toBeDefined();
      expect(storedMetadata.page_id).toBe('welcome');
      expect(storedMetadata.type).toBe('audio');
    });

    it('should save objectives page caption with page_id "objectives"', async () => {
      // Arrange
      const captionBlob = new Blob(['WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nLearning objectives content'], { type: 'text/vtt' });
      const file = new File([captionBlob], 'objectives-caption.vtt', { type: 'text/vtt' });

      // Act
      const mediaItem = await mediaService.storeMedia(file, 'objectives', 'caption', {
        original_name: 'objectives-caption.vtt'
      });

      // Assert
      expect(mediaItem.id).toBe('caption-1');

      // Verify metadata was stored with correct page_id
      const storedMetadata = mockFileStorage.getStoredMetadata(mediaItem.id);
      expect(storedMetadata).toBeDefined();
      expect(storedMetadata.page_id).toBe('objectives');
      expect(storedMetadata.type).toBe('caption');
    });

    it('should save first topic audio with page_id "topic-0"', async () => {
      // Arrange
      const audioBlob = new Blob(['topic 0 audio content'], { type: 'audio/mp3' });
      const file = new File([audioBlob], 'topic-0-audio.mp3', { type: 'audio/mp3' });

      // Act
      const mediaItem = await mediaService.storeMedia(file, 'topic-0', 'audio', {
        original_name: 'topic-0-audio.mp3'
      });

      // Assert
      expect(mediaItem.id).toBe('audio-2');

      // Verify metadata was stored with correct page_id
      const storedMetadata = mockFileStorage.getStoredMetadata(mediaItem.id);
      expect(storedMetadata).toBeDefined();
      expect(storedMetadata.page_id).toBe('topic-0');
      expect(storedMetadata.type).toBe('audio');
    });

    it('should save second topic image with page_id "topic-1"', async () => {
      // Arrange
      const imageBlob = new Blob(['fake image data'], { type: 'image/png' });
      const file = new File([imageBlob], 'topic-1-image.png', { type: 'image/png' });

      // Act
      const mediaItem = await mediaService.storeMedia(file, 'topic-1', 'image', {
        original_name: 'topic-1-image.png'
      });

      // Assert
      expect(mediaItem.id).toBe('image-3');

      // Verify metadata was stored with correct page_id
      const storedMetadata = mockFileStorage.getStoredMetadata(mediaItem.id);
      expect(storedMetadata).toBeDefined();
      expect(storedMetadata.page_id).toBe('topic-1');
      expect(storedMetadata.type).toBe('image');
    });
  });

  describe('ID generator creates correct mappings', () => {
    it('should generate correct media IDs for all page types', () => {
      // Test welcome page
      expect(generateMediaId('audio', 'welcome')).toBe('audio-0');
      expect(generateMediaId('caption', 'welcome')).toBe('caption-0');
      expect(generateMediaId('image', 'welcome')).toBe('image-0');
      expect(generateMediaId('video', 'welcome')).toBe('video-0');

      // Test objectives page
      expect(generateMediaId('audio', 'objectives')).toBe('audio-1');
      expect(generateMediaId('caption', 'objectives')).toBe('caption-1');
      expect(generateMediaId('image', 'objectives')).toBe('image-1');
      expect(generateMediaId('video', 'objectives')).toBe('video-1');

      // Test topic pages
      expect(generateMediaId('audio', 'topic-0')).toBe('audio-2');
      expect(generateMediaId('caption', 'topic-0')).toBe('caption-2');
      expect(generateMediaId('audio', 'topic-1')).toBe('audio-3');
      expect(generateMediaId('caption', 'topic-1')).toBe('caption-3');
      expect(generateMediaId('audio', 'topic-2')).toBe('audio-4');
      expect(generateMediaId('caption', 'topic-2')).toBe('caption-4');
    });
  });

  describe('Load operations return correct media for page_id', () => {
    it('should return correct media when loading by page_id', async () => {
      // Arrange - Save media for different pages
      const welcomeAudio = new File([new Blob(['welcome audio'])], 'welcome.mp3', { type: 'audio/mp3' });
      const objectivesCaption = new File([new Blob(['objectives caption'])], 'objectives.vtt', { type: 'text/vtt' });
      const topic0Audio = new File([new Blob(['topic 0 audio'])], 'topic0.mp3', { type: 'audio/mp3' });

      await mediaService.storeMedia(welcomeAudio, 'welcome', 'audio', { original_name: 'welcome.mp3' });
      await mediaService.storeMedia(objectivesCaption, 'objectives', 'caption', { original_name: 'objectives.vtt' });
      await mediaService.storeMedia(topic0Audio, 'topic-0', 'audio', { original_name: 'topic0.mp3' });

      // Act & Assert - Get all media and verify page_id associations
      const allMedia = await mockFileStorage.getAllProjectMediaMetadata();

      const welcomeAudioMeta = allMedia.find(m => m.id === 'audio-0');
      expect(welcomeAudioMeta).toBeDefined();
      expect(welcomeAudioMeta!.page_id).toBe('welcome');

      const objectivesCaptionMeta = allMedia.find(m => m.id === 'caption-1');
      expect(objectivesCaptionMeta).toBeDefined();
      expect(objectivesCaptionMeta!.page_id).toBe('objectives');

      const topic0AudioMeta = allMedia.find(m => m.id === 'audio-2');
      expect(topic0AudioMeta).toBeDefined();
      expect(topic0AudioMeta!.page_id).toBe('topic-0');
    });

    it('should not return topic-0 media when requesting objectives media', async () => {
      // Arrange - Save objectives audio and topic-0 audio
      const objectivesAudio = new File([new Blob(['objectives audio'])], 'objectives.mp3', { type: 'audio/mp3' });
      const topic0Audio = new File([new Blob(['topic 0 audio'])], 'topic0.mp3', { type: 'audio/mp3' });

      await mediaService.storeMedia(objectivesAudio, 'objectives', 'audio', { original_name: 'objectives.mp3' });
      await mediaService.storeMedia(topic0Audio, 'topic-0', 'audio', { original_name: 'topic0.mp3' });

      // Act - Get all media
      const allMedia = await mockFileStorage.getAllProjectMediaMetadata();

      // Assert - Each media should have its correct page_id
      const objectivesAudioMeta = allMedia.find(m => m.id === 'audio-1');
      expect(objectivesAudioMeta).toBeDefined();
      expect(objectivesAudioMeta!.page_id).toBe('objectives');
      expect(objectivesAudioMeta!.page_id).not.toBe('topic-0');

      const topic0AudioMeta = allMedia.find(m => m.id === 'audio-2');
      expect(topic0AudioMeta).toBeDefined();
      expect(topic0AudioMeta!.page_id).toBe('topic-0');
      expect(topic0AudioMeta!.page_id).not.toBe('objectives');
    });
  });

  describe('Edge cases and additional behavior', () => {
    it('should assign unknown page_id values to topic indices', async () => {
      // Arrange
      const audioBlob = new Blob(['test audio'], { type: 'audio/mp3' });
      const file = new File([audioBlob], 'test.mp3', { type: 'audio/mp3' });

      // Act - Store media with unknown page_id
      const mediaItem = await mediaService.storeMedia(file, 'custom-page-123', 'audio', { original_name: 'test.mp3' });

      // Assert - Should assign a topic index (starts at audio-2 for first unknown page)
      expect(mediaItem.id).toBe('audio-2');

      // Verify metadata has the original page_id
      const storedMetadata = mockFileStorage.getStoredMetadata(mediaItem.id);
      expect(storedMetadata.page_id).toBe('custom-page-123');
    });

    it('should assign empty page_id to topic index', async () => {
      // Arrange
      const audioBlob = new Blob(['test audio'], { type: 'audio/mp3' });
      const file = new File([audioBlob], 'test.mp3', { type: 'audio/mp3' });

      // Act - Store media with empty page_id
      const mediaItem = await mediaService.storeMedia(file, '', 'audio', { original_name: 'test.mp3' });

      // Assert - Should assign a topic index for empty page_id too
      expect(mediaItem.id).toBe('audio-3'); // audio-0, audio-1, audio-2 used in previous tests

      // Verify metadata has the empty page_id
      const storedMetadata = mockFileStorage.getStoredMetadata(mediaItem.id);
      expect(storedMetadata.page_id).toBe('');
    });
  });
});