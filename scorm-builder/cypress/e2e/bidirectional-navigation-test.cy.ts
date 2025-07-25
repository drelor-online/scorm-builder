describe('Bidirectional Navigation Test', () => {
  it('should maintain data integrity when navigating back and forth', () => {
    cy.visit('/')
    
    // Create project
    cy.contains('button', 'Create Your First Project').click()
    cy.get('input[placeholder="Enter project name"]').type('Navigation Test')
    cy.get('[role="dialog"] button').contains('Create').click()
    cy.wait(1000)
    
    // Enter initial data
    const initialData = {
      title: 'Initial Title',
      topics: 'Initial Topic 1\nInitial Topic 2'
    }
    
    cy.get('input[placeholder="Enter your course title"]').clear().type(initialData.title)
    cy.contains('button', 'Easy').click()
    cy.get('textarea').last().type(initialData.topics)
    
    // Navigate forward two steps
    cy.contains('button', 'Next').click()
    cy.wait(1000)
    cy.contains('h1', 'AI Prompt Generator').should('be.visible')
    
    cy.contains('button', 'Next').click()
    cy.wait(1000)
    cy.contains('h1', 'JSON Import & Validation').should('be.visible')
    
    // Add JSON data
    const jsonData = {
      "welcomePage": {
        "id": "w1",
        "title": "Welcome Page",
        "content": "<p>Welcome to the course</p>",
        "narration": "Welcome narration text"
      },
      "learningObjectivesPage": {
        "id": "obj1",
        "title": "Learning Objectives",
        "content": "<p>You will learn</p>",
        "narration": "Objectives narration"
      },
      "topics": [{
        "id": "t1",
        "title": "Topic One",
        "content": "<p>Topic one content</p>",
        "narration": "Topic one narration"
      }],
      "assessment": {
        "questions": [{
          "id": "q1",
          "type": "true-false",
          "question": "Is this working?",
          "correctAnswer": "true",
          "feedback": {
            "correct": "Yes it is!",
            "incorrect": "No, try again"
          }
        }]
      }
    }
    
    cy.get('textarea').first().type(JSON.stringify(jsonData), {parseSpecialCharSequences: false})
    cy.get('button').contains('Validate JSON').click()
    cy.wait(1000)
    
    // Go back to first page using progress indicator
    cy.get('[data-testid="progress-step-0"]').click()
    cy.wait(1000)
    
    // Verify initial data is still there
    cy.get('input[placeholder="Enter your course title"]').should('have.value', initialData.title)
    cy.get('textarea').last().should('have.value', initialData.topics)
    cy.get('button[aria-pressed="true"]').contains('Easy').should('exist')
    
    // Now update the data
    const updatedData = {
      title: 'Updated Title After Navigation',
      topics: 'Updated Topic A\nUpdated Topic B\nUpdated Topic C'
    }
    
    cy.get('input[placeholder="Enter your course title"]').clear().type(updatedData.title)
    cy.get('textarea').last().clear().type(updatedData.topics)
    cy.contains('button', 'Hard').click()
    
    // Jump directly to JSON page
    cy.get('[data-testid="progress-step-2"]').click()
    cy.wait(1000)
    
    // Verify JSON is still there
    cy.get('textarea').first().should('contain', 'Welcome Page')
    cy.get('textarea').first().should('contain', 'Topic one content')
    
    // Navigate to media page
    cy.contains('button', 'Next').click()
    cy.wait(1000)
    cy.contains('h1', 'Media Enhancement').should('be.visible')
    
    // Upload a file
    const testFile = new File(['test content'], 'navigation-test.jpg', { type: 'image/jpeg' })
    cy.get('input[type="file"][accept*="image"]').selectFile(testFile, { force: true })
    cy.wait(1000)
    cy.contains('navigation-test.jpg').should('be.visible')
    
    // Go all the way back to first page
    cy.get('[data-testid="progress-step-0"]').click()
    cy.wait(1000)
    
    // Verify updated data persisted
    cy.get('input[placeholder="Enter your course title"]').should('have.value', updatedData.title)
    cy.get('textarea').last().should('have.value', updatedData.topics)
    cy.get('button[aria-pressed="true"]').contains('Hard').should('exist')
    
    // Jump to media page to verify file is still there
    cy.get('[data-testid="progress-step-3"]').click()
    cy.wait(1000)
    cy.contains('navigation-test.jpg').should('be.visible')
  })
})