# Duplicate Media Handling Implementations - Audit Findings

## Overview
Multiple competing media handling systems exist in the codebase, causing confusion about which to use and potential data inconsistency.

## 1. Media Storage Systems

### MediaStore (services/MediaStore.ts)
- **Purpose**: Caching layer for media with protocol URLs
- **Key Features**:
  - Creates `scorm-media://projectId/mediaId` URLs
  - Uses ParallelMediaLoader for batch loading
  - Caches media in memory
  - Progress tracking
- **Storage**: Memory cache only, loads from backend

### MediaRegistry (services/MediaRegistry.ts) 
- **Purpose**: "Unified media management system"
- **Key Features**:
  - Single source of truth (claims to be)
  - Generates canonical IDs like "welcome-audio-0"
  - Manages storage keys
  - Has import/export manifest support
- **Storage**: Uses StorageBackend interface

### FileStorage (services/FileStorage.ts)
- **Purpose**: Tauri backend interface for file operations
- **Key Features**:
  - Direct file I/O via Tauri commands
  - Project-based storage
  - Metadata management
  - Used by other services
- **Storage**: Actual file system via Rust

### fileMediaManager (services/fileMediaManager.ts)
- **Purpose**: File-based media organization
- **Key Features**:
  - Creates directory structure
  - Organized by media type
  - Project structure management
- **Storage**: File system with specific folder layout

## 2. Context Providers

### MediaContext (contexts/MediaContext.tsx)
- Uses MediaStore
- Provides React context for media access
- Handles loading state and errors

### MediaRegistryContext (contexts/MediaRegistryContext.tsx)
- Uses MediaRegistry
- Another React context for media
- Competes with MediaContext

## 3. Storage Adapters

### ParallelMediaLoader (services/ParallelMediaLoader.ts)
- Used by MediaStore
- Handles concurrent media loading
- Has retry logic

### FileStorageAdapter (services/FileStorageAdapter.ts)
- Adapter pattern for FileStorage
- Another abstraction layer

## 4. Duplication Issues

### ID Generation Conflicts
```typescript
// MediaStore creates:
"scorm-media://project-123/audio-0"

// MediaRegistry creates:
"welcome-audio-0"

// FileStorage uses:
"audio-0.bin"

// fileMediaManager expects:
"media/audio/welcome-audio.mp3"
```

### Multiple Sources of Truth
1. MediaStore has in-memory cache
2. MediaRegistry claims to be "single source of truth"
3. FileStorage is actual file system truth
4. Each maintains different metadata

### Competing Context Providers
Components must choose between:
- `useMedia()` from MediaContext
- `useMediaRegistry()` from MediaRegistryContext

Both provide similar functionality with different implementations.

### Storage Location Confusion
- MediaStore: Uses protocol URLs
- MediaRegistry: Uses storage keys
- FileStorage: Direct file paths
- fileMediaManager: Organized folder structure

## 5. Usage Patterns

### In Components
```typescript
// Some components use MediaContext:
const { getMediaUrl } = useMedia()

// Others use MediaRegistry:
const { getMedia } = useMediaRegistry()

// Some bypass both and use FileStorage directly:
await FileStorage.getMedia(projectId, mediaId)
```

### In SCORM Generation
- rustScormGenerator uses FileStorage directly
- Some components prepare data using MediaStore
- Registry tracks what should be included

## 6. Problems Caused

### 1. Data Inconsistency
- Media saved via one system might not be visible in another
- IDs don't match between systems
- Metadata stored differently

### 2. Performance Issues
- Multiple caching layers
- Redundant loading
- Memory leaks from duplicate caches

### 3. Developer Confusion
- Which system to use?
- How do they interact?
- Why are there so many?

### 4. Maintenance Burden
- Changes must be made in multiple places
- Tests for each system
- Bug fixes duplicated

## 7. Evolution Evidence

### Comments Found
```typescript
// MediaRegistry.ts:
"This replaces the fragmented media handling with a single source of truth"

// MediaStore.ts:
"Re-export for backward compatibility"
```

This suggests MediaRegistry was meant to replace MediaStore, but both still exist.

### Naming Patterns
- "Refactored" suffix on some files
- Old and new patterns coexist
- Migration never completed

## Recommendations

1. **Choose ONE System**: MediaRegistry appears to be the intended future
2. **Complete Migration**: Remove MediaStore and MediaContext
3. **Simplify Architecture**: Too many abstraction layers
4. **Consistent IDs**: One ID format throughout
5. **Clear Documentation**: Which system for what purpose
6. **Remove fileMediaManager**: Functionality duplicated elsewhere