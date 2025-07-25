// Test Runner for End-to-End Testing
export interface TestResult {
  name: string
  status: 'pass' | 'fail' | 'error'
  message?: string
  duration?: number
}

export class TestRunner {
  private results: TestResult[] = []
  
  async runTest(name: string, testFn: () => Promise<void>): Promise<TestResult> {
    console.log(`🧪 Running test: ${name}`)
    const startTime = Date.now()
    
    try {
      await testFn()
      const result: TestResult = {
        name,
        status: 'pass',
        duration: Date.now() - startTime
      }
      this.results.push(result)
      console.log(`✅ ${name} - PASSED (${result.duration}ms)`)
      return result
    } catch (error) {
      const result: TestResult = {
        name,
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime
      }
      this.results.push(result)
      console.error(`❌ ${name} - FAILED: ${result.message}`)
      return result
    }
  }
  
  getResults(): TestResult[] {
    return this.results
  }
  
  printSummary(): void {
    console.log('\n📊 Test Summary:')
    const passed = this.results.filter(r => r.status === 'pass').length
    const failed = this.results.filter(r => r.status === 'fail').length
    const total = this.results.length
    
    console.log(`Total: ${total} | Passed: ${passed} | Failed: ${failed}`)
    
    if (failed > 0) {
      console.log('\nFailed tests:')
      this.results.filter(r => r.status === 'fail').forEach(r => {
        console.log(`  - ${r.name}: ${r.message}`)
      })
    }
  }
}

// Memory monitoring utilities
export function getMemoryUsage(): { usedJSHeapSize: number, totalJSHeapSize: number } {
  if ('memory' in performance) {
    const memory = (performance as any).memory
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize
    }
  }
  return { usedJSHeapSize: 0, totalJSHeapSize: 0 }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function logMemoryUsage(label: string): void {
  const memory = getMemoryUsage()
  console.log(`💾 Memory [${label}]: ${formatBytes(memory.usedJSHeapSize)} / ${formatBytes(memory.totalJSHeapSize)}`)
}