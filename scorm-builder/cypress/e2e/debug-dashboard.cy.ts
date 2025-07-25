describe('Debug Dashboard', () => {
  it('Shows what is actually on the dashboard', () => {
    cy.visit('/')
    cy.wait(2000) // Wait for any loading
    
    // Take screenshot
    cy.screenshot('dashboard-current-state')
    
    // Debug what buttons exist
    cy.get('button').then($buttons => {
      cy.log(`Found ${$buttons.length} buttons total`)
      $buttons.each((index, button) => {
        cy.log(`Button ${index}: "${button.textContent.trim()}"`)
      })
    })
    
    // Check if there's a loading state
    cy.get('body').then($body => {
      if ($body.find('.loading-spinner, [data-testid="loading"]').length > 0) {
        cy.log('⚠️ Loading spinner detected')
      }
      
      // Check for any error messages
      if ($body.text().includes('error') || $body.text().includes('Error')) {
        cy.log('⚠️ Error message detected')
      }
      
      // Log all h1, h2, h3 text
      const headings = []
      $body.find('h1, h2, h3').each((i, el) => {
        headings.push(`${el.tagName}: ${el.textContent.trim()}`)
      })
      cy.log('Headings found:', headings.join(' | '))
      
      // Check if empty state is showing
      if ($body.text().includes('Welcome to SCORM Builder')) {
        cy.log('✓ Empty state is showing')
        
        // In empty state, button might be in a different place
        cy.get('.empty-state button, .empty-state-cta button').then($emptyButtons => {
          cy.log(`Empty state buttons: ${$emptyButtons.length}`)
          $emptyButtons.each((i, btn) => {
            cy.log(`Empty state button: "${btn.textContent.trim()}"`)
          })
        })
      }
    })
    
    // Try different selectors for the create button
    const selectors = [
      'button:contains("Create New Project")',
      'button:contains("Create")',
      '[data-testid="create-project-button"]',
      '.empty-state button',
      'button[variant="primary"]',
      'button.primary'
    ]
    
    selectors.forEach(selector => {
      cy.get('body').then($body => {
        const found = $body.find(selector).length
        cy.log(`Selector "${selector}": ${found} found`)
      })
    })
  })
})