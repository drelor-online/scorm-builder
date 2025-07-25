import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fileStorage } from '../../services/FileStorage';
import { performanceMonitor } from '../../utils/performanceMonitor';

describe('Performance Baseline Tests', () => {
  let testProjectIds: string[] = [];

  beforeAll(async () => {
    // Initialize storage
    if (!fileStorage.isInitialized) {
      await fileStorage.initialize();
    }
    
    // Clear any existing metrics
    performanceMonitor.clearMetrics();
  });

  afterAll(async () => {
    // Cleanup test projects
    for (const id of testProjectIds) {
      try {
        await fileStorage.deleteProject(id);
      } catch (error) {
        console.error('Failed to cleanup test project:', error);
      }
    }

    // Generate performance report
    const report = performanceMonitor.generateReport();
    console.log('\n📊 Performance Test Report:');
    console.log('Total Operations:', report.totalOperations);
    console.log('\nSlow Operations:', report.slowOperations);
    console.log('\nTop 5 Slowest Operations:');
    report.summary.slice(0, 5).forEach(op => {
      console.log(`- ${op.operationName}: avg ${op.avgDuration.toFixed(2)}ms (${op.count} calls)`);
    });
  });

  describe('Project Operations Performance', () => {
    it('should create a project in under 100ms', async () => {
      const result = await performanceMonitor.measureOperation(
        'createProject',
        async () => {
          const metadata = await fileStorage.createProject('Performance Test Project');
          testProjectIds.push(metadata.id);
          return metadata;
        }
      );

      const metrics = performanceMonitor.getMetricsForOperation('createProject');
      const latestMetric = metrics[metrics.length - 1];
      
      expect(latestMetric.duration).toBeLessThan(100);
      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
    });

    it('should save content in under 50ms', async () => {
      const projectId = testProjectIds[0];
      expect(projectId).toBeDefined();

      const content = {
        topicId: 'perf-test-topic',
        title: 'Performance Test Topic',
        content: '<p>This is test content for performance measurement</p>',
        narration: 'This is test narration'
      };

      await performanceMonitor.measureOperation(
        'saveContent',
        async () => {
          await fileStorage.saveContent('perf-test-topic', content);
        }
      );

      const metrics = performanceMonitor.getMetricsForOperation('saveContent');
      const latestMetric = metrics[metrics.length - 1];
      
      expect(latestMetric.duration).toBeLessThan(50);
    });

    it('should handle batch operations efficiently', async () => {
      const batchSize = 10;
      const contents = Array.from({ length: batchSize }, (_, i) => ({
        topicId: `batch-topic-${i}`,
        title: `Batch Topic ${i}`,
        content: `<p>Content for topic ${i}</p>`,
        narration: `Narration for topic ${i}`
      }));

      const startTime = performance.now();
      
      await performanceMonitor.measureOperation(
        'batchSaveContent',
        async () => {
          await Promise.all(
            contents.map(content => 
              fileStorage.saveContent(content.topicId, content)
            )
          );
        }
      );

      const totalTime = performance.now() - startTime;
      const avgTimePerItem = totalTime / batchSize;

      // Batch operations should be efficient (less than 20ms per item)
      expect(avgTimePerItem).toBeLessThan(20);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory when creating and deleting projects', async () => {
      const initialMemory = performance.memory?.usedJSHeapSize || 0;
      
      // Create and delete 5 projects
      for (let i = 0; i < 5; i++) {
        const metadata = await performanceMonitor.measureOperation(
          'createDeleteCycle',
          async () => {
            const meta = await fileStorage.createProject(`Memory Test ${i}`);
            await fileStorage.deleteProject(meta.id);
            return meta;
          }
        );
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 100));

      const finalMemory = performance.memory?.usedJSHeapSize || 0;
      const memoryGrowth = finalMemory - initialMemory;

      // Should not grow more than 5MB
      expect(memoryGrowth).toBeLessThan(5 * 1024 * 1024);
    });

    it('should handle large content efficiently', async () => {
      const largeContent = {
        topicId: 'large-content',
        title: 'Large Content Test',
        content: '<p>Large content</p>'.repeat(1000), // ~17KB
        narration: 'Large narration text'.repeat(1000) // ~20KB
      };

      const memoryBefore = performance.memory?.usedJSHeapSize || 0;

      await performanceMonitor.measureOperation(
        'saveLargeContent',
        async () => {
          await fileStorage.saveContent('large-content', largeContent);
        }
      );

      const memoryAfter = performance.memory?.usedJSHeapSize || 0;
      const memoryUsed = memoryAfter - memoryBefore;

      // Memory usage should be reasonable (less than 1MB for ~37KB content)
      expect(memoryUsed).toBeLessThan(1024 * 1024);
    });
  });

  describe('File Operations Performance', () => {
    it('should save project file in reasonable time', async () => {
      const projectId = testProjectIds[0];
      
      // Add some content first
      for (let i = 0; i < 5; i++) {
        await fileStorage.saveContent(`topic-${i}`, {
          topicId: `topic-${i}`,
          title: `Topic ${i}`,
          content: `<p>Content for topic ${i}</p>`,
          narration: `Narration for topic ${i}`
        });
      }

      await performanceMonitor.measureOperation(
        'saveProjectFile',
        async () => {
          await fileStorage.saveProject();
        }
      );

      const metrics = performanceMonitor.getMetricsForOperation('saveProjectFile');
      const latestMetric = metrics[metrics.length - 1];
      
      // Should save in under 200ms even with content
      expect(latestMetric.duration).toBeLessThan(200);
    });

    it('should load project file quickly', async () => {
      const projectId = testProjectIds[0];
      
      await performanceMonitor.measureOperation(
        'loadProjectFile',
        async () => {
          await fileStorage.openProject(projectId);
        }
      );

      const metrics = performanceMonitor.getMetricsForOperation('loadProjectFile');
      const latestMetric = metrics[metrics.length - 1];
      
      // Should load in under 100ms
      expect(latestMetric.duration).toBeLessThan(100);
    });
  });

  describe('Performance Under Load', () => {
    it('should maintain performance with many topics', async () => {
      const topicCount = 50;
      const projectMetadata = await fileStorage.createProject('Load Test Project');
      testProjectIds.push(projectMetadata.id);

      const startTime = performance.now();

      // Add many topics
      for (let i = 0; i < topicCount; i++) {
        await fileStorage.saveContent(`load-topic-${i}`, {
          topicId: `load-topic-${i}`,
          title: `Load Test Topic ${i}`,
          content: `<p>This is content for topic ${i} with some text to make it realistic</p>`,
          narration: `This is the narration for topic ${i} which should be a reasonable length`
        });
      }

      const saveTime = performance.now() - startTime;
      const avgTimePerTopic = saveTime / topicCount;

      // Should maintain good performance even with many topics
      expect(avgTimePerTopic).toBeLessThan(10); // Less than 10ms per topic

      // Test loading performance with many topics
      await performanceMonitor.measureOperation(
        'loadProjectWithManyTopics',
        async () => {
          await fileStorage.saveProject();
          await fileStorage.openProject(projectMetadata.id);
        }
      );

      const loadMetrics = performanceMonitor.getMetricsForOperation('loadProjectWithManyTopics');
      const loadMetric = loadMetrics[loadMetrics.length - 1];
      
      // Should still load quickly even with 50 topics
      expect(loadMetric.duration).toBeLessThan(500);
    });
  });
});