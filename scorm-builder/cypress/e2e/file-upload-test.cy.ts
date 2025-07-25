describe('File Upload Test', () => {
  it('should handle multiple file uploads without locking up', () => {
    cy.visit('/')
    
    // Quick setup to get to media page
    cy.contains('button', 'Create Your First Project').click()
    cy.get('input[placeholder="Enter project name"]').type('Upload Test')
    cy.get('[role="dialog"] button').contains('Create').click()
    cy.wait(1000)
    
    // Skip to JSON page quickly
    cy.contains('button', 'Next').click()
    cy.wait(500)
    cy.contains('button', 'Next').click()
    cy.wait(500)
    
    // Add minimal JSON to proceed
    const minimalJson = {
      "welcomePage": {"id": "w", "title": "W", "content": "<p>W</p>", "narration": "W"},
      "learningObjectivesPage": {"id": "l", "title": "L", "content": "<p>L</p>", "narration": "L"},
      "topics": [{"id": "t", "title": "T", "content": "<p>T</p>", "narration": "T"}],
      "assessment": {"questions": [{"id": "q", "type": "true-false", "question": "Q?", "correctAnswer": "true", "feedback": {"correct": "C", "incorrect": "I"}}]}
    }
    
    cy.get('textarea').first().type(JSON.stringify(minimalJson), {parseSpecialCharSequences: false})
    cy.get('button').contains('Validate JSON').click()
    cy.wait(1000)
    
    // Navigate to media page
    cy.contains('button', 'Next').click()
    cy.wait(1000)
    cy.contains('h1', 'Media Enhancement').should('be.visible')
    
    // Upload multiple files simultaneously
    const files = [
      { contents: Cypress.Buffer.from('image1 content'), fileName: 'image1.jpg', mimeType: 'image/jpeg' },
      { contents: Cypress.Buffer.from('image2 content'), fileName: 'image2.jpg', mimeType: 'image/jpeg' },
      { contents: Cypress.Buffer.from('image3 content'), fileName: 'image3.jpg', mimeType: 'image/jpeg' },
      { contents: Cypress.Buffer.from('image4 content'), fileName: 'image4.jpg', mimeType: 'image/jpeg' }
    ]
    
    cy.get('input[type="file"][accept*="image"]').selectFile(files, { force: true })
    cy.wait(2000)
    
    // Verify all files appear
    files.forEach((file, index) => {
      cy.contains(`image${index + 1}.jpg`).should('be.visible')
    })
    
    // UI should remain responsive - test navigation buttons
    cy.contains('button', 'Next').should('not.be.disabled')
    cy.contains('button', 'Back').should('not.be.disabled')
    
    // Navigate away and back to verify files persist
    cy.contains('button', 'Next').click()
    cy.wait(1000)
    cy.contains('h1', 'Audio Narration Wizard').should('be.visible')
    
    cy.contains('button', 'Back').click()
    cy.wait(1000)
    
    // All files should still be there
    files.forEach((file, index) => {
      cy.contains(`image${index + 1}.jpg`).should('be.visible')
    })
    
    // Test uploading duplicate filename
    const duplicateFile = { contents: Cypress.Buffer.from('duplicate content'), fileName: 'image1.jpg', mimeType: 'image/jpeg' }
    cy.get('input[type="file"][accept*="image"]').selectFile(duplicateFile, { force: true })
    cy.wait(1000)
    
    // Should handle gracefully - at least one image1.jpg should be visible
    cy.contains('image1.jpg').should('be.visible')
  })
})