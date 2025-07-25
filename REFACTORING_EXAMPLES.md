# Refactoring Examples - Implementation Guide

## Quick Implementation Checklist

### 1. Install Required Dependencies

```bash
# For content sanitization
npm install dompurify
npm install --save-dev @types/dompurify

# For code formatting
npm install --save-dev prettier eslint-config-prettier
```

### 2. Update FileStorage.ts for Content Sanitization

**File:** `src/services/FileStorage.ts`

Add import at the top:
```typescript
import { sanitizeContentItem } from '../utils/contentSanitizer'
```

Update the `saveContent` method (around line 601):
```typescript
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

### 3. Update App.tsx to Use Custom Hooks

**File:** `src/App.tsx`

Add imports:
```typescript
import { useProjectData } from './hooks/useProjectData';
import { useAppState } from './hooks/useAppState';
```

Replace the projectData calculation (around line 116):
```typescript
// Remove this entire block:
// const projectData: ProjectData = courseSeedData ? { ... } : { ... }

// Replace with:
const projectData = useProjectData({ courseSeedData, courseContent, currentStep });
```

### 4. Update Rust Commands for Path Validation

**File:** `src-tauri/src/commands.rs`

Add at the top of the file:
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
```

Update the commands (around lines 114-138):
```rust
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

#[tauri::command]
pub async fn delete_project(file_path: String) -> Result<(), String> {
    let path = validate_project_path(&file_path)?;
    delete_project_file(&path)
}
```

### 5. Add URL Validation for Image Downloads

**File:** `src-tauri/src/commands.rs`

Add imports:
```rust
use url::Url;
use std::net::IpAddr;
```

Add validation constants and function:
```rust
/// List of allowed image domains
const ALLOWED_IMAGE_DOMAINS: &[&str] = &[
    "images.unsplash.com",
    "i.imgur.com",
    "upload.wikimedia.org",
    "cdn.pixabay.com",
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
    
    Ok(url)
}
```

Update the `download_image` command:
```rust
#[tauri::command]
pub async fn download_image(url: String) -> Result<DownloadImageResponse, String> {
    // Validate URL first
    let validated_url = validate_image_url(&url)?;
    
    // ... rest of the function using validated_url.as_str()
}
```

### 6. Remove Debug Logging

**File:** `src/App.tsx`

Wrap console.log statements in development checks:
```typescript
// Around line 78
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

### 7. Update package.json Scripts

Add these scripts to `package.json`:
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

## Testing the Refactoring

1. **Test Security Fixes:**
   ```bash
   # Try to save a project outside the allowed directory
   # Should fail with "Access denied" error
   
   # Try to download an image from a non-whitelisted domain
   # Should fail with domain not allowed error
   ```

2. **Test Performance:**
   - Open React DevTools Profiler
   - Navigate through the app
   - Check that `projectData` doesn't cause unnecessary re-renders

3. **Run Code Quality Checks:**
   ```bash
   npm run check:all
   ```

## Gradual Migration Strategy

1. **Phase 1 - Critical Security** (Do immediately):
   - Path validation in Rust
   - Content sanitization
   - URL validation for downloads

2. **Phase 2 - Performance** (Within a week):
   - Custom hooks for state management
   - Fix memory leaks in audio components
   - Add proper memoization

3. **Phase 3 - Code Quality** (Ongoing):
   - Remove dead code
   - Add proper TypeScript types
   - Implement consistent formatting

Remember to test thoroughly after each change!