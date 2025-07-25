# Manual Test Checklist

Run through this checklist before committing any changes:

## Visual Checks
- [ ] All text is visible (no dark text on dark backgrounds)
- [ ] Buttons have hover states
- [ ] Forms have proper borders and backgrounds
- [ ] Loading spinners are visible
- [ ] Error messages are readable

## Workflow Tests

### 1. Project Creation
- [ ] Click "Create New Project" 
- [ ] Enter project name: "Test Project 123"
- [ ] Click Create
- [ ] Verify course title auto-populates with "Test Project 123"

### 2. Data Persistence
- [ ] Fill in course title: "My Updated Course"
- [ ] Select difficulty: "Expert"
- [ ] Add topics:
  ```
  Introduction
  Advanced Topics
  Conclusion
  ```
- [ ] Click Next to go to Media Enhancement
- [ ] Click Back
- [ ] **VERIFY**: All data is still there

### 3. Navigation
- [ ] From Course Config, click Next 3 times to reach Audio
- [ ] Click on step 0 in progress bar (should work - it's visited)
- [ ] Click on step 6 in progress bar (should NOT work - not visited)
- [ ] Verify you can only click on blue (visited) steps

### 4. Clean New Projects
- [ ] Go back to dashboard
- [ ] Create another new project
- [ ] **VERIFY**: Course title only has project name, topics are empty

### 5. File Uploads (if testing audio)
- [ ] Upload an audio file
- [ ] Navigate away and back
- [ ] **VERIFY**: Audio file is still there
- [ ] Try uploading 2 files quickly
- [ ] **VERIFY**: Page doesn't freeze

## Quick Fixes Checklist

If something looks wrong:

1. **Text not visible?**
   - Check text color in ProjectDashboard.tsx
   - Check tokens in designTokens.ts
   - Import ensure-text-visible.css as emergency fix

2. **Data not persisting?**
   - Check useStepData hook is being used
   - Check PersistentStorage is initialized
   - Check autosave is working

3. **Navigation broken?**
   - Check StepNavigationContext is wrapped around App
   - Check visitedSteps array is being updated
   - Check progress indicator data-visited attributes

4. **UI frozen?**
   - Check for blocking file operations
   - Check for infinite loops in effects
   - Check console for errors

## Browser Testing
- [ ] Chrome
- [ ] Firefox (if needed)
- [ ] Edge (if needed)

## Final Checks
- [ ] No console errors
- [ ] Build succeeds: `npm run build`
- [ ] TypeScript passes: `npm run type-check`