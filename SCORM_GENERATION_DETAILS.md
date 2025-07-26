# SCORM Generation - Detailed Process Documentation

## Overview

The SCORM generation system transforms course content into a complete SCORM package through a modular architecture:

1. **spaceEfficientScormGenerator.ts** - Main orchestrator
2. **spaceEfficientScormGeneratorEnhanced.ts** - Page generation and styling
3. **spaceEfficientScormGeneratorNavigation.ts** - JavaScript navigation logic
4. **spaceEfficientScormGeneratorPages.ts** - Welcome/Objectives pages

## Data Structure

### EnhancedCourseContent Interface
```typescript
interface EnhancedCourseContent {
  // Course metadata
  title: string
  duration: number // minutes
  passMark: number // percentage (default: 80)
  navigationMode: "linear" | "free"
  allowRetake: boolean
  
  // Welcome page
  welcome: {
    title: string
    content: string
    startButtonText: string
    imageUrl?: string
    audioFile?: string
    audioBlob?: Blob
    captionFile?: string
    captionBlob?: Blob
    media?: Media[]
  }
  
  // Learning objectives
  objectives: string[]
  objectivesPage?: PageMedia
  
  // Topic content
  topics: Topic[]
  
  // Assessment
  assessment: {
    questions: AssessmentQuestion[]
  }
  
  // Audio timing data
  audioDurations?: Record<string, number>
}
```

## Generation Process

### 1. Package Initialization

```typescript
async function generateSpaceEfficientSCORM12Buffer(
  courseContent: EnhancedCourseContent,
  storage?: PersistentStorage
): Promise<GeneratorResult> {
  const zip = new JSZip()
  
  // Create folder structure
  zip.folder('pages')
  zip.folder('media')
  zip.folder('media/images')
  zip.folder('media/audio')
  zip.folder('media/captions')
  zip.folder('scripts')
  zip.folder('styles')
  zip.folder('assets')
```

### 2. File Extension Detection

The system intelligently detects image file extensions:

```typescript
const getFileExtension = (blob: Blob, media?: any): string => {
  // Priority order:
  // 1. Check metadata.fileName
  // 2. Check MIME type
  // 3. Check URL pattern
  // 4. Check media ID
  // 5. Default to 'jpg'
  
  // Supports: jpg, png, gif, webp, svg
}
```

### 3. Manifest Generation

```xml
<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${courseTitle}_manifest" version="1.0">
  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>
  <organizations default="course_org">
    <organization identifier="course_org">
      <title>${courseTitle}</title>
      <item identifier="course_item" identifierref="course_resource">
        <title>${courseTitle}</title>
      </item>
    </organization>
  </organizations>
  <resources>
    <resource identifier="course_resource" type="webcontent" 
              adlcp:scormtype="sco" href="index.html">
      <file href="index.html"/>
      <file href="styles/main.css"/>
      <file href="scripts/navigation.js"/>
      <file href="scripts/scorm-api.js"/>
      <!-- Dynamic page files -->
    </resource>
  </resources>
</manifest>
```

### 4. Main Index.html Structure

The index.html serves as the main container with:

1. **Sidebar Navigation**
   - Progress circle (visual percentage)
   - Navigation menu with numbered items
   - Completion checkmarks
   - Active state highlighting

2. **Content Area**
   - Dynamic iframe loading
   - Page title display
   - Fullscreen toggle

3. **Footer Navigation**
   - Previous/Next buttons
   - State management

### 5. Page Generation

#### Welcome Page
```typescript
generateWelcomePage(courseContent):
- Title and content display
- Media panel (images/videos)
- Audio player with captions
- Start button styling
```

#### Objectives Page
```typescript
generateObjectivesPage(courseContent):
- Bulleted objectives list
- Optional media support
- Audio narration
- Consistent layout
```

#### Topic Pages
```typescript
generateEnhancedTopicPage(topic, index, courseContent):
- Content with HTML support
- Media carousel (multiple images)
- Video embeds (YouTube)
- Audio player with controls
- Knowledge check questions
- Navigation gating
```

#### Assessment Page
```typescript
generateAssessmentPage(courseContent):
- Question rendering
- Radio button inputs
- Submit functionality
- Score calculation
- Pass/fail display
```

### 6. Navigation System

The navigation JavaScript provides:

1. **State Management**
   ```javascript
   let currentPage = 'welcome'
   let completedPages = new Set()
   let knowledgeCheckAttempts = {}
   let navigationBlockCount = {}
   ```

2. **Navigation Gating**
   - Knowledge checks must be attempted
   - Progressive warnings (3 attempts, 5 attempts)
   - Visual highlighting of unanswered questions
   - Assessment requires all topics complete

3. **Progress Tracking**
   - Percentage calculation
   - Visual progress circle
   - SCORM status updates
   - Page completion markers

### 7. Knowledge Check System

#### Question Types

1. **Multiple Choice**
   ```html
   <div class="kc-options">
     <label class="kc-option">
       <input type="radio" name="q1" value="0">
       Option text
     </label>
   </div>
   ```

2. **True/False**
   - Same as MC with 2 options
   - Special styling

3. **Fill in the Blank**
   ```html
   <input type="text" id="fill-blank-1" 
          style="padding: 8px; width: 300px;">
   ```

#### Validation Logic
```javascript
function submitAnswer() {
  // Check if answered
  // Validate correctness
  // Show feedback
  // Update navigation state
  // Flash correct answer if wrong
  // Disable inputs after submit
}
```

### 8. Media Handling

#### Images
1. Convert to blob
2. Detect extension
3. Save with unique ID
4. Reference in HTML
5. Lightbox support

#### Audio
1. Store as blob
2. Generate player HTML
3. Track timing
4. Controls:
   - Play/pause
   - Seek
   - Speed (0.5x-2x)
   - Volume
   - Skip ±10s

#### Captions
1. VTT format
2. Time adjustment based on audio
3. Sync with playback
4. Toggle visibility
5. Default: shown

### 9. SCORM API Implementation

```javascript
window.scormAPI = {
  LMSInitialize: function(param) {
    // Initialize session
    return "true"
  },
  
  LMSSetValue: function(element, value) {
    // Store in localStorage
    localStorage.setItem('scorm_' + element, value)
    return "true"
  },
  
  LMSGetValue: function(element) {
    // Retrieve from localStorage
    return localStorage.getItem('scorm_' + element) || ""
  },
  
  LMSCommit: function(param) {
    // Save state
    return "true"
  },
  
  LMSFinish: function(param) {
    // End session
    return "true"
  }
}
```

### 10. Styling System

The CSS provides:

1. **Responsive Layout**
   - Sidebar: 180px fixed
   - Content: Flexible
   - Mobile: Collapsed sidebar

2. **Theme Colors**
   - Primary: #8fbb40 (green)
   - Background: #241f20 (dark)
   - Text: #b3b4b2 (light gray)
   - Accent: #007acc (blue)

3. **Component Styles**
   - Progress circle animation
   - Button states
   - Form controls
   - Media containers
   - Knowledge checks

### 11. Assessment Scoring

```javascript
function calculateScore(correct, total) {
  return Math.round((correct / total) * 100)
}

function submitAssessment() {
  // Collect answers
  // Calculate score
  // Compare to pass mark
  // Update SCORM status
  // Show feedback
}
```

### 12. File Bundling

Final package structure:
```
scorm-package.zip
├── imsmanifest.xml (SCORM metadata)
├── index.html (Main container)
├── pages/
│   ├── welcome.html
│   ├── objectives.html
│   ├── topic-1.html
│   ├── topic-2.html
│   └── assessment.html
├── media/
│   ├── images/
│   │   ├── image-id-1.jpg
│   │   └── image-id-2.png
│   ├── audio/
│   │   ├── welcome-audio.mp3
│   │   └── topic-1-audio.mp3
│   └── captions/
│       ├── welcome-captions.vtt
│       └── topic-1-captions.vtt
├── scripts/
│   ├── navigation.js
│   ├── scorm-api.js
│   └── assessment.js
└── styles/
    └── main.css
```

## Error Handling

1. **Media Loading**
   - Fallback for missing images
   - Audio error states
   - Caption loading failures

2. **Navigation**
   - Prevent skipping required content
   - Handle missing pages
   - Recover from errors

3. **SCORM Communication**
   - Graceful degradation
   - Local storage fallback
   - Status persistence

## Accessibility Features

1. **Keyboard Navigation**
   - Tab order management
   - Enter/Space activation
   - Escape for modals

2. **Screen Reader Support**
   - ARIA labels
   - Role attributes
   - Status announcements

3. **Visual Aids**
   - Focus indicators
   - High contrast
   - Caption support

This comprehensive documentation provides the foundation for behavior-driven testing of the SCORM generation system.