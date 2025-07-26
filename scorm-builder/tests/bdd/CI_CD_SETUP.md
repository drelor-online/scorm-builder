# CI/CD Test Setup

## Overview
The BDD test suite is configured for reliable CI/CD integration with stable tests, automatic retries, and comprehensive reporting.

## Test Commands

### For CI/CD Pipeline
```bash
npm run test:bdd:ci
```
- Runs only @stable tagged tests
- Fails fast on first failure
- Retries failed tests once
- Generates multiple report formats
- Strict mode enabled

### For Local Development
```bash
# Run all tests
npm run test:bdd

# Run stable tests only
npm run test:bdd:stable

# Run with debugging features
npm run test:bdd:debug

# Run with visible browser
npm run test:bdd:headed
```

## CI Configuration

The `cucumber.ci.mjs` configuration includes:
- **Tags**: `@stable and not @wip and not @skip`
- **Fail Fast**: Stops on first failure
- **Retry**: Failed tests retry once
- **Timeout**: 30 seconds per step
- **Reports**: JSON, HTML, JUnit formats

## Report Outputs

Test results are saved to `test-results/`:
- `cucumber-report.json` - Machine-readable results
- `cucumber-report.html` - Human-readable HTML report
- `cucumber-report.xml` - JUnit format for CI tools
- `screenshots/` - Failure screenshots

## GitHub Actions Example

```yaml
name: BDD Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run BDD tests
      run: npm run test:bdd:ci
      
    - name: Upload test results
      if: always()
      uses: actions/upload-artifact@v3
      with:
        name: test-results
        path: test-results/
```

## Test Stability Guidelines

### Marking Tests as Stable
Only add the `@stable` tag to tests that:
1. Pass consistently (>95% success rate)
2. Don't depend on external services
3. Have proper wait strategies
4. Handle async operations correctly
5. Clean up after themselves

### Currently Stable Tests
- Create project with dialog
- Fill course seed and navigate
- Basic form validation

### Tests Under Evaluation
- Navigate back from AI Prompt (timing issues)
- Multi-step navigation (needs investigation)

### Example Stable Test
```gherkin
@stable @navigation
Scenario: Create project with dialog
  Given I am on the dashboard page
  When I click "Create New Project"
  Then I should see a dialog with title "Create New Project"
  When I enter "Test Project" in the project name input
  And I click the Create button in the new project dialog
  Then I should see the Course Seed Input form
```

## Debugging CI Failures

1. **Check Screenshots**: Download artifacts to see failure screenshots
2. **Run Locally**: `npm run test:bdd -- --tags @failing-scenario`
3. **Add Debug Steps**: Use debug.steps.ts helpers
4. **Check Timing**: May need longer waits in CI environment

## Best Practices

1. **Use Page Objects**: Consistent selectors across tests
2. **Add Wait Strategies**: Don't rely on fixed timeouts
3. **Mock External Services**: Use mock Tauri API
4. **Clean Test Data**: Each test should be independent
5. **Descriptive Names**: Clear scenario and step names

## Environment Variables

- `HEADLESS`: Set to "false" for visible browser
- `BASE_URL`: Override default URL (default: http://localhost:1420)
- `TAURI_TEST`: Set to "true" to test against real Tauri app

## Maintenance

### Adding New Stable Tests
1. Write and test locally first
2. Run multiple times to verify stability
3. Add @stable tag only when confident
4. Monitor in CI for flakiness

### Removing Flaky Tests
1. Remove @stable tag immediately
2. Add @flaky tag for tracking
3. Fix root cause
4. Re-add @stable after verification