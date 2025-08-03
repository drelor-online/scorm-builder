import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';

interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: string;
  updatedAt: string;
}

interface MediaInfo {
  id: string;
  mediaType: string;
  metadata?: any;
  size?: number;
}

export class FileStorage {
  private _currentProjectId: string | null = null;
  private _currentProjectPath: string | null = null;
  public isInitialized = false;
  
  get currentProjectId(): string | null {
    return this._currentProjectId;
  }

  async initialize(): Promise<void> {
    console.log('[FileStorage] Initializing...');
    this.isInitialized = true;
    return Promise.resolve();
  }

  async createProject(name: string, projectsDir?: string): Promise<Project> {
    try {
      // Call backend to create project with proper folder structure
      const projectMetadata = await invoke<any>('create_project', { name });
      
      this._currentProjectId = projectMetadata.id;
      this._currentProjectPath = projectMetadata.path;
      
      return {
        id: projectMetadata.id,
        name: projectMetadata.name,
        path: projectMetadata.path,
        createdAt: projectMetadata.created,
        updatedAt: projectMetadata.last_modified
      };
    } catch (error) {
      console.error('[FileStorage] Error creating project:', error);
      throw error;
    }
  }

  async openProject(projectId: string): Promise<void> {
    try {
      const projectFile = await invoke<any>('load_project', { filePath: projectId });
      this._currentProjectId = projectFile.project.id;
      this._currentProjectPath = projectId;
    } catch (error) {
      console.error('[FileStorage] Error opening project:', error);
      throw error;
    }
  }

  async saveContent(contentId: string, content: any): Promise<void> {
    if (!this._currentProjectPath) throw new Error('No project open');
    try {
      // Load current project, update content, and save
      const projectFile = await invoke<any>('load_project', { filePath: this._currentProjectPath });
      
      // Update the appropriate field based on contentId
      if (contentId === 'course-content') {
        projectFile.course_content = content;
      } else if (contentId === 'metadata') {
        // Ensure metadata conforms to CourseData structure
        projectFile.course_data = {
          title: content.title || projectFile.course_data.title || 'Untitled',
          difficulty: content.difficulty || projectFile.course_data.difficulty || 1,
          template: content.template || projectFile.course_data.template || 'default',
          topics: content.topics || projectFile.course_data.topics || [],
          custom_topics: content.custom_topics || projectFile.course_data.custom_topics || null
        };
      } else if (contentId === 'aiPrompt') {
        projectFile.ai_prompt = { prompt: content, generated_at: new Date().toISOString() };
      } else if (contentId === 'audioSettings') {
        // Ensure audio settings has all required fields
        projectFile.audio_settings = {
          voice: content.voice || projectFile.audio_settings.voice || 'default',
          speed: content.speed !== undefined ? content.speed : (projectFile.audio_settings.speed || 1.0),
          pitch: content.pitch !== undefined ? content.pitch : (projectFile.audio_settings.pitch || 1.0)
        };
      } else if (contentId === 'scormConfig') {
        // Ensure SCORM config has all required fields
        projectFile.scorm_config = {
          version: content.version || projectFile.scorm_config.version || 'SCORM_2004',
          completion_criteria: content.completion_criteria || projectFile.scorm_config.completion_criteria || 'all',
          passing_score: content.passing_score !== undefined ? content.passing_score : (projectFile.scorm_config.passing_score || 80)
        };
      }
      
      // Save updated project
      await invoke('save_project', {
        filePath: this._currentProjectPath,
        projectData: projectFile
      });
    } catch (error) {
      console.error('[FileStorage] Error saving content:', error);
      throw error;
    }
  }

  async getContent(contentId: string): Promise<any> {
    if (!this._currentProjectPath) return null;
    try {
      const projectFile = await invoke<any>('load_project', { filePath: this._currentProjectPath });
      
      // Return the appropriate field based on contentId
      if (contentId === 'course-content') {
        return projectFile.course_content;
      } else if (contentId === 'metadata') {
        return projectFile.course_data;
      } else if (contentId === 'aiPrompt') {
        return projectFile.ai_prompt?.prompt;
      } else if (contentId === 'audioSettings') {
        return projectFile.audio_settings;
      } else if (contentId === 'scormConfig') {
        return projectFile.scorm_config;
      }
      
      return null;
    } catch (error) {
      console.error('[FileStorage] Error getting content:', error);
      return null;
    }
  }

  async listProjects(): Promise<Project[]> {
    try {
      const projects = await invoke<any[]>('list_projects');
      return projects.map(p => ({
        id: p.id,
        name: p.name,
        path: p.path || '',
        createdAt: p.created || p.createdAt || new Date().toISOString(),
        updatedAt: p.last_modified || p.updatedAt || new Date().toISOString()
      }));
    } catch (error) {
      console.error('[FileStorage] Error listing projects:', error);
      return [];
    }
  }

  async getRecentProjects(): Promise<Project[]> {
    try {
      // For now, just return all projects sorted by last modified
      const allProjects = await invoke<any[]>('list_projects');
      return allProjects
        .map(p => ({
          id: p.id,
          name: p.name,
          path: p.path || '',
          createdAt: p.created || p.createdAt || new Date().toISOString(),
          updatedAt: p.last_modified || p.updatedAt || new Date().toISOString()
        }))
        .sort((a, b) => {
          const dateA = new Date(b.updatedAt).getTime();
          const dateB = new Date(a.updatedAt).getTime();
          return dateA - dateB;
        })
        .slice(0, 5); // Return top 5 most recent
    } catch (error) {
      console.error('[FileStorage] Error getting recent projects:', error);
      return [];
    }
  }

  async checkForRecovery(): Promise<{ hasBackup: boolean }> {
    // TODO: Implement recovery check
    return { hasBackup: false };
  }

  getCurrentProjectId(): string | null {
    return this.currentProjectId;
  }

  async saveCourseMetadata(metadata: any): Promise<void> {
    await this.saveContent('metadata', metadata);
  }

  async getCourseMetadata(): Promise<any> {
    return this.getContent('metadata');
  }

  async storeMedia(id: string, blob: Blob, mediaType: string, metadata?: any): Promise<void> {
    if (!this._currentProjectId) throw new Error('No project open');
    try {
      // Convert blob to ArrayBuffer for Tauri
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      
      await invoke('store_media', {
        id: id,
        projectId: this._currentProjectId,
        data: Array.from(bytes),
        metadata: {
          page_id: metadata?.page_id || '',
          type: mediaType,
          original_name: metadata?.original_name || 'unknown',
          mime_type: blob.type || undefined,
          source: metadata?.source || undefined,
          embed_url: metadata?.embed_url || undefined,
          title: metadata?.title || undefined
        }
      });
    } catch (error) {
      console.error('[FileStorage] Error storing media:', error);
      throw error;
    }
  }

  async getMedia(id: string): Promise<MediaInfo | null> {
    if (!this._currentProjectId) return null;
    try {
      const media = await invoke<any>('get_media', {
        projectId: this._currentProjectId,
        mediaId: id
      });
      return media ? {
        id: media.id,
        mediaType: media.metadata.type,
        metadata: media.metadata,
        size: media.data?.length
      } : null;
    } catch (error) {
      console.error('[FileStorage] Error getting media:', error);
      return null;
    }
  }
  
  async getMediaForTopic(topicId: string): Promise<any[]> {
    if (!this._currentProjectId) return [];
    try {
      // Get all media and filter by topic
      const allMedia = await invoke<any[]>('get_all_project_media', {
        projectId: this._currentProjectId
      });
      return allMedia.filter(media => media.metadata.page_id === topicId);
    } catch (error) {
      console.error('[FileStorage] Error getting topic media:', error);
      return [];
    }
  }
  
  async addMediaToTopic(topicId: string, blob: Blob, metadata: any): Promise<void> {
    if (!this._currentProjectPath) throw new Error('No project open');
    
    const mediaId = Date.now().toString();
    await this.storeMedia(mediaId, blob, metadata.mediaType, {
      ...metadata,
      topicId
    });
  }

  addStateChangeListener(_callback: (state: any) => void): () => void {
    // TODO: Implement state change notifications from Tauri
    return () => {};
  }

  async openProjectFromFile(): Promise<Project> {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'SCORM Project',
          extensions: ['scormproj']
        }]
      });
      
      if (!selected) throw new Error('No file selected');
      
      const projectPath = selected as string;
      const projectFile = await invoke<any>('load_project', { filePath: projectPath });
      
      this._currentProjectId = projectFile.project.id;
      this._currentProjectPath = projectPath;
      
      return {
        id: projectFile.project.id,
        name: projectFile.project.name,
        path: projectPath,
        createdAt: projectFile.project.created,
        updatedAt: projectFile.project.last_modified
      };
    } catch (error) {
      console.error('[FileStorage] Error opening project from file:', error);
      throw error;
    }
  }

  async openProjectFromPath(filePath: string, options?: any): Promise<void> {
    try {
      const projectFile = await invoke<any>('load_project', { filePath: filePath });
      this._currentProjectId = projectFile.project.id;
      this._currentProjectPath = filePath;
    } catch (error) {
      console.error('[FileStorage] Error opening project from path:', error);
      throw error;
    }
  }

  async saveProject(): Promise<void> {
    if (!this._currentProjectPath) throw new Error('No project open');
    try {
      // Load current project to preserve all data
      const projectFile = await invoke<any>('load_project', { filePath: this._currentProjectPath });
      
      // Update last modified
      projectFile.project.last_modified = new Date().toISOString();
      
      // Save the complete project
      await invoke('save_project', { 
        filePath: this._currentProjectPath,
        projectData: projectFile
      });
      console.log('[FileStorage] Project saved');
    } catch (error) {
      console.error('[FileStorage] Error saving project:', error);
      throw error;
    }
  }

  async saveProjectAs(): Promise<void> {
    try {
      const filePath = await save({
        filters: [{
          name: 'SCORM Project',
          extensions: ['scormproj']
        }]
      });
      
      if (!filePath) throw new Error('No save location selected');
      
      // Load current project data
      const projectFile = await invoke<any>('load_project', { filePath: this._currentProjectPath });
      
      // Save to new location
      await invoke('save_project', {
        file_path: filePath,
        project_data: projectFile
      });
      
      // TODO: Copy media folder to new location
      
      this._currentProjectPath = filePath;
      console.log('[FileStorage] Project saved as:', filePath);
    } catch (error) {
      console.error('[FileStorage] Error saving project as:', error);
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      await invoke('delete_project', { filePath: projectId });
      if (this._currentProjectPath === projectId) {
        this._currentProjectId = null;
        this._currentProjectPath = null;
      }
    } catch (error) {
      console.error('[FileStorage] Error deleting project:', error);
      throw error;
    }
  }

  async recoverFromBackup(backupPath: string): Promise<void> {
    // TODO: Implement backup recovery
    console.log('[FileStorage] Recovery not yet implemented');
  }

  async loadProjectFromFile(): Promise<Project> {
    return this.openProjectFromFile();
  }

  async storeYouTubeVideo(id: string, youtubeUrl: string, metadata?: any): Promise<void> {
    if (!this._currentProjectId) throw new Error('No project open');
    try {
      // Store YouTube URL as text data
      const urlBlob = new Blob([youtubeUrl], { type: 'text/plain' });
      await this.storeMedia(id, urlBlob, 'youtube', {
        ...metadata,
        embed_url: youtubeUrl,
        source: 'youtube'
      });
    } catch (error) {
      console.error('[FileStorage] Error storing YouTube video:', error);
      throw error;
    }
  }

  async exportProject(): Promise<Blob> {
    if (!this._currentProjectPath) throw new Error('No project open');
    try {
      // TODO: Implement proper project export with media
      const projectFile = await invoke<any>('load_project', { filePath: this._currentProjectPath });
      const data = JSON.stringify(projectFile, null, 2);
      return new Blob([data], { type: 'application/json' });
    } catch (error) {
      console.error('[FileStorage] Error exporting project:', error);
      throw error;
    }
  }

  async importProjectFromZip(zipBlob: Blob): Promise<void> {
    try {
      // TODO: Implement proper project import with media
      const text = await zipBlob.text();
      const projectData = JSON.parse(text);
      
      // Create new project with imported data
      const projectId = Date.now().toString();
      const projectsDir = await invoke<string>('get_projects_dir');
      const projectPath = `${projectsDir}/imported_${projectId}.scormproj`;
      
      await invoke('save_project', {
        file_path: projectPath,
        project_data: projectData
      });
      
      this._currentProjectId = projectId;
      this._currentProjectPath = projectPath;
      
      console.log('[FileStorage] Imported project from zip');
    } catch (error) {
      console.error('[FileStorage] Error importing project:', error);
      throw error;
    }
  }

  setProjectsDirectory(directory: string): void {
    invoke('set_projects_dir', { directory }).catch(error => {
      console.error('[FileStorage] Error setting projects directory:', error);
    });
  }

  async migrateFromLocalStorage(): Promise<any[]> {
    // TODO: Implement migration from localStorage
    return [];
  }

  async clearRecentFilesCache(): Promise<void> {
    // TODO: Implement recent files cache clearing
    console.log('[FileStorage] Recent files cache clearing not yet implemented');
  }

  async getMediaUrl(id: string): Promise<string | null> {
    if (!this._currentProjectId) return null;
    try {
      const media = await invoke<any>('get_media', {
        projectId: this._currentProjectId,
        mediaId: id
      });
      
      if (!media) return null;
      
      // For YouTube videos, return the embed URL
      if (media.metadata.source === 'youtube' && media.metadata.embed_url) {
        return media.metadata.embed_url;
      }
      
      // For other media, create a blob URL from the data
      const blob = new Blob([new Uint8Array(media.data)], { 
        type: media.metadata.mime_type || 'application/octet-stream' 
      });
      return URL.createObjectURL(blob);
    } catch (error) {
      console.error('[FileStorage] Error getting media URL:', error);
      return null;
    }
  }

  get courseData(): any {
    // This is a synchronous getter for compatibility
    // Returns cached data if available
    return null;
  }

  updateCourseData(metadata: any): void {
    // Queue the update to be saved
    this.saveCourseMetadata(metadata).catch(error => {
      console.error('[FileStorage] Error updating course data:', error);
    });
  }
  
  // SCORM and Settings Methods
  async saveScormConfig(config: any): Promise<void> {
    await this.saveContent('scormConfig', config);
  }
  
  async getScormConfig(): Promise<any> {
    return await this.getContent('scormConfig');
  }
  
  async saveAudioSettings(settings: any): Promise<void> {
    await this.saveContent('audioSettings', settings);
  }
  
  async getAudioSettings(): Promise<any> {
    return await this.getContent('audioSettings');
  }
  
  async saveAiPrompt(prompt: string): Promise<void> {
    await this.saveContent('aiPrompt', { prompt });
  }
  
  async getAiPrompt(): Promise<string | null> {
    const content = await this.getContent('aiPrompt');
    return content?.prompt || null;
  }
}

// Export a singleton instance
export const fileStorage = new FileStorage();