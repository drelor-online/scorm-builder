describe('Debug to File', () => {
  it('Captures all debug info and saves it', () => {
    const debugInfo = {
      consoleLogs: [] as string[],
      consoleErrors: [] as string[],
      buttons: [] as string[],
      headings: [] as string[],
      bodyText: '',
      hasModal: false,
      progressSteps: [] as any[]
    }
    
    // Capture console
    cy.on('window:before:load', (win) => {
      const originalLog = win.console.log
      win.console.log = (...args) => {
        debugInfo.consoleLogs.push(args.map(arg => String(arg)).join(' '))
        originalLog(...args)
      }
      
      const originalError = win.console.error
      win.console.error = (...args) => {
        debugInfo.consoleErrors.push(args.map(arg => String(arg)).join(' '))
        originalError(...args)
      }
    })
    
    cy.visit('/')
    cy.wait(3000)
    
    // Collect page info
    cy.get('body').then($body => {
      // Get all button text
      $body.find('button').each((i, btn) => {
        debugInfo.buttons.push(btn.textContent?.trim() || '')
      })
      
      // Get all headings
      $body.find('h1, h2, h3').each((i, h) => {
        debugInfo.headings.push(`${h.tagName}: ${h.textContent?.trim()}`)
      })
      
      // Get body text preview
      debugInfo.bodyText = $body.text().substring(0, 500)
      
      // Check for modal
      debugInfo.hasModal = $body.find('[role="dialog"]').length > 0
      
      // Get progress steps
      $body.find('[data-testid^="progress-step-"]').each((i, step) => {
        debugInfo.progressSteps.push({
          index: i,
          visited: step.getAttribute('data-visited'),
          disabled: step.hasAttribute('disabled')
        })
      })
    })
    
    // Try to click create button
    cy.get('button').then($buttons => {
      const createBtn = $buttons.filter((i, el) => el.textContent?.includes('Create'))
      if (createBtn.length > 0) {
        cy.wrap(createBtn.first()).click()
        cy.wait(1000)
        
        cy.get('body').then($body => {
          debugInfo.hasModal = $body.find('[role="dialog"]').length > 0
        })
      }
    })
    
    // Output all debug info
    cy.then(() => {
      cy.task('log', '=== DEBUG INFO ===')
      cy.task('log', `Console Errors: ${debugInfo.consoleErrors.length}`)
      debugInfo.consoleErrors.forEach(err => cy.task('log', `ERROR: ${err}`))
      
      cy.task('log', `\nButtons found: ${debugInfo.buttons.length}`)
      debugInfo.buttons.forEach(btn => cy.task('log', `- "${btn}"`))
      
      cy.task('log', `\nHeadings:`)
      debugInfo.headings.forEach(h => cy.task('log', `- ${h}`))
      
      cy.task('log', `\nModal opened: ${debugInfo.hasModal}`)
      
      cy.task('log', `\nProgress steps: ${debugInfo.progressSteps.length}`)
      debugInfo.progressSteps.forEach(step => 
        cy.task('log', `- Step ${step.index}: visited=${step.visited}, disabled=${step.disabled}`)
      )
      
      cy.task('log', `\nBody preview: ${debugInfo.bodyText}`)
    })
  })
})