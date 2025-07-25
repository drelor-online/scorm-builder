import type { 
  CourseContent, 
  LegacyCourseContent, 
  CourseContentUnion,
  KnowledgeCheckQuestion,
  LegacyTopic
} from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'
import type { EnhancedCourseContent } from './spaceEfficientScormGenerator'

// Type guard to check if content is new format
function isNewFormat(content: CourseContentUnion): content is CourseContent {
  return 'welcomePage' in content && 'learningObjectivesPage' in content && 'assessment' in content
}

// Export for testing
export const isNewFormatCourseContent = isNewFormat

export function convertToEnhancedCourseContent(
  courseContent: CourseContentUnion,
  metadata: CourseMetadata
): EnhancedCourseContent {
  // Handle new format
  if (isNewFormat(courseContent)) {
    return convertNewFormat(courseContent, metadata)
  }
  
  // Handle old format
  return convertOldFormat(courseContent as LegacyCourseContent, metadata)
}

// Convert new format to enhanced format
function convertNewFormat(
  courseContent: CourseContent,
  metadata: CourseMetadata
): EnhancedCourseContent {
    // Process welcome page media
    const welcomeMedia = courseContent.welcomePage.media || []
    const welcomeImageMedia = welcomeMedia.find(m => m.type === 'image')
    const welcomeVideoMedia = welcomeMedia.find(m => m.type === 'video')
    const welcomeSlug = 'welcome'
    
    // Fix audio file naming to ensure unique prefixes
    const getWelcomeAudioFile = () => {
      if (courseContent.welcomePage.audioFile) {
        // If file starts with 0001- but should be 0000-, fix it
        if (courseContent.welcomePage.audioFile.startsWith('0001-')) {
          return courseContent.welcomePage.audioFile.replace('0001-', '0000-')
        }
        return courseContent.welcomePage.audioFile
      }
      return courseContent.welcomePage.narration ? `0000-${welcomeSlug}.mp3` : undefined
    }
    
    const getWelcomeCaptionFile = () => {
      if (courseContent.welcomePage.captionFile) {
        // If file starts with 0001- but should be 0000-, fix it
        if (courseContent.welcomePage.captionFile.startsWith('0001-')) {
          return courseContent.welcomePage.captionFile.replace('0001-', '0000-')
        }
        return courseContent.welcomePage.captionFile
      }
      return courseContent.welcomePage.narration ? `0000-${welcomeSlug}.vtt` : undefined
    }
    
    const welcome = {
      title: courseContent.welcomePage.title,
      content: courseContent.welcomePage.content,
      startButtonText: 'Start Course',
      imageUrl: (welcomeImageMedia?.url && !welcomeImageMedia.url.startsWith('blob:')) ? welcomeImageMedia.url : undefined,
      audioFile: getWelcomeAudioFile(),
      audioBlob: (courseContent.welcomePage as any).audioBlob,
      captionFile: getWelcomeCaptionFile(),
      captionBlob: (courseContent.welcomePage as any).captionBlob,
      embedUrl: welcomeVideoMedia?.embedUrl,
      media: welcomeMedia.map(m => ({
        id: m.id,
        url: m.url,
        title: m.title,
        type: m.type,
        embedUrl: m.embedUrl,
        blob: (m as any).blob,
        captionUrl: (m as any).captionUrl,
        captionBlob: (m as any).captionBlob,
        storageId: (m as any).storageId
      }))
    }
    
    // Extract objectives from learningObjectivesPage
    const objectives = extractObjectivesFromNewFormat(courseContent.learningObjectivesPage.content)
    
    // Process objectives page media
    const objectivesMedia = courseContent.learningObjectivesPage.media || []
    const objectivesImageMedia = objectivesMedia.find(m => m.type === 'image')
    const objectivesVideoMedia = objectivesMedia.find(m => m.type === 'video')
    const objectivesSlug = 'objectives'
    
    const objectivesPage = {
      imageUrl: (objectivesImageMedia?.url && !objectivesImageMedia.url.startsWith('blob:')) ? objectivesImageMedia.url : undefined,
      audioFile: courseContent.learningObjectivesPage.audioFile || (courseContent.learningObjectivesPage.narration ? `0001-${objectivesSlug}.mp3` : undefined),
      audioBlob: (courseContent.learningObjectivesPage as any).audioBlob,
      captionFile: courseContent.learningObjectivesPage.captionFile || (courseContent.learningObjectivesPage.narration ? `0001-${objectivesSlug}.vtt` : undefined),
      captionBlob: (courseContent.learningObjectivesPage as any).captionBlob,
      embedUrl: objectivesVideoMedia?.embedUrl,
      media: objectivesMedia.map(m => ({
        id: m.id,
        url: m.url,
        title: m.title,
        type: m.type,
        embedUrl: m.embedUrl,
        blob: (m as any).blob,
        captionUrl: (m as any).captionUrl,
        captionBlob: (m as any).captionBlob,
        storageId: (m as any).storageId
      }))
    }
    
    // Convert topics with new format
    const enhancedTopics = courseContent.topics.map((topic, index) => {
      // Generate block number for audio files (starting from 1 for topics)
      const blockNumber = String(index + 1).padStart(4, '0')
      const topicSlug = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      
      // Handle knowledge check from new format
      const knowledgeCheck = convertKnowledgeCheck(topic.knowledgeCheck)
      
      // Get media from topic if available
      const topicMedia = topic.media || []
      const imageMedia = topicMedia.find(m => m.type === 'image')
      const videoMedia = topicMedia.find(m => m.type === 'video')
      
      // Generate file names
      const audioFile = topic.audioFile || (topic.narration ? `${blockNumber}-${topicSlug}.mp3` : undefined)
      const captionFile = topic.captionFile || (topic.narration ? `${blockNumber}-${topicSlug}.vtt` : undefined)
      const imageUrl = imageMedia && imageMedia.url && !imageMedia.url.startsWith('blob:')
        ? imageMedia.url
        : topic.imagePrompts.length > 0 || topic.imageKeywords.length > 0
        ? `${topicSlug}.jpg`
        : undefined
      const embedUrl = videoMedia?.embedUrl
      
      return {
        id: topic.id,
        title: topic.title,
        content: topic.content,
        imageUrl,
        audioFile,
        audioBlob: (topic as any).audioBlob,
        captionFile,
        captionBlob: (topic as any).captionBlob,
        embedUrl,
        knowledgeCheck,
        media: topicMedia.map(m => ({
          id: m.id,
          url: m.url,
          title: m.title,
          type: m.type,
          embedUrl: m.embedUrl,
          // blob and caption fields are not in the Media type but expected by EnhancedCourseContent
          blob: (m as any).blob,
          captionUrl: (m as any).captionUrl,
          captionBlob: (m as any).captionBlob,
          storageId: (m as any).storageId
        }))
      }
    })
    
    // Convert assessment from new format
    const assessment = {
      questions: courseContent.assessment.questions.map(q => {
        if (q.type === 'true-false') {
          return {
            id: q.id,
            question: q.question,
            options: ['True', 'False'],
            correctAnswer: q.correctAnswer.toLowerCase() === 'true' ? 0 : 1
          }
        } else if (q.type === 'multiple-choice' && q.options) {
          return {
            id: q.id,
            question: q.question,
            options: q.options,
            correctAnswer: q.options.indexOf(q.correctAnswer)
          }
        }
        // Default fallback
        return {
          id: q.id,
          question: q.question,
          options: q.options || [],
          correctAnswer: 0
        }
      })
    }
    
    // Calculate total duration from pages
    const totalDuration = 
      (courseContent.welcomePage.duration || 0) +
      (courseContent.learningObjectivesPage.duration || 0) +
      courseContent.topics.reduce((sum, topic) => sum + (topic.duration || 0), 0)
    
    return {
      title: metadata.title,
      duration: totalDuration,
      passMark: courseContent.assessment.passMark || 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome,
      objectives,
      objectivesPage,
      topics: enhancedTopics,
      assessment
    }
}

// Convert old format to enhanced format
function convertOldFormat(
  courseContent: LegacyCourseContent,
  metadata: CourseMetadata
): EnhancedCourseContent {
  const welcome = {
    title: `Welcome to ${metadata.title}`,
    content: `Welcome to ${metadata.title}. ${metadata.description || 'This course will help you learn important concepts and skills.'}`,
    startButtonText: 'Start Course'
  }
  
  // Extract objectives from topics or use empty array
  const objectives = extractObjectives(courseContent as LegacyCourseContent)
  
  // Convert topics
  const enhancedTopics = courseContent.topics.map((topic) => {
    // Find any activity that might be a knowledge check for this topic
    const topicActivity = (courseContent as LegacyCourseContent).activities?.find(
      activity => activity.type === 'multiple-choice' && 
      (activity.title.toLowerCase().includes('check') || 
       activity.title.toLowerCase().includes('review'))
    )
    
    // Convert activity to knowledge check if found
    let knowledgeCheck = undefined
    if (topicActivity && topicActivity.type === 'multiple-choice' && topicActivity.content) {
      // Type guard for multiple choice content
      const content = topicActivity.content as any // Legacy format may not match our types exactly
      if (content.question || content.options) {
        knowledgeCheck = {
          question: content.question || topicActivity.instructions,
          options: content.options || [],
          correctAnswer: content.options && content.correctAnswer 
            ? content.options.indexOf(content.correctAnswer) 
            : 0
        }
      }
    }
    
    // Get media from topic.media if available
    const legacyTopic = topic as LegacyTopic
    const topicMedia = legacyTopic.media || []
    const imageMedia = topicMedia.find((m) => m.type === 'image')
    const videoMedia = topicMedia.find((m) => m.type === 'video')
    
    // Generate file names for old format
    const topicSlug = topic.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const oldTopic = topic as LegacyTopic
    const audioFile = oldTopic.narration && oldTopic.narration.length > 0 
      ? `${oldTopic.narration[0].blockNumber}-${topicSlug}.mp3`
      : undefined
    const captionFile = oldTopic.narration && oldTopic.narration.length > 0
      ? `${oldTopic.narration[0].blockNumber}-${topicSlug}.vtt`
      : undefined
    const imageUrl = imageMedia 
      ? imageMedia.url // Use actual media URL
      : topic.imagePrompts.length > 0 || topic.imageKeywords.length > 0
      ? `${topicSlug}.jpg`
      : undefined
    const embedUrl = videoMedia?.embedUrl
    
    return {
      id: topic.id,
      title: topic.title,
      content: formatContent(topic),
      imageUrl,
      audioFile,
      captionFile,
      embedUrl,
      knowledgeCheck,
      media: topicMedia.map(m => ({
        id: m.id,
        url: m.url,
        title: m.title,
        type: m.type,
        embedUrl: m.embedUrl,
        blob: (m as any).blob,
        captionUrl: (m as any).captionUrl,
        captionBlob: (m as any).captionBlob
      }))
    }
  })
  
  // Convert quiz to assessment (old format)
  const assessment = {
    questions: courseContent.quiz.questions.map(q => ({
      id: q.id,
      question: q.question,
      options: q.options || [],
      correctAnswer: typeof q.correctAnswer === 'string' && q.options
        ? q.options.indexOf(q.correctAnswer)
        : typeof q.correctAnswer === 'number'
        ? q.correctAnswer
        : 0
    }))
  }
  
  return {
    title: metadata.title,
    duration: metadata.duration,
    passMark: metadata.passMark,
    navigationMode: 'linear',
    allowRetake: true,
    welcome,
    objectives,
    topics: enhancedTopics,
    assessment
  }
}

function extractObjectivesFromNewFormat(content: string): string[] {
  // Parse HTML content to extract list items as objectives
  const objectives: string[] = []
  
  // Simple regex to extract content from <li> tags
  const liRegex = /<li[^>]*>(.*?)<\/li>/gi
  let match
  
  while ((match = liRegex.exec(content)) !== null) {
    // Clean up the text by removing any inner HTML tags
    const cleanText = match[1].replace(/<[^>]*>/g, '').trim()
    if (cleanText) {
      objectives.push(cleanText)
    }
  }
  
  return objectives
}

function extractObjectives(courseContent: LegacyCourseContent): string[] {
  // Try to extract objectives from content or return empty array
  const objectives: string[] = []
  
  // Check if any topic mentions objectives or learning outcomes
  courseContent.topics.forEach(topic => {
    const oldTopic = topic as LegacyTopic
    if (topic.title.toLowerCase().includes('objective') || 
        topic.title.toLowerCase().includes('learning outcome')) {
      // Extract bullet points as objectives if they exist
      if (oldTopic.bulletPoints && Array.isArray(oldTopic.bulletPoints)) {
        objectives.push(...oldTopic.bulletPoints)
      }
    }
  })
  
  // If no objectives found, create basic ones from topics
  if (objectives.length === 0 && courseContent.topics.length > 0) {
    // Don't auto-generate objectives, let them be empty
    return []
  }
  
  return objectives
}

function formatContent(topic: LegacyTopic): string {
  let content = topic.content
  
  // Add bullet points if they exist
  if (topic.bulletPoints && topic.bulletPoints.length > 0) {
    content += '\n\n' + topic.bulletPoints.map((point: string) => `• ${point}`).join('\n')
  }
  
  return content
}

// Convert knowledge check questions to the simplified format
function convertKnowledgeCheck(knowledgeCheck?: { questions: KnowledgeCheckQuestion[] }) {
  if (!knowledgeCheck || knowledgeCheck.questions.length === 0) {
    return undefined
  }
  
  // If there's only one question, return the simplified format
  if (knowledgeCheck.questions.length === 1) {
    const firstQuestion = knowledgeCheck.questions[0]
    
    // Handle multiple-choice questions
    if (firstQuestion.type === 'multiple-choice' && firstQuestion.options) {
      return {
        type: 'multiple-choice' as const,
        question: firstQuestion.question,
        options: firstQuestion.options,
        correctAnswer: firstQuestion.correctAnswer, // Keep as text, don't convert to index
        explanation: firstQuestion.feedback?.correct || firstQuestion.feedback?.incorrect || firstQuestion.explanation,
        feedback: firstQuestion.feedback // Preserve the feedback object
      }
    }
    
    // Handle true/false questions
    if (firstQuestion.type === 'true-false') {
      return {
        type: 'true-false' as const,
        question: firstQuestion.question,
        options: ['True', 'False'],
        correctAnswer: firstQuestion.correctAnswer, // Keep as text
        explanation: firstQuestion.feedback?.correct || firstQuestion.feedback?.incorrect || firstQuestion.explanation,
        feedback: firstQuestion.feedback // Preserve the feedback object
      }
    }
    
    // Handle fill-in-the-blank questions
    if (firstQuestion.type === 'fill-in-the-blank') {
      return {
        type: 'fill-in-the-blank' as const,
        blank: firstQuestion.question, // The question with _____ blank
        question: firstQuestion.question,
        correctAnswer: firstQuestion.correctAnswer,
        explanation: firstQuestion.feedback?.correct || firstQuestion.feedback?.incorrect || firstQuestion.explanation,
        feedback: firstQuestion.feedback // Preserve the feedback object
      }
    }
  }
  
  // For multiple questions, return the full questions array
  // We need to provide a dummy correctAnswer for the top level to satisfy the type
  return {
    type: 'multiple-choice' as const,
    correctAnswer: 0, // Dummy value, not used when questions array is present
    questions: knowledgeCheck.questions.map(q => {
      if (q.type === 'multiple-choice' && q.options) {
        return {
          ...q,
          correctAnswer: q.correctAnswer, // Keep as text, don't convert to index
          explanation: q.feedback?.correct || q.feedback?.incorrect || q.explanation
        }
      } else if (q.type === 'true-false') {
        return {
          ...q,
          type: 'multiple-choice' as const,
          options: ['True', 'False'],
          correctAnswer: q.correctAnswer, // Keep as text
          explanation: q.feedback?.correct || q.feedback?.incorrect || q.explanation
        }
      } else if (q.type === 'fill-in-the-blank') {
        return {
          ...q,
          question: q.question,
          blank: q.question,
          correctAnswer: q.correctAnswer,
          explanation: q.feedback?.correct || q.feedback?.incorrect || q.explanation
        }
      }
      return q
    })
  }
}

