// New format
export interface CourseContent {
  welcomePage: Page
  learningObjectivesPage: Page
  topics: Topic[]
  assessment: Assessment
  objectives?: string[] // Array of learning objectives
}

// Legacy format (for backward compatibility during transition)
export interface LegacyCourseContent {
  topics: LegacyTopic[]
  activities: Activity[]
  quiz: Quiz
}

// Type union to support both during transition
export type CourseContentUnion = CourseContent | LegacyCourseContent

export interface Page {
  id: string
  title: string
  content: string // HTML fragment
  narration: string // Single narration text
  imageKeywords: string[]
  imagePrompts: string[]
  videoSearchTerms: string[]
  duration: number // in minutes
  media?: Media[]
  audioFile?: string
  captionFile?: string
}

export interface Topic extends Page {
  knowledgeCheck?: KnowledgeCheck
}

export interface KnowledgeCheck {
  questions: KnowledgeCheckQuestion[]
}

export interface KnowledgeCheckQuestion {
  id: string
  type: 'multiple-choice' | 'true-false' | 'fill-in-the-blank'
  question: string
  options?: string[] // for multiple choice
  correctAnswer: string
  blank?: string // for fill-in-the-blank only
  explanation?: string // optional explanation
  feedback?: {
    correct: string
    incorrect: string
  }
}

export interface Media {
  id: string
  url: string
  title: string
  type: 'image' | 'video' | 'audio'
  thumbnail?: string
  embedUrl?: string
  photographer?: string
  source?: string
  dimensions?: string
  views?: string
  uploadedAt?: string
  channel?: string
  duration?: string
  blob?: Blob
  captionUrl?: string
  captionBlob?: Blob
  storageId?: string // Reference to persistent storage
}

export interface Assessment {
  questions: AssessmentQuestion[]
  passMark: number
  narration: null // No narration for assessment
}

export interface AssessmentQuestion {
  id: string
  type: 'multiple-choice' | 'true-false' | 'fill-in-the-blank'
  question: string
  options?: string[] // for multiple choice
  correctAnswer: string
  feedback: {
    correct: string
    incorrect: string
  }
}

// Legacy types for backward compatibility
export interface LegacyTopic {
  id: string
  title: string
  content: string
  bulletPoints: string[]
  narration: NarrationBlock[]
  imageKeywords: string[]
  imagePrompts: string[]
  videoSearchTerms?: string[]
  duration: number
  media?: Media[]
}

export interface NarrationBlock {
  id: string
  text: string
  blockNumber: string
}

// Activity content types
export interface MultipleChoiceContent {
  question: string
  options: string[]
  correctAnswer: number
}

export interface DragDropContent {
  items: Array<{ id: string; text: string }>
  targets: Array<{ id: string; label: string }>
  correctMapping: Record<string, string>
}

export interface HotspotContent {
  imageUrl: string
  hotspots: Array<{ id: string; x: number; y: number; label: string }>
}

export interface ScenarioContent {
  description: string
  choices: Array<{ id: string; text: string; outcome: string }>
}

export type ActivityContent = 
  | MultipleChoiceContent 
  | DragDropContent 
  | HotspotContent 
  | ScenarioContent
  | Record<string, never> // Empty object for activities without content

export interface Activity {
  id: string
  type: 'multiple-choice' | 'drag-drop' | 'hotspot' | 'scenario'
  title: string
  instructions: string
  content: ActivityContent
}

export interface Quiz {
  questions: QuizQuestion[]
  passMark: number
}

export interface QuizQuestion {
  id: string
  type: 'multiple-choice' | 'true-false' | 'fill-in-blank'
  question: string
  options?: string[]
  correctAnswer: string | string[]
  feedback?: {
    correct: string
    incorrect: string
  }
}
