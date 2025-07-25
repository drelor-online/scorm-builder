# SCORM Builder Refactoring Guide

## 1. CRITICAL SECURITY FIXES

### 1.1 Fix Path Traversal Vulnerability

**File:** `src-tauri/src/commands.rs`

**Before:**
```rust
#[tauri::command]
pub async fn save_project(project_data: ProjectFile, file_path: String) -> Result<(), String> {
    let path = PathBuf::from(file_path);
    save_project_file(&project_data, &path)
}

#[tauri::command]
pub async fn load_project(file_path: String) -> Result<ProjectFile, String> {
    let path = PathBuf::from(file_path);
    load_project_file(&path)
}
```

**After:**
```rust
use std::path::{Path, PathBuf};

/// Validates that a path is within the allowed projects directory
fn validate_project_path(file_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(file_path);
    let projects_dir = get_projects_directory()?;
    
    // Canonicalize to resolve any .. or . components
    let canonical_path = path.canonicalize()
        .map_err(|e| format!("Invalid path: {}", e))?;
    
    let canonical_projects_dir = projects_dir.canonicalize()
        .map_err(|e| format!("Failed to resolve projects directory: {}", e))?;
    
    // Ensure the path is within the projects directory
    if !canonical_path.starts_with(&canonical_projects_dir) {
        return Err("Access denied: Path is outside projects directory".to_string());
    }
    
    // Ensure it's a .scormproj file
    if canonical_path.extension().and_then(|s| s.to_str()) != Some("scormproj") {
        return Err("Invalid file type: Only .scormproj files are allowed".to_string());
    }
    
    Ok(canonical_path)
}

#[tauri::command]
pub async fn save_project(project_data: ProjectFile, file_path: String) -> Result<(), String> {
    let path = validate_project_path(&file_path)?;
    save_project_file(&project_data, &path)
}

#[tauri::command]
pub async fn load_project(file_path: String) -> Result<ProjectFile, String> {
    let path = validate_project_path(&file_path)?;
    load_project_file(&path)
}
```

### 1.2 Fix XSS Vulnerability with Content Sanitization

**File:** Create `src/utils/contentSanitizer.ts`

**New File:**
```typescript
import DOMPurify from 'dompurify';

// Configure DOMPurify with safe defaults for SCORM content
const ALLOWED_TAGS = [
  'p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote', 'a', 'img', 'span', 'div',
  'table', 'thead', 'tbody', 'tr', 'td', 'th'
];

const ALLOWED_ATTRIBUTES = {
  'a': ['href', 'title', 'target'],
  'img': ['src', 'alt', 'width', 'height'],
  '*': ['class', 'id', 'style']
};

const ALLOWED_STYLES = [
  'color', 'background-color', 'font-size', 'font-weight', 
  'text-align', 'padding', 'margin', 'border'
];

export function sanitizeContent(content: string): string {
  return DOMPurify.sanitize(content, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: Object.keys(ALLOWED_ATTRIBUTES).reduce((acc, tag) => {
      ALLOWED_ATTRIBUTES[tag].forEach(attr => {
        acc.push(tag === '*' ? attr : `${tag}@${attr}`);
      });
      return acc;
    }, [] as string[]),
    ALLOWED_STYLE: ALLOWED_STYLES,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['onerror', 'onclick', 'onload', 'onmouseover']
  });
}

export function sanitizeContentItem(item: any): any {
  if (!item) return item;
  
  return {
    ...item,
    content: item.content ? sanitizeContent(item.content) : item.content,
    narration: item.narration ? sanitizeContent(item.narration) : item.narration
  };
}
```

**Update:** `src/services/FileStorage.ts`

**Before:**
```typescript
async saveContent(id: string, content: ContentItem): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    if (!this.currentProject.course_content) {
      this.currentProject.course_content = {}
    }
    
    this.currentProject.course_content[id] = content
    this.scheduleAutoSave()
}
```

**After:**
```typescript
import { sanitizeContentItem } from '../utils/contentSanitizer'

async saveContent(id: string, content: ContentItem): Promise<void> {
    if (!this.currentProject) throw new Error('No project open')
    
    if (!this.currentProject.course_content) {
      this.currentProject.course_content = {}
    }
    
    // Sanitize content before saving
    this.currentProject.course_content[id] = sanitizeContentItem(content)
    this.scheduleAutoSave()
}
```

### 1.3 Fix SSRF Vulnerability in Image Download

**File:** `src-tauri/src/commands.rs`

**Before:**
```rust
#[tauri::command]
pub async fn download_image(url: String) -> Result<DownloadImageResponse, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;
```

**After:**
```rust
use url::Url;
use std::net::IpAddr;

/// List of allowed image domains
const ALLOWED_IMAGE_DOMAINS: &[&str] = &[
    "images.unsplash.com",
    "i.imgur.com",
    "upload.wikimedia.org",
    "cdn.pixabay.com",
    // Add more trusted domains as needed
];

/// Validates URL for image download
fn validate_image_url(url_str: &str) -> Result<Url, String> {
    let url = Url::parse(url_str)
        .map_err(|_| "Invalid URL format")?;
    
    // Only allow HTTPS
    if url.scheme() != "https" {
        return Err("Only HTTPS URLs are allowed".to_string());
    }
    
    // Check domain whitelist
    let host = url.host_str()
        .ok_or("Invalid URL: No host found")?;
    
    if !ALLOWED_IMAGE_DOMAINS.iter().any(|&domain| host == domain || host.ends_with(&format!(".{}", domain))) {
        return Err(format!("Domain '{}' is not in the allowed list", host));
    }
    
    // Block private IP ranges
    if let Ok(ip) = host.parse::<IpAddr>() {
        if ip.is_loopback() || ip.is_private() || ip.is_link_local() {
            return Err("Access to private IP addresses is not allowed".to_string());
        }
    }
    
    Ok(url)
}

#[tauri::command]
pub async fn download_image(url: String) -> Result<DownloadImageResponse, String> {
    // Validate URL first
    let validated_url = validate_image_url(&url)?;
    
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")
        .timeout(std::time::Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(3)) // Limit redirects
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;
    
    let response = client
        .get(validated_url.as_str())
        .send()
        .await
        .map_err(|e| format!("Failed to fetch image: {}", e))?;
    
    // Verify content type
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();
    
    if !content_type.starts_with("image/") {
        return Err(format!("Invalid content type: {}. Only images are allowed", content_type));
    }
    
    // Limit size to 10MB
    const MAX_SIZE: usize = 10 * 1024 * 1024;
    let content_length = response.content_length().unwrap_or(0) as usize;
    if content_length > MAX_SIZE {
        return Err("Image too large: Maximum size is 10MB".to_string());
    }
    
    // Rest of the function...
```

## 2. REACT PERFORMANCE REFACTORING

### 2.1 Extract Custom Hooks from App Component

**File:** Create `src/hooks/useProjectData.ts`

**New Custom Hook:**
```typescript
import { useMemo } from 'react';
import { CourseSeedData } from '../types/course';
import { CourseContent } from '../types/aiPrompt';
import { ProjectData } from '../types/project';

interface UseProjectDataParams {
  courseSeedData: CourseSeedData | null;
  courseContent: CourseContent | null;
  currentStep: string;
}

const DEFAULT_PROJECT_DATA: ProjectData = {
  courseTitle: '',
  courseSeedData: {
    courseTitle: '',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
  },
  currentStep: 0,
  lastModified: new Date().toISOString(),
  mediaFiles: {},
  audioFiles: {}
};

const STEP_NUMBERS = {
  seed: 0,
  prompt: 1,
  json: 2,
  media: 3,
  audio: 4,
  activities: 5,
  scorm: 6
} as const;

export function useProjectData({ 
  courseSeedData, 
  courseContent, 
  currentStep 
}: UseProjectDataParams): ProjectData {
  return useMemo(() => {
    if (!courseSeedData) return DEFAULT_PROJECT_DATA;
    
    return {
      courseTitle: courseSeedData.courseTitle,
      courseSeedData: courseSeedData,
      courseContent: courseContent || undefined,
      currentStep: STEP_NUMBERS[currentStep as keyof typeof STEP_NUMBERS],
      lastModified: new Date().toISOString(),
      mediaFiles: {},
      audioFiles: {}
    };
  }, [courseSeedData, courseContent, currentStep]);
}
```

**Update App.tsx:**

**Before:**
```typescript
// In AppContent component
const stepNumbers = {
  seed: 0,
  prompt: 1,
  json: 2,
  media: 3,
  audio: 4,
  activities: 5,
  scorm: 6
}

const projectData: ProjectData = courseSeedData ? {
  courseTitle: courseSeedData.courseTitle,
  courseSeedData: courseSeedData,
  courseContent: courseContent || undefined,
  currentStep: stepNumbers[currentStep as keyof typeof stepNumbers],
  lastModified: new Date().toISOString(),
  mediaFiles: {},
  audioFiles: {}
} : {
  courseTitle: '',
  courseSeedData: {
    courseTitle: '',
    difficulty: 3,
    customTopics: [],
    template: 'None',
    templateTopics: []
  },
  currentStep: 0,
  lastModified: new Date().toISOString(),
  mediaFiles: {},
  audioFiles: {}
}
```

**After:**
```typescript
import { useProjectData } from './hooks/useProjectData';

// In AppContent component
const projectData = useProjectData({ courseSeedData, courseContent, currentStep });
```

### 2.2 Fix Memory Leaks in AudioNarrationWizard

**File:** `src/components/AudioNarrationWizardRefactored.tsx`

**Create:** `src/hooks/useAudioRecorder.ts`

**New Custom Hook:**
```typescript
import { useState, useRef, useCallback, useEffect } from 'react';

interface UseAudioRecorderReturn {
  isRecording: boolean;
  recordingTime: number;
  recordingError: string | null;
  previewUrl: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<Blob | null>;
  resetRecording: () => void;
}

export function useAudioRecorder(): UseAudioRecorderReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const urlsRef = useRef<Set<string>>(new Set());

  // Cleanup function
  const cleanup = useCallback(() => {
    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    // Revoke all URLs
    urlsRef.current.forEach(url => URL.revokeObjectURL(url));
    urlsRef.current.clear();

    // Reset state
    setIsRecording(false);
    setRecordingTime(0);
    audioChunksRef.current = [];
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    try {
      cleanup(); // Clean up any previous recording
      setRecordingError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Start timer
      const startTime = Date.now();
      timerRef.current = setInterval(() => {
        setRecordingTime(Math.floor((Date.now() - startTime) / 1000));
      }, 100);

    } catch (error) {
      setRecordingError(error instanceof Error ? error.message : 'Failed to start recording');
      cleanup();
    }
  }, [cleanup]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      if (!mediaRecorderRef.current) {
        resolve(null);
        return;
      }

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Create preview URL
        const url = URL.createObjectURL(audioBlob);
        urlsRef.current.add(url);
        setPreviewUrl(url);
        
        cleanup();
        resolve(audioBlob);
      };

      mediaRecorderRef.current.stop();
    });
  }, [cleanup]);

  // Reset recording
  const resetRecording = useCallback(() => {
    cleanup();
    setPreviewUrl(null);
    setRecordingError(null);
  }, [cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  return {
    isRecording,
    recordingTime,
    recordingError,
    previewUrl,
    startRecording,
    stopRecording,
    resetRecording
  };
}
```

**Update AudioNarrationWizard to use the hook:**

**Before:**
```typescript
// Multiple state variables for recording
const [isRecording, setIsRecording] = useState(false)
const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
const [audioChunks, setAudioChunks] = useState<Blob[]>([])
const [recordingTime, setRecordingTime] = useState(0)
const [recordingError, setRecordingError] = useState<string | null>(null)
const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
const [recordingPreviewUrl, setRecordingPreviewUrl] = useState<string | null>(null)

// Complex recording logic spread throughout component
```

**After:**
```typescript
import { useAudioRecorder } from '../hooks/useAudioRecorder';

// In component
const {
  isRecording,
  recordingTime,
  recordingError,
  previewUrl: recordingPreviewUrl,
  startRecording,
  stopRecording,
  resetRecording
} = useAudioRecorder();

// Usage is now much simpler
const handleStartRecording = async () => {
  await startRecording();
};

const handleStopRecording = async () => {
  const audioBlob = await stopRecording();
  if (audioBlob) {
    // Process the audio blob
  }
};
```

### 2.3 Optimize State Management with useReducer

**File:** Create `src/hooks/useAppState.ts`

**New State Management Hook:**
```typescript
import { useReducer, useCallback } from 'react';
import { CourseSeedData } from '../types/course';
import { CourseContent } from '../types/aiPrompt';

interface AppState {
  currentStep: string;
  courseSeedData: CourseSeedData | null;
  courseContent: CourseContent | null;
  showSettings: boolean;
  showHelp: boolean;
  showTestChecklist: boolean;
  showDeleteDialog: boolean;
  showUnsavedDialog: boolean;
  projectToDelete: { id: string; name: string } | null;
  toast: { message: string; type: 'success' | 'error' } | null;
  hasUnsavedChanges: boolean;
  apiKeys: {
    googleImageApiKey: string;
    googleCseId: string;
    youtubeApiKey: string;
  };
}

type AppAction =
  | { type: 'SET_STEP'; payload: string }
  | { type: 'SET_COURSE_SEED_DATA'; payload: CourseSeedData | null }
  | { type: 'SET_COURSE_CONTENT'; payload: CourseContent | null }
  | { type: 'TOGGLE_SETTINGS' }
  | { type: 'TOGGLE_HELP' }
  | { type: 'TOGGLE_TEST_CHECKLIST' }
  | { type: 'SHOW_DELETE_DIALOG'; payload: { id: string; name: string } | null }
  | { type: 'SHOW_UNSAVED_DIALOG'; payload: boolean }
  | { type: 'SHOW_TOAST'; payload: { message: string; type: 'success' | 'error' } | null }
  | { type: 'SET_UNSAVED_CHANGES'; payload: boolean }
  | { type: 'SET_API_KEYS'; payload: Partial<AppState['apiKeys']> }
  | { type: 'RESET_STATE' };

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.payload };
    case 'SET_COURSE_SEED_DATA':
      return { ...state, courseSeedData: action.payload };
    case 'SET_COURSE_CONTENT':
      return { ...state, courseContent: action.payload };
    case 'TOGGLE_SETTINGS':
      return { ...state, showSettings: !state.showSettings };
    case 'TOGGLE_HELP':
      return { ...state, showHelp: !state.showHelp };
    case 'TOGGLE_TEST_CHECKLIST':
      return { ...state, showTestChecklist: !state.showTestChecklist };
    case 'SHOW_DELETE_DIALOG':
      return { ...state, showDeleteDialog: !!action.payload, projectToDelete: action.payload };
    case 'SHOW_UNSAVED_DIALOG':
      return { ...state, showUnsavedDialog: action.payload };
    case 'SHOW_TOAST':
      return { ...state, toast: action.payload };
    case 'SET_UNSAVED_CHANGES':
      return { ...state, hasUnsavedChanges: action.payload };
    case 'SET_API_KEYS':
      return { ...state, apiKeys: { ...state.apiKeys, ...action.payload } };
    case 'RESET_STATE':
      return {
        ...state,
        currentStep: 'seed',
        courseSeedData: null,
        courseContent: null,
        hasUnsavedChanges: false,
        projectToDelete: null
      };
    default:
      return state;
  }
}

export function useAppState(initialApiKeys: AppState['apiKeys']) {
  const [state, dispatch] = useReducer(appReducer, {
    currentStep: 'seed',
    courseSeedData: null,
    courseContent: null,
    showSettings: false,
    showHelp: false,
    showTestChecklist: false,
    showDeleteDialog: false,
    showUnsavedDialog: false,
    projectToDelete: null,
    toast: null,
    hasUnsavedChanges: false,
    apiKeys: initialApiKeys
  });

  // Action creators
  const actions = {
    setStep: useCallback((step: string) => 
      dispatch({ type: 'SET_STEP', payload: step }), []),
    setCourseSeedData: useCallback((data: CourseSeedData | null) => 
      dispatch({ type: 'SET_COURSE_SEED_DATA', payload: data }), []),
    setCourseContent: useCallback((content: CourseContent | null) => 
      dispatch({ type: 'SET_COURSE_CONTENT', payload: content }), []),
    toggleSettings: useCallback(() => 
      dispatch({ type: 'TOGGLE_SETTINGS' }), []),
    toggleHelp: useCallback(() => 
      dispatch({ type: 'TOGGLE_HELP' }), []),
    toggleTestChecklist: useCallback(() => 
      dispatch({ type: 'TOGGLE_TEST_CHECKLIST' }), []),
    showDeleteDialog: useCallback((project: { id: string; name: string } | null) => 
      dispatch({ type: 'SHOW_DELETE_DIALOG', payload: project }), []),
    showUnsavedDialog: useCallback((show: boolean) => 
      dispatch({ type: 'SHOW_UNSAVED_DIALOG', payload: show }), []),
    showToast: useCallback((toast: { message: string; type: 'success' | 'error' } | null) => 
      dispatch({ type: 'SHOW_TOAST', payload: toast }), []),
    setUnsavedChanges: useCallback((hasChanges: boolean) => 
      dispatch({ type: 'SET_UNSAVED_CHANGES', payload: hasChanges }), []),
    setApiKeys: useCallback((keys: Partial<AppState['apiKeys']>) => 
      dispatch({ type: 'SET_API_KEYS', payload: keys }), []),
    resetState: useCallback(() => 
      dispatch({ type: 'RESET_STATE' }), [])
  };

  return { state, actions };
}
```

## 3. RUST ERROR HANDLING IMPROVEMENTS

### 3.1 Create Centralized Error Types

**File:** Create `src-tauri/src/error.rs`

**New Error Module:**
```rust
use std::fmt;

#[derive(Debug)]
pub enum AppError {
    Io(std::io::Error),
    Serialization(serde_json::Error),
    Validation(String),
    NotFound(String),
    Unauthorized(String),
    NetworkError(reqwest::Error),
    Internal(String),
}

impl fmt::Display for AppError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AppError::Io(e) => write!(f, "IO error: {}", e),
            AppError::Serialization(e) => write!(f, "Serialization error: {}", e),
            AppError::Validation(msg) => write!(f, "Validation error: {}", msg),
            AppError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AppError::Unauthorized(msg) => write!(f, "Unauthorized: {}", msg),
            AppError::NetworkError(e) => write!(f, "Network error: {}", e),
            AppError::Internal(msg) => write!(f, "Internal error: {}", msg),
        }
    }
}

impl std::error::Error for AppError {}

// Automatic conversions
impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::Io(err)
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::Serialization(err)
    }
}

impl From<reqwest::Error> for AppError {
    fn from(err: reqwest::Error) -> Self {
        AppError::NetworkError(err)
    }
}

// Convert to Tauri command result
impl From<AppError> for String {
    fn from(err: AppError) -> String {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, AppError>;
```

**Update:** `src-tauri/src/project_storage.rs`

**Before:**
```rust
pub fn save_project_file(project: &ProjectFile, file_path: &Path) -> Result<(), String> {
    let mut project = project.clone();
    project.project.last_modified = Utc::now();
    
    let json = serde_json::to_string_pretty(&project)
        .map_err(|e| format!("Failed to serialize project: {}", e))?;
    
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }
    
    let mut file = fs::File::create(file_path)
        .map_err(|e| format!("Failed to create file: {}", e))?;
    
    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write file: {}", e))?;
    
    Ok(())
}
```

**After:**
```rust
use crate::error::{AppError, Result};

pub fn save_project_file(project: &ProjectFile, file_path: &Path) -> Result<()> {
    let mut project = project.clone();
    project.project.last_modified = Utc::now();
    
    let json = serde_json::to_string_pretty(&project)?;
    
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent)?;
    }
    
    let mut file = fs::File::create(file_path)?;
    file.write_all(json.as_bytes())?;
    
    Ok(())
}

pub fn load_project_file(file_path: &Path) -> Result<ProjectFile> {
    if !file_path.exists() {
        return Err(AppError::NotFound(
            format!("Project file not found: {}", file_path.display())
        ));
    }
    
    let contents = fs::read_to_string(file_path)?;
    let project: ProjectFile = serde_json::from_str(&contents)?;
    
    Ok(project)
}
```

### 3.2 Add Async File Operations

**File:** Update `src-tauri/src/project_storage.rs`

**Before:**
```rust
use std::fs;
use std::io::Write;

pub fn save_project_file(project: &ProjectFile, file_path: &Path) -> Result<()> {
    // Synchronous file operations
    let mut file = fs::File::create(file_path)?;
    file.write_all(json.as_bytes())?;
}
```

**After:**
```rust
use tokio::fs;
use tokio::io::AsyncWriteExt;

pub async fn save_project_file(project: &ProjectFile, file_path: &Path) -> Result<()> {
    let mut project = project.clone();
    project.project.last_modified = Utc::now();
    
    let json = serde_json::to_string_pretty(&project)?;
    
    if let Some(parent) = file_path.parent() {
        fs::create_dir_all(parent).await?;
    }
    
    let mut file = fs::File::create(file_path).await?;
    file.write_all(json.as_bytes()).await?;
    file.sync_all().await?; // Ensure data is written to disk
    
    Ok(())
}

pub async fn load_project_file(file_path: &Path) -> Result<ProjectFile> {
    if !file_path.exists() {
        return Err(AppError::NotFound(
            format!("Project file not found: {}", file_path.display())
        ));
    }
    
    let contents = fs::read_to_string(file_path).await?;
    let project: ProjectFile = serde_json::from_str(&contents)?;
    
    Ok(project)
}
```

## 4. DEAD CODE REMOVAL

### 4.1 Unused Imports in App.tsx

**File:** `src/App.tsx`

**Before:**
```typescript
import { COLORS, SPACING, DURATIONS } from '@/constants'
import { Suspense } from 'react' // Not used
```

**After:**
```typescript
// Remove unused imports
// import { COLORS, SPACING, DURATIONS } from '@/constants' // Remove if not used
// Suspense is used for lazy loading, keep it
```

### 4.2 Remove Debug Logging in Production

**File:** `src/App.tsx`

**Before:**
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

**After:**
```typescript
// Remove debug logging or wrap in development check
useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('State changed:', {
        currentStep,
        hasCourseSeedData: !!courseSeedData,
        hasCourseContent: !!courseContent
      })
    }
}, [currentStep, courseSeedData, courseContent])
```

### 4.3 Remove Old localStorage Cleanup

**File:** `src/App.tsx`

**Before:**
```typescript
useEffect(() => {
    // Clear any old localStorage data to prevent conflicts
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('scorm_') && !key.includes('recent_files')) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => {
      console.log('Removing old localStorage key:', key)
      localStorage.removeItem(key)
    })
```

**After:**
```typescript
// Remove this entire useEffect - migration code no longer needed
// This was one-time cleanup code that's no longer necessary
```

## 5. CODE FORMATTING & CONSISTENCY

### 5.1 Prettier Configuration

**File:** Create `.prettierrc.json`

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "avoid",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "jsxSingleQuote": false,
  "jsxBracketSameLine": false,
  "overrides": [
    {
      "files": "*.tsx",
      "options": {
        "parser": "typescript"
      }
    }
  ]
}
```

### 5.2 ESLint Configuration

**File:** Update `.eslintrc.json`

```json
{
  "env": {
    "browser": true,
    "es2021": true,
    "node": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaFeatures": {
      "jsx": true
    },
    "ecmaVersion": "latest",
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "plugins": [
    "react",
    "@typescript-eslint",
    "react-hooks"
  ],
  "rules": {
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn"
  },
  "settings": {
    "react": {
      "version": "detect"
    }
  }
}
```

### 5.3 Rust Formatting

**File:** Create `rustfmt.toml`

```toml
# Rust formatting configuration
edition = "2021"
max_width = 100
hard_tabs = false
tab_spaces = 4
newline_style = "Unix"
use_small_heuristics = "Default"
reorder_imports = true
reorder_modules = true
remove_nested_parens = true
match_arm_leading_pipes = "Never"
fn_args_layout = "Tall"
merge_derives = true
use_try_shorthand = true
use_field_init_shorthand = true
force_explicit_abi = true
```

### 5.4 Package.json Scripts

**File:** Update `package.json`

```json
{
  "scripts": {
    "format": "prettier --write \"src/**/*.{js,jsx,ts,tsx,json,css,md}\"",
    "lint": "eslint src --ext .js,.jsx,.ts,.tsx",
    "lint:fix": "eslint src --ext .js,.jsx,.ts,.tsx --fix",
    "typecheck": "tsc --noEmit",
    "format:rust": "cd src-tauri && cargo fmt",
    "lint:rust": "cd src-tauri && cargo clippy -- -D warnings",
    "check:all": "npm run typecheck && npm run lint && npm run format:rust && npm run lint:rust"
  }
}
```

## Summary

This refactoring guide addresses:

1. **Critical Security Fixes**: Path traversal, XSS, and SSRF vulnerabilities
2. **Performance Improvements**: Custom hooks, memoization, and proper cleanup
3. **Code Organization**: Extracted reusable logic into custom hooks
4. **Error Handling**: Centralized Rust error types and better error messages
5. **Code Quality**: Formatting rules and linting configuration

Run `npm run check:all` to ensure code consistency across the project.