describe('Console Debug', () => {
  it('Captures console errors and logs', () => {
    // Capture console logs and errors
    const consoleLogs: string[] = []
    const consoleErrors: string[] = []
    
    cy.on('window:before:load', (win) => {
      // Capture console.log
      const originalLog = win.console.log
      win.console.log = (...args) => {
        consoleLogs.push(args.map(arg => String(arg)).join(' '))
        originalLog(...args)
      }
      
      // Capture console.error
      const originalError = win.console.error
      win.console.error = (...args) => {
        consoleErrors.push(args.map(arg => String(arg)).join(' '))
        originalError(...args)
      }
    })
    
    // Visit the page
    cy.visit('/')
    cy.wait(2000)
    
    // Log what we see
    cy.get('body').then(() => {
      cy.log('=== CONSOLE LOGS ===')
      consoleLogs.forEach(log => cy.log(log))
      
      cy.log('=== CONSOLE ERRORS ===')
      if (consoleErrors.length === 0) {
        cy.log('No console errors!')
      } else {
        consoleErrors.forEach(error => cy.log(`ERROR: ${error}`))
      }
    })
    
    // Try to create a project and see what happens
    cy.log('=== TRYING TO CREATE PROJECT ===')
    
    // Find create button
    cy.get('button').then($buttons => {
      const createButtons = $buttons.filter((i, el) => el.textContent?.includes('Create'))
      cy.log(`Found ${createButtons.length} create buttons`)
      
      if (createButtons.length > 0) {
        cy.wrap(createButtons.first()).click()
        
        // Check if modal opened
        cy.wait(1000)
        cy.get('body').then($body => {
          if ($body.find('[role="dialog"]').length > 0) {
            cy.log('✓ Modal opened successfully')
          } else {
            cy.log('✗ Modal did not open')
            cy.log('Page HTML:', $body.html().substring(0, 500))
          }
        })
      } else {
        cy.log('✗ No create button found')
      }
    })
    
    // Final console check
    cy.wait(1000).then(() => {
      cy.log('=== FINAL CONSOLE CHECK ===')
      if (consoleErrors.length > 0) {
        cy.log(`Total errors: ${consoleErrors.length}`)
        consoleErrors.slice(-5).forEach(error => cy.log(`Recent error: ${error}`))
      }
    })
  })
})