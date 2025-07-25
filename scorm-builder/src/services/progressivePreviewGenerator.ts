import type { CourseContent } from '../types/aiPrompt'
import type { CourseSeedData } from '../types/course'
import { sanitizeHTML } from '../utils/sanitization'
import { generateSCORMPlayerPreviewHTML } from './scormPlayerPreview'

// Mock data templates
const MOCK_TEMPLATES = {
  welcome: {
    content: `<h2>Welcome to {{courseTitle}}!</h2>
    <p>This course is designed to provide you with comprehensive knowledge and skills.</p>
    <p><strong>Difficulty Level:</strong> {{difficulty}}/5</p>
    <p>Click the Next button to continue to the learning objectives.</p>`,
    narration: 'Welcome to this exciting learning journey! This course has been carefully designed to help you master the subject matter at your own pace.'
  },
  objectives: {
    content: `<h2>Learning Objectives</h2>
    <p>By the end of this course, you will be able to:</p>
    <ul>
      <li>Understand the key concepts and principles</li>
      <li>Apply your knowledge in practical scenarios</li>
      <li>Demonstrate proficiency through assessments</li>
    </ul>`,
    narration: 'These learning objectives will guide your progress throughout the course. Take a moment to review them before proceeding.'
  },
  topic: {
    content: `<h2>{{topicTitle}}</h2>
    <p>This section covers important concepts related to {{topicTitle}}.</p>
    <p>Content is being prepared and will be available soon.</p>`,
    narration: 'This topic will provide you with essential knowledge and practical insights.'
  },
  assessment: {
    content: `<h2>Knowledge Check</h2>
    <p>Test your understanding of the course material.</p>
    <div class="assessment-placeholder">
      <p>Assessment questions will appear here once the course content is finalized.</p>
    </div>`,
    narration: 'Time to test your knowledge! Complete this assessment to reinforce your learning.'
  }
}

// Check if content has real data
function hasRealContent(content: any): boolean {
  if (!content) return false
  if (typeof content === 'string') {
    return content.trim().length > 0 && 
           !content.includes('being prepared') && 
           !content.includes('will be available')
  }
  return false
}

// Generate progressive preview HTML
export async function generateProgressivePreviewHTML(
  courseContent: CourseContent | null,
  courseSeedData: CourseSeedData,
  currentPageId: string = 'welcome'
): Promise<string> {
  // If we have complete course content, use the regular preview generator
  if (courseContent && courseContent.welcomePage && courseContent.topics && courseContent.topics.length > 0) {
    try {
      return generateSCORMPlayerPreviewHTML(courseContent, courseSeedData, currentPageId)
    } catch (error) {
      console.warn('Failed to generate full preview, falling back to progressive preview:', error)
    }
  }

  // Generate progressive preview with mock data where needed
  let isUsingMockData = false
  const getCurrentPageContent = () => {
    if (currentPageId === 'welcome') {
      const realContent = courseContent?.welcomePage
      if (realContent && hasRealContent(realContent.content)) {
        return {
          title: 'Welcome',
          content: realContent.content,
          narration: realContent.narration || MOCK_TEMPLATES.welcome.narration,
          media: []
        }
      }
      // Use mock data
      isUsingMockData = true
      return {
        title: 'Welcome',
        content: MOCK_TEMPLATES.welcome.content
          .replace('{{courseTitle}}', courseSeedData.courseTitle || 'the Course')
          .replace('{{difficulty}}', String(courseSeedData.difficulty || 3)),
        narration: MOCK_TEMPLATES.welcome.narration,
        media: []
      }
    } else if (currentPageId === 'objectives') {
      const realContent = courseContent?.learningObjectivesPage
      if (realContent && hasRealContent(realContent.content)) {
        return {
          title: 'Learning Objectives',
          content: realContent.content,
          narration: realContent.narration || MOCK_TEMPLATES.objectives.narration,
          media: []
        }
      }
      // Use mock data
      isUsingMockData = true
      return {
        title: 'Learning Objectives',
        content: MOCK_TEMPLATES.objectives.content,
        narration: MOCK_TEMPLATES.objectives.narration,
        media: []
      }
    } else if (currentPageId === 'assessment') {
      const realQuestions = courseContent?.assessment?.questions
      if (realQuestions && realQuestions.length > 0) {
        const questions = realQuestions.map((q, idx) => `
          <div class="assessment-question">
            <h3>Question ${idx + 1}</h3>
            <p>${sanitizeHTML(q.question)}</p>
            <div class="options">
              ${q.options?.map((opt, optIdx) => `
                <label class="option">
                  <input type="radio" name="q${idx}" value="${optIdx}">
                  <span>${sanitizeHTML(opt)}</span>
                </label>
              `).join('') || ''}
            </div>
          </div>
        `).join('')
        
        return {
          title: 'Assessment',
          content: questions,
          narration: 'Complete the assessment to test your knowledge.',
          media: []
        }
      }
      // Use mock data
      isUsingMockData = true
      return {
        title: 'Assessment',
        content: MOCK_TEMPLATES.assessment.content,
        narration: MOCK_TEMPLATES.assessment.narration,
        media: []
      }
    } else {
      // Topic page
      const topicIndex = parseInt(currentPageId.replace('topic-', ''))
      const topic = courseContent?.topics?.[topicIndex]
      
      if (topic && hasRealContent(topic.content)) {
        return {
          title: topic.title,
          content: topic.content,
          narration: topic.narration || MOCK_TEMPLATES.topic.narration,
          media: topic.media || []
        }
      }
      
      // Use mock data with topic from courseSeedData
      const topicTitle = courseSeedData.customTopics?.[topicIndex] || `Topic ${topicIndex + 1}`
      isUsingMockData = true
      return {
        title: topicTitle,
        content: MOCK_TEMPLATES.topic.content.replace(/{{topicTitle}}/g, topicTitle),
        narration: MOCK_TEMPLATES.topic.narration,
        media: []
      }
    }
  }
  
  const currentPage = getCurrentPageContent()
  const estimatedTopics = Math.max(
    courseSeedData.customTopics?.length || 3,
    courseContent?.topics?.length || 3
  )
  const totalPages = estimatedTopics + 3 // welcome + objectives + topics + assessment
  const currentPageIndex = currentPageId === 'welcome' ? 0 : 
                          currentPageId === 'objectives' ? 1 :
                          currentPageId === 'assessment' ? totalPages - 1 :
                          parseInt(currentPageId.replace('topic-', '')) + 2
  
  const progress = Math.round((currentPageIndex / (totalPages - 1)) * 100)
  
  // Generate the preview HTML
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${sanitizeHTML(courseSeedData.courseTitle || 'Course')} - Preview</title>
      <style>
        /* Preview Styles */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Century Gothic', sans-serif;
          background: #ffffff;
          height: 100vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .header {
          background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
          color: white;
          padding: 1rem 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }
        
        .header h1 {
          font-size: 1.5rem;
          font-weight: 600;
        }
        
        .progress-container {
          background: rgba(255, 255, 255, 0.2);
          height: 8px;
          border-radius: 4px;
          overflow: hidden;
          width: 200px;
        }
        
        .progress-bar {
          background: #fbbf24;
          height: 100%;
          width: ${progress}%;
          transition: width 0.3s ease;
        }
        
        .content-area {
          flex: 1;
          display: flex;
          overflow: hidden;
        }
        
        .main-content {
          flex: 1;
          padding: 3rem;
          overflow-y: auto;
          background: #f9fafb;
        }
        
        .content-wrapper {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 3rem;
          border-radius: 12px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .content-wrapper h2 {
          color: #1e293b;
          margin-bottom: 1.5rem;
          font-size: 2rem;
        }
        
        .content-wrapper h3 {
          color: #334155;
          margin: 1.5rem 0 1rem;
          font-size: 1.25rem;
        }
        
        .content-wrapper p {
          color: #475569;
          line-height: 1.6;
          margin-bottom: 1rem;
        }
        
        .content-wrapper ul, .content-wrapper ol {
          margin: 1rem 0 1rem 2rem;
          color: #475569;
        }
        
        .content-wrapper li {
          margin-bottom: 0.5rem;
          line-height: 1.6;
        }
        
        .navigation {
          background: white;
          padding: 1.5rem 2rem;
          border-top: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .nav-button {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 0.75rem 2rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }
        
        .nav-button:hover {
          background: #2563eb;
          transform: translateY(-1px);
        }
        
        .nav-button:disabled {
          background: #e5e7eb;
          color: #9ca3af;
          cursor: not-allowed;
          transform: none;
        }
        
        .page-indicator {
          color: #6b7280;
          font-size: 0.875rem;
        }
        
        .media-placeholder {
          background: #f3f4f6;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          color: #6b7280;
          margin: 1.5rem 0;
        }
        
        .assessment-question {
          background: #f9fafb;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        
        .assessment-question h3 {
          color: #1e293b;
          margin-bottom: 1rem;
        }
        
        .options {
          margin-top: 1rem;
        }
        
        .option {
          display: block;
          padding: 0.5rem 0;
          cursor: pointer;
        }
        
        .option input[type="radio"] {
          margin-right: 0.5rem;
        }
        
        .assessment-placeholder {
          background: #fef3c7;
          border: 1px solid #fcd34d;
          border-radius: 8px;
          padding: 2rem;
          text-align: center;
          color: #92400e;
          margin: 1.5rem 0;
        }
        
        .mock-indicator {
          background: #dbeafe;
          border: 1px solid #60a5fa;
          border-radius: 4px;
          padding: 0.5rem 1rem;
          margin-bottom: 1rem;
          color: #1e40af;
          font-size: 0.875rem;
          display: inline-block;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${sanitizeHTML(courseSeedData.courseTitle || 'Course Preview')}</h1>
        <div class="progress-container">
          <div class="progress-bar"></div>
        </div>
      </div>
      
      <div class="content-area">
        <div class="main-content">
          <div class="content-wrapper">
            ${isUsingMockData ? '<div class="mock-indicator">Preview Mode - Using Template Content</div>' : ''}
            <div>${sanitizeHTML(currentPage.content)}</div>
            
            ${currentPage.media && currentPage.media.length > 0 ? `
              <div class="media-section">
                ${currentPage.media.map(media => `
                  <div class="media-item">
                    ${media.type === 'image' ? 
                      `<img src="${media.url}" alt="Course image" style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0;">` :
                      `<video controls style="max-width: 100%; height: auto; border-radius: 8px; margin: 1rem 0;">
                        <source src="${media.url}" type="video/mp4">
                        Your browser does not support the video tag.
                      </video>`
                    }
                  </div>
                `).join('')}
              </div>
            ` : ''}
            
            ${currentPage.narration ? `
              <div style="margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb;">
                <h3 style="color: #6b7280; font-size: 1rem; margin-bottom: 0.5rem;">Narration</h3>
                <p style="color: #6b7280; font-style: italic;">${sanitizeHTML(currentPage.narration)}</p>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
      
      <div class="navigation">
        <button class="nav-button" onclick="window.parent.postMessage('previous', '*')" 
                ${currentPageIndex === 0 ? 'disabled' : ''}>
          ← Previous
        </button>
        <span class="page-indicator">
          Page ${currentPageIndex + 1} of ${totalPages}
        </span>
        <button class="nav-button" onclick="window.parent.postMessage('next', '*')"
                ${currentPageIndex === totalPages - 1 ? 'disabled' : ''}>
          Next →
        </button>
      </div>
    </body>
    </html>
  `
}