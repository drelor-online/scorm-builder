describe('Data Persistence Test', () => {
  it('should persist data across all pages', () => {
    cy.visit('/')
    
    // Create project
    cy.contains('button', 'Create Your First Project').click()
    cy.get('input[placeholder="Enter project name"]').type('Data Test')
    cy.get('[role="dialog"] button').contains('Create').click()
    cy.wait(1000)
    
    // Enter data on first page
    const courseTitle = 'Test Course Title 2024'
    cy.get('input[placeholder="Enter your course title"]').clear().type(courseTitle)
    cy.contains('button', 'Medium').click()
    cy.get('textarea').last().type('Topic 1\nTopic 2\nTopic 3')
    
    // Go to next page
    cy.contains('button', 'Next').click()
    cy.wait(1000)
    
    // Go back
    cy.contains('button', 'Back').click()
    cy.wait(1000)
    
    // Verify data persisted
    cy.get('input[placeholder="Enter your course title"]').should('have.value', courseTitle)
    cy.get('textarea').last().should('have.value', 'Topic 1\nTopic 2\nTopic 3')
    cy.get('button[aria-pressed="true"]').contains('Medium').should('exist')
  })
})