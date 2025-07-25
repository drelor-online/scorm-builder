/**
 * File Media Manager
 * Handles reading/writing media files to disk via Tauri
 */

import { invoke } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import type { MediaReference, ProjectStructure } from '../types/projectStructure';

export class FileMediaManager {
  private projectPath: string;
  private structure: ProjectStructure;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.structure = {
      projectFile: 'project.scormproj',
      mediaDir: {
        audio: 'media/audio',
        images: 'media/images',
        video: 'media/video'
      },
      captionsDir: 'captions',
      activitiesDir: 'activities',
      tempDir: 'temp'
    };
  }

  /**
   * Initialize project directory structure
   */
  async initializeProjectStructure(): Promise<void> {
    try {
      // Create all necessary directories
      await invoke('create_directory', { 
        path: await join(this.projectPath, this.structure.mediaDir.audio) 
      });
      await invoke('create_directory', { 
        path: await join(this.projectPath, this.structure.mediaDir.images) 
      });
      await invoke('create_directory', { 
        path: await join(this.projectPath, this.structure.mediaDir.video) 
      });
      await invoke('create_directory', { 
        path: await join(this.projectPath, this.structure.captionsDir) 
      });
      await invoke('create_directory', { 
        path: await join(this.projectPath, this.structure.activitiesDir) 
      });
      await invoke('create_directory', { 
        path: await join(this.projectPath, this.structure.tempDir) 
      });
    } catch (error) {
      console.error('Failed to initialize project structure:', error);
      throw error;
    }
  }

  /**
   * Save a media file to disk
   */
  async saveMediaFile(
    file: File | Blob, 
    reference: MediaReference
  ): Promise<void> {
    try {
      // Convert blob to base64 for Tauri
      const arrayBuffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );

      const fullPath = await join(this.projectPath, reference.relativePath);
      
      // Save file via Tauri
      await invoke('write_binary_file', {
        path: fullPath,
        contents: base64
      });

      console.log(`Saved media file: ${reference.filename}`);
    } catch (error) {
      console.error(`Failed to save media file ${reference.filename}:`, error);
      throw error;
    }
  }

  /**
   * Read a media file from disk
   */
  async readMediaFile(reference: MediaReference): Promise<Blob> {
    try {
      const fullPath = await join(this.projectPath, reference.relativePath);
      
      // Read file via Tauri
      const base64 = await invoke<string>('read_binary_file', { path: fullPath });
      
      // Convert base64 to blob
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      // Determine mime type
      const mimeType = this.getMimeType(reference.filename);
      return new Blob([bytes], { type: mimeType });
    } catch (error) {
      console.error(`Failed to read media file ${reference.filename}:`, error);
      throw error;
    }
  }

  /**
   * Delete a media file from disk
   */
  async deleteMediaFile(reference: MediaReference): Promise<void> {
    try {
      const fullPath = await join(this.projectPath, reference.relativePath);
      await invoke('remove_file', { path: fullPath });
      console.log(`Deleted media file: ${reference.filename}`);
    } catch (error) {
      console.error(`Failed to delete media file ${reference.filename}:`, error);
      throw error;
    }
  }

  /**
   * Get all media references from a directory
   */
  async scanMediaDirectory(type: 'audio' | 'images' | 'video'): Promise<MediaReference[]> {
    try {
      const dirPath = await join(this.projectPath, this.structure.mediaDir[type]);
      const files = await invoke<string[]>('read_directory', { path: dirPath });
      
      const references: MediaReference[] = [];
      for (const filename of files) {
        const fullPath = await join(dirPath, filename);
        const stats = await invoke<{ size: number; modified: number }>('get_file_stats', { 
          path: fullPath 
        });
        
        references.push({
          id: this.generateIdFromFilename(filename),
          filename,
          relativePath: `${this.structure.mediaDir[type]}/${filename}`,
          type: type === 'images' ? 'image' : type,
          size: stats.size,
          lastModified: stats.modified,
          metadata: this.extractMetadataFromFilename(filename)
        });
      }
      
      return references;
    } catch (error) {
      console.error(`Failed to scan ${type} directory:`, error);
      return [];
    }
  }

  /**
   * Get the relative path for a media type
   */
  getMediaDirectory(type: 'audio' | 'image' | 'video' | 'caption'): string {
    switch (type) {
      case 'audio':
        return this.structure.mediaDir.audio;
      case 'image':
        return this.structure.mediaDir.images;
      case 'video':
        return this.structure.mediaDir.video;
      case 'caption':
        return this.structure.captionsDir;
      default:
        throw new Error(`Unknown media type: ${type}`);
    }
  }

  /**
   * Generate a consistent ID from filename
   */
  private generateIdFromFilename(filename: string): string {
    const match = filename.match(/^(\d{4})-(.+)\.(mp3|wav|jpg|png|mp4|vtt)/i);
    if (match) {
      const [, blockNumber, , extension] = match;
      const type = this.getTypeFromExtension(extension);
      return `${type}-${blockNumber}`;
    }
    return `file-${Date.now()}`;
  }

  /**
   * Extract metadata from filename
   */
  private extractMetadataFromFilename(filename: string): any {
    const match = filename.match(/^(\d{4})-(.+)\./);
    if (match) {
      const [, blockNumber, identifier] = match;
      return {
        blockNumber,
        topicId: identifier
      };
    }
    return {};
  }

  /**
   * Get MIME type from filename
   */
  private getMimeType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'jpg':
      case 'jpeg': return 'image/jpeg';
      case 'png': return 'image/png';
      case 'gif': return 'image/gif';
      case 'mp4': return 'video/mp4';
      case 'vtt': return 'text/vtt';
      default: return 'application/octet-stream';
    }
  }

  /**
   * Get media type from file extension
   */
  private getTypeFromExtension(extension: string): string {
    switch (extension.toLowerCase()) {
      case 'mp3':
      case 'wav':
        return 'audio';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return 'image';
      case 'mp4':
        return 'video';
      case 'vtt':
        return 'caption';
      default:
        return 'file';
    }
  }

  /**
   * Save project manifest file
   */
  async saveProjectFile(projectData: any): Promise<void> {
    try {
      const projectPath = await join(this.projectPath, this.structure.projectFile);
      const jsonContent = JSON.stringify(projectData, null, 2);
      
      // Convert to base64 for Tauri
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(jsonContent);
      const base64 = btoa(String.fromCharCode(...uint8Array));
      
      await invoke('write_file', {
        path: projectPath,
        contents: base64
      });
      
      console.log('Saved project file');
    } catch (error) {
      console.error('Failed to save project file:', error);
      throw error;
    }
  }
}