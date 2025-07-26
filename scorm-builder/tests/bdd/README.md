# BDD E2E Tests for SCORM Builder

This directory contains Behavior-Driven Development (BDD) tests for the SCORM Builder application using Cucumber.js and Playwright.

## Structure

```
tests/bdd/
├── features/          # Gherkin feature files
├── steps/            # Step definitions
├── pages/            # Page object models
├── fixtures/         # Test data
├── support/          # Cucumber configuration & hooks
├── reports/          # Test reports (generated)
└── resolved-issues/  # Documentation of resolved bugs
```

## Running Tests

### Quick Start
```bash
# Run all working tests
npm run test:bdd:working

# Run complete E2E workflow
npm run test:bdd:e2e

# Run specific step tests
npm run test:bdd:course-seed
```

### All Available Commands
```bash
# Basic test execution
npm run test:bdd              # Run all tests with Tauri
npm run test:bdd:browser       # Run tests in browser with mocked Tauri
npm run test:bdd:headed        # Run with visible browser

# Tagged test execution
npm run test:bdd:browser -- --tags @critical
npm run test:bdd:browser -- --tags @validation
npm run test:bdd:browser -- --tags "@e2e and not @skip"

# Specific feature file
npx cucumber-js tests/bdd/features/02-complete-workflow.feature --config cucumber.mjs
```

## Writing Tests

### 1. Feature Files

Write scenarios in Gherkin format:

```gherkin
Feature: Course Creation
  Scenario: Create a basic course
    Given I am on the Course Seed Input step
    When I enter "My Course" as the course title
    And I click the Next button
    Then I should proceed to the AI Prompt Generator step
```

### 2. Step Definitions

Implement steps in TypeScript:

```typescript
When('I enter {string} as the course title', async function (title: string) {
  await courseSeedInputPage.enterTitle(title)
})
```

### 3. Page Objects

Create page objects for reusable interactions:

```typescript
export class CourseSeedInputPage {
  async enterTitle(title: string) {
    await this.titleInput.fill(title)
  }
}
```

## Tags

- `@critical` - Critical path tests
- `@e2e` - Full end-to-end flows
- `@validation` - Input validation tests
- `@save-resume` - Save/load functionality
- `@error-recovery` - Error handling

## Test Data

Test data is defined in `fixtures/test-data.ts`:
- Course templates
- AI responses
- Media files
- Knowledge check questions

## Reports

After running tests, reports are generated in:
- `reports/cucumber-report.json` - JSON format
- `reports/cucumber-report.html` - HTML format

## Important Testing Patterns

### Auto-Save Timing

The application has auto-save functionality with a 1-second debounce. Always wait for auto-save to complete before navigation:

```gherkin
When I enter "Test Course" as the course title
And I add a topic "Introduction"
And I wait for auto-save to complete
And I click the Next button
```

### Navigation Testing

Use the appropriate navigation steps:

- `I click the Next button` - For navigating forward in the workflow
- `I click Next and wait for navigation` - When you need to ensure navigation completes
- `I should be on the "AI Prompt Generator" step` - To verify current step

## Common Issues and Solutions

1. **Navigation Reset Bug** (Resolved)
   - Issue: App would reset to initial step after clicking Next
   - Cause: Topics were not being saved in metadata
   - Solution: Updated `saveCourseMetadata` to include topics array
   - See: `resolved-issues/NAVIGATION_BUG.md`

2. **Test Timeouts**
   - Always use `I wait for auto-save to complete` before navigation
   - Use `noWaitAfter: true` option for clicks that trigger navigation
   - Increase step timeout if needed: `{ timeout: 10000 }`

## Test Helpers

### WaitHelpers (`support/waitHelpers.ts`)
Provides robust waiting strategies:
- `waitForAutoSave()` - Waits for auto-save debounce
- `waitForNavigation()` - Waits for page navigation
- `waitForStepTransition()` - Waits for workflow step changes

### Auto-Save Steps (`steps/auto-save.steps.ts`)
- `I wait for auto-save to complete` - Standard wait for auto-save
- `I fill the course seed form with auto-save:` - Fills form and waits

## Debugging

1. Run with headed mode to see the browser: `HEADLESS=false npm run test:bdd`
2. Add `await this.page.pause()` in steps to pause execution
3. Check browser console for errors with `I capture console logs` and `I check console logs for errors`
4. Screenshots are taken on failure
5. Use `I debug the current page state` to inspect page content

## Best Practices

1. **Always wait for auto-save** before clicking navigation buttons
2. Use data-testid attributes for reliable selectors
3. Keep scenarios focused and independent
4. Use Background for common setup
5. **Mock external dependencies** (Tauri API, network requests)
6. Clean up test data after each scenario
7. **Add descriptive tags** to scenarios for easy filtering