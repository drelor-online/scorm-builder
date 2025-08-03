import React, { useState, useEffect } from 'react'
import { usePerformanceMetrics } from '../hooks/usePerformanceMonitor'
import { Icon } from './DesignSystem/Icons'
import { Activity, Clock, Zap, AlertTriangle, TrendingUp, Database } from 'lucide-react'
import type { MetricSummary } from '../utils/performanceMonitor'

export const PerformanceDashboard: React.FC<{ show?: boolean }> = ({ show = false }) => {
  const { getMetrics, getSummary, getSlowOperations, clearMetrics } = usePerformanceMetrics()
  const [metrics, setMetrics] = useState<MetricSummary[]>([])
  const [slowOps, setSlowOps] = useState<MetricSummary[]>([])
  const [totalOps, setTotalOps] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (show) {
      const interval = setInterval(() => {
        const summary = getSummary()
        const slow = getSlowOperations(500) // 500ms threshold
        const allMetrics = getMetrics()
        
        setMetrics(summary.slice(0, 10)) // Top 10 operations
        setSlowOps(slow)
        setTotalOps(allMetrics.length)
        setRefreshKey(prev => prev + 1)
      }, 1000) // Update every second

      return () => clearInterval(interval)
    }
  }, [show, getSummary, getSlowOperations, getMetrics])

  if (!show) return null

  const formatDuration = (ms: number) => {
    if (ms < 1) return `${ms.toFixed(2)}ms`
    if (ms < 1000) return `${Math.round(ms)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const formatMemory = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
  }

  return (
    <div className="performance-dashboard">
      <div className="dashboard-header">
        <h3>
          <Icon icon={Activity} size="sm" />
          Performance Monitor
        </h3>
        <div className="dashboard-actions">
          <span className="metric-count">
            <Icon icon={Database} size="sm" />
            {totalOps} operations
          </span>
          <button 
            onClick={clearMetrics}
            className="btn btn-sm btn-secondary"
            title="Clear all metrics"
          >
            Clear
          </button>
        </div>
      </div>

      {slowOps.length > 0 && (
        <div className="slow-operations">
          <h4>
            <Icon icon={AlertTriangle} size="sm" color="var(--color-warning)" />
            Slow Operations
          </h4>
          <div className="operations-list">
            {slowOps.map((op, idx) => (
              <div key={`${op.operationName}-${idx}-${refreshKey}`} className="operation-item slow">
                <span className="operation-name">{op.operationName}</span>
                <div className="operation-stats">
                  <span className="stat">
                    <Icon icon={Clock} size="xs" />
                    {formatDuration(op.avgDuration)}
                  </span>
                  <span className="stat count">×{op.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="all-operations">
        <h4>
          <Icon icon={TrendingUp} size="sm" />
          Top Operations
        </h4>
        <div className="operations-list">
          {metrics.map((metric, idx) => (
            <div 
              key={`${metric.operationName}-${idx}-${refreshKey}`} 
              className={`operation-item ${metric.avgDuration > 100 ? 'warning' : ''}`}
            >
              <span className="operation-name">{metric.operationName}</span>
              <div className="operation-stats">
                <span className="stat">
                  <Icon icon={Clock} size="xs" />
                  {formatDuration(metric.avgDuration)}
                </span>
                <span className="stat">
                  <Icon icon={Zap} size="xs" />
                  {formatDuration(metric.maxDuration)}
                </span>
                {metric.avgMemoryDelta > 0 && (
                  <span className="stat">
                    <Icon icon={Database} size="xs" />
                    {formatMemory(metric.avgMemoryDelta)}
                  </span>
                )}
                <span className="stat count">×{metric.count}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        .performance-dashboard {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 350px;
          max-height: 500px;
          background: var(--color-bg-secondary);
          border: 1px solid var(--color-border-default);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-lg);
          overflow: hidden;
          z-index: var(--z-index-popover);
          display: flex;
          flex-direction: column;
        }

        .dashboard-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--spacing-md) var(--spacing-lg);
          border-bottom: 1px solid var(--color-border-light);
          background: var(--color-bg-tertiary);
        }

        .dashboard-header h3 {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin: 0;
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-primary);
        }

        .dashboard-actions {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .metric-count {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
        }

        .slow-operations,
        .all-operations {
          padding: var(--spacing-md) var(--spacing-lg);
        }

        .slow-operations {
          border-bottom: 1px solid var(--color-border-light);
          background: rgba(245, 158, 11, 0.05);
        }

        h4 {
          display: flex;
          align-items: center;
          gap: var(--spacing-sm);
          margin: 0 0 var(--spacing-md) 0;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
        }

        .operations-list {
          max-height: 300px;
          overflow-y: auto;
          margin: 0 -var(--spacing-lg);
          padding: 0 var(--spacing-lg);
        }

        .operation-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--spacing-sm) 0;
          border-bottom: 1px solid var(--color-border-light);
          font-size: var(--font-size-sm);
        }

        .operation-item:last-child {
          border-bottom: none;
        }

        .operation-item.slow {
          color: var(--color-warning);
        }

        .operation-item.warning .operation-name {
          color: var(--color-warning);
        }

        .operation-name {
          flex: 1;
          color: var(--color-text-primary);
          font-family: var(--font-family-mono);
          font-size: var(--font-size-xs);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .operation-stats {
          display: flex;
          align-items: center;
          gap: var(--spacing-md);
        }

        .stat {
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          color: var(--color-text-tertiary);
          font-size: var(--font-size-xs);
        }

        .stat.count {
          font-weight: var(--font-weight-medium);
          color: var(--color-text-secondary);
        }

        /* Scrollbar styling */
        .operations-list::-webkit-scrollbar {
          width: 6px;
        }

        .operations-list::-webkit-scrollbar-track {
          background: var(--color-bg-tertiary);
        }

        .operations-list::-webkit-scrollbar-thumb {
          background: var(--color-border-medium);
          border-radius: 3px;
        }

        .operations-list::-webkit-scrollbar-thumb:hover {
          background: var(--color-border-dark);
        }

        /* Animation */
        .performance-dashboard {
          animation: slideIn var(--transition-normal);
        }

        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}