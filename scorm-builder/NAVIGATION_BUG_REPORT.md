# Navigation Bug Report

## Issue Summary
The application fails to navigate from Course Seed Input to AI Prompt Generator when clicking the Next button, even though the form is properly filled and validated.

## Root Cause
There's a project loading error showing in the UI: "Failed to open project: Error: No project currently open"

This error appears to be preventing navigation, even though:
1. The form is filled correctly
2. The Next button is enabled
3. The click event fires successfully

## Evidence from Tests

### Console Logs Show:
- Project is created with ID like `project-fix-nav-test-1234567890`
- But then it tries to load a different project ID `test-project-1`
- The metadata (course title, topics) is saved correctly
- The project ID mismatch causes the "No project currently open" error

### Test Results:
- Form filling works correctly ✅
- Auto-save appears to work ✅
- Next button becomes enabled ✅
- Click event fires ✅
- Navigation does NOT occur ❌
- Page remains on Course Seed Input ❌

## Attempted Fixes

1. **Fixed form filling**: Added `clear()` before `fill()` - This worked ✅
2. **Fixed project ID consistency in mock**: Made mock generate consistent IDs - Partially helped
3. **Added various wait strategies**: Did not resolve the issue

## Recommendation

This appears to be an application bug, not a test issue. The app needs to:

1. Handle project loading errors gracefully
2. Not block navigation when there are non-critical errors
3. Ensure project state is consistent between create and load operations

## Test Status

Due to this application bug, the following navigation tests cannot pass:
- Navigate to AI Prompt Generator
- Navigate backward through workflow
- Complete end-to-end workflow

These tests should remain excluded from the `@stable` tag until the application bug is fixed.