# Debug and Screenshot Functionality

## Overview
The BDD test suite now includes comprehensive debugging and screenshot capture capabilities to help diagnose test failures and document test execution.

## Automatic Screenshot on Failure

When any test fails, the system automatically captures:
- Full-page screenshot (PNG)
- Complete HTML content
- Console error logs (if any)
- Page state information (URL, title, viewport, etc.)

Files are saved to: `test-results/screenshots/`

## Manual Screenshot Steps

### Basic Screenshot
```gherkin
When I take a screenshot named "my-screenshot"
```

### Before/After Actions
```gherkin
When I take a screenshot before "clicking submit"
And I click "Submit"
And I take a screenshot after "clicking submit"
```

### Current Page State
```gherkin
When I capture the current page state
```

## Debug Steps

### Log Form Elements
```gherkin
When I log all form inputs
When I log all visible buttons
```

### Check for Errors
```gherkin
Then I should see no JavaScript errors
```

### Network and Auto-save
```gherkin
When I wait for network idle
When I debug auto-save
```

## Example Usage

```gherkin
Feature: Debug Example
  
  @debug
  Scenario: Debug form submission
    Given I am on the dashboard page
    When I take a screenshot before "form fill"
    And I fill in the form
    And I log all form inputs
    And I take a screenshot after "form fill"
    When I click "Submit"
    Then I should see no JavaScript errors
```

## File Naming Convention

Screenshots are named with:
- Timestamp (ISO format with colons replaced)
- Descriptive name (sanitized)
- File type (.png, .html, -state.json)

Example: `2025-07-25T17-47-24-301Z-dashboard-initial.png`

## Configuration

The functionality is automatically enabled. Screenshots are captured for test statuses:
- FAILED
- AMBIGUOUS
- UNDEFINED  
- PENDING

## Gitignore

Test artifacts are automatically excluded from git:
```
test-results/
tests/bdd/screenshots/
*.png
*.html
*-state.json
```

## Tips

1. Use descriptive names for manual screenshots
2. Capture before/after critical actions
3. Check console errors when tests behave unexpectedly
4. Use `@debug` tag for scenarios needing extra debugging
5. Review HTML captures to see exact page state during failures