# Media Service Migration Guide

## Overview

This guide explains how to migrate from the old FileStorage + FileStorageAdapter + MediaRegistry architecture to the new simplified MediaService + UnifiedMediaContext system.

## Architecture Changes

### Old Architecture (Complex)
```
FileStorage → FileStorageAdapter → MediaRegistry → MediaContext
    ↓              ↓                    ↓              ↓
  Tauri         Wrapper            ID Tracking    React Context
```

### New Architecture (Simplified)
```
MediaService → UnifiedMediaContext
    ↓              ↓
  Tauri       React Context
```

## Migration Steps

### 1. Update Imports

**Old:**
```typescript
import { useMedia } from '../contexts/MediaContext'
import { MediaRegistry } from '../services/MediaRegistry'
import { FileStorage } from '../services/FileStorage'
```

**New:**
```typescript
import { useUnifiedMedia, useMedia } from '../contexts/UnifiedMediaContext'
// useMedia() provides backward compatibility
```

### 2. Context Provider Migration

**Old:**
```tsx
<PersistentStorageProvider>
  <MediaProvider>
    <App />
  </MediaProvider>
</PersistentStorageProvider>
```

**New:**
```tsx
<PersistentStorageProvider>
  <UnifiedMediaProvider projectId={projectId}>
    <App />
  </UnifiedMediaProvider>
</PersistentStorageProvider>
```

### 3. API Usage Migration

#### Storing Media

**Old:**
```typescript
const { mediaRegistry } = useMedia()
const reference = await mediaRegistry.storeFile(file, pageId, type)
```

**New:**
```typescript
const { storeMedia } = useUnifiedMedia()
const mediaItem = await storeMedia(file, pageId, type)
```

#### Getting Media

**Old:**
```typescript
const reference = mediaRegistry.getReference(mediaId)
const blob = await reference.getBlob()
```

**New:**
```typescript
const { getMedia } = useUnifiedMedia()
const media = await getMedia(mediaId)
// media.data is Uint8Array, create blob if needed:
const blob = new Blob([media.data], { type: media.metadata.mimeType })
```

#### Creating Blob URLs

**Old:**
```typescript
const url = URL.createObjectURL(blob)
// Manual cleanup required
```

**New:**
```typescript
const { createBlobUrl } = useUnifiedMedia()
const url = await createBlobUrl(mediaId)
// Automatic cleanup with blobUrlManager
```

#### YouTube Videos

**Old:**
```typescript
// Complex flow through multiple services
```

**New:**
```typescript
const { storeYouTubeVideo } = useUnifiedMedia()
const mediaItem = await storeYouTubeVideo(youtubeUrl, embedUrl, pageId)
```

### 4. Component-Specific Migration

#### MediaEnhancementWizard

```typescript
// Old
const { mediaRegistry } = useMedia()
const ref = await mediaRegistry.storeFile(imageFile, pageId, 'image')

// New
const { storeMedia } = useUnifiedMedia()
const mediaItem = await storeMedia(imageFile, pageId, 'image')
```

#### AudioNarrationWizard

```typescript
// Old
const { mediaRegistry } = useMedia()
const audioRef = await mediaRegistry.storeFile(audioFile, pageId, 'audio')

// New  
const { storeMedia } = useUnifiedMedia()
const audioItem = await storeMedia(audioFile, pageId, 'audio', {
  narrationIndex: index,
  recordingId: generateAudioRecordingId()
})
```

#### SCORMPackageBuilder

```typescript
// Old
const { mediaRegistry } = useMedia()
const refs = mediaRegistry.getMediaForPage(pageId)

// New
const { getMediaForPage } = useUnifiedMedia()
const mediaItems = getMediaForPage(pageId)
```

### 5. Blob URL Management

The new system includes automatic blob URL cleanup:

```typescript
// Old - Manual cleanup required
useEffect(() => {
  const url = URL.createObjectURL(blob)
  return () => URL.revokeObjectURL(url)
}, [blob])

// New - Automatic cleanup
const { createBlobUrl, revokeBlobUrl } = useUnifiedMedia()
const url = await createBlobUrl(mediaId)
// Cleanup handled automatically, but can revoke manually:
// revokeBlobUrl(url)
```

### 6. Performance Improvements

The new system includes:
- Automatic blob URL cleanup after 30 minutes of inactivity
- Cleanup on page unload
- Reference counting for shared URLs
- Statistics tracking

```typescript
// Get blob URL statistics
import { blobUrlManager } from '../utils/blobUrlManager'
const stats = blobUrlManager.getStats()
console.log(`Total URLs: ${stats.totalUrls}, Total Size: ${stats.totalSize}`)
```

## Backward Compatibility

The `useMedia()` hook provides backward compatibility:

```typescript
// This still works but uses the new system internally
const { mediaRegistry } = useMedia()
```

However, it's recommended to migrate to `useUnifiedMedia()` for full feature access.

## Testing Migration

1. Update test imports:
```typescript
// Old
import { MediaProvider } from '../contexts/MediaContext'

// New
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
```

2. Update test setup:
```typescript
// Old
const wrapper = ({ children }) => (
  <MediaProvider>
    {children}
  </MediaProvider>
)

// New
const wrapper = ({ children }) => (
  <UnifiedMediaProvider projectId="test-project">
    {children}
  </UnifiedMediaProvider>
)
```

## Benefits After Migration

1. **Simpler API** - Direct methods instead of nested objects
2. **Better Performance** - Automatic blob URL cleanup
3. **Type Safety** - Better TypeScript support
4. **Less Code** - No need for adapters and registries
5. **Memory Efficiency** - Automatic cleanup prevents leaks

## Removing Old Code

After migration, these files can be removed:
- `src/services/FileStorage.ts`
- `src/services/FileStorage.refactored.ts`
- `src/services/FileStorageAdapter.ts`
- `src/services/MediaRegistry.ts`
- `src/contexts/MediaContext.tsx`
- `src/contexts/MediaRegistryContext.tsx`

## Troubleshooting

### Issue: Media IDs are different
The new system uses the same ID generation, so IDs should be compatible.

### Issue: Blob URLs expire
The new system automatically manages blob URL lifecycle. If you need a URL to persist longer, use `createBlobUrl()` again.

### Issue: YouTube videos not working
Ensure you're using `storeYouTubeVideo()` which doesn't call the backend.

### Issue: Tests failing
Make sure to update both the provider and the hook usage in tests.