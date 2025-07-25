interface PerformanceMetric {
  name: string;
  duration: number;
  memoryDelta: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface MetricSummary {
  operationName: string;
  avgDuration: number;
  maxDuration: number;
  minDuration: number;
  count: number;
  avgMemoryDelta: number;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics
  private slowOperationThreshold = 1000; // 1 second

  /**
   * Measure the performance of an async operation
   */
  async measureOperation<T>(
    name: string, 
    operation: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<T> {
    const start = performance.now();
    const initialMemory = this.getCurrentMemory();
    
    try {
      const result = await operation();
      
      const duration = performance.now() - start;
      const memoryDelta = this.getCurrentMemory() - initialMemory;
      
      this.recordMetric({
        name,
        duration,
        memoryDelta,
        timestamp: new Date().toISOString(),
        metadata
      });
      
      // Alert on slow operations
      if (duration > this.slowOperationThreshold) {
        console.warn(`⚠️ Slow operation detected: ${name} took ${duration.toFixed(2)}ms`);
      }
      
      return result;
    } catch (error) {
      // Still record failed operations
      const duration = performance.now() - start;
      this.recordMetric({
        name: `${name} (failed)`,
        duration,
        memoryDelta: 0,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, error: true }
      });
      
      throw error;
    }
  }

  /**
   * Measure a synchronous operation
   */
  measureSync<T>(
    name: string, 
    operation: () => T,
    metadata?: Record<string, any>
  ): T {
    const start = performance.now();
    const initialMemory = this.getCurrentMemory();
    
    try {
      const result = operation();
      
      const duration = performance.now() - start;
      const memoryDelta = this.getCurrentMemory() - initialMemory;
      
      this.recordMetric({
        name,
        duration,
        memoryDelta,
        timestamp: new Date().toISOString(),
        metadata
      });
      
      return result;
    } catch (error) {
      const duration = performance.now() - start;
      this.recordMetric({
        name: `${name} (failed)`,
        duration,
        memoryDelta: 0,
        timestamp: new Date().toISOString(),
        metadata: { ...metadata, error: true }
      });
      
      throw error;
    }
  }

  /**
   * Start a manual timing measurement
   */
  startTiming(name: string): () => void {
    const start = performance.now();
    const initialMemory = this.getCurrentMemory();
    
    return () => {
      const duration = performance.now() - start;
      const memoryDelta = this.getCurrentMemory() - initialMemory;
      
      this.recordMetric({
        name,
        duration,
        memoryDelta,
        timestamp: new Date().toISOString()
      });
    };
  }

  private recordMetric(metric: PerformanceMetric) {
    this.metrics.push(metric);
    
    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  private getCurrentMemory(): number {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return 0;
  }

  /**
   * Get all recorded metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  /**
   * Get metrics for a specific operation
   */
  getMetricsForOperation(operationName: string): PerformanceMetric[] {
    return this.metrics.filter(m => m.name === operationName);
  }

  /**
   * Get summary statistics for all operations
   */
  getSummary(): MetricSummary[] {
    const grouped = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric);
      return acc;
    }, {} as Record<string, PerformanceMetric[]>);

    return Object.entries(grouped).map(([name, metrics]) => {
      const durations = metrics.map(m => m.duration);
      const memoryDeltas = metrics.map(m => m.memoryDelta);
      
      return {
        operationName: name,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
        count: metrics.length,
        avgMemoryDelta: memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length
      };
    }).sort((a, b) => b.avgDuration - a.avgDuration); // Sort by slowest first
  }

  /**
   * Get operations that are consistently slow
   */
  getSlowOperations(threshold = this.slowOperationThreshold): MetricSummary[] {
    return this.getSummary().filter(s => s.avgDuration > threshold);
  }

  /**
   * Clear all metrics
   */
  clearMetrics() {
    this.metrics = [];
  }

  /**
   * Generate a performance report
   */
  generateReport(): {
    summary: MetricSummary[];
    slowOperations: MetricSummary[];
    totalOperations: number;
    timeRange: { start: string; end: string } | null;
  } {
    const summary = this.getSummary();
    const slowOperations = this.getSlowOperations();
    
    const timeRange = this.metrics.length > 0 ? {
      start: this.metrics[0].timestamp,
      end: this.metrics[this.metrics.length - 1].timestamp
    } : null;
    
    return {
      summary,
      slowOperations,
      totalOperations: this.metrics.length,
      timeRange
    };
  }
}

export const performanceMonitor = new PerformanceMonitor();

// Export for testing
export { PerformanceMonitor, type PerformanceMetric, type MetricSummary };