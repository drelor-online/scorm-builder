# Comprehensive Fix Plan - SCORM Builder

## Issues to Address

### 1. Immediate SCORM Package Fixes
- Logo showing all white (remove filter, use proper SVG)
- Content only displays correctly in fullscreen
- Content doesn't scroll on overflow
- Audio/captions not loading
- Knowledge check blocking navigation incorrectly
- Remove "Start Course" button
- Allow backward navigation always

### 2. Data Persistence Issues
- Audio narration disappearing after navigation
- General data loss when navigating between pages
- Need temporary storage for all media/content

### 3. New Features
- Dashboard for recent projects
- Real-time preview (not mock)
- Working navigation in preview
- Progressive preview updates

## Implementation Plan (TDD Approach)

### Phase 1: Data Persistence Layer
1. **Create persistent storage service**
   - Intent: "When user uploads media, it should persist across navigation"
   - Intent: "When user enters content, it should be saved automatically"
   - Use IndexedDB for media storage
   - Use localStorage for text content with auto-save

2. **Project management service**
   - Intent: "User should see recent projects on startup"
   - Intent: "User should be able to create new or open existing projects"
   - Store project metadata and file references

### Phase 2: Fix SCORM Generation Issues
1. **Logo fixes**
   - Intent: "Logo should be visible on dark background without filters"
   - Use proper SVG with built-in colors

2. **Layout/scrolling fixes**
   - Intent: "Content should be fully visible and scrollable at any screen size"
   - Fix iframe height calculation
   - Ensure proper overflow handling

3. **Audio/caption loading**
   - Intent: "Audio and captions should load from stored data"
   - Fix file path references
   - Ensure media files are properly included

4. **Navigation fixes**
   - Intent: "User can always go backward"
   - Intent: "Knowledge check only blocks forward, not backward"
   - Remove "Start Course" button

### Phase 3: Real Preview System
1. **Replace mock preview with real generation**
   - Intent: "Preview shows exactly what SCORM package will contain"
   - Generate actual HTML/CSS/JS on demand
   - Use iframe to display real content

2. **Working preview navigation**
   - Intent: "All buttons in preview should work like final SCORM"
   - Implement full navigation within preview

### Phase 4: Dashboard & Project Management
1. **Create dashboard component**
   - Intent: "User sees recent projects on app start"
   - Intent: "User can create new or continue existing project"
   - Clear separation between projects

## Test Structure

```typescript
// Example intent-based test structure
describe('Data Persistence', () => {
  it('should persist audio files across navigation', async () => {
    // Red: Test fails initially
    // User uploads audio file
    // Navigate away and back
    // Audio should still be there
  })
  
  it('should auto-save content as user types', async () => {
    // Red: Test fails initially
    // User types content
    // Wait for debounce
    // Content should be in storage
  })
})

describe('SCORM Preview', () => {
  it('should generate real preview content, not mock', async () => {
    // Red: Test fails initially
    // Add content to course
    // Click preview
    // Should see actual content, not placeholder
  })
  
  it('should allow navigation within preview', async () => {
    // Red: Test fails initially
    // Open preview with multiple topics
    // Click next/previous
    // Should navigate between real topics
  })
})
```

## Priority Order
1. Fix data persistence (prevents data loss)
2. Fix SCORM generation issues (makes package work correctly)
3. Implement real preview system
4. Add dashboard and project management

## Next Steps
1. Create failing tests for data persistence
2. Implement storage service
3. Update all components to use persistent storage
4. Fix SCORM generation issues one by one
5. Replace mock preview with real generation
6. Add dashboard