# Visual Regression Testing Guide

## Overview
Visual regression testing captures screenshots of your application and compares them against baseline images to detect unintended visual changes.

## Setup
The visual regression system is built into the BDD test framework and uses Playwright's screenshot capabilities.

## Directory Structure
```
test-results/visual-regression/
├── baseline/     # Reference screenshots
├── actual/       # Current test screenshots  
├── diff/         # Difference images (when implemented)
└── report/       # HTML and JSON reports
```

## Basic Usage

### 1. Capture a Simple Screenshot
```gherkin
When I capture screenshot "homepage" for visual regression
Then the screenshot "homepage" should match the baseline
```

### 2. Capture with Options
```gherkin
When I capture screenshot "dialog" with options:
  | fullPage | false          |
  | selector | .modal-content |
```

### 3. Mask Dynamic Content
```gherkin
When I capture screenshot "form" masking dynamic content
```
This automatically masks timestamps, dates, and auto-save indicators.

### 4. Capture Multiple Elements
```gherkin
When I capture visual regression screenshots for:
  | name           | selector                    |
  | header         | [data-testid="page-header"] |
  | navigation     | .navigation-menu            |
  | main-content   | main                        |
```

## Running Visual Regression Tests

### First Run (Create Baselines)
```bash
npm run test:bdd -- --tags @visual
```
This creates baseline images for comparison.

### Subsequent Runs
```bash
npm run test:bdd -- --tags @visual
```
Compares current screenshots against baselines.

### Update Baselines
When UI changes are intentional:
```gherkin
When I update the baseline for "homepage"
```

## Best Practices

### 1. Mask Dynamic Content
Always mask content that changes between test runs:
- Timestamps and dates
- Loading indicators
- Auto-save messages
- Random IDs or generated content

### 2. Use Specific Selectors
Instead of full-page screenshots, capture specific components:
```gherkin
When I capture screenshot "button" with options:
  | selector | [data-testid="submit-button"] |
```

### 3. Test Different States
Capture all important states:
- Empty states
- Filled forms
- Error states
- Success states
- Hover states
- Focus states

### 4. Responsive Testing
Test different viewport sizes:
```gherkin
Given I set the viewport to 1920x1080
When I capture screenshot "desktop" for visual regression
Given I set the viewport to 375x667
When I capture screenshot "mobile" for visual regression
```

## Handling Failures

### View Report
After tests run, open:
```
test-results/visual-regression/report/index.html
```

### Review Differences
1. Check actual vs baseline images
2. Determine if change is intentional
3. Update baseline if needed

### Common Issues
- **Font rendering**: May vary between OS/browsers
- **Animations**: Capture after animations complete
- **Scrollbars**: Can appear differently across platforms
- **Anti-aliasing**: Minor pixel differences

## CI/CD Integration

### Store Baselines in Git
```bash
git add test-results/visual-regression/baseline/
git commit -m "Update visual regression baselines"
```

### Ignore Test Artifacts
Already configured in .gitignore:
```
test-results/visual-regression/actual/
test-results/visual-regression/diff/
test-results/visual-regression/report/
```

### CI Configuration
```yaml
- name: Run visual regression tests
  run: npm run test:bdd -- --tags @visual
  
- name: Upload visual regression artifacts
  if: failure()
  uses: actions/upload-artifact@v3
  with:
    name: visual-regression-results
    path: test-results/visual-regression/
```

## Example Test Suite

```gherkin
@visual @stable
Feature: Visual Regression - Course Builder UI

  Background:
    Given I am on the dashboard page

  Scenario: Dashboard components
    When I capture visual regression screenshots for:
      | name        | selector                        |
      | header      | [data-testid="page-header"]     |
      | project-list| [data-testid="projects-grid"]   |
      | create-btn  | button:has-text("Create New")   |
    Then all visual regression screenshots should match baselines

  Scenario: Form states
    When I click "Create New Project"
    And I enter "Visual Test" in the project name input
    And I click the Create button
    Then I should see the Course Seed Input form
    # Empty state
    When I capture screenshot "form-empty" masking dynamic content
    # Filled state
    When I enter "Test Course" as the course title
    And I capture screenshot "form-filled" masking dynamic content
    Then all visual regression screenshots should match baselines
```

## Future Enhancements

1. **Pixel-by-pixel comparison**: Integrate pixelmatch for detailed diffs
2. **Threshold configuration**: Allow acceptable pixel differences
3. **Percy integration**: For cloud-based visual testing
4. **Cross-browser testing**: Run same tests in multiple browsers
5. **Visual accessibility**: Highlight contrast issues