/**
 * Storage Refactor Migration Service
 * Migrates data from IndexedDB + localStorage to file-based storage
 */

import { PersistentStorage } from './PersistentStorage';
import { FileMediaManager } from './fileMediaManager';
import type { MediaReference } from '../types/projectStructure';

export interface MigrationOptions {
  cleanupAfter?: boolean;
  onProgress?: (progress: MigrationProgress) => void;
}

export interface MigrationProgress {
  current: number;
  total: number;
  phase: 'starting' | 'migrating' | 'cleaning' | 'complete';
  message?: string;
}

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  errors?: string[];
}

interface MediaItem {
  id: string;
  blob: Blob;
  type: string;
  mediaType: 'image' | 'video' | 'audio';
  metadata?: Record<string, any>;
  timestamp: number;
}

export class StorageRefactorMigration {
  constructor(
    private persistentStorage: PersistentStorage,
    private fileManager: FileMediaManager
  ) {}

  /**
   * Migrate all media from IndexedDB to file system
   */
  async migrateMedia(options: MigrationOptions = {}): Promise<MigrationResult> {
    const errors: string[] = [];
    let migratedCount = 0;

    try {
      // Report starting
      options.onProgress?.({
        current: 0,
        total: 0,
        phase: 'starting',
        message: 'Starting media migration...'
      });

      // Get all media from IndexedDB
      const allMedia = await this.getAllMedia();
      const total = allMedia.length;

      options.onProgress?.({
        current: 0,
        total,
        phase: 'migrating',
        message: `Found ${total} media items to migrate`
      });

      // Migrate each media item
      for (let i = 0; i < allMedia.length; i++) {
        const mediaItem = allMedia[i];
        
        try {
          const reference = this.createMediaReference(mediaItem);
          await this.fileManager.saveMediaFile(mediaItem.blob, reference);
          migratedCount++;

          // Delete from IndexedDB if cleanup is enabled
          if (options.cleanupAfter) {
            await this.persistentStorage.deleteMedia?.(mediaItem.id);
          }

          options.onProgress?.({
            current: i + 1,
            total,
            phase: 'migrating',
            message: `Migrated ${reference.filename}`
          });
        } catch (error) {
          const errorMessage = `Failed to migrate ${mediaItem.id}: ${error}`;
          errors.push(errorMessage);
          console.error(errorMessage);
        }
      }

      // Report completion
      options.onProgress?.({
        current: total,
        total,
        phase: 'complete',
        message: `Migration complete: ${migratedCount}/${total} items migrated`
      });

      return {
        success: true,
        migratedCount,
        errors: errors.length > 0 ? errors : undefined
      };
    } catch (error) {
      console.error('Migration failed:', error);
      return {
        success: false,
        migratedCount,
        errors: [`Migration failed: ${error}`]
      };
    }
  }

  /**
   * Migrate project content from localStorage to project file
   */
  async migrateProjectContent(contentIds: string[]): Promise<{ success: boolean }> {
    try {
      const content: Record<string, any> = {};
      
      // Get all content
      for (const id of contentIds) {
        const item = await this.persistentStorage.getContent(id);
        if (item) {
          content[id] = item;
        }
      }

      // Get metadata
      const metadata = await this.persistentStorage.getCourseMetadata() || {};

      // Get media references
      const mediaReferences = await this.fileManager.scanMediaDirectory('audio');
      const imageReferences = await this.fileManager.scanMediaDirectory('images');
      const videoReferences = await this.fileManager.scanMediaDirectory('video');

      // Save project file
      await this.fileManager.saveProjectFile?.({
        metadata,
        content,
        mediaReferences: [...mediaReferences, ...imageReferences, ...videoReferences]
      });

      return { success: true };
    } catch (error) {
      console.error('Failed to migrate project content:', error);
      return { success: false };
    }
  }

  /**
   * Generate filename based on media ID and metadata
   */
  generateFilename(id: string, mimeType: string, metadata?: any): string {
    const extension = this.getExtensionFromMimeType(mimeType);
    
    // Handle block number prefixed files
    if (metadata?.blockNumber) {
      const topicId = metadata.topicId || 'audio';
      return `${metadata.blockNumber}-${topicId}.${extension}`;
    }

    // Handle image files
    if (id.startsWith('image-')) {
      const name = id.replace('image-', '') || 'image';
      const topicId = metadata?.topicId;
      return topicId ? `${topicId}-${name}.${extension}` : `${name}.${extension}`;
    }

    // Default fallback
    return `${id}.${extension}`;
  }

  /**
   * Get all media from IndexedDB
   */
  private async getAllMedia(): Promise<MediaItem[]> {
    // Use a special topic ID to get all media
    return await this.persistentStorage.getMediaForTopic('*') || [];
  }

  /**
   * Create a MediaReference from a MediaItem
   */
  private createMediaReference(mediaItem: MediaItem): MediaReference {
    const type = this.getMediaTypeFromId(mediaItem.id);
    const filename = this.generateFilename(mediaItem.id, mediaItem.type, mediaItem.metadata);
    let directory: string;
    
    try {
      directory = this.fileManager.getMediaDirectory(type);
    } catch (error) {
      // If getMediaDirectory throws, use a fallback
      const typeMap = {
        'audio': 'media/audio',
        'image': 'media/images',
        'video': 'media/video',
        'caption': 'captions'
      };
      directory = typeMap[type] || 'media/files';
    }
    
    return {
      id: mediaItem.id,
      filename,
      relativePath: `${directory}/${filename}`,
      type,
      size: mediaItem.blob.size,
      lastModified: mediaItem.timestamp || Date.now(),
      metadata: mediaItem.metadata
    };
  }

  /**
   * Determine media type from ID
   */
  private getMediaTypeFromId(id: string): 'audio' | 'image' | 'video' | 'caption' {
    if (id.startsWith('audio-')) return 'audio';
    if (id.startsWith('image-')) return 'image';
    if (id.startsWith('video-')) return 'video';
    if (id.startsWith('caption-')) return 'caption';
    
    // Default based on common patterns
    if (id.includes('caption') || id.includes('vtt')) return 'caption';
    return 'audio'; // Default fallback
  }

  /**
   * Get file extension from MIME type
   */
  private getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'text/vtt': 'vtt',
      'text/plain': 'txt'
    };

    return mimeMap[mimeType] || 'bin';
  }
}