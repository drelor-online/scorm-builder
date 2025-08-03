# MediaService API Reference

## Overview

The `MediaService` class provides a unified interface for all media operations in the SCORM Builder application. It handles storage, retrieval, and management of images, videos, audio files, and YouTube URLs.

## Constructor

```typescript
constructor(projectId: string)
```

Creates a new MediaService instance for a specific project.

**Parameters:**
- `projectId` (string): The unique identifier of the project

**Example:**
```typescript
const mediaService = new MediaService('project-123')
```

## Methods

### storeMedia

```typescript
async storeMedia(
  file: File,
  mediaType: 'image' | 'video' | 'audio',
  metadata?: Record<string, any>,
  progressCallback?: (progress: ProgressInfo) => void
): Promise<MediaItem>
```

Stores a media file in the project.

**Parameters:**
- `file` (File): The file to upload
- `mediaType` ('image' | 'video' | 'audio'): Type of media
- `metadata` (Record<string, any>, optional): Additional metadata
  - `pageId` (string): Associated page/topic ID
  - `alt` (string): Alternative text for images
  - Any other custom metadata
- `progressCallback` (function, optional): Progress tracking callback

**Returns:** Promise<MediaItem> - The stored media item

**Throws:**
- Error if file validation fails
- Error if storage operation fails

**Example:**
```typescript
const imageFile = new File([blob], 'diagram.png', { type: 'image/png' })

const mediaItem = await mediaService.storeMedia(
  imageFile,
  'image',
  { 
    pageId: 'topic-1',
    alt: 'Architecture diagram'
  },
  (progress) => {
    console.log(`Upload ${progress.percent}% complete`)
  }
)
```

### storeYouTubeVideo

```typescript
async storeYouTubeVideo(
  url: string,
  title: string,
  metadata?: Record<string, any>
): Promise<MediaItem>
```

Stores a YouTube video reference.

**Parameters:**
- `url` (string): YouTube video URL
- `title` (string): Video title
- `metadata` (Record<string, any>, optional): Additional metadata

**Returns:** Promise<MediaItem> - The stored video reference

**Throws:**
- Error if URL validation fails
- Error if not a valid YouTube URL

**Example:**
```typescript
const videoItem = await mediaService.storeYouTubeVideo(
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  'Tutorial Video',
  { pageId: 'topic-2' }
)
```

### getMedia

```typescript
async getMedia(mediaId: string): Promise<MediaData | null>
```

Retrieves media data by ID.

**Parameters:**
- `mediaId` (string): The media item ID

**Returns:** Promise<MediaData | null>
- `MediaData` object containing:
  - `id` (string): Media ID
  - `data` (Uint8Array): Binary data
  - `mimeType` (string): MIME type
  - `metadata` (any): Associated metadata
- `null` if media not found

**Example:**
```typescript
const mediaData = await mediaService.getMedia('topic-1-image-abc123')
if (mediaData) {
  console.log('Retrieved media:', mediaData.mimeType)
}
```

### createBlobUrl

```typescript
async createBlobUrl(mediaId: string): Promise<string | null>
```

Creates a blob URL for displaying media in the browser.

**Parameters:**
- `mediaId` (string): The media item ID

**Returns:** Promise<string | null>
- Blob URL string for use in img/video/audio elements
- `null` if media not found

**Note:** Blob URLs are automatically cleaned up by BlobURLManager

**Example:**
```typescript
const blobUrl = await mediaService.createBlobUrl('topic-1-image-abc123')
if (blobUrl) {
  imageElement.src = blobUrl
}
```

### deleteMedia

```typescript
async deleteMedia(mediaId: string): Promise<void>
```

Deletes a media item from storage.

**Parameters:**
- `mediaId` (string): The media item ID to delete

**Returns:** Promise<void>

**Side Effects:**
- Removes from backend storage
- Clears from cache
- Revokes any blob URLs

**Example:**
```typescript
await mediaService.deleteMedia('topic-1-image-abc123')
```

### listMediaForPage

```typescript
async listMediaForPage(pageId: string): Promise<MediaItem[]>
```

Lists all media items associated with a specific page/topic.

**Parameters:**
- `pageId` (string): The page/topic ID

**Returns:** Promise<MediaItem[]> - Array of media items

**Example:**
```typescript
const topicMedia = await mediaService.listMediaForPage('topic-1')
console.log(`Found ${topicMedia.length} media items`)
```

### listAllMedia

```typescript
async listAllMedia(): Promise<MediaItem[]>
```

Lists all media items in the project.

**Returns:** Promise<MediaItem[]> - Array of all media items

**Example:**
```typescript
const allMedia = await mediaService.listAllMedia()
const imageCount = allMedia.filter(m => m.mimeType.startsWith('image/')).length
```

### clearCache

```typescript
clearCache(): void
```

Clears the in-memory media cache.

**Returns:** void

**Use Cases:**
- Free memory after heavy media operations
- Force fresh data retrieval

**Example:**
```typescript
mediaService.clearCache()
```

### validateExternalUrl

```typescript
validateExternalUrl(url: string): ValidationResult
```

Validates an external URL for security.

**Parameters:**
- `url` (string): URL to validate

**Returns:** ValidationResult
- `valid` (boolean): Whether URL is safe
- `error` (string, optional): Error message if invalid
- `sanitized` (string, optional): Sanitized URL if valid

**Example:**
```typescript
const result = mediaService.validateExternalUrl('https://example.com/image.jpg')
if (result.valid) {
  // Safe to use URL
}
```

## Types

### MediaItem

```typescript
interface MediaItem {
  id: string
  url: string
  type: 'image' | 'video' | 'audio'
  mimeType: string
  fileName: string
  metadata?: Record<string, any>
}
```

### MediaData

```typescript
interface MediaData {
  id: string
  data: Uint8Array
  mimeType: string
  metadata?: any
}
```

### ProgressInfo

```typescript
interface ProgressInfo {
  loaded: number      // Bytes uploaded
  total: number       // Total bytes
  percent: number     // Percentage (0-100)
  timestamp?: number  // Unix timestamp
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean
  error?: string
  sanitized?: string
}
```

## Error Handling

All async methods can throw errors. Common error types:

- **ValidationError**: Invalid file type, size, or URL
- **StorageError**: Backend storage failure
- **NetworkError**: Communication failure with backend
- **NotFoundError**: Media ID doesn't exist

**Best Practice:**
```typescript
try {
  const mediaItem = await mediaService.storeMedia(file, 'image')
} catch (error) {
  if (error.message.includes('validation')) {
    // Handle validation error
  } else if (error.message.includes('storage')) {
    // Handle storage error
  } else {
    // Handle other errors
  }
}
```

## Performance Considerations

1. **Caching**: Media data is cached in memory after first retrieval
2. **Retry Logic**: Failed operations automatically retry with exponential backoff
3. **Progress Tracking**: Use progress callbacks for large files
4. **Batch Operations**: Use `listAllMedia()` instead of multiple `getMedia()` calls

## Security Features

1. **URL Validation**: All external URLs are validated against XSS patterns
2. **Path Sanitization**: File paths are sanitized to prevent directory traversal
3. **Content Type Validation**: MIME types are verified
4. **Size Limits**: Maximum file sizes are enforced

## Integration with React

Use the `useMedia` hook from `UnifiedMediaContext`:

```typescript
import { useMedia } from '../contexts/UnifiedMediaContext'

function MyComponent() {
  const { mediaService } = useMedia()
  
  // Use mediaService methods
}
```

## Migration from Legacy Systems

See the [Architecture Guide](../architecture/README.md#migration-guide) for migrating from FileStorage or other legacy systems.