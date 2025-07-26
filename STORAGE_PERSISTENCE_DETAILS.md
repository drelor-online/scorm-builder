# Storage & Persistence Layer - Detailed Documentation

## Architecture Overview

The storage system provides a unified interface that abstracts the underlying storage mechanism (IndexedDB or File System) through the `PersistentStorageContext`.

```
PersistentStorageContext (Interface)
    ├── usePersistentStorage (Hook)
    │   ├── IndexedDB Implementation (Browser/Default)
    │   └── FileStorage Implementation (Tauri Desktop)
    └── Storage Operations
        ├── Project Management
        ├── Content Storage
        ├── Media Storage
        └── Settings/Config
```

## Storage Context Interface

### Project Management Operations

1. **createProject**
   ```typescript
   createProject(name: string, defaultFolder?: string): Promise<Project>
   ```
   - Generates unique project ID (UUID)
   - Creates project metadata
   - Sets as current project
   - Initializes empty content structure
   - Returns project object with ID

2. **openProject**
   ```typescript
   openProject(
     projectId: string, 
     onProgress?: (progress: ProgressInfo) => void
   ): Promise<void>
   ```
   - Progress phases:
     - "Opening project" (0-10%)
     - "Loading content" (10-40%)
     - "Loading media" (40-90%)
     - "Finalizing" (90-100%)
   - Sets current project ID
   - Loads all associated data

3. **saveProject**
   ```typescript
   saveProject(): Promise<void>
   ```
   - Saves to current project
   - Updates last_modified timestamp
   - Atomic operation (all or nothing)
   - Auto-creates backup

4. **deleteProject**
   ```typescript
   deleteProject(projectId: string, filePath?: string): Promise<void>
   ```
   - Removes project metadata
   - Deletes all content
   - Clears media blobs
   - Updates recent projects list

### Content Storage Operations

1. **saveContent**
   ```typescript
   saveContent(id: string, content: any): Promise<void>
   ```
   - Content types:
     - 'seed-data': Initial course info
     - 'course-content': Full course structure
     - 'activities': Knowledge checks
     - 'scorm-config': Package settings
   - Validates before saving
   - Maintains version history

2. **getContent**
   ```typescript
   getContent(id: string): Promise<any>
   ```
   - Returns null if not found
   - Deserializes JSON data
   - Handles migration if needed

### Media Storage Operations

1. **storeMedia**
   ```typescript
   storeMedia(
     id: string, 
     blob: Blob, 
     mediaType: 'image' | 'video' | 'audio' | 'caption',
     metadata?: Record<string, any>
   ): Promise<void>
   ```
   - Metadata includes:
     - Original filename
     - MIME type
     - Dimensions (images)
     - Duration (audio/video)
     - Page/topic association

2. **storeYouTubeVideo**
   ```typescript
   storeYouTubeVideo(
     id: string, 
     youtubeUrl: string, 
     metadata?: Record<string, any>
   ): Promise<void>
   ```
   - Stores URL reference only
   - Extracts video ID
   - Generates embed code
   - No blob storage

3. **getMedia**
   ```typescript
   getMedia(id: string): Promise<MediaItem>
   ```
   - Returns blob + metadata
   - Handles missing media gracefully
   - Supports streaming (planned)

### Settings & Configuration

1. **Audio Settings**
   ```typescript
   interface AudioSettings {
     provider: 'browser' | 'elevenlabs' | 'murf'
     voice: string
     rate?: number
     pitch?: number
     stability?: number
     clarity?: number
   }
   ```

2. **SCORM Configuration**
   ```typescript
   interface ScormConfig {
     version: '1.2' | '2004'
     passMark: number
     completionCriteria: 'visited' | 'passed'
     allowRetake: boolean
     navigationMode: 'linear' | 'free'
   }
   ```

## IndexedDB Implementation

### Database Schema

```typescript
// Database: ScormBuilder
interface Schema {
  projects: {
    id: string
    name: string
    created: string
    last_modified: string
    metadata?: any
  }
  
  content: {
    id: string
    projectId: string
    contentId: string
    data: any
    timestamp: string
  }
  
  media: {
    id: string
    projectId: string
    mediaId: string
    blob: Blob
    metadata: MediaMetadata
  }
  
  settings: {
    key: string
    value: any
  }
}
```

### Transaction Handling

1. **Read Operations**
   - Uses readonly transactions
   - Implements retry logic
   - Handles quota errors

2. **Write Operations**
   - Uses readwrite transactions
   - Atomic updates
   - Rollback on failure

3. **Bulk Operations**
   - Batches for performance
   - Progress reporting
   - Cancellation support

## File System Implementation (Tauri)

### Directory Structure

```
projects/
├── {project-id}/
│   ├── project.json (metadata)
│   ├── content/
│   │   ├── seed-data.json
│   │   ├── course-content.json
│   │   ├── activities.json
│   │   └── scorm-config.json
│   ├── media/
│   │   ├── images/
│   │   ├── audio/
│   │   ├── videos/
│   │   └── captions/
│   └── backup/
│       └── {timestamp}/
```

### File Operations

1. **Project Files**
   ```typescript
   // project.json
   {
     "id": "uuid",
     "name": "Course Name",
     "created": "2024-01-01T00:00:00Z",
     "last_modified": "2024-01-01T00:00:00Z",
     "version": "1.0.0"
   }
   ```

2. **Content Files**
   - JSON format
   - Pretty printed for readability
   - UTF-8 encoding
   - Atomic writes (temp + rename)

3. **Media Files**
   - Original format preserved
   - Filename: {id}.{extension}
   - Metadata in separate JSON

## Migration & Recovery

### LocalStorage Migration

```typescript
migrateFromLocalStorage(): Promise<MigratedProject[]>
```

1. **Detection**
   - Checks for legacy keys
   - Validates data structure
   - Estimates migration time

2. **Migration Process**
   - Creates new projects
   - Transfers content
   - Converts media references
   - Updates format version

3. **Cleanup**
   - Backs up old data
   - Clears localStorage
   - Reports success/failure

### Crash Recovery

```typescript
checkForRecovery(): Promise<RecoveryInfo>
recoverFromBackup(backupPath: string): Promise<void>
```

1. **Detection**
   - Checks crash flag
   - Finds recent backups
   - Validates backup integrity

2. **Recovery Options**
   - Restore from backup
   - Start fresh
   - Merge changes (planned)

## Export/Import

### Export Format

```typescript
// ZIP structure
project-export.zip
├── manifest.json
├── content/
│   └── *.json
├── media/
│   ├── images/
│   ├── audio/
│   └── captions/
└── metadata.json
```

### Import Process

1. **Validation**
   - Check ZIP structure
   - Verify manifest
   - Validate content format

2. **Import Steps**
   - Create new project
   - Extract content
   - Process media
   - Update references

3. **Conflict Resolution**
   - Duplicate detection
   - Name collision handling
   - Version compatibility

## Performance Optimizations

1. **Lazy Loading**
   - Media loaded on demand
   - Content chunking
   - Progressive loading

2. **Caching**
   - Memory cache for recent items
   - Blob URL caching
   - Metadata indexing

3. **Cleanup**
   - Orphaned media detection
   - Old backup removal
   - Storage quota management

## Error Handling

### Common Errors

1. **QuotaExceededError**
   - Prompt for cleanup
   - Suggest export
   - Compress media option

2. **Network Errors**
   - Retry with backoff
   - Offline mode
   - Queue for sync

3. **Corruption**
   - Validation on load
   - Repair attempts
   - Fallback to backup

### Error Recovery

```typescript
interface ErrorRecovery {
  retry: () => Promise<void>
  fallback: () => Promise<void>
  report: (error: Error) => void
}
```

## Security Considerations

1. **Data Validation**
   - Input sanitization
   - Size limits
   - Type checking

2. **Access Control**
   - Project isolation
   - No cross-project access
   - User permission checks

3. **Data Privacy**
   - Local storage only
   - No cloud sync
   - Encryption (planned)

This comprehensive documentation provides the foundation for testing the storage and persistence layer.