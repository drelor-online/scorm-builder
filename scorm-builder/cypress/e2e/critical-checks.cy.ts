describe('Critical Workflow Checks', () => {
  beforeEach(() => {
    cy.visit('/')
    cy.wait(1000)
  })

  it('1. Can see and click the create button', () => {
    // Find and click the create button
    cy.get('button').contains(/Create/i).should('be.visible').click()
    
    // Modal should open
    cy.get('[role="dialog"]').should('be.visible')
    cy.contains('Create New Project').should('be.visible')
  })

  it('2. Course title auto-populates from project name', () => {
    cy.createProject('Auto Populate Test')
    
    // Course title should have the project name
    cy.get('input[placeholder*="course title" i]')
      .should('have.value', 'Auto Populate Test')
  })

  it('3. Data persists when navigating', () => {
    cy.createProject('Persistence Test')
    
    // Fill data
    cy.get('input[placeholder*="course title" i]').clear().type('My Custom Title')
    cy.get('textarea[placeholder*="topics" i]').type('Topic A\nTopic B')
    
    // Navigate away
    cy.contains('button', 'Next').click()
    cy.contains('h1', 'Media Enhancement', { timeout: 10000 }).should('be.visible')
    
    // Navigate back
    cy.contains('button', 'Back').click()
    cy.contains('h1', 'Course Configuration', { timeout: 10000 }).should('be.visible')
    
    // Check data is still there
    cy.get('input[placeholder*="course title" i]').should('have.value', 'My Custom Title')
    cy.get('textarea[placeholder*="topics" i]').should('have.value', 'Topic A\nTopic B')
  })

  it('4. Text is visible in all states', () => {
    // Dashboard text
    cy.get('h1').should('be.visible').and('have.css', 'color').and('not.eq', 'rgb(0, 0, 0)')
    
    // Empty state or project cards
    cy.get('body').then($body => {
      if ($body.find('.empty-state').length > 0) {
        cy.get('.empty-state h2').should('be.visible')
        cy.get('.empty-state p').should('be.visible')
      } else {
        cy.get('.project-card h3').should('be.visible')
        cy.get('.project-date').should('be.visible')
      }
    })
  })

  it('5. Progress indicator works correctly', () => {
    cy.createProject('Progress Test')
    
    // Initially only step 0 is visited
    cy.get('[data-testid="progress-step-0"]').should('have.attr', 'data-visited', 'true')
    cy.get('[data-testid="progress-step-1"]').should('have.attr', 'data-visited', 'false')
    
    // Navigate to next step
    cy.contains('button', 'Next').click()
    
    // Now both should be visited
    cy.get('[data-testid="progress-step-0"]').should('have.attr', 'data-visited', 'true')
    cy.get('[data-testid="progress-step-1"]').should('have.attr', 'data-visited', 'true')
    
    // Can click to go back
    cy.get('[data-testid="progress-step-0"]').click()
    cy.contains('h1', 'Course Configuration').should('be.visible')
  })
})