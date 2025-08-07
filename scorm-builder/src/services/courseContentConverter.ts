import type { 
  CourseContent, 
  LegacyCourseContent, 
  CourseContentUnion,
  KnowledgeCheckQuestion,
  LegacyTopic
} from '../types/aiPrompt'
import type { CourseMetadata } from '../types/metadata'
import type { EnhancedCourseContent } from '../types/scorm'
import type { Media } from '../types/aiPrompt'

// Type guard to check if content is new format
function isNewFormat(content: CourseContentUnion): content is CourseContent {
  return 'welcomePage' in content && 'learningObjectivesPage' in content && 'assessment' in content
}

// Helper function to resolve media URL
function resolveMediaUrl(media: Media | undefined, _projectId?: string): string | undefined {
  if (!media) return undefined
  
  // If we have a storageId, use that
  if ((media as any).storageId) {
    return (media as any).storageId
  }
  
  // If it's an external URL, keep it (will be downloaded during SCORM generation)
  if (media.url && (media.url.startsWith('http://') || media.url.startsWith('https://'))) {
    return media.url
  }
  
  // Otherwise, can't use it
  return undefined
}

// Export for testing
export const isNewFormatCourseContent = isNewFormat

export function convertToEnhancedCourseContent(
  courseContent: CourseContentUnion,
  metadata: CourseMetadata,
  projectId?: string
): EnhancedCourseContent {
  // Handle new format
  if (isNewFormat(courseContent)) {
    return convertNewFormat(courseContent, metadata, projectId)
  }
  
  // Handle old format
  return convertOldFormat(courseContent as LegacyCourseContent, metadata)
}

// Convert new format to enhanced format
function convertNewFormat(
  courseContent: CourseContent,
  metadata: CourseMetadata,
  projectId?: string
): EnhancedCourseContent {
    // Process welcome page media
    const welcomeMedia = courseContent.welcomePage.media || []
    const welcomeImageMedia = welcomeMedia.find(m => m.type === 'image')
    const welcomeVideoMedia = welcomeMedia.find(m => m.type === 'video')
    
    // Use simple file naming without topic/page names
    const getWelcomeAudioFile = () => {
      // Prefer audioId over audioFile
      if ((courseContent.welcomePage as any).audioId) {
        return (courseContent.welcomePage as any).audioId
      }
      if (courseContent.welcomePage.audioFile) {
        // If file already uses simple format, keep it
        if (courseContent.welcomePage.audioFile.match(/^audio-\d+\.(mp3|bin)$/)) {
          return courseContent.welcomePage.audioFile
        }
      }
      return courseContent.welcomePage.narration ? `audio-0.bin` : undefined
    }
    
    const getWelcomeCaptionFile = () => {
      // Prefer captionId over captionFile
      if ((courseContent.welcomePage as any).captionId) {
        return (courseContent.welcomePage as any).captionId
      }
      if (courseContent.welcomePage.captionFile) {
        // If file already uses simple format, keep it
        if (courseContent.welcomePage.captionFile.match(/^caption-\d+\.(vtt|bin)$/)) {
          return courseContent.welcomePage.captionFile
        }
      }
      return courseContent.welcomePage.narration ? `caption-0.bin` : undefined
    }
    
    const welcome = {
      title: courseContent.welcomePage.title,
      content: courseContent.welcomePage.content,
      startButtonText: 'Start Course',
      imageUrl: resolveMediaUrl(welcomeImageMedia, projectId),
      audioFile: getWelcomeAudioFile(),
      audioId: (courseContent.welcomePage as any).audioId,
      audioBlob: (courseContent.welcomePage as any).audioBlob,
      captionFile: getWelcomeCaptionFile(),
      captionId: (courseContent.welcomePage as any).captionId,
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
    
    const objectivesPage = {
      imageUrl: resolveMediaUrl(objectivesImageMedia, projectId),
      audioFile: (courseContent.learningObjectivesPage as any).audioId || courseContent.learningObjectivesPage.audioFile || (courseContent.learningObjectivesPage.narration ? `audio-1.bin` : undefined),
      audioId: (courseContent.learningObjectivesPage as any).audioId,
      audioBlob: (courseContent.learningObjectivesPage as any).audioBlob,
      captionFile: (courseContent.learningObjectivesPage as any).captionId || courseContent.learningObjectivesPage.captionFile || (courseContent.learningObjectivesPage.narration ? `caption-1.bin` : undefined),
      captionId: (courseContent.learningObjectivesPage as any).captionId,
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
      
      // Handle knowledge check from new format
      const knowledgeCheck = convertKnowledgeCheck(topic.knowledgeCheck)
      
      // Get media from topic if available
      const topicMedia = topic.media || []
      const imageMedia = topicMedia.find(m => m.type === 'image')
      const videoMedia = topicMedia.find(m => m.type === 'video')
      
      // Generate file names using simple numbering (no topic names)
      // Welcome is audio-0, objectives is audio-1, so topics start at audio-2
      const topicAudioIndex = index + 2
      const audioFile = (topic as any).audioId || topic.audioFile || (topic.narration ? `audio-${topicAudioIndex}.bin` : undefined)
      const captionFile = (topic as any).captionId || topic.captionFile || (topic.narration ? `caption-${topicAudioIndex}.bin` : undefined)
      const imageUrl = resolveMediaUrl(imageMedia, projectId) || 
        (topic.imagePrompts.length > 0 || topic.imageKeywords.length > 0
          ? `image-${index}.jpg`
          : undefined)
      const embedUrl = videoMedia?.embedUrl
      
      return {
        id: topic.id,
        title: topic.title,
        content: topic.content,
        imageUrl,
        audioFile,
        audioId: (topic as any).audioId,
        audioBlob: (topic as any).audioBlob,
        captionFile,
        captionId: (topic as any).captionId,
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
        const baseQuestion = {
          id: q.id,
          question: q.question,
          // Map feedback if it exists
          correct_feedback: q.feedback?.correct,
          incorrect_feedback: q.feedback?.incorrect
        }

        if (q.type === 'true-false') {
          return {
            ...baseQuestion,
            options: ['True', 'False'],
            correctAnswer: q.correctAnswer.toLowerCase() === 'true' ? 0 : 1
          }
        } else if (q.type === 'multiple-choice' && q.options) {
          return {
            ...baseQuestion,
            options: q.options,
            correctAnswer: q.options.indexOf(q.correctAnswer)
          }
        }
        // Default fallback
        return {
          ...baseQuestion,
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
  const enhancedTopics = courseContent.topics.map((topic, index) => {
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
    
    // Generate file names using simple numbering (no topic names)
    // Welcome is audio-0, objectives is audio-1, so topics start at audio-2
    const topicAudioIndex = index + 2
    const oldTopic = topic as LegacyTopic
    const audioFile = oldTopic.narration && oldTopic.narration.length > 0 
      ? `audio-${topicAudioIndex}.bin`
      : undefined
    const captionFile = oldTopic.narration && oldTopic.narration.length > 0
      ? `caption-${topicAudioIndex}.bin`
      : undefined
    const imageUrl = imageMedia 
      ? imageMedia.url // Use actual media URL
      : topic.imagePrompts.length > 0 || topic.imageKeywords.length > 0
      ? `image-${index}.jpg`
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
      // Convert string correctAnswer to numeric index
      const correctAnswerIndex = typeof firstQuestion.correctAnswer === 'string' 
        ? firstQuestion.options.indexOf(firstQuestion.correctAnswer)
        : firstQuestion.correctAnswer
      
      return {
        type: 'multiple-choice' as const,
        question: firstQuestion.question,
        options: firstQuestion.options,
        correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0, // Convert to index
        explanation: firstQuestion.feedback?.correct || firstQuestion.feedback?.incorrect || firstQuestion.explanation,
        feedback: firstQuestion.feedback // Preserve the feedback object
      }
    }
    
    // Handle true/false questions
    if (firstQuestion.type === 'true-false') {
      // Convert string correctAnswer to numeric index for true/false
      const correctAnswerIndex = typeof firstQuestion.correctAnswer === 'string'
        ? firstQuestion.correctAnswer.toLowerCase() === 'true' ? 0 : 1
        : firstQuestion.correctAnswer
      
      return {
        type: 'true-false' as const,
        question: firstQuestion.question,
        options: ['True', 'False'],
        correctAnswer: correctAnswerIndex, // Convert to index
        explanation: firstQuestion.feedback?.correct || firstQuestion.feedback?.incorrect || firstQuestion.explanation,
        feedback: firstQuestion.feedback // Preserve the feedback object
      }
    }
    
    // Handle fill-in-the-blank questions
    if (firstQuestion.type === 'fill-in-the-blank') {
      return {
        type: 'fill-in-the-blank' as const,
        blank: (firstQuestion as any).blank || firstQuestion.question, // Use blank property if it exists
        question: (firstQuestion as any).blank || firstQuestion.question, // Use blank for question too
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
        // Convert string correctAnswer to numeric index
        const correctAnswerIndex = typeof q.correctAnswer === 'string' 
          ? q.options.indexOf(q.correctAnswer)
          : q.correctAnswer
          
        return {
          ...q,
          correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0, // Convert to index
          explanation: q.feedback?.correct || q.feedback?.incorrect || q.explanation
        }
      } else if (q.type === 'true-false') {
        // Convert string correctAnswer to numeric index for true/false
        const correctAnswerIndex = typeof q.correctAnswer === 'string'
          ? q.correctAnswer.toLowerCase() === 'true' ? 0 : 1
          : q.correctAnswer
          
        return {
          ...q,
          type: 'multiple-choice' as const,
          options: ['True', 'False'],
          correctAnswer: correctAnswerIndex, // Convert to index
          explanation: q.feedback?.correct || q.feedback?.incorrect || q.explanation
        }
      } else if (q.type === 'fill-in-the-blank') {
        return {
          ...q,
          question: (q as any).blank || q.question, // Use blank property if it exists
          blank: (q as any).blank || q.question, // Use blank property if it exists
          correctAnswer: q.correctAnswer,
          explanation: q.feedback?.correct || q.feedback?.incorrect || q.explanation
        }
      }
      return q
    })
  }
}

