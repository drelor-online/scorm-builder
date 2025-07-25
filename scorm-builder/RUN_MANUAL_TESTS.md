# Manual Testing Guide

## Quick Manual Test Steps

Since we found an issue with audio storage in automated tests, let's do a quick manual test:

### 1. Open Test Checklist
Press **Ctrl+Shift+T** in the app to open the manual test checklist

### 2. Test Audio Manually
1. Create a new project
2. Go through to Audio Recording step
3. Either:
   - Record a short audio clip (5 seconds)
   - Upload an MP3 file
4. Save the project
5. Close and reopen the project
6. Check if audio is still there

### 3. What to Check
- Does the audio play after reload?
- Is the duration shown correctly?
- Do the waveforms appear?

### 4. Console Commands
After doing manual tests, run these in console:
```javascript
// Check current project state
fileStorage.getCurrentProjectId()
fileStorage.currentProject.media.audio

// Run automated UI tests
await runUITests()
```

## Known Issues
- Audio storage test failing in automated tests
- Might be timing issue with auto-save
- Images work fine, so issue is audio-specific