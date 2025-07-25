/**
 * Project Structure Types
 * Defines the file structure for SCORM Builder projects
 */

export interface ProjectStructure {
  projectFile: string;          // project.scormproj (JSON)
  mediaDir: {
    audio: string;              // media/audio/
    images: string;             // media/images/
    video: string;              // media/video/
  };
  captionsDir: string;          // captions/
  activitiesDir: string;        // activities/
  tempDir: string;              // temp/ (for recordings, etc.)
}

export interface MediaReference {
  id: string;                   // e.g., "audio-0001"
  filename: string;             // e.g., "0001-welcome.mp3"
  relativePath: string;         // e.g., "media/audio/0001-welcome.mp3"
  type: 'audio' | 'image' | 'video' | 'caption';
  size: number;                 // file size in bytes
  lastModified: number;         // timestamp
  metadata?: {
    blockNumber?: string;
    topicId?: string;
    duration?: number;          // for audio/video
    dimensions?: {              // for images/video
      width: number;
      height: number;
    };
  };
}

export interface ProjectManifest {
  version: string;              // e.g., "1.0.0"
  created: string;              // ISO date
  lastModified: string;         // ISO date
  media: MediaReference[];      // All media references
}