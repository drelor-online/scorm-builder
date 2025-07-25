describe('SCORM Builder - Working Tests', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  it('1. Dashboard text is visible', () => {
    cy.contains('h1', 'SCORM Builder Projects').should('be.visible')
    cy.contains('h2', 'Welcome to SCORM Builder').should('be.visible')
    cy.contains('button', 'Create Your First Project').should('be.visible')
  })

  it('2. Can create project and title auto-populates', () => {
    // Click create button
    cy.contains('button', 'Create Your First Project').click()
    
    // Fill project name
    cy.get('input[placeholder="Enter project name"]').type('Auto Populate Test')
    cy.get('[role="dialog"] button').contains('Create').click()
    
    // Wait for navigation and check title
    cy.contains('h1', 'Course Configuration').should('be.visible')
    cy.get('input[placeholder="Enter your course title"]')
      .should('have.value', 'Auto Populate Test')
  })

  it('3. Data persists when navigating', () => {
    // Create project
    cy.contains('button', 'Create Your First Project').click()
    cy.get('input[placeholder="Enter project name"]').type('Persistence Test')
    cy.get('[role="dialog"] button').contains('Create').click()
    
    // Wait for Course Configuration
    cy.contains('h1', 'Course Configuration').should('be.visible')
    
    // Fill data
    cy.get('input[placeholder="Enter your course title"]').clear().type('Custom Title')
    cy.contains('button', 'Expert').click()
    cy.get('textarea[placeholder*="List your course topics"]').type('Topic 1\nTopic 2\nTopic 3')
    
    // Navigate forward
    cy.contains('button', 'Next').click()
    cy.contains('h1', 'AI Prompt Generator').should('be.visible')
    
    // Navigate back
    cy.contains('button', 'Back').click()
    cy.contains('h1', 'Course Configuration').should('be.visible')
    
    // Verify data persisted
    cy.get('input[placeholder="Enter your course title"]').should('have.value', 'Custom Title')
    cy.get('textarea[placeholder*="List your course topics"]').should('have.value', 'Topic 1\nTopic 2\nTopic 3')
    cy.get('button[aria-pressed="true"]').contains('Expert').should('exist')
  })

  it('4. Progress indicator works correctly', () => {
    // Create project
    cy.contains('button', 'Create Your First Project').click()
    cy.get('input[placeholder="Enter project name"]').type('Progress Test')
    cy.get('[role="dialog"] button').contains('Create').click()
    
    // Check initial state
    cy.get('[data-testid="progress-step-0"]').should('have.attr', 'data-visited', 'true')
    cy.get('[data-testid="progress-step-1"]').should('have.attr', 'data-visited', 'false')
    
    // Navigate to next step
    cy.contains('button', 'Next').click()
    cy.contains('h1', 'AI Prompt Generator').should('be.visible')
    
    // Both steps should be visited
    cy.get('[data-testid="progress-step-0"]').should('have.attr', 'data-visited', 'true')
    cy.get('[data-testid="progress-step-1"]').should('have.attr', 'data-visited', 'true')
    
    // Click step 0 to go back
    cy.get('[data-testid="progress-step-0"]').click()
    cy.contains('h1', 'Course Configuration').should('be.visible')
    
    // Try to click unvisited step (should be disabled)
    cy.get('[data-testid="progress-step-3"]')
      .should('have.attr', 'data-visited', 'false')
      .should('be.disabled')
  })

  it('5. New projects start clean', () => {
    // Create first project
    cy.contains('button', 'Create Your First Project').click()
    cy.get('input[placeholder="Enter project name"]').type('First Project')
    cy.get('[role="dialog"] button').contains('Create').click()
    
    // Fill with data
    cy.get('input[placeholder="Enter your course title"]').clear().type('First Project Data')
    cy.get('textarea[placeholder*="List your course topics"]').type('Old Topic 1\nOld Topic 2')
    
    // Go back to dashboard
    cy.visit('/')
    
    // Should now see project card
    cy.get('[data-testid="project-card"]').contains('First Project').should('be.visible')
    
    // Create second project - button text is different now
    cy.contains('button', 'Create New Project').click()
    cy.get('input[placeholder="Enter project name"]').type('Second Clean Project')
    cy.get('[role="dialog"] button').contains('Create').click()
    
    // Verify it's clean
    cy.get('input[placeholder="Enter your course title"]').should('have.value', 'Second Clean Project')
    cy.get('textarea[placeholder*="List your course topics"]').should('have.value', '')
  })

  it('6. Can navigate through all steps', () => {
    // Create project
    cy.contains('button', 'Create Your First Project').click()
    cy.get('input[placeholder="Enter project name"]').type('Full Navigation')
    cy.get('[role="dialog"] button').contains('Create').click()
    
    // Navigate through all steps
    const steps = [
      'Course Configuration',
      'AI Prompt Generator', 
      'JSON Import & Validation',
      'Media Enhancement',
      'Audio Narration Wizard',
      'Questions & Assessment Editor',
      'SCORM Package Builder'
    ]
    
    steps.forEach((step, index) => {
      if (index > 0) {
        cy.contains('button', 'Next').click()
        cy.wait(1000) // Wait for navigation
      }
      
      // Special handling for JSON Import step
      if (index === 2) {
        // On JSON Import page, paste sample JSON and validate
        const sampleJson = {
          "welcomePage": {
            "id": "welcome-1",
            "title": "Test Course",
            "content": "<p>Welcome to the test course</p>",
            "narration": "Welcome to our test course."
          },
          "learningObjectivesPage": {
            "id": "objectives-1",
            "title": "Learning Objectives",
            "content": "<p>You will learn testing</p>",
            "narration": "Let's review the objectives."
          },
          "topics": [
            {
              "id": "topic-1",
              "title": "Topic 1",
              "content": "<p>Content for topic 1</p>",
              "narration": "This is topic 1."
            }
          ],
          "assessment": {
            "questions": [
              {
                "id": "q-1",
                "type": "true-false",
                "question": "This is a test question?",
                "correctAnswer": "true",
                "feedback": {
                  "correct": "Correct!",
                  "incorrect": "Try again."
                }
              }
            ]
          }
        }
        cy.get('textarea').first().type(JSON.stringify(sampleJson), {parseSpecialCharSequences: false})
        cy.get('button').contains('Validate JSON').click()
        cy.wait(1000)
      }
      
      cy.contains('h1', steps[index]).should('be.visible')
      
      // Verify progress indicator
      cy.get(`[data-testid="progress-step-${index}"]`)
        .should('have.attr', 'data-visited', 'true')
    })
    
    // Navigate back using progress indicator
    cy.get('[data-testid="progress-step-0"]').click()
    cy.contains('h1', 'Course Configuration').should('be.visible')
    
    // Jump to visited step
    cy.get('[data-testid="progress-step-3"]').click()
    cy.contains('h1', 'Media Enhancement').should('be.visible')
  })
})