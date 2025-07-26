# Detailed Component Behaviors Documentation

## CourseSeedInput Component

### State Management
```typescript
// Local state
const [title, setTitle] = useState(initialData?.title || '')
const [audience, setAudience] = useState(initialData?.audience || '')
const [duration, setDuration] = useState(initialData?.duration || 15)
const [topics, setTopics] = useState<string[]>(initialData?.topics || [])
const [newTopic, setNewTopic] = useState('')
const [selectedTemplate, setSelectedTemplate] = useState<CourseTemplate | null>(null)
const [showTemplateModal, setShowTemplateModal] = useState(false)
const [showPreview, setShowPreview] = useState(false)
const [errors, setErrors] = useState<Record<string, string>>({})
```

### Validation Behaviors

1. **Title Validation**
   - Triggered: On blur, on submit
   - Rules:
     - Required (cannot be empty)
     - Max length: 100 characters
     - Trimmed of whitespace
   - Error display: Below input field
   - Error message: "Course title is required"

2. **Audience Validation**
   - Triggered: On blur, on submit
   - Rules:
     - Required (cannot be empty)
     - Max length: 200 characters
     - Trimmed of whitespace
   - Error display: Below input field
   - Error message: "Target audience is required"

3. **Duration Validation**
   - Triggered: On change, on submit
   - Rules:
     - Min: 5 minutes
     - Max: 90 minutes
     - Must be integer
     - Default: 15 minutes
   - Input type: Number with increment/decrement
   - Error message: "Duration must be between 5 and 90 minutes"

4. **Topics Validation**
   - Triggered: On add, on submit
   - Rules:
     - Min topics: 1
     - Max topics: 20
     - Each topic max length: 100 characters
     - No duplicate topics (case insensitive)
     - Empty topics ignored
   - Error messages:
     - "At least one topic is required"
     - "Maximum 20 topics allowed"
     - "Topic already exists"

### Topic Management Behaviors

1. **Adding a Topic**
   ```typescript
   const handleAddTopic = () => {
     const trimmed = newTopic.trim()
     if (!trimmed) return
     if (topics.length >= 20) {
       setErrors({ topics: 'Maximum 20 topics allowed' })
       return
     }
     if (topics.some(t => t.toLowerCase() === trimmed.toLowerCase())) {
       setErrors({ topics: 'Topic already exists' })
       return
     }
     setTopics([...topics, trimmed])
     setNewTopic('')
     setErrors({})
   }
   ```
   - Trigger: Enter key or Add button click
   - Input cleared after successful add
   - Focus remains on input

2. **Removing a Topic**
   - Trigger: Click X button on topic chip
   - No confirmation required
   - Updates topic count immediately
   - Re-validates if below minimum

3. **Topic Reordering**
   - Currently not implemented
   - Planned: Drag and drop support

### Template System Behaviors

1. **Template Selection Modal**
   - Trigger: "Use Template" button
   - Templates available:
     - Software Training
     - Compliance Training
     - Product Knowledge
     - Onboarding Program
     - Sales Training
   - Each template includes:
     - Pre-filled title
     - Target audience
     - Duration
     - Topic list

2. **Template Application**
   ```typescript
   const handleTemplateSelect = (template: CourseTemplate) => {
     setTitle(template.title)
     setAudience(template.audience)
     setDuration(template.duration)
     setTopics([...templateTopics[template.id]])
     setShowTemplateModal(false)
     setHasChanges(true)
   }
   ```
   - Overwrites all current values
   - No merge behavior
   - Marks form as dirty

### Auto-Save Behaviors

1. **Trigger Conditions**
   - Any field change
   - 30-second debounce
   - Only if form has changes

2. **Save Indicator States**
   - Idle: No indicator
   - Saving: Spinner + "Saving..."
   - Saved: Checkmark + "Saved"
   - Error: X + "Failed to save"

3. **Data Saved**
   ```typescript
   {
     title,
     audience,
     duration,
     topics
   }
   ```

### Navigation Behaviors

1. **Next Button**
   - Enabled only when:
     - Title is not empty
     - Audience is not empty
     - At least one topic exists
     - Duration is valid (5-90)
   - Validates all fields on click
   - Shows first error if validation fails

2. **Back/Previous**
   - Not available on step 1
   - Would trigger unsaved changes dialog

### Preview Feature

1. **Toggle Preview**
   - Button: "Preview" / "Hide Preview"
   - Shows course structure visualization
   - Updates in real-time
   - Displays:
     - Course title
     - Duration with clock icon
     - Audience with user icon
     - Topics as numbered list

### Keyboard Shortcuts

1. **In Topic Input**
   - Enter: Add topic
   - Escape: Clear input

2. **Global (when focused)**
   - Tab: Navigate between fields
   - Shift+Tab: Navigate backwards

### Error Recovery

1. **Validation Errors**
   - Clear on next valid input
   - Persist until corrected
   - Don't block other interactions

2. **Save Errors**
   - Retry automatically after 5 seconds
   - Show manual retry button
   - Don't block navigation

### Data Persistence

1. **On Mount**
   - Load from storage if available
   - Apply initial data if provided
   - Mark as clean state

2. **On Change**
   - Mark form as dirty
   - Trigger auto-save timer
   - Update preview if visible

3. **On Unmount**
   - Save current state
   - Cancel pending saves
   - Clean up timers

---

## AIPromptGenerator Component

### State Management
```typescript
const [selectedTemplate, setSelectedTemplate] = useState('professional')
const [includeExamples, setIncludeExamples] = useState(false)
const [includeObjectives, setIncludeObjectives] = useState(true)
const [includeAssessments, setIncludeAssessments] = useState(true)
const [tone, setTone] = useState('instructional')
const [generatedPrompt, setGeneratedPrompt] = useState('')
const [aiResponse, setAiResponse] = useState('')
const [isGenerating, setIsGenerating] = useState(false)
const [copySuccess, setCopySuccess] = useState(false)
```

### Prompt Generation Logic

1. **Template Structure**
   ```typescript
   const templates = {
     professional: {
       intro: "Create a professional training course...",
       style: "formal and structured",
       extras: ["Clear learning objectives", "Professional terminology"]
     },
     casual: {
       intro: "Create an engaging, conversational course...",
       style: "friendly and approachable",
       extras: ["Relatable examples", "Conversational tone"]
     }
     // ... more templates
   }
   ```

2. **Generation Process**
   - Combines: Template + Options + Seed Data
   - Adds token count estimate
   - Formats for AI consumption
   - Updates character count live

3. **Options Impact**
   - Include Examples: Adds "with practical examples"
   - Include Objectives: Adds objectives section
   - Include Assessments: Adds quiz questions
   - Tone: Modifies language style

### Copy/Paste Behaviors

1. **Copy to Clipboard**
   - Single click copies prompt
   - Shows success indicator (2 seconds)
   - Falls back to manual selection
   - Keyboard: Ctrl/Cmd+C works

2. **Paste Response**
   - Large textarea for pasting
   - No validation on paste
   - Preserves formatting
   - Auto-scrolls to top

### External AI Integration

1. **Open AI Service**
   - Button: "Open ChatGPT" / "Open Claude"
   - Opens in new tab
   - No API integration
   - Manual copy required

2. **Response Handling**
   - User pastes response
   - Basic structure check
   - No parsing at this step
   - Passed raw to next step

### Character/Token Estimation

1. **Display Format**
   - "~X,XXX characters"
   - "~X,XXX tokens (estimated)"
   - Updates on every change
   - Token estimate: chars / 4

2. **Warnings**
   - Over 4000 tokens: Yellow warning
   - Over 8000 tokens: Red warning
   - Message about AI limits

---

## JSONImportValidator Component

### Import Methods

1. **Direct Paste**
   ```typescript
   const handlePaste = (e: ClipboardEvent) => {
     const text = e.clipboardData.getData('text')
     try {
       const parsed = JSON.parse(text)
       validateAndSetContent(parsed)
     } catch (error) {
       setError('Invalid JSON format')
     }
   }
   ```

2. **File Upload**
   - Accept: .json files only
   - Max size: 10MB
   - Drag & drop supported
   - Progress indicator

3. **Manual Entry**
   - Form fields for each property
   - Real-time validation
   - Convert to JSON on complete

### Validation Rules

1. **Structure Validation**
   ```typescript
   interface RequiredStructure {
     title: string          // Required, non-empty
     audience: string       // Required, non-empty
     duration: number       // Required, 5-90
     objectives: string[]   // Required, min 1
     welcomeMessage: string // Required, non-empty
     topics: Topic[]        // Required, min 1
     assessment: {          // Required
       questions: Question[] // Min 1
     }
   }
   ```

2. **Field-Level Validation**
   - Title: Max 100 chars
   - Audience: Max 200 chars
   - Objectives: Each max 200 chars
   - Topics: 1-20 items
   - Questions: 1-20 items

3. **Deep Validation**
   - Each topic must have:
     - id (generated if missing)
     - title (required)
     - content (required)
   - Each question must have:
     - id (generated if missing)
     - question text
     - options (for MC)
     - correct answer

### Error Display

1. **Validation Errors**
   - Listed by field
   - Specific error messages
   - Path to error (e.g., "topics[2].title")
   - Suggestions for fixes

2. **Error Recovery**
   - Edit in form mode
   - Re-validate on change
   - Clear errors on fix
   - Retry parsing button

### Data Transformation

1. **Normalization**
   ```typescript
   const normalizeContent = (data: any): CourseContent => {
     return {
       ...data,
       id: data.id || generateId(),
       topics: data.topics.map(normalizeTopic),
       objectives: ensureArray(data.objectives),
       assessment: normalizeAssessment(data.assessment)
     }
   }
   ```

2. **Default Values**
   - Missing IDs generated
   - Empty arrays initialized
   - Default durations applied
   - Missing content flagged

3. **Migration Support**
   - Old format detection
   - Automatic conversion
   - Warning messages
   - Backup original

---

## MediaEnhancementWizard Component

### Page Navigation

1. **Page Selection UI**
   - Tab-based interface
   - Current page highlighted
   - Completion indicators
   - Disabled if no content

2. **Pagination for Topics**
   - 10 topics per page
   - Page numbers shown
   - Previous/Next navigation
   - Current page indicator

### Image Management

1. **Upload Flow**
   ```typescript
   const handleImageUpload = async (file: File) => {
     // Validation
     if (!file.type.startsWith('image/')) {
       throw new Error('File must be an image')
     }
     if (file.size > 10 * 1024 * 1024) {
       throw new Error('Image must be less than 10MB')
     }
     
     // Process
     const blob = await processImage(file)
     const id = generateMediaId()
     
     // Store
     await storage.saveMedia(id, blob, {
       type: 'image',
       name: file.name,
       size: file.size,
       dimensions: await getImageDimensions(blob)
     })
   }
   ```

2. **AI Generation**
   - Keywords extracted from content
   - Editable before generation
   - Progress bar during generation
   - Multiple attempt support
   - Error fallbacks

3. **Preview Modal**
   - Click image to preview
   - Lightbox effect
   - Close on backdrop click
   - Escape key support
   - Zoom controls (planned)

### Video Integration

1. **YouTube Support**
   - URL validation regex
   - Extract video ID
   - Generate embed code
   - Privacy-enhanced mode

2. **Embed Preview**
   - Responsive iframe
   - 16:9 aspect ratio
   - Sandbox security
   - Autoplay disabled

### Media Storage

1. **Blob Storage**
   ```typescript
   interface MediaStorage {
     id: string
     blob: Blob
     metadata: {
       type: 'image' | 'video'
       name: string
       size: number
       url?: string
       dimensions?: { width: number; height: number }
       pageId: string
       timestamp: number
     }
   }
   ```

2. **Reference System**
   - Media linked by page ID
   - Multiple media per page
   - Order preserved
   - Cascading deletes

### Bulk Operations

1. **Generate All Images**
   - Queue all pages
   - Sequential processing
   - Progress tracking
   - Skip existing
   - Error collection

2. **Clear All Media**
   - Confirmation required
   - Type page selection
   - Immediate effect
   - Undo not supported

---

## AudioNarrationWizard Component

### Script Generation

1. **Auto-Generation**
   ```typescript
   const generateScript = (content: PageContent): string => {
     let script = ""
     
     // Title
     if (content.title) {
       script += content.title + ". "
     }
     
     // Main content
     script += cleanHtmlToText(content.content)
     
     // Objectives (special handling)
     if (content.objectives) {
       script += " The objectives are: "
       script += content.objectives.join(". ")
     }
     
     return script.trim()
   }
   ```

2. **Script Editing**
   - Character count display
   - Limit warnings (provider-specific)
   - Save on blur
   - Revert option

### TTS Provider Integration

1. **Browser TTS**
   - Voice list from system
   - Rate control (0.5-2.0)
   - Pitch control (0.5-2.0)
   - Preview before generate

2. **ElevenLabs**
   - API key required
   - Voice selection
   - Stability/clarity sliders
   - Usage quota display
   - Error handling

3. **Murf.ai**
   - Manual process
   - Copy script button
   - File upload area
   - Instructions provided

### Audio Generation Process

1. **Single Page**
   - Click generate button
   - Progress indicator
   - Cancel support
   - Auto-save on complete

2. **Bulk Generation**
   - Select pages
   - Queue processing
   - Progress bar
   - Skip existing option
   - Error summary

### Caption Management

1. **VTT Generation**
   ```typescript
   const generateVTT = (script: string, duration: number): string => {
     const words = script.split(' ')
     const wordsPerSecond = words.length / duration
     let vtt = "WEBVTT\n\n"
     
     // Generate time-based chunks
     let currentTime = 0
     for (let i = 0; i < words.length; i += 10) {
       const chunk = words.slice(i, i + 10).join(' ')
       const endTime = currentTime + (10 / wordsPerSecond)
       
       vtt += `${formatTime(currentTime)} --> ${formatTime(endTime)}\n`
       vtt += `${chunk}\n\n`
       
       currentTime = endTime
     }
     
     return vtt
   }
   ```

2. **Caption Editing**
   - Inline editor
   - Time code adjustment
   - Preview with audio
   - Sync validation

### Audio Player

1. **Controls**
   - Play/Pause
   - Seek bar
   - Time display
   - Volume control
   - Speed control

2. **Features**
   - Waveform display (planned)
   - Caption sync display
   - Download option
   - Replace function

---

## State Persistence Patterns

### Auto-Save Strategy
```typescript
// Debounced save
const debouncedSave = useMemo(
  () => debounce((data: CourseData) => {
    storage.saveContent(data)
  }, 30000),
  [storage]
)

// Track changes
useEffect(() => {
  if (hasChanges) {
    debouncedSave(currentData)
  }
}, [currentData, hasChanges])
```

### Navigation Guards
```typescript
const handleNavigation = (nextStep: string) => {
  if (hasUnsavedChanges) {
    showDialog({
      title: "Unsaved Changes",
      message: "You have unsaved changes. Save before continuing?",
      actions: [
        { label: "Save & Continue", action: saveAndNavigate },
        { label: "Continue Without Saving", action: navigate },
        { label: "Cancel", action: close }
      ]
    })
  } else {
    navigate(nextStep)
  }
}
```

### Error Recovery
```typescript
// Crash recovery on mount
useEffect(() => {
  const checkCrashRecovery = async () => {
    const crashed = await storage.getCrashFlag()
    if (crashed) {
      const recovered = await storage.recoverSession()
      if (recovered) {
        showToast("Session recovered from last save")
        applyRecoveredData(recovered)
      }
    }
  }
  checkCrashRecovery()
}, [])
```

This detailed documentation provides the behavioral foundation for comprehensive testing.