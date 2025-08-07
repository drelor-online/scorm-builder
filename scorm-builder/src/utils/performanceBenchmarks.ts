import { performanceMonitor } from './performanceMonitor'
import { MediaService } from '../services/MediaService'
import { PersistentStorage } from '../services/PersistentStorage'

export interface BenchmarkResult {
  operation: string
  target: number
  actual: number
  passed: boolean
  details?: any
}

/**
 * Run comprehensive performance benchmarks for SCORM Builder
 */
export async function runPerformanceBenchmarks(): Promise<BenchmarkResult[]> {
  console.log('🚀 Starting Performance Benchmarks...\n')
  
  const results: BenchmarkResult[] = []
  let testProjectId: string | null = null
  
  try {
    // Initialize services
    const storage = new PersistentStorage()
    await storage.initialize()
    
    // Create test project
    const project = await storage.createProject('Performance Benchmark Test')
    testProjectId = project.id
    await storage.openProject(testProjectId)
    
    const mediaService = MediaService.getInstance({ projectId: testProjectId })
    
    // Benchmark 1: Image Upload Performance
    console.log('📸 Testing Image Upload Performance...')
    results.push(...await benchmarkImageUploads(mediaService))
    
    // Benchmark 2: Media Retrieval Performance
    console.log('🔍 Testing Media Retrieval Performance...')
    results.push(...await benchmarkMediaRetrieval(mediaService))
    
    // Benchmark 3: Project Operations
    console.log('📁 Testing Project Operations...')
    results.push(...await benchmarkProjectOperations(storage))
    
    // Benchmark 4: Blob URL Performance
    console.log('🔗 Testing Blob URL Creation...')
    results.push(...await benchmarkBlobUrls(mediaService))
    
    // Generate summary report
    const report = performanceMonitor.generateReport()
    console.log('\n📊 Performance Summary:')
    console.log(`Total Operations: ${report.totalOperations}`)
    console.log(`Slow Operations: ${report.slowOperations.length}`)
    
    // Print results table
    printResultsTable(results)
    
    // Cleanup
    if (testProjectId) {
      await storage.deleteProject(testProjectId)
    }
    
    return results
    
  } catch (error) {
    console.error('❌ Benchmark failed:', error)
    
    // Cleanup on error
    if (testProjectId) {
      try {
        const cleanupStorage = new PersistentStorage()
        await cleanupStorage.initialize()
        await cleanupStorage.deleteProject(testProjectId)
      } catch (cleanupError) {
        console.warn('Failed to cleanup test project:', cleanupError)
      }
    }
    
    throw error
  }
}

async function benchmarkImageUploads(mediaService: MediaService): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  
  const testCases = [
    { size: 100 * 1024, name: '100KB Image', target: 500 },
    { size: 1 * 1024 * 1024, name: '1MB Image', target: 2000 },
    { size: 5 * 1024 * 1024, name: '5MB Image', target: 5000 }
  ]
  
  for (const test of testCases) {
    const blob = new Blob([new Uint8Array(test.size)], { type: 'image/png' })
    const file = new File([blob], `test-${test.name}.png`, { type: 'image/png' })
    
    const duration = await performanceMonitor.measureOperation(
      `Upload ${test.name}`,
      async () => {
        await mediaService.storeMedia(file, 'topic-1', 'image', { test: true })
      },
      { fileSize: test.size }
    ).then(() => {
      const metrics = performanceMonitor.getMetricsForOperation(`Upload ${test.name}`)
      return metrics[metrics.length - 1]?.duration || 0
    })
    
    results.push({
      operation: `Upload ${test.name}`,
      target: test.target,
      actual: Math.round(duration),
      passed: duration <= test.target,
      details: { fileSize: test.size }
    })
  }
  
  return results
}

async function benchmarkMediaRetrieval(mediaService: MediaService): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  
  // First, ensure we have some media to retrieve
  const testFile = new File([new Uint8Array(1024)], 'test.png', { type: 'image/png' })
  const storedItem = await mediaService.storeMedia(testFile, 'topic-1', 'image', { test: true })
  
  // Test retrieval
  const duration = await performanceMonitor.measureOperation(
    'Media Retrieval',
    async () => {
      await mediaService.getMedia(storedItem.id)
    }
  ).then(() => {
    const metrics = performanceMonitor.getMetricsForOperation('Media Retrieval')
    return metrics[metrics.length - 1]?.duration || 0
  })
  
  results.push({
    operation: 'Media Retrieval (from cache)',
    target: 100,
    actual: Math.round(duration),
    passed: duration <= 100
  })
  
  // Test list operation
  const listDuration = await performanceMonitor.measureOperation(
    'List All Media',
    async () => {
      await mediaService.listAllMedia()
    }
  ).then(() => {
    const metrics = performanceMonitor.getMetricsForOperation('List All Media')
    return metrics[metrics.length - 1]?.duration || 0
  })
  
  results.push({
    operation: 'List All Media',
    target: 200,
    actual: Math.round(listDuration),
    passed: listDuration <= 200
  })
  
  return results
}

async function benchmarkProjectOperations(storage: PersistentStorage): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  
  // Test project creation
  const createDuration = await performanceMonitor.measureOperation(
    'Create Project',
    async () => {
      const project = await storage.createProject('Benchmark Test 2')
      // Clean up immediately
      await storage.deleteProject(project.id)
    }
  ).then(() => {
    const metrics = performanceMonitor.getMetricsForOperation('Create Project')
    return metrics[metrics.length - 1]?.duration || 0
  })
  
  results.push({
    operation: 'Project Creation',
    target: 500,
    actual: Math.round(createDuration),
    passed: createDuration <= 500
  })
  
  // Test save operation
  const testData = {
    courseTitle: 'Performance Test Course',
    difficulty: 3,
    topics: ['Topic 1', 'Topic 2', 'Topic 3']
  }
  
  const saveDuration = await performanceMonitor.measureOperation(
    'Save Course Metadata',
    async () => {
      await storage.saveCourseMetadata(testData)
    }
  ).then(() => {
    const metrics = performanceMonitor.getMetricsForOperation('Save Course Metadata')
    return metrics[metrics.length - 1]?.duration || 0
  })
  
  results.push({
    operation: 'Save Course Metadata',
    target: 1000,
    actual: Math.round(saveDuration),
    passed: saveDuration <= 1000
  })
  
  return results
}

async function benchmarkBlobUrls(mediaService: MediaService): Promise<BenchmarkResult[]> {
  const results: BenchmarkResult[] = []
  
  // Ensure we have media to work with
  const testFile = new File([new Uint8Array(1024)], 'blob-test.png', { type: 'image/png' })
  const storedItem = await mediaService.storeMedia(testFile, 'topic-1', 'image', { test: true })
  
  const duration = await performanceMonitor.measureOperation(
    'Create Blob URL',
    async () => {
      await mediaService.createBlobUrl(storedItem.id)
    }
  ).then(() => {
    const metrics = performanceMonitor.getMetricsForOperation('Create Blob URL')
    return metrics[metrics.length - 1]?.duration || 0
  })
  
  results.push({
    operation: 'Blob URL Creation',
    target: 50,
    actual: Math.round(duration),
    passed: duration <= 50
  })
  
  return results
}

function printResultsTable(results: BenchmarkResult[]) {
  console.log('\n📈 Benchmark Results:')
  console.log('━'.repeat(70))
  console.log(
    'Operation'.padEnd(30) + 
    'Target'.padEnd(12) + 
    'Actual'.padEnd(12) + 
    'Status'.padEnd(10)
  )
  console.log('━'.repeat(70))
  
  for (const result of results) {
    const status = result.passed ? '✅ PASS' : '❌ FAIL'
    const statusColor = result.passed ? '\x1b[32m' : '\x1b[31m'
    const resetColor = '\x1b[0m'
    
    console.log(
      result.operation.padEnd(30) +
      `${result.target}ms`.padEnd(12) +
      `${result.actual}ms`.padEnd(12) +
      `${statusColor}${status}${resetColor}`
    )
  }
  
  console.log('━'.repeat(70))
  
  const passed = results.filter(r => r.passed).length
  const total = results.length
  const percentage = Math.round((passed / total) * 100)
  
  console.log(`\nOverall: ${passed}/${total} passed (${percentage}%)`)
  
  if (percentage < 80) {
    console.log('\n⚠️  Performance is below acceptable levels!')
  } else if (percentage === 100) {
    console.log('\n🎉 All benchmarks passed!')
  }
}

// Export for console use
if (typeof window !== 'undefined') {
  (window as any).runPerformanceBenchmarks = runPerformanceBenchmarks
  console.log('💡 Performance benchmarks loaded. Run with: runPerformanceBenchmarks()')
}