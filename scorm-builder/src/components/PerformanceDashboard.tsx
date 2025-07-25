import React, { useState, useEffect } from 'react';
import { Card, Flex, Button } from './DesignSystem';
import { performanceMonitor } from '../utils/performanceMonitor';

interface MetricSummary {
  operationName: string;
  avgDuration: number;
  maxDuration: number;
  count: number;
  avgMemoryDelta: number;
}

export const PerformanceDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricSummary[]>([]);
  const [memoryInfo, setMemoryInfo] = useState<{
    used: number;
    total: number;
    percent: number;
  } | null>(null);

  useEffect(() => {
    const updateMetrics = () => {
      // const rawMetrics = performanceMonitor.getMetrics();
      const summary = performanceMonitor.getSummary();
      
      setMetrics(summary);
      
      // Update memory info if available
      if ('memory' in performance) {
        const memory = (performance as any).memory;
        setMemoryInfo({
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          percent: (memory.usedJSHeapSize / memory.totalJSHeapSize) * 100
        });
      }
    };

    // Update every second
    const interval = setInterval(updateMetrics, 1000);
    updateMetrics();

    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const getPerformanceColor = (duration: number): string => {
    if (duration < 100) return '#22c55e'; // Green - Fast
    if (duration < 500) return '#f59e0b'; // Orange - Moderate
    return '#ef4444'; // Red - Slow
  };

  return (
    <div style={{ padding: '1rem' }}>
      <Card title="Performance Dashboard" padding="large">
        {/* Memory Usage */}
        {memoryInfo && (
          <div style={{ marginBottom: '2rem' }}>
            <h3>Memory Usage</h3>
            <div style={{ 
              background: '#27272a', 
              borderRadius: '0.5rem', 
              padding: '1rem',
              marginTop: '0.5rem' 
            }}>
              <div style={{ marginBottom: '0.5rem' }}>
                <span>Used: {formatBytes(memoryInfo.used)}</span>
                <span style={{ marginLeft: '1rem' }}>
                  Total: {formatBytes(memoryInfo.total)}
                </span>
                <span style={{ marginLeft: '1rem' }}>
                  ({memoryInfo.percent.toFixed(1)}%)
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '20px',
                background: '#18181b',
                borderRadius: '0.25rem',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${memoryInfo.percent}%`,
                  height: '100%',
                  background: memoryInfo.percent > 80 ? '#ef4444' : '#3b82f6',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          </div>
        )}

        {/* Operation Metrics */}
        <div>
          <h3>Operation Performance</h3>
          <div style={{ marginTop: '0.5rem' }}>
            {metrics.length === 0 ? (
              <p style={{ color: '#71717a' }}>No metrics recorded yet</p>
            ) : (
              <div style={{ display: 'grid', gap: '0.5rem' }}>
                {metrics.map((metric, index) => (
                  <div
                    key={index}
                    style={{
                      background: '#27272a',
                      borderRadius: '0.375rem',
                      padding: '0.75rem',
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto auto',
                      gap: '1rem',
                      alignItems: 'center'
                    }}
                  >
                    <span style={{ fontWeight: 500 }}>{metric.operationName}</span>
                    <span style={{ 
                      color: getPerformanceColor(metric.avgDuration),
                      fontSize: '0.875rem' 
                    }}>
                      Avg: {formatDuration(metric.avgDuration)}
                    </span>
                    <span style={{ 
                      color: getPerformanceColor(metric.maxDuration),
                      fontSize: '0.875rem' 
                    }}>
                      Max: {formatDuration(metric.maxDuration)}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: '#71717a' }}>
                      Count: {metric.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <Flex gap="medium" style={{ marginTop: '2rem' }}>
          <Button
            size="small"
            variant="secondary"
            onClick={() => performanceMonitor.clearMetrics()}
          >
            Clear Metrics
          </Button>
          <Button
            size="small"
            variant="secondary"
            onClick={() => {
              const report = performanceMonitor.generateReport();
              console.log('Performance Report:', report);
              // Could download as JSON
            }}
          >
            Export Report
          </Button>
        </Flex>
      </Card>
    </div>
  );
};