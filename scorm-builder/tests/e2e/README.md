# SCORM Builder End-to-End Testing Guide

> **Note:** The Playwright-based instructions below are archived. New automated desktop tests live under `tests/tauri` and are executed with WebdriverIO + tauri-driver (`npm run test:tauri`).

This guide explains how to run the comprehensive test suite for SCORM Builder, including AI analysis capabilities.

## Quick Start

### 1. Validation Test (Recommended First)
```bash
# Run basic validation test to check if app loads
npm run test:validation

# Run with browser visible for debugging
npm run test:validation:headed
```

### 2. Comprehensive AI Analysis
```bash
# Run full AI analysis suite (headless)
npm run test:comprehensive

# Run with browser visible for debugging
npm run test:comprehensive:headed
```

### 3. Individual Test Suites
```bash
# User journey tests
npx playwright test complete-user-journey.spec.ts

# Performance tests
npx playwright test performance-testing.spec.ts

# Accessibility tests  
npx playwright test accessibility-and-responsive.spec.ts

# Visual regression tests
npx playwright test visual-regression.spec.ts

# Cross-platform tests
npx playwright test cross-platform-compatibility.spec.ts

# Edge cases and error handling
npx playwright test edge-cases-and-error-handling.spec.ts

# Data persistence tests
npx playwright test data-persistence.spec.ts
```

## Test Modes

### Headless Mode (Default)
- Best for AI analysis and CI/CD
- Faster execution
- Consistent results for screenshots
- Generates comprehensive reports

```bash
npx playwright test comprehensive-ai-analysis.spec.ts
```

### Headed Mode (Browser Visible)
- Best for development and debugging
- Can see what tests are doing in real-time
- Easier to troubleshoot failures

```bash
npx playwright test comprehensive-ai-analysis.spec.ts --headed
```

### Debug Mode
- Interactive debugging with pause/step through
- DOM inspection during test execution

```bash
npx playwright test comprehensive-ai-analysis.spec.ts --debug
```

### UI Mode (Interactive)
- Visual test runner interface
- Best for test development and exploration

```bash
npx playwright test --ui
```

## Generated Reports

### AI Analysis Reports
After running comprehensive tests, reports are generated in:
- `test-results/ai-analysis/test-report-[timestamp].json`
- `test-results/ai-analysis/test-report-[timestamp].html`

### Playwright Reports
Standard Playwright reports are available:
```bash
npx playwright show-report
```

## Troubleshooting

### Application Not Starting
If tests fail with connection errors:

1. **Check if Tauri is installed:**
   ```bash
   npm run tauri --version
   ```

2. **Manually start the app:**
   ```bash
   npm run tauri:dev
   ```

3. **Run tests against running app:**
   ```bash
   # In another terminal
   npx playwright test --project=chromium
   ```

### Test Configuration Issues

1. **Update browser browsers:**
   ```bash
   npx playwright install
   ```

2. **Check configuration:**
   ```bash
   npx playwright test --list
   ```

### Common Test Failures

1. **"Create New Project" button not found:**
   - The app might not be fully loaded
   - Try increasing timeout in test
   - Run validation test first

2. **File upload failures:**
   - Check file permissions
   - Ensure test files are created correctly
   - Run with `--headed` to see what's happening

3. **Visual regression failures:**
   - Screenshots might differ across systems
   - Update baseline screenshots if needed

## Test Development

### Creating New Tests
1. Use `quick-validation.spec.ts` as a template
2. Follow the existing patterns in comprehensive tests
3. Add proper error handling and timeouts

### Best Practices
- Always check element visibility before interaction
- Use proper selectors (prefer data-testid)
- Include meaningful assertions
- Add debugging information for failures
- Clean up test data in afterEach hooks

### Test Data
The test suite includes helpers for generating test data:
- `helpers/test-data-generator.ts` - Realistic course data
- `helpers/file-helpers.ts` - File upload utilities  
- `helpers/test-reporter.ts` - AI analysis reporting

## Platform-Specific Notes

### Windows (WebView2)
- Primary testing platform
- Uses Chromium-based WebView2
- Best compatibility with modern web features

### Cross-Platform Testing
The suite includes tests for different webview behaviors:
- Windows: WebView2 (Chromium-based)
- macOS: WKWebView (WebKit-based) 
- Linux: WebKitGTK (WebKit-based)

Note: Cross-platform tests are currently configured to run Chromium, Firefox, and WebKit engines as proxies for the different platform webviews.

## Integration with CI/CD

For automated testing in CI/CD pipelines:

```bash
# Install dependencies
npm ci
npx playwright install --with-deps

# Run tests
npm run test:comprehensive

# Generate reports
npm run report:ai
```

Set environment variable `CI=true` for CI-specific configurations.