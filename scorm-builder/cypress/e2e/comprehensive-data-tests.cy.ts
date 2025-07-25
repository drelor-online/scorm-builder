describe('SCORM Builder - Comprehensive Data Persistence Tests', () => {
  beforeEach(() => {
    cy.visit('/')
    // Clear any existing data by going to IndexedDB
    cy.window().then((win) => {
      win.indexedDB.deleteDatabase('SCORMBuilderDB')
    })
    cy.reload()
  })

  describe('Test 1: Data Persistence Across Pages', () => {
    it('should persist all data when navigating forward through pages', () => {
      // Create a new project
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Data Persistence Test Project')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Wait for navigation
      cy.contains('h1', 'Course Configuration').should('be.visible')
      
      // Step 1: Course Configuration - Enter comprehensive data
      const courseData = {
        title: 'Advanced Customer Service Training 2024',
        description: 'This comprehensive course covers all aspects of modern customer service including digital channels, AI integration, and emotional intelligence.',
        topics: `Module 1: Understanding Modern Customers
- Digital natives vs traditional customers
- Multi-channel expectations
- The importance of personalization

Module 2: Communication Excellence
- Active listening techniques
- Empathy in digital communications
- Managing difficult conversations

Module 3: Technology Integration
- Using CRM systems effectively
- AI-powered support tools
- Social media customer service

Module 4: Measuring Success
- Key performance indicators
- Customer satisfaction metrics
- Continuous improvement strategies`
      }
      
      cy.get('input[placeholder="Enter your course title"]').clear().type(courseData.title)
      cy.get('textarea[placeholder*="brief description"]').type(courseData.description)
      cy.contains('button', 'Expert').click()
      cy.get('textarea[placeholder*="List your course topics"]').type(courseData.topics)
      
      // Navigate to next page
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Step 2: AI Prompt Generator - Verify data persisted and add prompt
      cy.contains('h1', 'AI Prompt Generator').should('be.visible')
      cy.contains(courseData.title).should('be.visible')
      
      // Navigate to next page
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Step 3: JSON Import - Add valid JSON
      cy.contains('h1', 'JSON Import & Validation').should('be.visible')
      
      const courseJson = {
        "welcomePage": {
          "id": "welcome-page",
          "title": "Welcome to " + courseData.title,
          "content": `<div class="welcome-container">
            <h1>${courseData.title}</h1>
            <p>${courseData.description}</p>
            <p>This course consists of 4 comprehensive modules designed to transform your customer service skills.</p>
          </div>`,
          "narration": "Welcome to the Advanced Customer Service Training course for 2024. Over the next several modules, you'll learn cutting-edge techniques for delivering exceptional customer experiences.",
          "imageKeywords": ["customer service", "professional", "training", "modern office"],
          "duration": 3
        },
        "learningObjectivesPage": {
          "id": "objectives-page",
          "title": "Learning Objectives",
          "content": `<div class="objectives-container">
            <h2>By completing this course, you will be able to:</h2>
            <ul>
              <li>Identify and adapt to different customer communication preferences</li>
              <li>Apply active listening and empathy techniques in digital communications</li>
              <li>Utilize modern technology tools to enhance customer service efficiency</li>
              <li>Measure and improve customer satisfaction using data-driven approaches</li>
            </ul>
          </div>`,
          "narration": "Let's review the key learning objectives for this course. By the end, you'll have mastered four critical competencies.",
          "duration": 2
        },
        "topics": [
          {
            "id": "module-1",
            "title": "Understanding Modern Customers",
            "content": `<div class="module-content">
              <h2>Module 1: Understanding Modern Customers</h2>
              <h3>Digital Natives vs Traditional Customers</h3>
              <p>Today's customer base spans multiple generations, each with unique expectations and communication preferences.</p>
              <h4>Digital Natives (Gen Z & Millennials):</h4>
              <ul>
                <li>Expect instant responses (under 1 minute for chat)</li>
                <li>Prefer self-service options</li>
                <li>Value authenticity and transparency</li>
              </ul>
              <h4>Traditional Customers (Gen X & Boomers):</h4>
              <ul>
                <li>Value personal relationships</li>
                <li>Prefer phone or in-person support</li>
                <li>Appreciate detailed explanations</li>
              </ul>
            </div>`,
            "narration": "In this module, we'll explore how customer expectations have evolved and how to adapt your service approach for different customer segments.",
            "duration": 8,
            "imageKeywords": ["diverse customers", "multi-generational", "digital communication"],
            "knowledgeCheck": {
              "questions": [
                {
                  "id": "kc-1-1",
                  "type": "multiple-choice",
                  "question": "What response time do digital natives typically expect for chat support?",
                  "options": ["Under 1 minute", "5-10 minutes", "Within 24 hours", "Within 1 hour"],
                  "correctAnswer": "Under 1 minute",
                  "explanation": "Digital natives have grown up with instant messaging and expect near-immediate responses in chat support.",
                  "feedback": {
                    "correct": "Excellent! You understand the high expectations digital natives have for response times.",
                    "incorrect": "Not quite. Digital natives expect much faster responses - typically under 1 minute for chat support."
                  }
                }
              ]
            }
          },
          {
            "id": "module-2",
            "title": "Communication Excellence",
            "content": `<div class="module-content">
              <h2>Module 2: Communication Excellence</h2>
              <h3>Active Listening in the Digital Age</h3>
              <p>Active listening remains crucial, but the techniques must adapt to digital channels.</p>
              <h4>Digital Active Listening Techniques:</h4>
              <ol>
                <li><strong>Acknowledge receipt:</strong> "I've received your message and I'm reviewing your concern."</li>
                <li><strong>Paraphrase understanding:</strong> "Let me make sure I understand correctly..."</li>
                <li><strong>Ask clarifying questions:</strong> "Can you help me understand more about when this issue started?"</li>
                <li><strong>Summarize before solving:</strong> "So the main issues are X, Y, and Z. Is that correct?"</li>
              </ol>
            </div>`,
            "narration": "Communication excellence is the cornerstone of exceptional customer service. Let's explore how to apply active listening techniques in digital channels.",
            "duration": 10,
            "videoSearchTerms": ["active listening customer service", "empathy in communication"],
            "knowledgeCheck": {
              "questions": [
                {
                  "id": "kc-2-1",
                  "type": "true-false",
                  "question": "In digital communications, it's important to acknowledge that you've received the customer's message before providing a solution.",
                  "correctAnswer": "true",
                  "explanation": "Acknowledging receipt shows the customer that their message has been received and is being addressed, reducing anxiety.",
                  "feedback": {
                    "correct": "That's right! Acknowledgment is a crucial first step in digital active listening.",
                    "incorrect": "Actually, acknowledging receipt is very important in digital communications where customers can't see you working on their issue."
                  }
                }
              ]
            }
          }
        ],
        "assessment": {
          "questions": [
            {
              "id": "final-1",
              "type": "multiple-choice",
              "question": "A Gen Z customer contacts support via chat at 2:15 PM. By what time should you ideally respond?",
              "options": ["2:16 PM", "2:30 PM", "3:15 PM", "End of business day"],
              "correctAnswer": "2:16 PM",
              "feedback": {
                "correct": "Perfect! Gen Z customers expect responses within 1 minute on chat platforms.",
                "incorrect": "Remember, digital natives expect much faster response times - ideally under 1 minute for chat."
              }
            },
            {
              "id": "final-2",
              "type": "multiple-choice",
              "question": "Which of the following is NOT a digital active listening technique?",
              "options": [
                "Acknowledging receipt of the message",
                "Immediately offering a solution without questions",
                "Paraphrasing to confirm understanding",
                "Asking clarifying questions"
              ],
              "correctAnswer": "Immediately offering a solution without questions",
              "feedback": {
                "correct": "Correct! Jumping to solutions without understanding the full context is poor listening.",
                "incorrect": "Think about what active listening means - it's about understanding before solving."
              }
            },
            {
              "id": "final-3",
              "type": "true-false",
              "question": "Traditional customers (Gen X and Boomers) generally prefer self-service options over personal support.",
              "correctAnswer": "false",
              "feedback": {
                "correct": "That's right! Traditional customers typically value personal relationships and prefer phone or in-person support.",
                "incorrect": "Actually, traditional customers generally prefer personal support over self-service options."
              }
            }
          ],
          "passMark": 80,
          "narration": null
        }
      }
      
      cy.get('textarea').first().type(JSON.stringify(courseJson), {parseSpecialCharSequences: false, delay: 0})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(2000)
      
      // Navigate to Media Enhancement
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Step 4: Media Enhancement - Upload multiple files
      cy.contains('h1', 'Media Enhancement').should('be.visible')
      
      // Create test files
      const imageFile1 = new File(['image1 content'], 'customer-service-1.jpg', { type: 'image/jpeg' })
      const imageFile2 = new File(['image2 content'], 'customer-service-2.jpg', { type: 'image/jpeg' })
      const videoFile = new File(['video content'], 'training-intro.mp4', { type: 'video/mp4' })
      
      // Upload files
      cy.get('input[type="file"][accept*="image"]').selectFile([imageFile1, imageFile2], { force: true })
      cy.wait(1000)
      
      // Navigate to Audio
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Step 5: Audio Narration - Add audio settings
      cy.contains('h1', 'Audio Narration Wizard').should('be.visible')
      
      // Select voice settings
      cy.get('select').first().select('en-US-JennyNeural')
      cy.get('input[type="range"]').first().invoke('val', 1.1).trigger('change')
      
      // Verify all pages have narration text from JSON
      cy.contains('Welcome to the Advanced Customer Service Training course').should('be.visible')
      
      // Now navigate backwards and verify all data persists
      cy.contains('button', 'Back').click()
      cy.wait(1000)
      
      // Verify Media page still has uploaded files
      cy.contains('h1', 'Media Enhancement').should('be.visible')
      cy.contains('customer-service-1.jpg').should('be.visible')
      cy.contains('customer-service-2.jpg').should('be.visible')
      
      cy.contains('button', 'Back').click()
      cy.wait(1000)
      
      // Verify JSON page still has the JSON
      cy.contains('h1', 'JSON Import & Validation').should('be.visible')
      cy.get('textarea').first().should('contain', 'Welcome to Advanced Customer Service Training')
      
      cy.contains('button', 'Back').click()
      cy.wait(1000)
      
      // Skip AI Prompt page
      cy.contains('button', 'Back').click()
      cy.wait(1000)
      
      // Verify Course Configuration still has all data
      cy.contains('h1', 'Course Configuration').should('be.visible')
      cy.get('input[placeholder="Enter your course title"]').should('have.value', courseData.title)
      cy.get('textarea[placeholder*="brief description"]').should('have.value', courseData.description)
      cy.get('textarea[placeholder*="List your course topics"]').should('have.value', courseData.topics)
      cy.get('button[aria-pressed="true"]').contains('Expert').should('exist')
    })
  })

  describe('Test 2: Bidirectional Navigation Data Persistence', () => {
    it('should maintain all data when navigating back and forth multiple times', () => {
      // Create project
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Bidirectional Navigation Test')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Add data to first page
      const originalTitle = 'Original Course Title for Testing'
      const updatedTitle = 'Updated Course Title After Navigation'
      
      cy.get('input[placeholder="Enter your course title"]').clear().type(originalTitle)
      cy.get('textarea[placeholder*="brief description"]').type('Original description that should persist')
      cy.contains('button', 'Beginner').click()
      
      // Go forward two pages
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Add JSON data
      const testJson = {
        "welcomePage": {
          "id": "wp-1",
          "title": originalTitle,
          "content": "<p>Welcome content</p>",
          "narration": "Welcome narration"
        },
        "learningObjectivesPage": {
          "id": "lo-1",
          "title": "Objectives",
          "content": "<p>Objectives content</p>",
          "narration": "Objectives narration"
        },
        "topics": [{
          "id": "t-1",
          "title": "Topic 1",
          "content": "<p>Topic content</p>",
          "narration": "Topic narration"
        }],
        "assessment": {
          "questions": [{
            "id": "q-1",
            "type": "true-false",
            "question": "Test question?",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Good!",
              "incorrect": "Try again"
            }
          }]
        }
      }
      
      cy.get('textarea').first().type(JSON.stringify(testJson), {parseSpecialCharSequences: false, delay: 0})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      
      // Go back to first page
      cy.get('[data-testid="progress-step-0"]').click()
      cy.wait(1000)
      
      // Update the title
      cy.get('input[placeholder="Enter your course title"]').clear().type(updatedTitle)
      
      // Navigate forward to JSON page
      cy.get('[data-testid="progress-step-2"]').click()
      cy.wait(1000)
      
      // Verify JSON is still there
      cy.get('textarea').first().should('contain', 'welcomePage')
      
      // Go back to verify updated title persisted
      cy.get('[data-testid="progress-step-0"]').click()
      cy.wait(1000)
      cy.get('input[placeholder="Enter your course title"]').should('have.value', updatedTitle)
      
      // Go forward to Media page
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Upload a file on media page
      const testImage = new File(['test image'], 'test-image.png', { type: 'image/png' })
      cy.get('input[type="file"][accept*="image"]').selectFile(testImage, { force: true })
      cy.wait(1000)
      
      // Go all the way back to first page
      cy.get('[data-testid="progress-step-0"]').click()
      cy.wait(1000)
      
      // Then all the way forward to media
      cy.get('[data-testid="progress-step-3"]').click()
      cy.wait(1000)
      
      // Verify image is still there
      cy.contains('test-image.png').should('be.visible')
    })
  })

  describe('Test 3: Clean Project Start', () => {
    it('should have completely clean data when creating a new project', () => {
      // Create first project with lots of data
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('First Project With Data')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Fill first project with data
      const firstProjectData = {
        title: 'First Project Course Title',
        description: 'This is specific to the first project only',
        topics: 'Topic A\nTopic B\nTopic C'
      }
      
      cy.get('input[placeholder="Enter your course title"]').clear().type(firstProjectData.title)
      cy.get('textarea[placeholder*="brief description"]').type(firstProjectData.description)
      cy.contains('button', 'Advanced').click()
      cy.get('textarea[placeholder*="List your course topics"]').type(firstProjectData.topics)
      
      // Navigate forward and add more data
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Add JSON to first project
      const firstProjectJson = {
        "welcomePage": {
          "id": "fp-wp",
          "title": "First Project Welcome",
          "content": "<p>First project specific content</p>",
          "narration": "First project narration"
        },
        "learningObjectivesPage": {
          "id": "fp-lo",
          "title": "First Project Objectives",
          "content": "<p>First project objectives</p>",
          "narration": "First project objectives narration"
        },
        "topics": [{
          "id": "fp-t1",
          "title": "First Project Topic",
          "content": "<p>First project topic content</p>",
          "narration": "First project topic narration"
        }],
        "assessment": {
          "questions": [{
            "id": "fp-q1",
            "type": "multiple-choice",
            "question": "First project question?",
            "options": ["A", "B", "C", "D"],
            "correctAnswer": "A",
            "feedback": {
              "correct": "First project correct",
              "incorrect": "First project incorrect"
            }
          }]
        }
      }
      
      cy.get('textarea').first().type(JSON.stringify(firstProjectJson), {parseSpecialCharSequences: false, delay: 0})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      
      // Go to media page and upload file
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      const firstProjectImage = new File(['first project image'], 'first-project.jpg', { type: 'image/jpeg' })
      cy.get('input[type="file"][accept*="image"]').selectFile(firstProjectImage, { force: true })
      cy.wait(1000)
      
      // Now go back to dashboard
      cy.visit('/')
      cy.wait(1000)
      
      // Create second project
      cy.contains('button', 'Create New Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Second Clean Project')
      cy.get('[role="dialog"] button').contains('Create').click()
      cy.wait(1000)
      
      // Verify second project is completely clean
      // Title should only have the project name
      cy.get('input[placeholder="Enter your course title"]').should('have.value', 'Second Clean Project')
      
      // Description should be empty
      cy.get('textarea[placeholder*="brief description"]').should('have.value', '')
      
      // Topics should be empty
      cy.get('textarea[placeholder*="List your course topics"]').should('have.value', '')
      
      // No difficulty should be selected
      cy.get('button[aria-pressed="true"]').should('not.exist')
      
      // Navigate to JSON page
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // JSON textarea should be empty
      cy.get('textarea').first().should('have.value', '')
      
      // Navigate to media page
      cy.get('button').contains('Validate JSON').should('be.disabled')
      
      // Add minimal JSON to proceed
      const secondProjectJson = {
        "welcomePage": {
          "id": "sp-wp",
          "title": "Second Project",
          "content": "<p>Second</p>",
          "narration": "Second"
        },
        "learningObjectivesPage": {
          "id": "sp-lo",
          "title": "Second Objectives",
          "content": "<p>Second</p>",
          "narration": "Second"
        },
        "topics": [{
          "id": "sp-t1",
          "title": "Second Topic",
          "content": "<p>Second</p>",
          "narration": "Second"
        }],
        "assessment": {
          "questions": [{
            "id": "sp-q1",
            "type": "true-false",
            "question": "Second?",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Yes",
              "incorrect": "No"
            }
          }]
        }
      }
      
      cy.get('textarea').first().type(JSON.stringify(secondProjectJson), {parseSpecialCharSequences: false, delay: 0})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Media page should have no files from first project
      cy.contains('first-project.jpg').should('not.exist')
      
      // Go back to dashboard and back to first project
      cy.visit('/')
      cy.wait(1000)
      cy.get('[data-testid="project-card"]').contains('First Project With Data').click()
      cy.wait(1000)
      
      // Verify first project data is intact
      cy.get('input[placeholder="Enter your course title"]').should('have.value', firstProjectData.title)
      cy.get('textarea[placeholder*="brief description"]').should('have.value', firstProjectData.description)
      cy.get('textarea[placeholder*="List your course topics"]').should('have.value', firstProjectData.topics)
      cy.get('button[aria-pressed="true"]').contains('Advanced').should('exist')
    })
  })

  describe('Test 4: File Upload Handling', () => {
    it('should handle multiple simultaneous file uploads without locking up', () => {
      // Create project
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('File Upload Test')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Navigate quickly to media page
      cy.contains('button', 'Next').click()
      cy.wait(500)
      cy.contains('button', 'Next').click()
      cy.wait(500)
      
      // Add JSON to proceed
      const minimalJson = {
        "welcomePage": {
          "id": "w", "title": "W", "content": "<p>W</p>", "narration": "W"
        },
        "learningObjectivesPage": {
          "id": "l", "title": "L", "content": "<p>L</p>", "narration": "L"
        },
        "topics": [{
          "id": "t", "title": "T", "content": "<p>T</p>", "narration": "T"
        }],
        "assessment": {
          "questions": [{
            "id": "q",
            "type": "true-false",
            "question": "Q?",
            "correctAnswer": "true",
            "feedback": { "correct": "C", "incorrect": "I" }
          }]
        }
      }
      
      cy.get('textarea').first().type(JSON.stringify(minimalJson), {parseSpecialCharSequences: false, delay: 0})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Create multiple large files to test simultaneous uploads
      const files = []
      for (let i = 1; i <= 5; i++) {
        // Create larger files to simulate real uploads
        const content = new Array(1000).fill(`File ${i} content line`).join('\n')
        files.push(new File([content], `test-file-${i}.jpg`, { type: 'image/jpeg' }))
      }
      
      // Attempt to upload all files at once
      cy.get('input[type="file"][accept*="image"]').selectFile(files, { force: true })
      
      // Verify UI doesn't lock up - should be able to interact
      cy.contains('h1', 'Media Enhancement').should('be.visible')
      
      // Wait for uploads to process
      cy.wait(2000)
      
      // Verify all files appear
      files.forEach((file, index) => {
        cy.contains(`test-file-${index + 1}.jpg`).should('be.visible')
      })
      
      // Try to navigate while uploads might still be processing
      cy.contains('button', 'Next').should('not.be.disabled')
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Should successfully navigate to audio page
      cy.contains('h1', 'Audio Narration Wizard').should('be.visible')
      
      // Go back and verify files are still there
      cy.contains('button', 'Back').click()
      cy.wait(1000)
      
      files.forEach((file, index) => {
        cy.contains(`test-file-${index + 1}.jpg`).should('be.visible')
      })
      
      // Test uploading more files to existing collection
      const additionalFiles = [
        new File(['additional 1'], 'additional-1.png', { type: 'image/png' }),
        new File(['additional 2'], 'additional-2.png', { type: 'image/png' })
      ]
      
      cy.get('input[type="file"][accept*="image"]').selectFile(additionalFiles, { force: true })
      cy.wait(1000)
      
      // Verify both original and new files are present
      cy.contains('test-file-1.jpg').should('be.visible')
      cy.contains('additional-1.png').should('be.visible')
      cy.contains('additional-2.png').should('be.visible')
    })

    it('should prevent file upload conflicts and show appropriate feedback', () => {
      // Create project
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Upload Conflict Test')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Navigate to media page (using keyboard navigation for variety)
      cy.get('body').type('{ctrl}{rightarrow}')
      cy.wait(500)
      cy.get('body').type('{ctrl}{rightarrow}')
      cy.wait(500)
      
      // Add JSON
      const json = {
        "welcomePage": { "id": "w", "title": "W", "content": "<p>W</p>", "narration": "W" },
        "learningObjectivesPage": { "id": "l", "title": "L", "content": "<p>L</p>", "narration": "L" },
        "topics": [{ "id": "t", "title": "T", "content": "<p>T</p>", "narration": "T" }],
        "assessment": {
          "questions": [{
            "id": "q", "type": "true-false", "question": "Q?", "correctAnswer": "true",
            "feedback": { "correct": "C", "incorrect": "I" }
          }]
        }
      }
      
      cy.get('textarea').first().type(JSON.stringify(json), {parseSpecialCharSequences: false, delay: 0})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Upload a file with the same name twice
      const duplicateFile1 = new File(['content 1'], 'duplicate.jpg', { type: 'image/jpeg' })
      cy.get('input[type="file"][accept*="image"]').selectFile(duplicateFile1, { force: true })
      cy.wait(1000)
      
      // Try to upload another file with same name but different content
      const duplicateFile2 = new File(['different content'], 'duplicate.jpg', { type: 'image/jpeg' })
      cy.get('input[type="file"][accept*="image"]').selectFile(duplicateFile2, { force: true })
      cy.wait(1000)
      
      // System should handle this gracefully - either replace or rename
      // Verify there's some indication of how it was handled
      cy.get('body').then($body => {
        // Either we see duplicate.jpg once (replaced) or we see a renamed version
        const duplicateCount = $body.find(':contains("duplicate")').length
        expect(duplicateCount).to.be.at.least(1)
      })
    })
  })

  describe('Integration Test: Complete Workflow with Real Data', () => {
    it('should complete entire course creation with comprehensive real-world data', () => {
      // Create a comprehensive project
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Complete Integration Test - Cybersecurity Awareness Training')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Course Configuration with real data
      const courseConfig = {
        title: 'Cybersecurity Awareness Training for Remote Workers 2024',
        description: 'A comprehensive cybersecurity training program designed specifically for remote and hybrid workers. This course covers essential security practices, threat identification, and incident response procedures to protect both personal and company data in distributed work environments.',
        topics: `Module 1: Introduction to Cybersecurity for Remote Work
- Understanding the remote work threat landscape
- Common vulnerabilities in home office setups
- The cost of data breaches and security incidents
- Your role in organizational security

Module 2: Securing Your Home Office
- Router and WiFi security configuration
- VPN setup and best practices
- Physical security considerations
- Secure device management

Module 3: Password and Authentication Security
- Creating strong, unique passwords
- Password manager implementation
- Multi-factor authentication (MFA) setup
- Biometric security options

Module 4: Recognizing and Avoiding Threats
- Phishing email identification
- Social engineering tactics
- Malware and ransomware prevention
- Safe browsing practices

Module 5: Data Protection and Privacy
- Data classification and handling
- Secure file sharing methods
- Cloud storage security
- GDPR and privacy compliance

Module 6: Incident Response and Reporting
- Recognizing security incidents
- Immediate response procedures
- Reporting channels and escalation
- Post-incident best practices`
      }
      
      cy.get('input[placeholder="Enter your course title"]').clear().type(courseConfig.title)
      cy.get('textarea[placeholder*="brief description"]').type(courseConfig.description)
      cy.contains('button', 'Intermediate').click()
      cy.get('textarea[placeholder*="List your course topics"]').type(courseConfig.topics)
      
      // Save and continue
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Skip AI Prompt for now
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Add comprehensive JSON content
      const comprehensiveJson = {
        "welcomePage": {
          "id": "welcome-cyber",
          "title": "Welcome to Cybersecurity Awareness Training",
          "content": `<div class="welcome-section">
            <h1>Welcome to Cybersecurity Awareness Training for Remote Workers</h1>
            <p class="intro">In today's digital landscape, cybersecurity is everyone's responsibility. With the rise of remote work, protecting sensitive data has become more challenging and more critical than ever.</p>
            <div class="statistics">
              <h3>Did You Know?</h3>
              <ul>
                <li>🔒 <strong>43%</strong> of cyber attacks target small businesses</li>
                <li>💰 The average cost of a data breach is <strong>$4.35 million</strong></li>
                <li>⏱️ It takes an average of <strong>277 days</strong> to identify and contain a breach</li>
                <li>👥 <strong>95%</strong> of cybersecurity breaches are caused by human error</li>
              </ul>
            </div>
            <p>This comprehensive training will equip you with the knowledge and skills to protect yourself and your organization from cyber threats.</p>
          </div>`,
          "narration": "Welcome to Cybersecurity Awareness Training for Remote Workers. In this comprehensive course, you'll learn essential security practices to protect both personal and company data. With cyber attacks increasing by 38% year over year, your role in maintaining security has never been more important.",
          "imageKeywords": ["cybersecurity", "remote work", "data protection", "digital security"],
          "duration": 5
        },
        "learningObjectivesPage": {
          "id": "objectives-cyber",
          "title": "Learning Objectives",
          "content": `<div class="objectives-section">
            <h2>Learning Objectives</h2>
            <p>By the end of this course, you will be able to:</p>
            <ol class="objectives-list">
              <li><strong>Identify</strong> common cybersecurity threats specific to remote work environments</li>
              <li><strong>Implement</strong> robust security measures for your home office setup</li>
              <li><strong>Create and manage</strong> strong passwords using industry best practices</li>
              <li><strong>Recognize</strong> phishing attempts and social engineering tactics</li>
              <li><strong>Apply</strong> data protection principles to your daily work activities</li>
              <li><strong>Execute</strong> proper incident response procedures when security issues arise</li>
              <li><strong>Demonstrate</strong> compliance with organizational security policies</li>
            </ol>
            <div class="time-commitment">
              <p><strong>Time Commitment:</strong> Approximately 2 hours</p>
              <p><strong>Assessment:</strong> Final quiz with 80% passing score required</p>
            </div>
          </div>`,
          "narration": "Let's review what you'll accomplish in this training. These seven learning objectives form the foundation of your cybersecurity knowledge. Each module builds upon the previous one, creating a comprehensive security framework you can immediately apply to your remote work environment.",
          "duration": 3
        },
        "topics": [
          {
            "id": "module-1-intro",
            "title": "Introduction to Cybersecurity for Remote Work",
            "content": `<div class="module-content">
              <h2>Module 1: Introduction to Cybersecurity for Remote Work</h2>
              
              <h3>The Changing Threat Landscape</h3>
              <p>Remote work has fundamentally changed how we approach cybersecurity. Traditional office-based security measures like firewalls and monitored networks don't extend to your home office.</p>
              
              <div class="threat-comparison">
                <h4>Office Environment vs. Home Environment</h4>
                <table>
                  <tr>
                    <th>Security Aspect</th>
                    <th>Traditional Office</th>
                    <th>Home Office</th>
                  </tr>
                  <tr>
                    <td>Network Security</td>
                    <td>Enterprise-grade firewall</td>
                    <td>Consumer router (often unsecured)</td>
                  </tr>
                  <tr>
                    <td>Device Management</td>
                    <td>IT-managed and monitored</td>
                    <td>Self-managed or BYOD</td>
                  </tr>
                  <tr>
                    <td>Physical Security</td>
                    <td>Controlled access</td>
                    <td>Shared with family/roommates</td>
                  </tr>
                </table>
              </div>
              
              <h3>Common Remote Work Vulnerabilities</h3>
              <ol>
                <li><strong>Unsecured Wi-Fi Networks:</strong> Default router settings and weak passwords</li>
                <li><strong>Personal Device Usage:</strong> Mixing personal and work activities</li>
                <li><strong>Phishing Attacks:</strong> Increased targeting of remote workers</li>
                <li><strong>Shadow IT:</strong> Unauthorized software and services</li>
                <li><strong>Physical Security:</strong> Unlocked devices and screens</li>
              </ol>
              
              <div class="case-study">
                <h4>Real-World Example</h4>
                <p>In 2023, a major corporation suffered a data breach when an employee's home router was compromised. The attacker gained access to the corporate VPN through the employee's saved credentials, resulting in the theft of customer data affecting over 100,000 individuals.</p>
              </div>
            </div>`,
            "narration": "Welcome to Module 1. Remote work has created new cybersecurity challenges that require a different approach to protection. Understanding these unique vulnerabilities is your first step toward maintaining robust security outside the traditional office environment.",
            "duration": 15,
            "imageKeywords": ["home office security", "remote work risks", "cybersecurity threats"],
            "knowledgeCheck": {
              "questions": [
                {
                  "id": "kc-1-1-cyber",
                  "type": "multiple-choice",
                  "question": "What percentage of cybersecurity breaches are caused by human error?",
                  "options": ["45%", "65%", "85%", "95%"],
                  "correctAnswer": "95%",
                  "explanation": "Studies show that 95% of cybersecurity breaches involve human error, making user awareness and training critical for prevention.",
                  "feedback": {
                    "correct": "Correct! This highlights why cybersecurity training is so important - humans are often the weakest link in security.",
                    "incorrect": "Not quite. The actual figure is even higher - 95% of breaches involve human error."
                  }
                },
                {
                  "id": "kc-1-2-cyber",
                  "type": "true-false",
                  "question": "Home networks typically have the same level of security as corporate office networks.",
                  "correctAnswer": "false",
                  "explanation": "Home networks usually lack enterprise-grade security features like managed firewalls, intrusion detection systems, and professional IT monitoring.",
                  "feedback": {
                    "correct": "That's right! Home networks typically have much weaker security than corporate environments, which is why additional precautions are necessary.",
                    "incorrect": "Actually, home networks are generally much less secure than corporate networks, lacking professional security infrastructure."
                  }
                }
              ]
            }
          },
          {
            "id": "module-2-securing",
            "title": "Securing Your Home Office",
            "content": `<div class="module-content">
              <h2>Module 2: Securing Your Home Office</h2>
              
              <h3>Router and Network Security</h3>
              <div class="security-checklist">
                <h4>Essential Router Security Steps</h4>
                <ol>
                  <li>✅ Change default admin username and password</li>
                  <li>✅ Enable WPA3 encryption (or WPA2 if WPA3 unavailable)</li>
                  <li>✅ Create a strong WiFi password (minimum 15 characters)</li>
                  <li>✅ Disable WPS (WiFi Protected Setup)</li>
                  <li>✅ Change default network name (SSID)</li>
                  <li>✅ Enable automatic firmware updates</li>
                  <li>✅ Create a guest network for visitors</li>
                </ol>
              </div>
              
              <h3>VPN Configuration and Usage</h3>
              <p>A Virtual Private Network (VPN) creates an encrypted tunnel between your device and the company network, protecting data in transit.</p>
              
              <div class="vpn-best-practices">
                <h4>VPN Best Practices</h4>
                <ul>
                  <li>Always connect to VPN before accessing company resources</li>
                  <li>Use company-provided VPN only - avoid free public VPNs</li>
                  <li>Enable automatic VPN connection on startup</li>
                  <li>Report any VPN connection issues immediately</li>
                </ul>
              </div>
              
              <h3>Physical Security Measures</h3>
              <div class="physical-security">
                <p>Don't forget about physical security in your home office:</p>
                <ul>
                  <li>🔒 Use privacy screens on monitors</li>
                  <li>🚪 Lock devices when stepping away</li>
                  <li>📁 Secure physical documents in locked storage</li>
                  <li>🎥 Position webcam away from sensitive information</li>
                  <li>🗑️ Shred sensitive documents before disposal</li>
                </ul>
              </div>
            </div>`,
            "narration": "Securing your home office is fundamental to remote work cybersecurity. This module covers essential steps from router configuration to physical security measures. Remember, your home office is an extension of the corporate network and requires the same security diligence.",
            "duration": 20,
            "videoSearchTerms": ["router security configuration", "VPN setup tutorial", "home office security"],
            "knowledgeCheck": {
              "questions": [
                {
                  "id": "kc-2-1-cyber",
                  "type": "multiple-choice",
                  "question": "What is the minimum recommended length for a strong WiFi password?",
                  "options": ["8 characters", "10 characters", "12 characters", "15 characters"],
                  "correctAnswer": "15 characters",
                  "explanation": "Security experts recommend WiFi passwords of at least 15 characters to resist brute-force attacks.",
                  "feedback": {
                    "correct": "Excellent! A 15+ character password provides strong protection against unauthorized access.",
                    "incorrect": "While that length provides some security, experts recommend at least 15 characters for WiFi passwords."
                  }
                }
              ]
            }
          }
        ],
        "assessment": {
          "questions": [
            {
              "id": "final-cyber-1",
              "type": "multiple-choice",
              "question": "You receive an email that appears to be from your IT department asking you to click a link to verify your password. What should you do?",
              "options": [
                "Click the link and update your password as requested",
                "Ignore the email and delete it",
                "Contact IT directly through official channels to verify the request",
                "Forward the email to your colleagues to warn them"
              ],
              "correctAnswer": "Contact IT directly through official channels to verify the request",
              "feedback": {
                "correct": "Perfect! Always verify suspicious requests through official channels. This is the best defense against phishing.",
                "incorrect": "The safest approach is to contact IT directly through official channels to verify any password reset requests."
              }
            },
            {
              "id": "final-cyber-2",
              "type": "true-false",
              "question": "It's safe to use public WiFi for work activities if you're using a VPN.",
              "correctAnswer": "false",
              "feedback": {
                "correct": "Correct! Even with a VPN, public WiFi poses risks. It's best to use your mobile hotspot or wait until you have a secure connection.",
                "incorrect": "Actually, public WiFi should be avoided for work activities even with a VPN, as there are still potential security risks."
              }
            },
            {
              "id": "final-cyber-3",
              "type": "multiple-choice",
              "question": "How often should you update your router's firmware?",
              "options": [
                "Only when experiencing problems",
                "Once a year",
                "Whenever updates are available",
                "Every 5 years"
              ],
              "correctAnswer": "Whenever updates are available",
              "feedback": {
                "correct": "Excellent! Firmware updates often contain critical security patches and should be installed promptly.",
                "incorrect": "Router firmware should be updated whenever updates are available, as they often contain important security fixes."
              }
            }
          ],
          "passMark": 80,
          "narration": null
        }
      }
      
      cy.get('textarea').first().type(JSON.stringify(comprehensiveJson), {parseSpecialCharSequences: false, delay: 0})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(2000)
      
      // Verify validation success
      cy.contains('3 pages').should('be.visible')
      cy.contains('3 knowledge check questions').should('be.visible')
      cy.contains('3 assessment questions').should('be.visible')
      
      // Continue to Media
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Upload multiple media files
      const mediaFiles = [
        new File(['security diagram'], 'network-security-diagram.png', { type: 'image/png' }),
        new File(['phishing example'], 'phishing-email-example.jpg', { type: 'image/jpeg' }),
        new File(['vpn setup'], 'vpn-configuration.png', { type: 'image/png' }),
        new File(['password tips'], 'password-best-practices.jpg', { type: 'image/jpeg' })
      ]
      
      cy.get('input[type="file"][accept*="image"]').selectFile(mediaFiles, { force: true })
      cy.wait(2000)
      
      // Continue to Audio
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Configure audio settings
      cy.get('select').first().select('en-US-AriaNeural') // Professional female voice
      cy.get('input[type="range"]').first().invoke('val', 0.95).trigger('change') // Slightly slower for clarity
      
      // Continue to Activities
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Verify Activities page loads with questions from JSON
      cy.contains('h1', 'Questions & Assessment Editor').should('be.visible')
      cy.contains('What percentage of cybersecurity breaches').should('be.visible')
      
      // Continue to SCORM
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Configure SCORM settings
      cy.contains('h1', 'SCORM Package Builder').should('be.visible')
      
      // Now navigate all the way back to verify data persistence
      cy.get('[data-testid="progress-step-0"]').click()
      cy.wait(1000)
      
      // Verify all original data is intact
      cy.get('input[placeholder="Enter your course title"]').should('have.value', courseConfig.title)
      cy.get('textarea[placeholder*="brief description"]').should('have.value', courseConfig.description)
      cy.get('textarea[placeholder*="List your course topics"]').should('contain', 'Module 1:')
      cy.get('button[aria-pressed="true"]').contains('Intermediate').should('exist')
      
      // Navigate forward to media to verify files
      cy.get('[data-testid="progress-step-3"]').click()
      cy.wait(1000)
      
      mediaFiles.forEach(file => {
        cy.contains(file.name).should('be.visible')
      })
      
      // Final verification - go to SCORM page
      cy.get('[data-testid="progress-step-5"]').click()
      cy.wait(1000)
      
      cy.contains('h1', 'SCORM Package Builder').should('be.visible')
      
      // All data has persisted throughout the entire journey
    })
  })
})