/**
 * SCORM-related type definitions
 * These types are used by both the Rust SCORM generator and other parts of the application
 */

// Export topic type for convenience
export type EnhancedTopic = EnhancedCourseContent['topics'][0]

export interface EnhancedCourseContent {
  title: string
  duration: number // minutes
  passMark: number // percentage
  navigationMode: "linear" | "free"
  allowRetake: boolean
  welcome: {
    title: string
    content: string
    startButtonText: string
    imageUrl?: string
    audioFile?: string
    audioBlob?: Blob
    captionFile?: string
    captionBlob?: Blob
    embedUrl?: string
    media?: Array<{
      id: string
      url: string
      title: string
      type: 'image' | 'video' | 'audio'
      embedUrl?: string
      blob?: Blob
      captionUrl?: string
      captionBlob?: Blob
    }>
  }
  objectives: string[]
  objectivesPage?: {
    imageUrl?: string
    audioFile?: string
    audioBlob?: Blob
    captionFile?: string
    captionBlob?: Blob
    embedUrl?: string
    media?: Array<{
      id: string
      url: string
      title: string
      type: 'image' | 'video' | 'audio'
      embedUrl?: string
      blob?: Blob
      captionUrl?: string
      captionBlob?: Blob
    }>
  }
  learningObjectivesPage?: {
    objectives?: string[]
    imageUrl?: string
    audioFile?: string
    audioBlob?: Blob
    captionFile?: string
    captionBlob?: Blob
    embedUrl?: string
    media?: Array<{
      id: string
      url: string
      title: string
      type: 'image' | 'video' | 'audio'
      embedUrl?: string
      blob?: Blob
      captionUrl?: string
      captionBlob?: Blob
    }>
  }
  topics: Array<{
    id: string
    title: string
    content: string
    imageUrl?: string
    audioFile?: string
    audioBlob?: Blob
    captionFile?: string
    captionBlob?: Blob
    embedUrl?: string
    knowledgeCheck?: {
      type?: 'multiple-choice' | 'true-false' | 'fill-in-the-blank'
      question?: string
      blank?: string // For fill-in-the-blank: question with _____
      options?: string[]
      correctAnswer: number | string // number for MC/TF, string for fill-in-blank
      explanation?: string
      // Support for multiple questions
      questions?: Array<{
        id?: string
        type: 'multiple-choice' | 'true-false' | 'fill-in-the-blank'
        question: string
        blank?: string
        options?: string[]
        correctAnswer: number | string
        explanation?: string
      }>
    }
    media?: Array<{
      id: string
      url: string
      title: string
      type: 'image' | 'video' | 'audio'
      embedUrl?: string
      blob?: Blob
      captionUrl?: string
      captionBlob?: Blob
    }>
  }>
  assessment: {
    questions: Array<{
      id: string
      question: string
      options: string[]
      correctAnswer: number
    }>
  }
  audioDurations?: Record<string, number> // Map of audio file names to their durations in seconds
}

export interface GeneratorResult {
  buffer: Uint8Array
}

// Re-export CourseContent type for compatibility
export type { CourseContent } from './course'