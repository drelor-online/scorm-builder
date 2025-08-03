# Performance Optimization Guide

## Overview

This guide explains how to use the integrated performance monitoring to identify and optimize critical paths in the SCORM Builder application.

## Performance Monitoring Integration

### Current Integration Points

Performance monitoring is already integrated into:

1. **MediaService** - All media operations
   - `storeMedia` - Upload performance tracking
   - `getMedia` - Retrieval performance
   - `deleteMedia` - Deletion performance
   - `listMediaForPage` - Listing performance
   - `createBlobUrl` - URL generation

2. **PersistentStorage** - Project and content operations
   - `storeMedia` - Backend storage
   - `getMedia` - Backend retrieval
   - `openProject` - Project loading

## Identifying Performance Bottlenecks

### 1. Enable Debug Mode

```javascript
// In browser console
localStorage.setItem('debug', 'scorm-builder:*')
localStorage.setItem('enablePerformanceMonitoring', 'true')
```

### 2. Run Performance Analysis

```javascript
// Get current performance data
const report = window.performanceMonitor.generateReport()

// Find slow operations
const slowOps = report.slowOperations
console.table(slowOps)

// Get detailed metrics for specific operation
const mediaUploads = window.performanceMonitor.getMetricsForOperation('MediaService.storeMedia')
console.table(mediaUploads)
```

### 3. Analyze Memory Usage

```javascript
// Check memory delta for operations
const summary = report.summary
const memoryIntensive = summary
  .filter(op => op.avgMemoryDelta > 10 * 1024 * 1024) // 10MB
  .sort((a, b) => b.avgMemoryDelta - a.avgMemoryDelta)

console.table(memoryIntensive)
```

## Optimization Strategies

### 1. Media Upload Optimization

**Current Implementation**:
```typescript
// MediaService already includes progress tracking
await mediaService.storeMedia(file, 'image', metadata, progressCallback)
```

**Optimization Opportunities**:
- Implement client-side image compression before upload
- Use Web Workers for image processing
- Implement chunked uploads for large files

**Example Enhancement**:
```typescript
// Add image compression before upload
async function optimizeImageBeforeUpload(file: File): Promise<File> {
  if (file.size < 1024 * 1024) return file // Skip if < 1MB
  
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  
  // Resize if too large
  const maxDimension = 2048
  let { width, height } = bitmap
  
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height)
    width *= scale
    height *= scale
  }
  
  canvas.width = width
  canvas.height = height
  ctx.drawImage(bitmap, 0, 0, width, height)
  
  // Convert to blob with compression
  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.85)
  })
  
  return new File([blob], file.name, { type: 'image/jpeg' })
}
```

### 2. Caching Optimization

**Current Implementation**:
- MediaService has in-memory cache
- Blob URLs are managed by BlobURLManager

**Enhancement**:
```typescript
// Add IndexedDB caching for media metadata
class MediaMetadataCache {
  private db: IDBDatabase | null = null
  
  async init() {
    this.db = await openDB('scorm-builder-cache', 1, {
      upgrade(db) {
        db.createObjectStore('mediaMetadata', { keyPath: 'id' })
      }
    })
  }
  
  async get(id: string): Promise<MediaMetadata | null> {
    if (!this.db) return null
    return await this.db.get('mediaMetadata', id)
  }
  
  async set(id: string, metadata: MediaMetadata) {
    if (!this.db) return
    await this.db.put('mediaMetadata', { id, ...metadata })
  }
}
```

### 3. Lazy Loading Implementation

**For Media Lists**:
```typescript
// Implement virtual scrolling for large media lists
import { VirtualList } from '@tanstack/react-virtual'

function MediaGrid({ items }: { items: MediaItem[] }) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 200,
    overscan: 5
  })
  
  return (
    <div ref={parentRef} style={{ height: '600px', overflow: 'auto' }}>
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualItem => (
          <MediaCard
            key={virtualItem.key}
            item={items[virtualItem.index]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualItem.start}px)`
            }}
          />
        ))}
      </div>
    </div>
  )
}
```

### 4. SCORM Generation Optimization

**Current Challenges**:
- Sequential media processing
- Large memory footprint for ZIP creation

**Optimization**:
```typescript
// Process media in parallel batches
async function optimizedMediaProcessing(mediaItems: MediaItem[]) {
  const BATCH_SIZE = 5
  const results = []
  
  for (let i = 0; i < mediaItems.length; i += BATCH_SIZE) {
    const batch = mediaItems.slice(i, i + BATCH_SIZE)
    
    const batchResults = await Promise.all(
      batch.map(item => performanceMonitor.measureOperation(
        'Process Media Item',
        () => processMediaItem(item),
        { mediaId: item.id }
      ))
    )
    
    results.push(...batchResults)
    
    // Allow browser to breathe
    await new Promise(resolve => setTimeout(resolve, 0))
  }
  
  return results
}
```

### 5. Debouncing and Throttling

**For Auto-save**:
```typescript
// Already implemented in useAutoSave hook
const debouncedSave = useMemo(
  () => debounce(saveFunction, 2000), // 2 second delay
  [saveFunction]
)
```

**For Search Operations**:
```typescript
// Throttle external API calls
const throttledSearch = useMemo(
  () => throttle(searchFunction, 1000), // Max once per second
  [searchFunction]
)
```

## Performance Monitoring Dashboard

Create a development dashboard to monitor performance:

```typescript
// components/PerformanceDashboard.tsx
export function PerformanceDashboard() {
  const [metrics, setMetrics] = useState(performanceMonitor.getMetrics())
  const [autoRefresh, setAutoRefresh] = useState(false)
  
  useEffect(() => {
    if (!autoRefresh) return
    
    const interval = setInterval(() => {
      setMetrics(performanceMonitor.getMetrics())
    }, 1000)
    
    return () => clearInterval(interval)
  }, [autoRefresh])
  
  const report = performanceMonitor.generateReport()
  
  return (
    <div className="performance-dashboard">
      <h2>Performance Monitor</h2>
      
      <div className="stats">
        <div>Total Operations: {report.totalOperations}</div>
        <div>Slow Operations: {report.slowOperations.length}</div>
      </div>
      
      <h3>Recent Operations</h3>
      <table>
        <thead>
          <tr>
            <th>Operation</th>
            <th>Duration</th>
            <th>Memory Δ</th>
            <th>Time</th>
          </tr>
        </thead>
        <tbody>
          {metrics.slice(-20).reverse().map((metric, i) => (
            <tr key={i} className={metric.duration > 1000 ? 'slow' : ''}>
              <td>{metric.name}</td>
              <td>{metric.duration.toFixed(0)}ms</td>
              <td>{(metric.memoryDelta / 1024 / 1024).toFixed(2)}MB</td>
              <td>{new Date(metric.timestamp).toLocaleTimeString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <button onClick={() => setAutoRefresh(!autoRefresh)}>
        {autoRefresh ? 'Stop' : 'Start'} Auto-refresh
      </button>
      
      <button onClick={() => performanceMonitor.clearMetrics()}>
        Clear Metrics
      </button>
    </div>
  )
}
```

## Critical Path Optimizations

### 1. Project Load Optimization

```typescript
// Load critical data first, defer non-essential
async function optimizedProjectLoad(projectId: string) {
  // Phase 1: Critical data (blocking)
  const [metadata, settings] = await Promise.all([
    storage.getCourseMetadata(),
    storage.getProjectSettings()
  ])
  
  // Render UI with critical data
  updateUI({ metadata, settings })
  
  // Phase 2: Content (non-blocking)
  loadContentInBackground(projectId)
  
  // Phase 3: Media (lazy load)
  // Media loads on-demand when needed
}
```

### 2. Media Preview Optimization

```typescript
// Generate and cache thumbnails
async function generateThumbnail(file: File): Promise<string> {
  return performanceMonitor.measureOperation(
    'Generate Thumbnail',
    async () => {
      const bitmap = await createImageBitmap(file)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      
      // Fixed thumbnail size
      const size = 200
      canvas.width = size
      canvas.height = size
      
      // Center crop
      const scale = Math.max(size / bitmap.width, size / bitmap.height)
      const x = (size - bitmap.width * scale) / 2
      const y = (size - bitmap.height * scale) / 2
      
      ctx.drawImage(bitmap, x, y, bitmap.width * scale, bitmap.height * scale)
      
      return canvas.toDataURL('image/jpeg', 0.7)
    }
  )
}
```

## Monitoring Best Practices

1. **Regular Performance Audits**:
   - Run benchmarks weekly
   - Compare against baseline
   - Track trends over time

2. **User-Centric Metrics**:
   - Time to Interactive (TTI)
   - First Contentful Paint (FCP)
   - Largest Contentful Paint (LCP)

3. **Real User Monitoring**:
   - Collect anonymous performance data
   - Identify patterns in slow operations
   - Prioritize optimizations by impact

4. **Continuous Integration**:
   - Add performance tests to CI/CD
   - Fail builds on performance regression
   - Track metrics over releases

## Troubleshooting Performance Issues

1. **Memory Leaks**:
   ```javascript
   // Check for accumulating blob URLs
   console.log(window.blobUrlManager.getActiveUrls().size)
   
   // Force cleanup
   window.blobUrlManager.cleanup()
   ```

2. **Slow Operations**:
   ```javascript
   // Get detailed breakdown
   const slowOp = performanceMonitor.getMetricsForOperation('MediaService.storeMedia')
   const stats = {
     avg: slowOp.reduce((a, b) => a + b.duration, 0) / slowOp.length,
     max: Math.max(...slowOp.map(m => m.duration)),
     min: Math.min(...slowOp.map(m => m.duration))
   }
   console.table(stats)
   ```

3. **Resource Usage**:
   ```javascript
   // Monitor resource usage
   if ('memory' in performance) {
     console.log({
       usedJSHeapSize: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
       totalJSHeapSize: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2) + 'MB',
       jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2) + 'MB'
     })
   }
   ```