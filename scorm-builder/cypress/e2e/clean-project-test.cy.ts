describe('Clean Project Start Test', () => {
  it('should start with completely clean data for new projects', () => {
    cy.visit('/')
    
    // Create first project with specific data
    cy.contains('button', 'Create Your First Project').click()
    cy.get('input[placeholder="Enter project name"]').type('First Project')
    cy.get('[role="dialog"] button').contains('Create').click()
    cy.wait(1000)
    
    // Add distinctive data to first project
    cy.get('input[placeholder="Enter your course title"]').clear().type('First Project Custom Title')
    cy.contains('button', 'Expert').click()
    cy.get('textarea').last().type('First project specific topics:\n- Topic Alpha\n- Topic Beta')
    
    // Go back to dashboard
    cy.visit('/')
    cy.wait(1000)
    
    // Should see the first project
    cy.get('[data-testid="project-card"]').contains('First Project').should('be.visible')
    
    // Create second project
    cy.contains('button', 'Create New Project').click()
    cy.get('input[placeholder="Enter project name"]').type('Second Project')
    cy.get('[role="dialog"] button').contains('Create').click()
    cy.wait(1000)
    
    // Verify second project has clean state
    // Course title should only have the project name
    cy.get('input[placeholder="Enter your course title"]').should('have.value', 'Second Project')
    
    // Topics textarea should be empty
    cy.get('textarea').last().should('have.value', '')
    
    // Check that default difficulty is not from first project (which was Expert)
    cy.get('button[aria-pressed="true"]').should('not.contain', 'Expert')
    
    // Add data to second project
    cy.get('input[placeholder="Enter your course title"]').clear().type('Second Project Different Title')
    cy.contains('button', 'Basic').click()
    cy.get('textarea').last().type('Second project topics:\n- Topic One\n- Topic Two')
    
    // Go back to dashboard
    cy.visit('/')
    cy.wait(1000)
    
    // Open first project again
    cy.get('[data-testid="project-card"]').contains('First Project').click()
    cy.wait(1000)
    
    // Verify first project data is intact and not mixed with second project
    cy.get('input[placeholder="Enter your course title"]').should('have.value', 'First Project Custom Title')
    cy.get('textarea').last().should('have.value', 'First project specific topics:\n- Topic Alpha\n- Topic Beta')
    cy.get('button[aria-pressed="true"]').contains('Expert').should('exist')
    
    // Go back to dashboard and open second project
    cy.visit('/')
    cy.wait(1000)
    cy.get('[data-testid="project-card"]').contains('Second Project').click()
    cy.wait(1000)
    
    // Verify second project data is separate
    cy.get('input[placeholder="Enter your course title"]').should('have.value', 'Second Project Different Title')
    cy.get('textarea').last().should('have.value', 'Second project topics:\n- Topic One\n- Topic Two')
    cy.get('button[aria-pressed="true"]').contains('Basic').should('exist')
  })
})