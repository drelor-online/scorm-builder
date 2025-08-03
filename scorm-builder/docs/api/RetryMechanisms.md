# Retry Mechanisms Documentation

## Overview

The SCORM Builder includes built-in retry mechanisms for all media operations to ensure reliability and handle transient network failures. The retry system is implemented using the `retryWithBackoff` utility with configurable strategies.

## How It Works

### Automatic Retry with Exponential Backoff

All MediaService operations automatically retry failed requests using exponential backoff:

```typescript
// Example from MediaService
await retryWithBackoff(
  async () => invoke('store_media', params),
  {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2
  }
)
```

### Retry Strategies

The system provides pre-configured retry strategies:

#### 1. Network Strategy (Default for uploads)
- **Max Attempts**: 3
- **Initial Delay**: 1000ms
- **Max Delay**: 10000ms
- **Backoff Factor**: 2
- **Use Case**: Media uploads, downloads

#### 2. Fast Strategy (For quick operations)
- **Max Attempts**: 2
- **Initial Delay**: 500ms
- **Max Delay**: 2000ms
- **Backoff Factor**: 2
- **Use Case**: Metadata retrieval, listing operations

## Operations with Automatic Retry

### 1. Media Upload (`storeMedia`)
```typescript
// Automatically retries up to 3 times
await mediaService.storeMedia(file, 'image', metadata)
```

**Retry Behavior**:
- 1st attempt: Immediate
- 2nd attempt: After 1 second
- 3rd attempt: After 2 seconds

### 2. Media Retrieval (`getMedia`)
```typescript
// Automatically retries up to 2 times
await mediaService.getMedia(mediaId)
```

**Retry Behavior**:
- 1st attempt: Immediate
- 2nd attempt: After 500ms

### 3. Media Deletion (`deleteMedia`)
```typescript
// Automatically retries up to 2 times
await mediaService.deleteMedia(mediaId)
```

### 4. Media Listing (`listAllMedia`, `listMediaForPage`)
```typescript
// Automatically retries up to 2 times
await mediaService.listAllMedia()
```

## User-Facing Retry Features

### Progress Callbacks During Retry

When a retry occurs during upload, the progress callback is notified:

```typescript
await mediaService.storeMedia(file, 'image', metadata, (progress) => {
  if (progress.percent === 0 && progress.timestamp) {
    // Retry in progress
    console.log('Retrying upload...')
  }
})
```

### Error Messages

Failed operations after all retries provide clear error messages:

- "Network error: Please check your connection"
- "Storage error: Unable to save file"
- "Server error: Please try again later"

## Manual Retry Options

While automatic retry handles most cases, users can manually retry through:

1. **Re-upload Button**: In MediaEnhancementWizard
2. **Try Again**: In error dialogs
3. **Refresh**: Reloads and retries pending operations

## Configuration

### Custom Retry Configuration

Developers can customize retry behavior:

```typescript
import { retryWithBackoff, RetryOptions } from '../utils/retryWithBackoff'

const customRetry: RetryOptions = {
  maxAttempts: 5,
  initialDelay: 500,
  maxDelay: 30000,
  backoffFactor: 3,
  shouldRetry: (error) => {
    // Custom logic to determine if should retry
    return !error.message.includes('permanent failure')
  },
  onRetry: (error, attempt, delay) => {
    console.log(`Retry attempt ${attempt} in ${delay}ms`)
  }
}
```

### Disabling Retry

To disable retry for specific operations:

```typescript
const options = {
  maxAttempts: 1 // No retry
}
```

## Best Practices

1. **Don't Retry User Errors**: 
   - Invalid file types
   - Files too large
   - Malformed data

2. **Do Retry Network Errors**:
   - Connection timeouts
   - Temporary server errors
   - Network interruptions

3. **Provide Feedback**:
   - Show retry attempts to users
   - Allow manual retry after automatic retry fails
   - Clear error messages

4. **Resource Cleanup**:
   - Cancel pending retries on component unmount
   - Clear upload progress on retry

## Error Handling

### Retry Exhausted

When all retry attempts fail:

```typescript
try {
  await mediaService.storeMedia(file, 'image')
} catch (error) {
  if (error.message.includes('after 3 attempts')) {
    // All retries failed
    showError('Upload failed. Please check your connection and try again.')
  }
}
```

### Permanent Failures

Some errors should not trigger retry:

- 400 Bad Request (invalid data)
- 401 Unauthorized (auth required)
- 413 Payload Too Large (file too big)
- 415 Unsupported Media Type

## Monitoring

### Debug Logging

Enable retry logging:

```typescript
localStorage.setItem('debug', 'scorm-builder:retry')
```

### Performance Impact

Retry delays are included in performance metrics:

```typescript
const report = performanceMonitor.generateReport()
// Check for operations with high retry rates
```

## Future Enhancements

1. **Smart Retry**: Adjust strategy based on error type
2. **Offline Queue**: Queue operations when offline
3. **Retry Analytics**: Track retry patterns
4. **User Preferences**: Allow users to configure retry behavior