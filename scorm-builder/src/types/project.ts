import type { CourseSeedData } from './course'
import type { CourseContentUnion, Activity, Quiz } from './aiPrompt'
import type { PromptTuningSettings } from './promptTuning'
import type { CourseSettings } from '../components/CourseSettingsWizard'

export interface ProjectData {
  // Core project info
  courseTitle: string
  projectId?: string
  
  // Course configuration
  courseSeedData: CourseSeedData
  
  // Generated content
  courseContent?: CourseContentUnion
  aiPrompt?: string
  importedJSON?: string
  
  // Media and files
  mediaFiles?: Record<string, MediaFile>
  audioFiles?: Record<string, AudioFile>
  captionFiles?: Record<string, CaptionFile>
  
  // Custom data from various steps
  customTopics?: string[]
  activities?: Activity[] // Legacy format activities
  quiz?: Quiz // Legacy format quiz
  scormSettings?: ScormSettings
  promptTuningSettings?: PromptTuningSettings
  courseSettings?: CourseSettings
  
  // Workflow state
  currentStep: string
  lastModified: string
  
  // Additional metadata
  createdAt?: string
  version?: string
}

export interface MediaFile {
  type: 'image' | 'video'
  url: string
  filename: string
  size?: number
  mimeType?: string
}

export interface AudioFile {
  url: string
  filename: string
  duration?: number
  size?: number
}

export interface CaptionFile {
  content: string
  format: 'vtt' | 'srt'
  language?: string
}

export interface ScormSettings {
  packageTitle: string
  packageId: string
  organization: string
  launchPage?: string
  passingScore?: number
  requireAudioCompletion?: boolean
}

export interface SavedProject {
  id: string
  title: string
  lastModified: string
  template: string
  preview: string
  currentStep: string
  createdAt?: string
  size?: number
}

export interface SaveResult {
  success: boolean
  projectId?: string
  message?: string
  error?: string
}

export interface LoadResult {
  success: boolean
  data?: ProjectData
  error?: string
}

export interface DeleteResult {
  success: boolean
  message?: string
  error?: string
}

export interface ExportResult {
  success: boolean
  data?: string
  filename?: string
  error?: string
}

export interface ImportResult {
  success: boolean
  projectId?: string
  data?: ProjectData
  error?: string
}

// Hook for tracking unsaved changes
export interface UnsavedChanges {
  hasUnsavedChanges: boolean
  lastSaved: Date | null
  markAsModified: () => void
  markAsSaved: () => void
  reset: () => void
}