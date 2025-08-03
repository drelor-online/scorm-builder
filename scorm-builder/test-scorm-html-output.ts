// This script generates a test HTML file to debug why knowledge checks aren't showing
import { convertToRustFormat } from './src/services/rustScormGenerator'
import fs from 'fs/promises'

async function generateTestHTML() {
  // Mock FileStorage
  const mockFileStorage = {
    getMedia: async (projectId: string, mediaId: string) => {
      console.log(`Mock FileStorage.getMedia: ${projectId}, ${mediaId}`)
      return {
        data: new Uint8Array([255, 216, 255]), // Mock JPEG data
        mimeType: 'image/jpeg'
      }
    }
  }

  // Override the FileStorage import
  jest.mock('./src/services/FileStorage', () => ({
    FileStorage: mockFileStorage
  }))

  const courseContent = {
    title: 'Debug Test Course',
    topics: [
      {
        id: 'topic-1',
        title: 'Topic with KC',
        content: '<p>This is test content.</p>',
        imageUrl: 'image-test-123',
        knowledgeCheck: {
          type: 'multiple-choice',
          question: 'What is 2+2?',
          options: ['3', '4', '5', '6'],
          correctAnswer: 1,
          explanation: 'Two plus two equals four.'
        }
      }
    ]
  }

  const { courseData } = await convertToRustFormat(courseContent, 'test-project')
  
  // Log the converted data
  console.log('Converted courseData:', JSON.stringify(courseData, null, 2))
  
  // Generate sample HTML based on what the template should produce
  const sampleHTML = `
<div class="content-wrapper">
    <div class="topic-header">
        <h2>Topic with KC</h2>
    </div>
    
    <div class="two-column-layout">
        <!-- Left Column: Content and Knowledge Check -->
        <div class="content-column">
            <div class="topic-text">
                <p>This is test content.</p>
            </div>
            
            ${courseData.topics[0].knowledge_check ? `
            <div class="knowledge-check-container">
                <h3>Knowledge Check</h3>
                
                ${courseData.topics[0].knowledge_check.questions.map((q, index) => `
                <div class="kc-question-wrapper" data-question-index="${index}">
                    <p class="kc-question">${q.text}</p>
                    <div class="kc-options">
                        ${q.options?.map(option => `
                        <label class="kc-option">
                            <input type="radio" 
                                   name="q${index}" 
                                   value="${option}"
                                   data-correct="${q.correct_answer}"
                                   data-feedback="${q.explanation}">
                            <span>${option}</span>
                        </label>
                        `).join('')}
                    </div>
                    <button class="kc-submit" 
                            data-question-index="${index}"
                            onclick="window.submitMultipleChoice(${index})">
                        Submit Answer
                    </button>
                    <div id="feedback-${index}" class="feedback"></div>
                </div>
                `).join('')}
            </div>
            ` : '<!-- No knowledge check -->'}
        </div>
        
        <!-- Right Column: Media and Audio -->
        <div class="content-column media-column">
            ${courseData.topics[0].image_url ? `
            <div class="media-container">
                <img src="${courseData.topics[0].image_url}" alt="${courseData.topics[0].title}" class="topic-image" />
            </div>
            ` : '<!-- No image -->'}
        </div>
    </div>
</div>
`

  // Write to file for inspection
  await fs.writeFile('test-topic-output.html', sampleHTML)
  console.log('Sample HTML written to test-topic-output.html')
  
  // Also write the template data
  await fs.writeFile('test-template-data.json', JSON.stringify({
    id: courseData.topics[0].id,
    title: courseData.topics[0].title,
    content: courseData.topics[0].content,
    has_knowledge_check: !!courseData.topics[0].knowledge_check?.questions?.length,
    knowledge_check_questions: courseData.topics[0].knowledge_check?.questions || [],
    image_url: courseData.topics[0].image_url
  }, null, 2))
  console.log('Template data written to test-template-data.json')
}

generateTestHTML().catch(console.error)