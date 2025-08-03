# SCORM Builder Architecture Guide

## Overview

The SCORM Builder has undergone a major architectural transformation to simplify media management and improve maintainability. This guide documents the current architecture and provides guidance for developers.

## Architecture Evolution

### Previous Architecture (Complex - 6+ Layers)
```
FileStorage → FileStorageAdapter → MediaRegistry → MediaStore → MediaContext → Components
```

### Current Architecture (Simple - 2 Layers)
```
MediaService → UnifiedMediaContext → Components
```

## Core Components

### 1. MediaService (Backend Layer)
The `MediaService` is the single source of truth for all media operations. It communicates directly with the Tauri backend.

```
┌─────────────────────────────────────────────────────────┐
│                      MediaService                        │
├─────────────────────────────────────────────────────────┤
│ • Single instance per project                           │
│ • Direct Tauri API communication                        │
│ • Built-in caching and performance optimization        │
│ • Automatic retry with exponential backoff              │
│ • Security validation (URL & path sanitization)         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                    Tauri Backend                        │
├─────────────────────────────────────────────────────────┤
│ • Rust-based file system operations                    │
│ • Project-scoped media storage                         │
│ • Secure file handling                                 │
└─────────────────────────────────────────────────────────┘
```

### 2. UnifiedMediaContext (React Layer)
The `UnifiedMediaContext` provides React components with access to media functionality through hooks.

```
┌─────────────────────────────────────────────────────────┐
│                  UnifiedMediaContext                     │
├─────────────────────────────────────────────────────────┤
│ • React Context API                                     │
│ • Provides useMedia() hook                             │
│ • Manages MediaService lifecycle                        │
│ • Integrates with BlobURLManager                       │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   React Components                       │
├─────────────────────────────────────────────────────────┤
│ • MediaEnhancementWizard                               │
│ • AudioNarrationWizard                                 │
│ • SCORMPackageBuilder                                  │
│ • MediaLibrary                                         │
└─────────────────────────────────────────────────────────┘
```

## Data Flow

### Media Upload Flow
```
User selects file
       │
       ▼
Component calls mediaService.storeMedia()
       │
       ▼
MediaService validates file
       │
       ▼
MediaService generates unique ID
       │
       ▼
MediaService stores via Tauri API
       │
       ▼
MediaService updates cache
       │
       ▼
Component receives MediaItem
```

### Media Retrieval Flow
```
Component requests media
       │
       ▼
MediaService checks cache
       │
       ├─── Cache Hit ──→ Return cached data
       │
       └─── Cache Miss
              │
              ▼
       Fetch from Tauri backend
              │
              ▼
       Update cache
              │
              ▼
       Create Blob URL via BlobURLManager
              │
              ▼
       Return to component
```

## Key Features

### 1. Automatic Memory Management
The `BlobURLManager` automatically tracks and cleans up blob URLs to prevent memory leaks:

```typescript
// Blob URLs are automatically cleaned up when:
// - Component unmounts
// - Media is deleted
// - New media replaces old media
// - Manual cleanup is triggered
```

### 2. Performance Optimization
- **Caching**: In-memory cache for frequently accessed media
- **Lazy Loading**: Media data loaded on demand
- **Progress Tracking**: Real-time upload progress
- **Retry Logic**: Automatic retry with exponential backoff

### 3. Security Features
- **URL Validation**: Prevents XSS and malicious URLs
- **Path Sanitization**: Prevents directory traversal attacks
- **Content Security Policy**: Restricts external resources
- **API Key Protection**: Secure storage of sensitive data

## Project Structure

```
src/
├── services/
│   ├── MediaService.ts         # Core media operations
│   ├── PersistentStorage.ts    # Project and content storage
│   └── BlobURLManager.ts       # Memory management
├── contexts/
│   └── UnifiedMediaContext.tsx # React integration
├── hooks/
│   └── useMedia.ts            # Included in UnifiedMediaContext
└── utils/
    ├── idGenerator.ts         # Unique ID generation
    ├── urlValidator.ts        # URL security validation
    ├── pathSanitizer.ts       # Path security
    └── retryWithBackoff.ts    # Retry mechanisms
```

## Usage Examples

### Basic Media Upload
```typescript
const { mediaService } = useMedia()

const handleUpload = async (file: File) => {
  try {
    const mediaItem = await mediaService.storeMedia(
      file,
      'image',
      { pageId: 'topic-1' }
    )
    console.log('Uploaded:', mediaItem.id)
  } catch (error) {
    console.error('Upload failed:', error)
  }
}
```

### Media with Progress Tracking
```typescript
const handleUploadWithProgress = async (file: File) => {
  const mediaItem = await mediaService.storeMedia(
    file,
    'image',
    { pageId: 'topic-1' },
    (progress) => {
      console.log(`Upload progress: ${progress.percent}%`)
    }
  )
}
```

### YouTube Video Storage
```typescript
const handleYouTubeVideo = async (url: string) => {
  const mediaItem = await mediaService.storeYouTubeVideo(
    url,
    'Tutorial Video',
    { pageId: 'topic-1' }
  )
}
```

## Migration Guide

If you're updating code from the old architecture:

### Old Pattern (FileStorage)
```typescript
// DON'T DO THIS
import { fileStorage } from '../services/FileStorage'
await fileStorage.storeMedia(id, blob, type)
```

### New Pattern (MediaService)
```typescript
// DO THIS
const { mediaService } = useMedia()
await mediaService.storeMedia(file, type, metadata)
```

### Key Differences
1. **No manual ID generation** - MediaService handles this
2. **File-based instead of Blob-based** - Pass File objects directly
3. **Metadata as parameter** - Not separate method calls
4. **Automatic project scoping** - No need to specify project ID

## Best Practices

1. **Always use the useMedia hook** in React components
2. **Handle errors gracefully** - All operations can fail
3. **Use progress callbacks** for large files
4. **Clean up blob URLs** when done (automatic with BlobURLManager)
5. **Validate URLs** before storing external media

## Troubleshooting

See the [Troubleshooting Guide](../troubleshooting/README.md) for common issues and solutions.

## Performance Considerations

- Media is cached in memory for fast access
- Blob URLs are created on demand and cleaned up automatically
- Large files show progress indicators
- Failed operations retry automatically

## Security Considerations

- All external URLs are validated
- File paths are sanitized
- Content Security Policy is enforced
- API keys are stored securely

## Future Enhancements

- Media compression and optimization
- Thumbnail generation
- Advanced caching strategies
- WebRTC streaming support