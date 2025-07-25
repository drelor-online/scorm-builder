# SCORM Builder Security & Performance Audit Report

## Executive Summary
This audit analyzes the SCORM Builder codebase for security vulnerabilities, performance bottlenecks, and code quality issues. Critical findings include path traversal vulnerabilities, excessive memory usage from base64 encoding, and several React performance anti-patterns.

---

## 1. SECURITY VULNERABILITIES

### 1.1 Rust Backend Security Issues

#### CRITICAL: Path Traversal Vulnerability in File Operations

**File:** `src-tauri/src/commands.rs`

```rust
#[tauri::command]
pub async fn save_project(project_data: ProjectFile, file_path: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    save_project_file(&project_data, &path)
}
```

**Issue:** No validation of `file_path` parameter. An attacker could provide paths like `../../../sensitive/file` to write outside intended directories.

**Recommendation:** Validate and sanitize file paths:
```rust
let path = PathBuf::from(file_path);
// Ensure path is within projects directory
let projects_dir = get_projects_directory()?;
if !path.starts_with(&projects_dir) {
    return Err("Invalid file path".to_string());
}
```

#### HIGH: Unbounded File Write in append_to_log

**File:** `src-tauri/src/commands.rs`

```rust
#[tauri::command]
pub async fn append_to_log(content: String) -> Result<(), String> {
    // ... 
    writeln!(file, "{}", content)
        .map_err(|e| format!("Failed to write to log file: {}", e))?;
```

**Issue:** No size limit on log content. Could lead to disk exhaustion attacks.

**Recommendation:** Add content size validation:
```rust
const MAX_LOG_ENTRY_SIZE: usize = 10_000; // 10KB max
if content.len() > MAX_LOG_ENTRY_SIZE {
    return Err("Log entry too large".to_string());
}
```

#### MEDIUM: SSRF Risk in download_image

**File:** `src-tauri/src/commands.rs`

```rust
#[tauri::command]
pub async fn download_image(url: String) -> Result<DownloadImageResponse, String> {
    let response = client
        .get(&url)
        .send()
        .await
```

**Issue:** No URL validation. Could be used to access internal services.

**Recommendation:** Validate URL scheme and host:
```rust
let parsed_url = url::Url::parse(&url)
    .map_err(|_| "Invalid URL")?;
    
if !["http", "https"].contains(&parsed_url.scheme()) {
    return Err("Only HTTP(S) URLs allowed".to_string());
}

// Optionally block private IP ranges
```

### 1.2 Frontend Security Issues

#### HIGH: XSS Risk in Content Rendering

**File:** `src/services/FileStorage.ts`

```typescript
async saveContent(id: string, content: ContentItem): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    if (!this.currentProject.course_content) {
      this.currentProject.course_content = {}
    }
    
    this.currentProject.course_content[id] = content
```

**Issue:** User-provided HTML content stored without sanitization. If rendered with `dangerouslySetInnerHTML`, could lead to XSS.

**Recommendation:** Sanitize HTML content before storage:
```typescript
import DOMPurify from 'dompurify';

const sanitizedContent = {
    ...content,
    content: content.content ? DOMPurify.sanitize(content.content) : undefined
};
```

#### MEDIUM: Sensitive Data in Console Logs

**File:** `src/App.tsx`

```typescript
useEffect(() => {
    console.log('State changed:', {
      currentStep,
      hasCourseSeedData: !!courseSeedData,
      courseSeedDataKeys: courseSeedData ? Object.keys(courseSeedData) : null,
      hasCourseContent: !!courseContent,
      courseContentKeys: courseContent ? Object.keys(courseContent) : null
    })
}, [currentStep, courseSeedData, courseContent])
```

**Issue:** Extensive logging of application state could expose sensitive information in production.

**Recommendation:** Use conditional logging:
```typescript
if (process.env.NODE_ENV === 'development') {
    console.log('State changed:', {...});
}
```

---

## 2. PERFORMANCE BOTTLENECKS

### 2.1 React Performance Issues

#### CRITICAL: Inefficient Re-renders in App Component

**File:** `src/App.tsx`

```typescript
const projectData: ProjectData = courseSeedData ? {
    courseTitle: courseSeedData.courseTitle,
    courseSeedData: courseSeedData,
    courseContent: courseContent || undefined,
    currentStep: stepNumbers[currentStep as keyof typeof stepNumbers],
    lastModified: new Date().toISOString(),
    mediaFiles: {},
    audioFiles: {}
} : {
    // ... default object
}
```

**Issue:** New object created on every render, causing unnecessary re-renders in child components.

**Recommendation:** Use useMemo:
```typescript
const projectData = useMemo(() => courseSeedData ? {
    courseTitle: courseSeedData.courseTitle,
    // ...
} : defaultProjectData, [courseSeedData, courseContent, currentStep]);
```

#### HIGH: Memory Leak Risk in AudioNarrationWizard

**File:** `src/components/AudioNarrationWizardRefactored.tsx`

```typescript
const [audioFiles, setAudioFiles] = useState<Map<string, AudioFile>>(new Map())
// ...
interface AudioFile {
  blockNumber: string
  file: File
  url: string
}
```

**Issue:** Object URLs created for audio files but cleanup only happens in useEffect. If component unmounts during state updates, URLs may leak.

**Recommendation:** Track URLs separately and ensure cleanup:
```typescript
const audioUrlsRef = useRef<Set<string>>(new Set());

// When creating URL
const url = URL.createObjectURL(file);
audioUrlsRef.current.add(url);

// In cleanup
useEffect(() => {
    return () => {
        audioUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
    };
}, []);
```

### 2.2 Rust Performance Issues

#### HIGH: Synchronous I/O in Commands

**File:** `src-tauri/src/project_storage.rs`

```rust
pub fn save_project_file(project: &ProjectFile, file_path: &Path) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    
    let mut file = fs::File::create(file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;
```

**Issue:** Blocking I/O operations on the main thread could freeze the UI.

**Recommendation:** Use tokio for async I/O:
```rust
use tokio::fs;
use tokio::io::AsyncWriteExt;

pub async fn save_project_file(project: &ProjectFile, file_path: &Path) -> Result<(), String> {
    let json = serde_json::to_string_pretty(&project)?;
    let mut file = fs::File::create(file_path).await?;
    file.write_all(json.as_bytes()).await?;
    Ok(())
}
```

#### MEDIUM: Inefficient Base64 Encoding for Large Media

**File:** `src/services/FileStorage.ts`

```typescript
async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
}
```

**Issue:** Base64 encoding increases data size by ~33%, causing memory bloat for large media files.

**Recommendation:** Consider streaming or chunked processing for large files, or store as binary with references.

---

## 3. ERROR HANDLING & RECOVERY

### 3.1 Missing Error Boundaries

**Issue:** Limited error boundaries in React components could cause entire app crashes.

**Recommendation:** Add error boundaries around major features:
```typescript
<ErrorBoundary fallback={<ErrorFallback />}>
  <AudioNarrationWizard />
</ErrorBoundary>
```

### 3.2 Inadequate Error Messages

**File:** Various Rust files

```rust
.map_err(|e| format!("Failed to create file: {}", e))?;
```

**Issue:** Generic error messages don't help with debugging.

**Recommendation:** Include context:
```rust
.map_err(|e| format!("Failed to create project file at {}: {}", file_path.display(), e))?;
```

---

## 4. MEMORY MANAGEMENT

### 4.1 Large Object Retention

**File:** `src/services/FileStorage.ts`

```typescript
private currentProject: ProjectFile | null = null
```

**Issue:** Entire project kept in memory including all base64 media data.

**Recommendation:** Implement lazy loading for media:
```typescript
interface ProjectFile {
    // ...
    media: {
        images: MediaReference[], // Just IDs and metadata
        // ...
    }
}

async getMediaData(id: string): Promise<string> {
    // Load from disk/cache as needed
}
```

---

## 5. CODE QUALITY

### 5.1 Type Safety Issues

**File:** Various TypeScript files

```typescript
const anyContent = content as any
```

**Issue:** Frequent use of `any` type defeats TypeScript's benefits.

**Recommendation:** Define proper union types or use type guards.

### 5.2 Magic Numbers

**File:** Various files

```typescript
private readonly SAVE_DEBOUNCE_MS = 1500
private readonly AUTO_BACKUP_INTERVAL_MS = 60000
```

**Issue:** Hard-coded values should be configurable.

**Recommendation:** Move to configuration:
```typescript
const CONFIG = {
    storage: {
        saveDebounceMs: 1500,
        autoBackupIntervalMs: 60000
    }
};
```

---

## RECOMMENDATIONS SUMMARY

### Immediate Actions (Critical):
1. Fix path traversal vulnerability in save_project
2. Add URL validation in download_image  
3. Implement proper HTML sanitization
4. Fix React performance issues with useMemo/useCallback

### Short-term (High Priority):
1. Convert blocking I/O to async in Rust
2. Add size limits for file operations
3. Remove sensitive console logs
4. Implement proper error boundaries

### Long-term (Medium Priority):
1. Refactor media storage to avoid base64 bloat
2. Implement proper type safety throughout
3. Add comprehensive input validation
4. Set up security headers and CSP

### Testing Recommendations:
1. Add security-focused unit tests
2. Implement fuzz testing for file operations
3. Add performance benchmarks
4. Regular dependency vulnerability scanning

---

## Conclusion

The SCORM Builder has a solid foundation but requires immediate attention to the critical security vulnerabilities, particularly the path traversal issue. Performance optimizations would significantly improve user experience, especially for projects with large media files. Implementing the recommended fixes would greatly enhance the application's security posture and reliability.