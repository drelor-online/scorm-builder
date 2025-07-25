describe('SCORM Builder - Critical Workflow Tests', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('Test 1: Data Persistence Across Pages', () => {
    it('should save and reload data when moving between pages', () => {
      // Create a new project
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Data Persistence Test')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Enter data on Course Configuration page
      cy.contains('h1', 'Course Configuration').should('be.visible')
      const testData = {
        title: 'Test Course Title for Persistence',
        description: 'This is a test description to verify data persistence',
        topics: 'Topic 1: Introduction\nTopic 2: Main Content\nTopic 3: Summary'
      }
      
      cy.get('input[placeholder="Enter your course title"]').clear().type(testData.title)
      cy.get('textarea[placeholder*="description"]').first().type(testData.description)
      cy.contains('button', 'Intermediate').click()
      cy.get('textarea[placeholder*="List your course topics"]').type(testData.topics)
      
      // Navigate forward
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('h1', 'AI Prompt Generator').should('be.visible')
      
      // Navigate to JSON page
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('h1', 'JSON Import & Validation').should('be.visible')
      
      // Add JSON data
      const jsonData = {
        "welcomePage": {
          "id": "welcome",
          "title": testData.title,
          "content": "<p>Welcome</p>",
          "narration": "Welcome to the course"
        },
        "learningObjectivesPage": {
          "id": "objectives",
          "title": "Objectives",
          "content": "<p>Learn stuff</p>",
          "narration": "You will learn"
        },
        "topics": [{
          "id": "topic1",
          "title": "Topic 1",
          "content": "<p>Content</p>",
          "narration": "This is topic 1"
        }],
        "assessment": {
          "questions": [{
            "id": "q1",
            "type": "true-false",
            "question": "Is this a test?",
            "correctAnswer": "true",
            "feedback": {
              "correct": "Yes!",
              "incorrect": "No!"
            }
          }]
        }
      }
      
      cy.get('textarea').first().clear().type(JSON.stringify(jsonData), {parseSpecialCharSequences: false})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      
      // Navigate to Media page
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('h1', 'Media Enhancement').should('be.visible')
      
      // Upload a test image
      const imageFile = new File(['test image content'], 'test-image.jpg', { type: 'image/jpeg' })
      cy.get('input[type="file"][accept*="image"]').selectFile(imageFile, { force: true })
      cy.wait(1000)
      cy.contains('test-image.jpg').should('be.visible')
      
      // Navigate to Audio page
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('h1', 'Audio Narration Wizard').should('be.visible')
      
      // Now go all the way back to the first page
      cy.get('[data-testid="progress-step-0"]').click()
      cy.wait(1000)
      
      // Verify all data persisted
      cy.get('input[placeholder="Enter your course title"]').should('have.value', testData.title)
      cy.get('textarea[placeholder*="description"]').first().should('have.value', testData.description)
      cy.get('textarea[placeholder*="List your course topics"]').should('have.value', testData.topics)
      cy.get('button[aria-pressed="true"]').contains('Intermediate').should('exist')
      
      // Jump to JSON page
      cy.get('[data-testid="progress-step-2"]').click()
      cy.wait(1000)
      cy.get('textarea').first().should('contain', 'Welcome to the course')
      
      // Jump to Media page
      cy.get('[data-testid="progress-step-3"]').click()
      cy.wait(1000)
      cy.contains('test-image.jpg').should('be.visible')
    })
  })

  describe('Test 2: Back/Forward Navigation Data Integrity', () => {
    it('should not lose data when changing content and navigating', () => {
      // Create project
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Navigation Test')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Initial data
      cy.get('input[placeholder="Enter your course title"]').clear().type('Initial Title')
      cy.get('textarea[placeholder*="List your course topics"]').type('Initial Topics')
      
      // Go forward
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Add JSON
      const json = {
        "welcomePage": {"id": "w", "title": "Welcome", "content": "<p>W</p>", "narration": "W"},
        "learningObjectivesPage": {"id": "l", "title": "Learn", "content": "<p>L</p>", "narration": "L"},
        "topics": [{"id": "t", "title": "Topic", "content": "<p>T</p>", "narration": "T"}],
        "assessment": {"questions": [{"id": "q", "type": "true-false", "question": "Q?", "correctAnswer": "true", "feedback": {"correct": "C", "incorrect": "I"}}]}
      }
      cy.get('textarea').first().type(JSON.stringify(json), {parseSpecialCharSequences: false})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      
      // Go back and change data
      cy.get('[data-testid="progress-step-0"]').click()
      cy.wait(1000)
      cy.get('input[placeholder="Enter your course title"]').clear().type('Updated Title')
      cy.get('textarea[placeholder*="List your course topics"]').clear().type('Updated Topics\nWith Multiple Lines')
      
      // Go forward again
      cy.get('[data-testid="progress-step-2"]').click()
      cy.wait(1000)
      
      // JSON should still be there
      cy.get('textarea').first().should('contain', 'Welcome')
      
      // Go back to verify changes saved
      cy.get('[data-testid="progress-step-0"]').click()
      cy.wait(1000)
      cy.get('input[placeholder="Enter your course title"]').should('have.value', 'Updated Title')
      cy.get('textarea[placeholder*="List your course topics"]').should('have.value', 'Updated Topics\nWith Multiple Lines')
    })
  })

  describe('Test 3: Clean Project Starts', () => {
    it('should start completely fresh when creating new project', () => {
      // Create first project
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('First Project')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Add distinctive data
      cy.get('input[placeholder="Enter your course title"]').clear().type('First Project Specific Title')
      cy.get('textarea[placeholder*="description"]').first().type('First project only description')
      cy.contains('button', 'Expert').click()
      cy.get('textarea[placeholder*="List your course topics"]').type('First project topics')
      
      // Go to dashboard
      cy.visit('/')
      cy.wait(1000)
      
      // Create second project
      cy.contains('button', 'Create New Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Second Project')
      cy.get('[role="dialog"] button').contains('Create').click()
      cy.wait(1000)
      
      // Verify clean state
      cy.get('input[placeholder="Enter your course title"]').should('have.value', 'Second Project')
      cy.get('textarea[placeholder*="description"]').first().should('have.value', '')
      cy.get('textarea[placeholder*="List your course topics"]').should('have.value', '')
      cy.get('button[aria-pressed="true"]').should('not.exist')
      
      // Go back to first project
      cy.visit('/')
      cy.get('[data-testid="project-card"]').contains('First Project').click()
      cy.wait(1000)
      
      // Verify first project data intact
      cy.get('input[placeholder="Enter your course title"]').should('have.value', 'First Project Specific Title')
      cy.get('textarea[placeholder*="description"]').first().should('have.value', 'First project only description')
      cy.get('button[aria-pressed="true"]').contains('Expert').should('exist')
    })
  })

  describe('Test 4: File Upload Behavior', () => {
    it('should handle multiple file uploads gracefully', () => {
      // Quick navigation to media page
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Upload Test')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Skip to JSON page
      cy.contains('button', 'Next').click()
      cy.wait(500)
      cy.contains('button', 'Next').click()
      cy.wait(500)
      
      // Add minimal JSON
      const json = {
        "welcomePage": {"id": "w", "title": "W", "content": "<p>W</p>", "narration": "W"},
        "learningObjectivesPage": {"id": "l", "title": "L", "content": "<p>L</p>", "narration": "L"},
        "topics": [{"id": "t", "title": "T", "content": "<p>T</p>", "narration": "T"}],
        "assessment": {"questions": [{"id": "q", "type": "true-false", "question": "Q?", "correctAnswer": "true", "feedback": {"correct": "C", "incorrect": "I"}}]}
      }
      cy.get('textarea').first().type(JSON.stringify(json), {parseSpecialCharSequences: false})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Upload multiple files
      const files = [
        new File(['content1'], 'file1.jpg', { type: 'image/jpeg' }),
        new File(['content2'], 'file2.jpg', { type: 'image/jpeg' }),
        new File(['content3'], 'file3.jpg', { type: 'image/jpeg' })
      ]
      
      cy.get('input[type="file"][accept*="image"]').selectFile(files, { force: true })
      cy.wait(2000)
      
      // Verify all files appear
      cy.contains('file1.jpg').should('be.visible')
      cy.contains('file2.jpg').should('be.visible')
      cy.contains('file3.jpg').should('be.visible')
      
      // UI should remain responsive
      cy.contains('button', 'Next').should('not.be.disabled')
      cy.contains('button', 'Back').should('not.be.disabled')
      
      // Navigate away and back
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      cy.contains('button', 'Back').click()
      cy.wait(1000)
      
      // Files should still be there
      cy.contains('file1.jpg').should('be.visible')
      cy.contains('file2.jpg').should('be.visible')
      cy.contains('file3.jpg').should('be.visible')
    })

    it('should handle duplicate filenames appropriately', () => {
      // Quick setup
      cy.contains('button', 'Create Your First Project').click()
      cy.get('input[placeholder="Enter project name"]').type('Duplicate Test')
      cy.get('[role="dialog"] button').contains('Create').click()
      
      // Navigate to media
      cy.contains('button', 'Next').click()
      cy.wait(500)
      cy.contains('button', 'Next').click()
      cy.wait(500)
      
      const json = {
        "welcomePage": {"id": "w", "title": "W", "content": "<p>W</p>", "narration": "W"},
        "learningObjectivesPage": {"id": "l", "title": "L", "content": "<p>L</p>", "narration": "L"},
        "topics": [{"id": "t", "title": "T", "content": "<p>T</p>", "narration": "T"}],
        "assessment": {"questions": [{"id": "q", "type": "true-false", "question": "Q?", "correctAnswer": "true", "feedback": {"correct": "C", "incorrect": "I"}}]}
      }
      cy.get('textarea').first().type(JSON.stringify(json), {parseSpecialCharSequences: false})
      cy.get('button').contains('Validate JSON').click()
      cy.wait(1000)
      cy.contains('button', 'Next').click()
      cy.wait(1000)
      
      // Upload file
      const file1 = new File(['original content'], 'duplicate.jpg', { type: 'image/jpeg' })
      cy.get('input[type="file"][accept*="image"]').selectFile(file1, { force: true })
      cy.wait(1000)
      
      // Upload another file with same name
      const file2 = new File(['different content'], 'duplicate.jpg', { type: 'image/jpeg' })
      cy.get('input[type="file"][accept*="image"]').selectFile(file2, { force: true })
      cy.wait(1000)
      
      // Should handle gracefully - either replace or show both
      cy.contains('duplicate').should('be.visible')
    })
  })
})