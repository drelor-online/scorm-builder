# BDD Testing Guide for SCORM Builder

## Overview

The SCORM Builder is a Tauri desktop application that requires the Tauri runtime for full functionality. This presents unique challenges for browser-based BDD testing.

## Testing Approaches

### 1. Testing Against Tauri App (Recommended)

To test the full application with all features:

```bash
# Start the Tauri development server
npm run tauri:dev

# In another terminal, run BDD tests
npm run test:bdd
```

The tests will connect to the Tauri app's web view on the configured port.

### 2. Browser Testing Limitations

When running the app in a regular browser (http://localhost:1420), you'll encounter:
- "Storage Initialization Failed" error
- Missing Tauri APIs (`window.__TAURI__` is undefined)
- File system operations won't work

This is because the app depends on Tauri's native APIs for:
- File storage and project management
- Dialog windows
- File system access
- Window management

## Test Implementation Status

### ✅ Completed
- Comprehensive BDD feature files for all 7 steps
- Test infrastructure setup (Cucumber + Playwright)
- Page Object Model structure
- Basic step definitions
- Mock Tauri API implementation (partial)

### 🚧 In Progress
- Step definition implementations
- Browser-compatible testing approach

### 📋 TODO
- Complete step definitions for all scenarios
- Set up CI/CD pipeline for automated testing
- Create test data fixtures

## Running Tests

### Basic Test Run
```bash
npm run test:bdd
```

### Headed Mode (See Browser)
```bash
npm run test:bdd:headed
```

### Specific Feature
```bash
npm run test:bdd -- --tags @validation
```

### Specific Scenario
```bash
npm run test:bdd -- --name "Course title validation"
```

## Feature Files

1. **01-complete-course-workflow.feature** - End-to-end workflow
2. **02-course-seed-input.feature** - Course configuration step
3. **03-ai-prompt-generator.feature** - AI prompt generation
4. **04-json-import-validator.feature** - JSON validation
5. **05-media-enhancement-wizard.feature** - Media management
6. **06-audio-narration-wizard.feature** - Audio and captions
7. **07-activities-editor.feature** - Knowledge checks
8. **08-scorm-package-builder.feature** - SCORM generation

## Known Issues

1. **Browser Testing**: The app cannot run in a browser without Tauri APIs
2. **Mock Implementation**: Current mock Tauri implementation doesn't fully replicate the API
3. **Async Operations**: Some Tauri operations are async and may cause timing issues

## Recommendations

1. **Use Tauri Dev Mode**: Always test against the running Tauri app for accurate results
2. **Test Data**: Create consistent test data fixtures for reproducible tests
3. **Parallel Testing**: Be cautious with parallel tests as they may interfere with shared storage

## Future Improvements

1. **Web-Compatible Mode**: Create a version that works without Tauri for easier testing
2. **Mock Server**: Implement a mock server that simulates Tauri APIs
3. **Visual Testing**: Add visual regression tests for UI consistency
4. **Performance Tests**: Add tests for performance metrics

## Technical Details

### Why Browser Testing Fails

The app's initialization flow:
1. `App.dashboard.tsx` uses `PersistentStorageProvider`
2. `usePersistentStorage` hook tries to initialize `FileStorage`
3. `FileStorage` calls Tauri's `invoke` API
4. Without Tauri, `window.__TAURI__` is undefined, causing initialization to fail
5. The app shows "Storage Initialization Failed" and won't proceed

### Mock Tauri Implementation

We attempted to mock Tauri APIs by:
1. Creating `mockTauri.ts` with simulated storage
2. Injecting it via Playwright's `addInitScript`
3. However, the bundled code doesn't see our injected mock

### Solution Options

1. **Refactor for Web Compatibility**: Add a storage abstraction layer that can use localStorage in browser mode
2. **Test Against Tauri**: Run the actual desktop app and test against it
3. **Create Test Build**: Build a special version with mock storage baked in

For now, option 2 (testing against Tauri) is the most practical approach.