describe('Quick Check', () => {
  it('Dashboard loads and text is visible', () => {
    cy.visit('/')
    
    // Check main title
    cy.get('h1').contains('SCORM Builder Projects').should('be.visible')
    
    // Take screenshot
    cy.screenshot('dashboard-check')
    
    // Log what we find
    cy.get('body').then($body => {
      const buttons = $body.find('button').length
      const h1Text = $body.find('h1').text()
      const h2Text = $body.find('h2').text()
      
      cy.log(`Found ${buttons} buttons`)
      cy.log(`H1: ${h1Text}`)
      cy.log(`H2: ${h2Text}`)
    })
  })
})