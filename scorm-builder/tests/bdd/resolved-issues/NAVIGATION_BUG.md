# Navigation Bug in SCORM Builder

## Issue Description
The application has a navigation bug that prevents moving from the Course Seed Input step to the AI Prompt Generator step in the test environment.

## Root Cause
1. When the user clicks Next on the Course Seed Input form, the app calls `handleCourseSeedSubmit`
2. This function saves the course metadata WITHOUT including the topics array:
   ```javascript
   await storage.saveCourseMetadata({
     courseTitle: data.courseTitle,
     difficulty: data.difficulty,
     lastModified: new Date().toISOString()
   })
   ```

3. The app then tries to navigate to the 'prompt' step
4. However, the app immediately reloads the project data in a useEffect hook
5. When loading, it checks if `metadata.topics` exists and has items
6. Since topics were not saved in the metadata, it considers this a "new project" and resets to the 'seed' step

## Evidence
From the console logs:
- `State changed: {currentStep: prompt, ...}` - Navigation happens
- `Loaded metadata: {courseTitle: , difficulty: 3, topics: Array(0)}` - Topics array is empty
- `New project detected, starting fresh...` - App resets
- `State changed: {currentStep: seed, ...}` - Back to beginning

## Workaround for Testing
To properly test the full E2E flow, we need to either:
1. Fix the app to include topics in the metadata when saving
2. Create a mock that intercepts and fixes the metadata structure
3. Test each step in isolation rather than as a continuous flow

## Recommendation
This should be fixed in the application code by updating `handleCourseSeedSubmit` to include topics in the metadata save operation.