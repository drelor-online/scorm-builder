describe('SCORM Builder Workflow', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.wait(1000) // Wait for app to load
  })

  it('1. Text should be visible on dashboard', () => {
    // Check that main title is visible
    cy.contains('h1', 'SCORM Builder Projects').should('be.visible')
    
    // Check text color contrast
    cy.get('h1').first().then(($el) => {
      const color = window.getComputedStyle($el[0]).color
      const rgb = color.match(/\d+/g)
      if (rgb) {
        const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3
        expect(brightness).to.be.greaterThan(150, 'Text should be light colored')
      }
    })

    // Check empty state text if visible
    cy.get('body').then(($body) => {
      if ($body.find('h2:contains("Welcome to SCORM Builder")').length > 0) {
        cy.contains('h2', 'Welcome to SCORM Builder').should('be.visible')
        cy.contains('Start by creating your first project').should('be.visible')
      }
    })
  })

  it('2. Can create a new project and data persists', () => {
    // Create new project - button text varies based on empty state
    cy.get('button').then($buttons => {
      const createButton = $buttons.filter(':contains("Create")').first()
      cy.wrap(createButton).click()
    })
    cy.get('[role="dialog"]').should('be.visible')
    
    // Fill project name
    cy.get('input[placeholder="Enter project name"]').type('Cypress Test Project')
    cy.contains('button', 'Create').click()
    
    // Should navigate to Course Configuration
    cy.contains('h1', 'Course Configuration').should('be.visible')
    
    // Check that project name auto-populated
    cy.get('input[placeholder*="course title" i]').should('have.value', 'Cypress Test Project')
    
    // Fill in course data
    cy.get('input[placeholder*="course title" i]').clear().type('Updated Course Title')
    cy.contains('button', 'Expert').click()
    cy.get('textarea[placeholder*="topics" i]').type('Topic One\nTopic Two\nTopic Three')
    
    // Navigate to Media Enhancement
    cy.contains('button', 'Next').click()
    cy.contains('h1', 'Media Enhancement').should('be.visible')
    
    // Navigate back
    cy.contains('button', 'Back').click()
    cy.contains('h1', 'Course Configuration').should('be.visible')
    
    // Verify data persisted
    cy.get('input[placeholder*="course title" i]').should('have.value', 'Updated Course Title')
    cy.get('textarea[placeholder*="topics" i]').should('have.value', 'Topic One\nTopic Two\nTopic Three')
    cy.get('button[aria-pressed="true"]').contains('Expert').should('exist')
  })

  it('3. Progress indicator shows visited steps correctly', () => {
    // Create project first
    cy.createProject('Progress Test')
    
    // Check initial state - only step 0 is visited
    cy.get('[data-testid="progress-step-0"]').should('have.attr', 'data-visited', 'true')
    cy.get('[data-testid="progress-step-1"]').should('have.attr', 'data-visited', 'false')
    
    // Navigate to step 1
    cy.contains('button', 'Next').click()
    cy.contains('h1', 'Media Enhancement').should('be.visible')
    
    // Both steps should be visited
    cy.get('[data-testid="progress-step-0"]').should('have.attr', 'data-visited', 'true')
    cy.get('[data-testid="progress-step-1"]').should('have.attr', 'data-visited', 'true')
    
    // Should be able to click on visited step
    cy.get('[data-testid="progress-step-0"]').click()
    cy.contains('h1', 'Course Configuration').should('be.visible')
    
    // Should NOT be able to navigate to unvisited step
    cy.get('[data-testid="progress-step-3"]').should('have.attr', 'data-visited', 'false')
    cy.get('[data-testid="progress-step-3"]').should('be.disabled')
  })

  it('4. New projects start completely clean', () => {
    // Create first project
    cy.createProject('First Project')
    
    // Fill with data
    cy.get('input[placeholder*="course title" i]').clear().type('First Project Data')
    cy.get('textarea[placeholder*="topics" i]').type('Old Topic 1\nOld Topic 2')
    
    // Go back to dashboard
    cy.visit('/')
    
    // Create second project
    cy.createProject('Second Clean Project')
    
    // Verify it's clean
    cy.get('input[placeholder*="course title" i]').should('have.value', 'Second Clean Project')
    cy.get('textarea[placeholder*="topics" i]').should('have.value', '')
    cy.get('button[aria-pressed="true"]').contains('Medium').should('exist') // Default difficulty
  })

  it('5. Can navigate using progress indicator', () => {
    // Create project and navigate through steps
    cy.createProject('Navigation Test')
    
    // Navigate through multiple steps
    cy.contains('button', 'Next').click() // To Media
    cy.contains('h1', 'Media Enhancement').should('be.visible')
    
    cy.contains('button', 'Next').click() // To Content Review
    cy.contains('h1', 'Content Review').should('be.visible')
    
    cy.contains('button', 'Next').click() // To Audio
    cy.contains('h1', 'Audio Narration').should('be.visible')
    
    // Now use progress indicator to go back to step 0
    cy.get('[data-testid="progress-step-0"]').click()
    cy.contains('h1', 'Course Configuration').should('be.visible')
    
    // Jump to step 3 (should work since visited)
    cy.get('[data-testid="progress-step-3"]').click()
    cy.contains('h1', 'Audio Narration').should('be.visible')
  })

  it('6. File upload areas should not freeze UI', () => {
    // Navigate to audio page
    cy.createProject('Upload Test')
    
    // Navigate to Audio page
    cy.contains('button', 'Next').click() // Media
    cy.contains('button', 'Next').click() // Content Review  
    cy.contains('button', 'Next').click() // Audio
    
    cy.contains('h1', 'Audio Narration').should('be.visible')
    
    // Check that file inputs exist and are interactive
    cy.get('input[type="file"]').should('exist')
    
    // Try clicking other UI elements to ensure not frozen
    cy.contains('button', 'Back').should('not.be.disabled')
    cy.get('[data-testid="progress-step-0"]').should('not.be.disabled')
  })

  it('7. Dashboard shows projects correctly', () => {
    // Create a project
    cy.createProject('Dashboard Test Project')
    
    // Go back to dashboard
    cy.visit('/')
    
    // Project should be visible
    cy.get('[data-testid="project-card"]').contains('Dashboard Test Project').should('be.visible')
    
    // Check that date text is visible
    cy.get('.project-date').first().then(($el) => {
      const color = window.getComputedStyle($el[0]).color
      const rgb = color.match(/\d+/g)
      if (rgb) {
        const brightness = (parseInt(rgb[0]) + parseInt(rgb[1]) + parseInt(rgb[2])) / 3
        expect(brightness).to.be.greaterThan(100, 'Date text should be visible')
      }
    })
  })
})