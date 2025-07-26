# SCORM Builder - Comprehensive Application Documentation

## Table of Contents
1. [Application Overview](#application-overview)
2. [Architecture](#architecture)
3. [User Journey & Steps](#user-journey--steps)
4. [Component Behaviors](#component-behaviors)
5. [Data Flow & State Management](#data-flow--state-management)
6. [Storage & Persistence](#storage--persistence)
7. [SCORM Generation](#scorm-generation)
8. [External Integrations](#external-integrations)
9. [Keyboard Shortcuts & Accessibility](#keyboard-shortcuts--accessibility)

---

## 1. Application Overview

### Purpose
SCORM Builder is a multi-step wizard application that guides users through creating SCORM-compliant e-learning packages. It transforms course ideas into fully functional SCORM packages with media, narration, and interactive elements.

### Key Features
- 7-step wizard interface for course creation
- AI-powered content generation
- Media enhancement with images and videos
- Audio narration with multiple TTS providers
- Knowledge check activities
- SCORM 1.2/2004 package generation
- Project management with file-based storage

### Technology Stack
- **Frontend**: React 19.1 with TypeScript
- **Build Tool**: Vite 7.0.4
- **Desktop**: Tauri 2.7.0
- **Storage**: IndexedDB + File System (via Tauri)
- **Testing**: Vitest + Playwright
- **Styling**: CSS-in-JS with design tokens

---

## 2. Architecture

### Component Structure
```
App.tsx (Main orchestrator)
├── Contexts (Global state providers)
│   ├── PersistentStorageContext (Storage abstraction)
│   ├── StepNavigationContext (Wizard navigation)
│   ├── AutoSaveContext (Auto-save functionality)
│   └── MediaContext (Media management)
├── Step Components (Lazy loaded)
│   ├── CourseSeedInput (Step 1)
│   ├── AIPromptGenerator (Step 2)
│   ├── JSONImportValidator (Step 3)
│   ├── MediaEnhancementWizard (Step 4)
│   ├── AudioNarrationWizard (Step 5)
│   ├── ActivitiesEditor (Step 6)
│   └── SCORMPackageBuilder (Step 7)
└── Supporting Components
    ├── ProjectDashboard (Project management)
    ├── Settings (API keys, preferences)
    ├── HelpPage (Documentation)
    └── TestChecklist (Testing guide)
```

### Lazy Loading Strategy
- Heavy components (Steps 2-7) are lazy loaded
- Settings and Help pages are lazy loaded
- Export/Import services loaded on demand
- Reduces initial bundle from 234KB to 96KB

---

## 3. User Journey & Steps

### Step 1: Course Seed Input
**Component**: `CourseSeedInputRefactored.tsx`

**Purpose**: Collect basic course information
- Course Title (required, 100 char limit)
- Target Audience (required, 200 char limit)
- Course Duration (5-90 minutes, default: 15)
- Topics List (1-20 topics, each 100 char limit)

**Behaviors**:
1. **Validation**:
   - Title cannot be empty
   - Audience cannot be empty
   - At least 1 topic required
   - Duration must be 5-90 minutes
   
2. **Topic Management**:
   - Add topic: Enter key or "Add Topic" button
   - Remove topic: X button on each topic
   - Reorder: Drag and drop (not implemented)
   - Auto-trim whitespace
   
3. **Navigation**:
   - Cannot proceed without valid data
   - Data persists on navigation

**Data Output**:
```typescript
interface CourseSeedData {
  title: string
  audience: string
  duration: number
  topics: string[]
}
```

### Step 2: AI Prompt Generator
**Component**: `AIPromptGenerator.tsx`

**Purpose**: Generate AI prompt for content creation

**Behaviors**:
1. **Template Selection**:
   - Professional
   - Casual
   - Academic
   - Technical
   - Creative
   
2. **Options**:
   - Include examples (checkbox)
   - Include objectives (checkbox, default: true)
   - Include assessments (checkbox, default: true)
   - Tone selection (dropdown)
   
3. **Prompt Generation**:
   - Combines seed data with template
   - Adds selected options
   - Shows character count
   - Copy to clipboard functionality
   
4. **AI Interaction**:
   - External: Opens ChatGPT/Claude
   - Paste response back
   - Basic validation of response

**Data Flow**:
- Input: CourseSeedData
- Output: AI-generated course content (pasted)

### Step 3: JSON Import/Validator
**Component**: `JSONImportValidatorRefactored.tsx`

**Purpose**: Validate and structure course content

**Behaviors**:
1. **Import Methods**:
   - Paste JSON
   - Upload .json file
   - Manual entry form
   
2. **Validation Rules**:
   - Required fields check
   - Data type validation
   - Content length limits
   - Structure validation
   
3. **Error Handling**:
   - Inline error messages
   - Field highlighting
   - Suggested fixes
   - Retry functionality
   
4. **Data Transformation**:
   - Normalizes structure
   - Generates IDs
   - Adds default values
   - Ensures SCORM compatibility

**Data Output**:
```typescript
interface CourseContent {
  title: string
  audience: string
  duration: number
  objectives: string[]
  welcomeMessage: string
  pages: Page[]
  topics: Topic[]
  assessment: Assessment
}
```

### Step 4: Media Enhancement Wizard
**Component**: `MediaEnhancementWizardRefactored.tsx`

**Purpose**: Add images and videos to course

**Behaviors**:
1. **Page Selection**:
   - Welcome page
   - Objectives page
   - Topic pages (paginated, 10 per page)
   
2. **Media Addition**:
   - **Images**: 
     - Upload from computer
     - Generate with AI keywords
     - Preview before adding
     - Replace existing
   - **Videos**:
     - YouTube URL input
     - Embed code validation
     - Preview in modal
   
3. **AI Image Generation**:
   - Keywords per page (editable)
   - Bulk generate option
   - Progress tracking
   - Error retry
   
4. **Media Management**:
   - View current media
   - Remove media
   - Replace media
   - Confirmation dialogs

**Storage**:
- Images stored as blobs in IndexedDB
- Videos stored as embed URLs
- Metadata includes dimensions, type, source

### Step 5: Audio Narration Wizard
**Component**: `AudioNarrationWizardRefactored.tsx`

**Purpose**: Add voice narration to course

**Behaviors**:
1. **Script Management**:
   - Auto-generated from content
   - Editable text areas
   - Character count
   - Save changes
   
2. **TTS Providers**:
   - **Browser TTS**: Free, basic
   - **ElevenLabs**: Premium voices
   - **Murf.ai**: Professional voices
   - Voice selection per provider
   - Preview functionality
   
3. **Audio Generation**:
   - Page-by-page generation
   - Bulk generation
   - Progress tracking
   - Error handling with retry
   
4. **Caption Management**:
   - Auto-generate VTT files
   - Edit captions
   - Sync with audio
   - Preview with audio

**Storage**:
- Audio files as blobs
- Caption files as text
- Duration metadata

### Step 6: Activities Editor
**Component**: `ActivitiesEditorRefactored.tsx`

**Purpose**: Add knowledge checks and assessments

**Behaviors**:
1. **Knowledge Checks** (per topic):
   - Question types:
     - Multiple choice
     - True/false
     - Fill in the blank
   - Immediate feedback
   - Navigation gating option
   
2. **Final Assessment**:
   - Multiple questions
   - Question bank
   - Pass/fail threshold
   - Randomization option
   
3. **Question Editor**:
   - Rich text editing
   - Media in questions
   - Feedback messages
   - Points/scoring
   
4. **Validation**:
   - At least one correct answer
   - Feedback required
   - Question text required

**Data Structure**:
```typescript
interface KnowledgeCheck {
  questions: Question[]
}

interface Question {
  id: string
  type: 'multiple-choice' | 'true-false' | 'fill-blank'
  question: string
  options?: string[]
  correctAnswer: string | number
  feedback: {
    correct: string
    incorrect: string
  }
}
```

### Step 7: SCORM Package Builder
**Component**: `SCORMPackageBuilderRefactored.tsx`

**Purpose**: Generate final SCORM package

**Behaviors**:
1. **Preview**:
   - Live preview in iframe
   - Navigation testing
   - Media playback check
   - Assessment testing
   
2. **Configuration**:
   - SCORM version (1.2/2004)
   - Manifest metadata
   - Completion criteria
   - Scoring options
   
3. **Generation**:
   - Progress indicator
   - File bundling
   - Zip creation
   - Download trigger
   
4. **Testing Checklist**:
   - LMS upload guide
   - Common issues
   - Testing steps

---

## 4. Component Behaviors

### Global Behaviors

#### Auto-Save
- Triggers: 30 seconds after change
- Debounced to prevent excessive saves
- Visual indicator (spinner + "Saving...")
- Error recovery with retry
- Stores to current project

#### Navigation
- Step validation before proceeding
- Back navigation always allowed
- Progress indicator in header
- Unsaved changes warning
- Keyboard shortcuts (Alt+N/P)

#### Error Handling
- Toast notifications for errors
- Inline validation messages
- Network error detection
- Fallback UI components
- Error boundaries per step

### Common UI Patterns

#### Forms
- Real-time validation
- Clear error messages
- Loading states
- Disabled state styling
- Focus management

#### Modals
- Backdrop click to close
- Escape key to close
- Focus trap
- Smooth animations
- Z-index management

#### Lists
- Add/remove animations
- Empty states
- Pagination (10 items)
- Search/filter (where applicable)
- Selection states

---

## 5. Data Flow & State Management

### State Hierarchy
```
App State
├── Navigation State (current step, can proceed)
├── Course Data
│   ├── Seed Data (step 1)
│   ├── Course Content (steps 2-3)
│   ├── Media Assets (step 4)
│   ├── Audio/Captions (step 5)
│   └── Activities (step 6)
├── UI State
│   ├── Loading states
│   ├── Error states
│   ├── Modal visibility
│   └── Form dirty states
└── Storage State
    ├── Current project ID
    ├── Save status
    └── Storage type
```

### Data Transformations

#### Step 1 → Step 2
- Seed data becomes prompt context
- Topics become content sections
- Duration influences depth

#### Step 2 → Step 3
- AI response parsed to JSON
- Structure normalized
- IDs generated
- Defaults applied

#### Step 3 → Step 4
- Content provides media context
- Keywords extracted
- Page structure created

#### Step 4 → Step 5
- Content becomes narration scripts
- Media timing considered
- Order preserved

#### Step 5 → Step 6
- Topics get knowledge checks
- Assessment questions added
- Navigation flow defined

#### Step 6 → Step 7
- All data combined
- SCORM structure created
- Files bundled
- Package generated

---

## 6. Storage & Persistence

### Storage Layers

#### 1. PersistentStorageContext
Provides unified interface for:
- Project management
- Content storage
- Media storage
- Settings storage

#### 2. IndexedDB (Default)
```typescript
Database: ScormBuilder
├── projects (metadata)
├── content (course data)
├── media (blobs)
├── audio (blobs)
├── settings (preferences)
└── recovery (crash recovery)
```

#### 3. File System (Tauri)
- Projects as folders
- JSON files for data
- Binary files for media
- Organized structure

### Storage Operations

#### Project Creation
1. Generate unique ID
2. Create project record
3. Set as current
4. Initialize content

#### Auto-Save
1. Debounced trigger
2. Serialize current state
3. Update storage
4. Update timestamp

#### Media Storage
1. Convert to blob
2. Generate unique ID
3. Store with metadata
4. Update references

#### Recovery
1. Check for crash flag
2. Load last state
3. Prompt user
4. Restore or discard

---

## 7. SCORM Generation

### Package Structure
```
scorm-package.zip
├── imsmanifest.xml
├── index.html
├── pages/
│   ├── welcome.html
│   ├── objectives.html
│   ├── topic-1.html
│   └── assessment.html
├── media/
│   ├── images/
│   ├── audio/
│   └── captions/
├── scripts/
│   ├── scorm-api.js
│   └── navigation.js
└── styles/
    └── main.css
```

### SCORM Features

#### Navigation
- Sidebar menu
- Progress tracking
- Previous/Next buttons
- Knowledge check gating
- Completion status

#### Media Playback
- Audio players with controls
- Caption display
- Image lightbox
- Video embeds
- Responsive sizing

#### Assessment
- Question rendering
- Answer validation
- Score calculation
- Pass/fail status
- Result reporting

#### SCORM API
- Initialize/Terminate
- Get/Set values
- Commit data
- Error handling
- Status tracking

### Generation Process

1. **Prepare Data**
   - Validate content
   - Process media
   - Generate IDs

2. **Create HTML**
   - Page templates
   - Dynamic content
   - Media references

3. **Bundle Assets**
   - Copy media files
   - Generate scripts
   - Create styles

4. **Create Manifest**
   - Metadata
   - Organization
   - Resources
   - SCORM version

5. **Package ZIP**
   - Compress files
   - Set structure
   - Generate blob
   - Trigger download

---

## 8. External Integrations

### ElevenLabs API
- Endpoint: https://api.elevenlabs.io/v1/
- Authentication: API key
- Features:
  - Voice list
  - Text-to-speech
  - Voice settings
  - Usage tracking

### Murf.ai API
- Manual process
- Copy-paste workflow
- File upload/download
- Voice selection in UI

### AI Services
- ChatGPT (external)
- Claude (external)
- Manual copy-paste
- No direct integration

### YouTube
- Embed URL validation
- oEmbed API (optional)
- Iframe parameters
- Privacy mode

---

## 9. Keyboard Shortcuts & Accessibility

### Global Shortcuts
- `Alt + N`: Next step
- `Alt + P`: Previous step
- `Alt + S`: Save project
- `Escape`: Close modal
- `Ctrl + Z`: Undo (in text fields)

### Accessibility Features
- Keyboard navigation
- Focus indicators
- ARIA labels
- Screen reader support
- High contrast mode
- Skip links

### Form Controls
- Tab navigation
- Enter to submit
- Space to toggle
- Arrow keys in selects
- Escape to cancel

---

## Testing Considerations

### User Flows to Test
1. Complete course creation
2. Save and resume
3. Import existing content
4. Media upload/generation
5. Audio generation
6. Assessment creation
7. SCORM generation
8. Error recovery

### Edge Cases
- Network failures
- Large files
- Invalid data
- Browser limits
- Concurrent edits
- Storage quota

### Integration Points
- File system access
- IndexedDB operations
- API calls
- Media processing
- ZIP generation

This documentation serves as the foundation for behavior-driven test development. Each behavior described should have corresponding tests to ensure the application functions as expected.