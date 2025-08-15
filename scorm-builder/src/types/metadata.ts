export interface CourseMetadata {
  title: string
  identifier: string
  description?: string
  version: string
  scormVersion: string
  duration: number
  passMark: number
  // Optional SCORM-specific metadata fields
  createdAt?: string
  lastModified?: string
  totalPages?: number
  totalQuestions?: number
  packageSize?: number
  author?: string
  keywords?: string[]
  language?: string
}