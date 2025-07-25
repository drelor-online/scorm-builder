/// <reference types="cypress" />

// Custom commands for SCORM Builder testing

// Command to create a new project quickly
Cypress.Commands.add('createProject', (projectName: string) => {
  // Click create button - text varies based on state
  cy.get('button').filter(':contains("Create")').first().click()
  cy.get('[role="dialog"]').should('be.visible')
  cy.get('input[placeholder="Enter project name"]').type(projectName)
  cy.contains('button', 'Create').click()
  cy.contains('h1', 'Course Configuration').should('be.visible')
})

// Command to navigate to a specific step
Cypress.Commands.add('navigateToStep', (stepNumber: number) => {
  cy.get(`[data-testid="progress-step-${stepNumber}"]`).click()
})

// Command to fill course configuration
Cypress.Commands.add('fillCourseConfig', (title: string, difficulty: string, topics: string) => {
  cy.get('input[placeholder*="course title" i]').clear().type(title)
  cy.contains('button', difficulty).click()
  cy.get('textarea[placeholder*="topics" i]').clear().type(topics)
})

// Declare types for TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      createProject(projectName: string): Chainable<void>
      navigateToStep(stepNumber: number): Chainable<void>
      fillCourseConfig(title: string, difficulty: string, topics: string): Chainable<void>
    }
  }
}