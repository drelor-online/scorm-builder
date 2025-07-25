# Debug Logger Documentation

The SCORM Builder includes a comprehensive debug logging system that monitors all aspects of the application for development and troubleshooting.

## Enabling Debug Mode

There are two ways to enable debug mode:

1. **URL Parameter**: Add `?debug` to the URL when launching the app
2. **localStorage**: Set `localStorage.setItem('debugMode', 'true')` in the browser console and refresh

## Using Debug Mode

### Keyboard Shortcut
- Press `Ctrl+Shift+D` to toggle the debug panel visibility

### Debug Panel Features
The debug panel (bottom-right corner) shows:
- Real-time logs with filtering by level (Info, Warn, Error, Debug, Perf, Actions)
- Export functionality to save logs as JSON
- Clear button to reset log history

### Debug Info Overlay
When debug mode is active, a small overlay in the top-left shows:
- "DEBUG MODE ACTIVE" indicator
- Current memory usage
- DOM node count
- Keyboard shortcut reminder

## What's Being Monitored

### 1. Performance Monitoring
- Memory usage snapshots (every 30 seconds)
- DOM node count (every 10 seconds)
- Long tasks (>50ms)
- React component render times (if React Profiler is available)

### 2. Network Monitoring
- All fetch requests with timing
- XMLHttpRequest calls
- Request/response details and errors

### 3. User Action Recording
- Click events with element details
- Input changes (passwords are redacted)
- Special key presses (Enter, Escape, Tab, Ctrl/Cmd combinations)

### 4. State Monitoring
- localStorage changes
- Project state changes (create, open, save)
- Content updates

### 5. Error Tracking
- Console errors and warnings
- Uncaught exceptions
- Unhandled promise rejections
- Tauri command failures

### 6. Tauri Integration
- All Tauri invoke calls are logged with timing
- Command arguments and results
- Error details with duration

## Log Persistence

When debug mode is enabled with `logToFile: true`, logs are written to:
- Windows: `%USERPROFILE%\.scorm-builder\logs\debug-YYYY-MM-DD.log`
- macOS/Linux: `~/.scorm-builder/logs/debug-YYYY-MM-DD.log`

## Accessing Debug Data Programmatically

```javascript
// Get debug logger instance
const logger = window.debugLogger

// Get performance metrics
const metrics = logger.getPerformanceMetrics()

// Get recent user actions
const actions = logger.getUserActions()

// Get state history
const states = logger.getStateHistory()

// Create a bug report
const report = logger.createBugReport()

// Replay user actions
logger.replayActions()
```

## Bug Report Generation

The debug logger can generate comprehensive bug reports containing:
- System information (user agent, screen resolution, window size)
- Performance metrics
- Last 100 log entries
- Last 50 user actions
- Last 20 state changes
- Active network requests
- Error count
- localStorage snapshot

To generate a bug report:
1. Open the browser console
2. Run: `window.debugLogger.createBugReport()`
3. Copy the returned JSON object

## Privacy Considerations

The debug logger:
- Redacts password field values
- Truncates large data objects
- Limits stored history (1000 logs, 100 actions, 50 state changes)
- Sanitizes sensitive data before logging

## Disabling Debug Mode

To disable debug mode:
1. Open browser console
2. Run: `window.debugLogger.disable()`
3. The page will reload without debug mode

Or simply remove the `?debug` parameter from the URL or clear the localStorage flag.