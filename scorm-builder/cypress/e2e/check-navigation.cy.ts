describe('Check Navigation', () => {
  it('Checks what happens after project creation', () => {
    const debugInfo = {
      errors: [] as string[],
      afterCreation: {
        url: '',
        title: '',
        progressSteps: [] as any[],
        formFields: [] as any[]
      }
    }
    
    // Capture errors
    cy.on('window:before:load', (win) => {
      const originalError = win.console.error
      win.console.error = (...args) => {
        debugInfo.errors.push(args.map(arg => String(arg)).join(' '))
        originalError(...args)
      }
    })
    
    cy.visit('/')
    
    // Create project
    cy.get('button').contains('Create Your First Project').click()
    cy.get('[role="dialog"]').should('be.visible')
    
    // Fill and submit
    cy.get('input[placeholder="Enter project name"]').type('Test Navigation')
    cy.get('[role="dialog"] button').contains('Create').click()
    
    // Wait for navigation
    cy.wait(3000)
    
    // Collect info after navigation
    cy.url().then(url => debugInfo.afterCreation.url = url)
    
    cy.get('h1').then($h1 => {
      debugInfo.afterCreation.title = $h1.text()
    })
    
    // Check for progress steps
    cy.get('body').then($body => {
      // Try different selectors for progress indicator
      const selectors = [
        '[data-testid^="progress-step-"]',
        'button[data-testid*="step"]',
        '.progress-step',
        '.stepper-container button',
        '[class*="progress"] button'
      ]
      
      selectors.forEach(selector => {
        const found = $body.find(selector).length
        if (found > 0) {
          cy.task('log', `Found ${found} elements with selector: ${selector}`)
          $body.find(selector).each((i, el) => {
            debugInfo.afterCreation.progressSteps.push({
              selector,
              index: i,
              text: el.textContent,
              testId: el.getAttribute('data-testid'),
              visited: el.getAttribute('data-visited')
            })
          })
        }
      })
      
      // Check form fields
      $body.find('input, textarea, select').each((i, el) => {
        const field = el as HTMLInputElement
        debugInfo.afterCreation.formFields.push({
          type: el.tagName,
          placeholder: field.placeholder,
          value: field.value,
          id: field.id
        })
      })
    })
    
    // Output debug info
    cy.then(() => {
      cy.task('log', '=== AFTER PROJECT CREATION ===')
      cy.task('log', `URL: ${debugInfo.afterCreation.url}`)
      cy.task('log', `Page Title: ${debugInfo.afterCreation.title}`)
      
      cy.task('log', `\nProgress Steps Found: ${debugInfo.afterCreation.progressSteps.length}`)
      debugInfo.afterCreation.progressSteps.forEach(step => {
        cy.task('log', `- ${step.selector} [${step.index}]: "${step.text}" testId=${step.testId} visited=${step.visited}`)
      })
      
      cy.task('log', `\nForm Fields:`)
      debugInfo.afterCreation.formFields.forEach(field => {
        cy.task('log', `- ${field.type}: placeholder="${field.placeholder}" value="${field.value}"`)
      })
      
      if (debugInfo.errors.length > 0) {
        cy.task('log', `\nErrors: ${debugInfo.errors.length}`)
        debugInfo.errors.forEach(err => cy.task('log', `ERROR: ${err}`))
      }
    })
  })
})