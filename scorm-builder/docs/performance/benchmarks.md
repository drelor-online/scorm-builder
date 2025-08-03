# SCORM Builder Performance Benchmarks

## Overview

This document defines performance benchmarks and targets for the SCORM Builder application. All measurements are taken using the built-in `performanceMonitor` utility.

## Baseline Performance Targets

### Media Operations

| Operation | Target Time | Acceptable Range | Notes |
|-----------|------------|------------------|-------|
| **Image Upload (< 1MB)** | < 500ms | 200-800ms | Includes validation and storage |
| **Image Upload (1-5MB)** | < 2s | 1-3s | Larger images, includes processing |
| **Image Upload (5-10MB)** | < 5s | 3-7s | Maximum size images |
| **Video Upload (< 10MB)** | < 3s | 2-5s | Small video clips |
| **Video Upload (10-50MB)** | < 15s | 10-20s | Standard videos |
| **Video Upload (50-100MB)** | < 30s | 20-40s | Large videos |
| **Audio Upload (< 5MB)** | < 1s | 500ms-2s | Typical audio files |
| **Media Retrieval** | < 100ms | 50-200ms | From cache |
| **Media List (< 50 items)** | < 200ms | 100-300ms | Listing all media |
| **Blob URL Creation** | < 50ms | 20-100ms | Creating display URL |

### Project Operations

| Operation | Target Time | Acceptable Range | Notes |
|-----------|------------|------------------|-------|
| **Project Creation** | < 500ms | 200-800ms | New empty project |
| **Project Load (Small)** | < 1s | 500ms-2s | < 10 topics, < 20 media |
| **Project Load (Medium)** | < 3s | 2-5s | 10-50 topics, 20-100 media |
| **Project Load (Large)** | < 10s | 5-15s | > 50 topics, > 100 media |
| **Project Save** | < 1s | 500ms-2s | Metadata and content |
| **Project Export** | < 5s | 3-10s | Creating ZIP archive |
| **Project Import** | < 5s | 3-10s | Extracting and loading |

### SCORM Generation

| Operation | Target Time | Acceptable Range | Notes |
|-----------|------------|------------------|-------|
| **Small Package (< 10 topics)** | < 3s | 2-5s | Basic course |
| **Medium Package (10-30 topics)** | < 10s | 5-15s | Standard course |
| **Large Package (> 30 topics)** | < 30s | 15-45s | Comprehensive course |
| **Media Processing** | < 100ms/file | 50-200ms | Per media item |
| **ZIP Creation** | < 5s | 3-10s | Final package |

### UI Operations

| Operation | Target Time | Acceptable Range | Notes |
|-----------|------------|------------------|-------|
| **Page Navigation** | < 100ms | 50-200ms | Between wizard steps |
| **Search (Images/Videos)** | < 2s | 1-3s | External API calls |
| **Form Validation** | < 50ms | 20-100ms | Input validation |
| **Auto-save** | < 500ms | 200-1s | Background save |
| **Preview Update** | < 200ms | 100-500ms | Real-time preview |

## Memory Targets

| Metric | Target | Maximum | Notes |
|--------|--------|---------|-------|
| **Initial Load** | < 50MB | 100MB | Application startup |
| **Idle State** | < 100MB | 200MB | No active operations |
| **Active Editing** | < 200MB | 400MB | Normal usage |
| **Media Operations** | < 500MB | 1GB | During uploads |
| **SCORM Generation** | < 300MB | 600MB | Package creation |
| **Blob URLs** | < 100 URLs | 200 URLs | Active blob URLs |

## Performance Testing Script

```typescript
// Run performance benchmarks
import { performanceMonitor } from './utils/performanceMonitor'
import { MediaService } from './services/MediaService'

async function runBenchmarks() {
  const mediaService = new MediaService('benchmark-project')
  
  // Test 1: Image Upload Performance
  console.log('Testing Image Upload Performance...')
  
  const imageSizes = [
    { size: 100 * 1024, name: '100KB' },
    { size: 1 * 1024 * 1024, name: '1MB' },
    { size: 5 * 1024 * 1024, name: '5MB' }
  ]
  
  for (const { size, name } of imageSizes) {
    const blob = new Blob([new Uint8Array(size)], { type: 'image/png' })
    const file = new File([blob], `test-${name}.png`, { type: 'image/png' })
    
    await performanceMonitor.measureOperation(
      `Image Upload ${name}`,
      async () => {
        await mediaService.storeMedia(file, 'image')
      },
      { fileSize: size }
    )
  }
  
  // Test 2: Media Retrieval Performance
  console.log('Testing Media Retrieval Performance...')
  
  const mediaIds = await mediaService.listAllMedia()
  
  for (const item of mediaIds.slice(0, 10)) {
    await performanceMonitor.measureOperation(
      'Media Retrieval',
      async () => {
        await mediaService.getMedia(item.id)
      },
      { mediaId: item.id }
    )
  }
  
  // Test 3: Blob URL Creation
  console.log('Testing Blob URL Creation...')
  
  for (const item of mediaIds.slice(0, 10)) {
    await performanceMonitor.measureOperation(
      'Blob URL Creation',
      async () => {
        await mediaService.createBlobUrl(item.id)
      },
      { mediaId: item.id }
    )
  }
  
  // Generate Report
  const report = performanceMonitor.generateReport()
  console.log('Performance Report:', report)
  
  // Check against benchmarks
  checkBenchmarks(report.summary)
}

function checkBenchmarks(summary: MetricSummary[]) {
  const benchmarks = {
    'Image Upload 100KB': 500,
    'Image Upload 1MB': 2000,
    'Image Upload 5MB': 5000,
    'Media Retrieval': 100,
    'Blob URL Creation': 50
  }
  
  for (const metric of summary) {
    const benchmark = benchmarks[metric.operationName]
    if (benchmark && metric.avgDuration > benchmark) {
      console.warn(`⚠️ ${metric.operationName} exceeds benchmark: ${metric.avgDuration}ms > ${benchmark}ms`)
    }
  }
}

// Make available for console testing
if (typeof window !== 'undefined') {
  (window as any).runPerformanceBenchmarks = runBenchmarks
}
```

## Monitoring in Production

### Enable Performance Monitoring

```javascript
// In browser console or settings
localStorage.setItem('enablePerformanceMonitoring', 'true')
```

### View Performance Report

```javascript
// In browser console
window.performanceMonitor.generateReport()
```

### Export Performance Data

```javascript
// Export as JSON
const data = window.performanceMonitor.getMetrics()
console.log(JSON.stringify(data, null, 2))
```

## Optimization Guidelines

### When Performance Degrades

1. **Check Slow Operations**:
   ```javascript
   const slowOps = performanceMonitor.getSlowOperations(1000)
   ```

2. **Identify Memory Leaks**:
   - Monitor blob URL count
   - Check media cache size
   - Verify cleanup on unmount

3. **Common Bottlenecks**:
   - Large file processing
   - Multiple concurrent uploads
   - Excessive re-renders
   - Memory accumulation

### Optimization Strategies

1. **Media Operations**:
   - Implement thumbnail generation
   - Use web workers for processing
   - Optimize image compression
   - Lazy load media content

2. **Project Operations**:
   - Implement pagination
   - Use virtual scrolling
   - Cache frequently accessed data
   - Debounce auto-save

3. **SCORM Generation**:
   - Process media in parallel
   - Stream large files
   - Optimize ZIP compression
   - Cache processed content

## Continuous Monitoring

### Automated Checks

```typescript
// Add to test suite
describe('Performance Benchmarks', () => {
  it('should meet upload performance targets', async () => {
    const result = await measureUploadPerformance()
    expect(result.avgDuration).toBeLessThan(2000)
  })
  
  it('should meet memory targets', () => {
    const memory = getMemoryUsage()
    expect(memory).toBeLessThan(200 * 1024 * 1024) // 200MB
  })
})
```

### Performance Regression Prevention

1. Run benchmarks before releases
2. Monitor performance metrics in CI/CD
3. Set up alerts for degradation
4. Regular performance audits

## Reporting Issues

When reporting performance issues:

1. **Collect Metrics**:
   ```javascript
   const report = performanceMonitor.generateReport()
   ```

2. **Include Context**:
   - Browser and version
   - System specifications
   - Project size (topics, media)
   - Specific operations affected

3. **Provide Timeline**:
   - When issue started
   - Recent changes
   - Reproducible steps