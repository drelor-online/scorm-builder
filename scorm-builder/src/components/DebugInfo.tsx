import { useEffect, useState } from 'react'
import { debugLogger } from '../utils/debugLogger'

export function DebugInfo() {
  const [isDebugMode, setIsDebugMode] = useState(false)
  const [metrics, setMetrics] = useState<any>(null)
  
  useEffect(() => {
    setIsDebugMode(debugLogger.isDebugMode())
    
    if (debugLogger.isDebugMode()) {
      const interval = setInterval(() => {
        setMetrics(debugLogger.getPerformanceMetrics())
      }, 2000)
      
      return () => clearInterval(interval)
    }
  }, [])
  
  if (!isDebugMode) return null
  
  return (
    <div style={{
      position: 'fixed',
      top: '0.5rem',
      left: '0.5rem',
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      color: '#00ff00',
      padding: '0.5rem',
      fontSize: '0.75rem',
      fontFamily: 'monospace',
      borderRadius: '0.25rem',
      zIndex: 9999,
      pointerEvents: 'none'
    }}>
      <div>DEBUG MODE ACTIVE</div>
      {metrics && (
        <>
          <div>Memory: {metrics.memoryUsage.usedJSHeapSize ? 
            `${(metrics.memoryUsage.usedJSHeapSize / 1048576).toFixed(1)}MB` : 
            'N/A'}</div>
          <div>DOM Nodes: {metrics.domNodes}</div>
          <div>Press Ctrl+Shift+D to toggle panel</div>
        </>
      )}
    </div>
  )
}