# Accessibility, Keyboard Shortcuts & Integration Details

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| Alt + N | Navigate to next step | When not on last step |
| Alt + P | Navigate to previous step | When not on first step |
| Alt + S | Save project | Always available |
| Alt + O | Open project | From dashboard |
| Alt + H | Open help | Always available |
| Ctrl/Cmd + S | Quick save | Always available |
| Escape | Close modal/dialog | When modal is open |

### Step-Specific Shortcuts

#### Course Seed Input (Step 1)
- Tab/Shift+Tab: Navigate fields
- Enter (in topic field): Add topic
- Delete/Backspace: Remove selected topic

#### AI Prompt Generator (Step 2)
- Ctrl/Cmd + C: Copy prompt
- Ctrl/Cmd + V: Paste response
- Tab: Navigate between options

#### JSON Validator (Step 3)
- Ctrl/Cmd + V: Paste JSON
- Ctrl/Cmd + A: Select all
- F8: Validate JSON

#### Media Enhancement (Step 4)
- Space: Open image preview
- Left/Right arrows: Navigate carousel
- Delete: Remove selected media

#### Audio Narration (Step 5)
- Space: Play/pause audio
- Left/Right arrows: Skip ±10 seconds
- Up/Down arrows: Volume control

#### Activities Editor (Step 6)
- Tab: Navigate questions
- Enter: Add new option
- Delete: Remove option

#### SCORM Builder (Step 7)
- Ctrl/Cmd + G: Generate package
- F5: Refresh preview

## Accessibility Features

### ARIA Implementation

1. **Landmarks**
   ```html
   <header role="banner">
   <nav role="navigation" aria-label="Step navigation">
   <main role="main" aria-label="Course builder content">
   <aside role="complementary" aria-label="Help panel">
   ```

2. **Live Regions**
   ```html
   <div role="status" aria-live="polite" aria-atomic="true">
     <!-- Auto-save status -->
   </div>
   
   <div role="alert" aria-live="assertive">
     <!-- Error messages -->
   </div>
   ```

3. **Form Controls**
   ```html
   <label for="course-title">
     Course Title
     <span aria-label="required">*</span>
   </label>
   <input 
     id="course-title"
     aria-describedby="title-error"
     aria-invalid="false"
     required
   />
   <span id="title-error" role="alert"></span>
   ```

### Focus Management

1. **Focus Order**
   - Logical tab sequence
   - Skip links to main content
   - Focus trap in modals
   - Return focus on close

2. **Focus Indicators**
   ```css
   :focus {
     outline: 2px solid #007acc;
     outline-offset: 2px;
   }
   
   :focus:not(:focus-visible) {
     outline: none; /* Remove for mouse users */
   }
   ```

3. **Focus Restoration**
   ```typescript
   const [lastFocusedElement, setLastFocusedElement] = useState<HTMLElement>()
   
   const openModal = () => {
     setLastFocusedElement(document.activeElement as HTMLElement)
     setModalOpen(true)
   }
   
   const closeModal = () => {
     setModalOpen(false)
     lastFocusedElement?.focus()
   }
   ```

### Screen Reader Support

1. **Announcements**
   ```typescript
   const announce = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
     const region = document.querySelector(`[aria-live="${priority}"]`)
     if (region) {
       region.textContent = message
       // Clear after announcement
       setTimeout(() => {
         region.textContent = ''
       }, 1000)
     }
   }
   ```

2. **Descriptive Labels**
   - Button purposes clear
   - Form field instructions
   - Error message associations
   - Progress indicators

3. **Dynamic Content**
   - Loading states announced
   - Completion notifications
   - Error alerts
   - Status updates

### Color & Contrast

1. **WCAG AA Compliance**
   - Text contrast ratio: 4.5:1
   - Large text: 3:1
   - Interactive elements: 3:1
   - Focus indicators visible

2. **Color Independence**
   - Not solely color-based
   - Icons supplement color
   - Text labels provided
   - Pattern alternatives

### Responsive Design

1. **Touch Targets**
   - Minimum 44×44 pixels
   - Adequate spacing
   - No precision required
   - Gesture alternatives

2. **Zoom Support**
   - Up to 200% zoom
   - No horizontal scroll
   - Content reflows
   - Functionality preserved

## External API Integrations

### ElevenLabs Integration

1. **Authentication**
   ```typescript
   const headers = {
     'xi-api-key': apiKey,
     'Content-Type': 'application/json'
   }
   ```

2. **Voice List Endpoint**
   ```
   GET https://api.elevenlabs.io/v1/voices
   Response: {
     voices: [{
       voice_id: string
       name: string
       category: string
       labels: {}
     }]
   }
   ```

3. **Text-to-Speech Endpoint**
   ```
   POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}
   Body: {
     text: string
     model_id: "eleven_monolingual_v1"
     voice_settings: {
       stability: number (0-1)
       similarity_boost: number (0-1)
     }
   }
   Response: Audio stream (MP3)
   ```

4. **Error Handling**
   - 401: Invalid API key
   - 422: Text too long
   - 429: Rate limit exceeded
   - 500: Server error

### Murf.ai Integration

1. **Manual Process**
   - No API available
   - Copy text to clipboard
   - Open Murf.ai website
   - Paste and generate
   - Download result
   - Upload to app

2. **Instructions Provided**
   ```typescript
   const murfInstructions = [
     "1. Click 'Copy Script' button",
     "2. Open Murf.ai in new tab",
     "3. Create new project",
     "4. Paste script",
     "5. Select voice",
     "6. Generate audio",
     "7. Download MP3",
     "8. Upload here"
   ]
   ```

### YouTube Integration

1. **URL Validation**
   ```typescript
   const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
   
   const extractVideoId = (url: string): string | null => {
     const match = url.match(youtubeRegex)
     return match ? match[4] : null
   }
   ```

2. **Embed Generation**
   ```typescript
   const generateEmbed = (videoId: string): string => {
     return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
   }
   ```

3. **Privacy Mode**
   - Uses youtube-nocookie.com
   - No tracking cookies
   - Reduced branding
   - No related videos

## Error Boundaries

### Component Error Boundary

```typescript
class ErrorBoundary extends Component {
  state = { hasError: false, error: null }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Component error:', error, errorInfo)
    // Log to error service
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />
    }
    return this.props.children
  }
}
```

### Step-Level Protection

Each step wrapped in error boundary:
```typescript
<ErrorBoundary fallback={<StepErrorFallback step={currentStep} />}>
  <Suspense fallback={<LoadingComponent />}>
    <StepComponent {...props} />
  </Suspense>
</ErrorBoundary>
```

## Performance Monitoring

### Metrics Tracked

1. **Step Load Times**
   ```typescript
   const measureStepLoad = (step: string) => {
     performance.mark(`${step}-start`)
     // After load
     performance.mark(`${step}-end`)
     performance.measure(step, `${step}-start`, `${step}-end`)
   }
   ```

2. **Save Operations**
   - Duration
   - Data size
   - Success rate
   - Retry count

3. **Media Operations**
   - Upload time
   - Processing time
   - Compression ratio
   - Error rate

### Bundle Size Monitoring

1. **Build-Time Checks**
   ```json
   {
     "bundlesize": [
       {
         "path": "./dist/index.js",
         "maxSize": "100 kB"
       }
     ]
   }
   ```

2. **Lazy Loading Metrics**
   - Initial bundle: 96KB
   - Step 2 chunk: 11KB
   - Step 3 chunk: 10KB
   - Step 4 chunk: 37KB
   - Step 5 chunk: 32KB
   - Step 6 chunk: 18KB
   - Step 7 chunk: 13KB

## Testing Hooks

### E2E Test Helpers

```typescript
// Exposed on window for testing
window.__testHelpers = {
  getCurrentStep: () => currentStep,
  getFormData: () => formData,
  triggerSave: () => handleSave(),
  setTestMode: (enabled: boolean) => {
    window.__testMode = enabled
  }
}
```

### Automation Support

1. **Data Attributes**
   ```html
   <button data-testid="next-step">Next</button>
   <input data-testid="course-title" />
   <div data-step="course-seed" />
   ```

2. **State Inspection**
   ```typescript
   // Console commands for debugging
   window.debugState = () => {
     return {
       step: currentStep,
       data: getCurrentData(),
       validation: getValidationState(),
       storage: getStorageInfo()
     }
   }
   ```

## Security Considerations

### Input Validation

1. **XSS Prevention**
   - DOMPurify for HTML content
   - Escape user input
   - CSP headers
   - Sanitize URLs

2. **File Upload Security**
   - Type validation
   - Size limits
   - Virus scanning (planned)
   - Sandboxed processing

### API Key Management

1. **Storage**
   - Encrypted in storage
   - Never in code
   - User-provided only
   - Revocable

2. **Usage**
   - HTTPS only
   - Request signing
   - Rate limiting
   - Error masking

This comprehensive documentation completes the detailed behavioral specification of the SCORM Builder application.