# Visual Automation Guide

The SCORM Builder now includes a powerful visual automation system that can run through the entire project workflow automatically while providing visual feedback and capturing screenshots.

## Quick Start

### From the UI
1. Open the Project Dashboard
2. In development mode, you'll see a "Run Automation" button
3. Click it to start the visual automation

### From the Console
Open the browser console and run:

```javascript
// Basic visual automation with screenshots
runFullAutomation({ 
  visual: true, 
  captureScreenshots: true,
  speed: 'normal'
})

// Slow mode for better visibility
runFullAutomation({ 
  visual: true, 
  captureScreenshots: true,
  speed: 'slow'
})

// Quick test without visuals
runFullAutomation({ 
  visual: false,
  scenario: 'quick'
})

// Keep the project after testing
runFullAutomation({ 
  visual: true,
  keepProject: true
})
```

## Features

### Visual Progress Overlay
- Shows real-time progress of each automation step
- Displays timing information for each step
- Highlights current action being performed
- Shows success/failure status immediately

### UI Navigation
- Virtual pointer shows where clicks are happening
- Elements are highlighted when interacted with
- Form fields are filled character-by-character in slow mode
- Smooth scrolling to elements before interaction

### Screenshot Capture
- Captures screenshots at key points in the workflow
- Stores screenshots with timestamps and step names
- Memory-efficient storage with automatic cleanup
- Export all screenshots as a ZIP file

### Screenshot Viewer
After running automation with screenshots:

```javascript
// Open the screenshot viewer
viewAutomationScreenshots()
```

Features:
- Navigate through screenshots with arrow keys
- Zoom in/out for detailed inspection
- Download individual screenshots or all as ZIP
- Thumbnail strip for quick navigation

## Automation Scenarios

### Quick (8 steps)
- Basic project creation and setup
- Minimal media and content
- Fastest execution time

### Standard (12 steps)
- Full project workflow
- Media enhancement on select topics
- Audio narration for all pages
- SCORM generation

### Comprehensive (15 steps)
- All features tested
- Rich text editing
- YouTube video integration
- Custom image uploads
- Preview testing
- Data persistence verification

## Options Reference

```typescript
interface AutomationOptions {
  keepProject?: boolean      // Don't delete project after test
  showProgress?: boolean     // Show progress modal (deprecated, use visual)
  scenario?: 'quick' | 'standard' | 'comprehensive'
  skipScormGeneration?: boolean
  visual?: boolean          // Enable visual mode (default: true)
  captureScreenshots?: boolean  // Capture screenshots during run
  speed?: 'fast' | 'normal' | 'slow'  // Animation speed
}
```

## Implementation Details

### Key Components

1. **AutomationUINavigator** (`src/utils/automationUINavigator.ts`)
   - Handles UI interactions programmatically
   - Provides visual feedback (highlighting, pointer)
   - Captures screenshots

2. **AutomationScreenshotManager** (`src/utils/automationScreenshotManager.ts`)
   - Manages screenshot storage and retrieval
   - Handles memory efficiently
   - Exports screenshots as ZIP

3. **AutomationProgressOverlay** (`src/utils/automationProgressOverlay.tsx`)
   - Visual progress display
   - Real-time status updates
   - Minimizable interface

4. **FullWorkflowAutomation** (`src/utils/fullWorkflowAutomation.ts`)
   - Main automation orchestrator
   - Coordinates all automation steps
   - Handles both visual and headless modes

### Adding Test IDs

To make elements accessible to automation, add `data-testid` attributes:

```jsx
<Button 
  onClick={handleClick}
  data-testid="my-button"
>
  Click Me
</Button>
```

Common test IDs needed:
- `new-project-button`
- `project-name-input`
- `create-project-confirm`
- `next-step-button`
- `save-button`

## Troubleshooting

### Screenshots not capturing
- Ensure `captureScreenshots: true` is set
- Check browser console for errors
- Try installing html2canvas: `npm install html2canvas`

### UI navigation failing
- Elements may not have test IDs yet
- Page may not be fully loaded
- Try using slower speed: `speed: 'slow'`

### Automation stops unexpectedly
- Check browser console for errors
- Ensure all required data is present
- Try running with `scenario: 'quick'` first

## Best Practices

1. **Always run in visual mode during development** to catch UI issues
2. **Capture screenshots for debugging** failed tests
3. **Use slow mode** when demonstrating to stakeholders
4. **Keep test projects** when debugging specific issues
5. **Add test IDs** to all interactive elements

## Future Enhancements

- Video recording of entire automation run
- Automated visual regression testing
- Custom automation scripts
- Parallel test execution
- Cloud screenshot storage