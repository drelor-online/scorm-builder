import React, { useState, useEffect } from 'react'
import { debugLogger } from '../utils/ultraSimpleLogger'
import { Icon } from './DesignSystem'
import { Check, Copy, Save, Folder } from 'lucide-react'

export function DebugPanel() {
  const [isVisible, setIsVisible] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'>('ALL')
  
  useEffect(() => {
    // Update logs every 500ms
    const interval = setInterval(() => {
      if (window.debugLogs) {
        setLogs([...window.debugLogs])
      }
    }, 500)
    
    return () => clearInterval(interval)
  }, [])
  
  // Keyboard shortcut to toggle panel (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        setIsVisible(prev => !prev)
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [])
  
  const handleCopyLogs = async () => {
    const logText = logs.join('\n')
    try {
      await navigator.clipboard.writeText(logText)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      // Fallback: create a textarea and copy
      const textarea = document.createElement('textarea')
      textarea.value = logText
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }
  
  const handleExportLogs = () => {
    const logText = logs.join('\n')
    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `debug-logs-${Date.now()}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }
  
  const handleClearLogs = () => {
    debugLogger.clearLogs()
    setLogs([])
  }
  
  // Filter logs based on search and log level
  const getFilteredLogs = () => {
    let filtered = logs
    
    // Apply log level filter
    if (logLevelFilter !== 'ALL') {
      filtered = filtered.filter(log => {
        if (logLevelFilter === 'ERROR') return log.includes('[ERROR]') || log.includes('ERROR')
        if (logLevelFilter === 'WARN') return log.includes('[WARN]') || log.includes('WARN')
        if (logLevelFilter === 'INFO') return log.includes('[INFO]') || log.includes('INFO')
        if (logLevelFilter === 'DEBUG') return log.includes('[DEBUG]') || log.includes('DEBUG')
        return true
      })
    }
    
    // Apply search filter
    if (searchFilter) {
      const searchLower = searchFilter.toLowerCase()
      filtered = filtered.filter(log => log.toLowerCase().includes(searchLower))
    }
    
    return filtered
  }
  
  // Always render the toggle button
  return (
    <>
      {/* Floating Debug Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          borderRadius: '50%',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          fontWeight: 'bold',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          zIndex: 9998,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        title="Toggle Debug Panel (Ctrl+Shift+D)"
      >
        🐛
      </button>
      
      {/* Debug Panel */}
      {isVisible && (
        <div style={{
          position: 'fixed',
          top: '50px',
          right: '20px',
          width: '600px',
          height: '80vh',
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          color: '#00ff00',
          border: '2px solid #00ff00',
          borderRadius: '8px',
          padding: '20px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'monospace',
          fontSize: '12px'
        }}>
          {/* Header */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            paddingBottom: '10px',
            borderBottom: '1px solid #00ff00'
          }}>
            <h3 style={{ margin: 0, color: '#00ff00' }}>🐛 Debug Logs ({getFilteredLogs().length}/{logs.length} entries)</h3>
            <button
              onClick={() => setIsVisible(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#00ff00',
                fontSize: '20px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
          
          {/* Filter Controls */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '10px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              placeholder="Search logs..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                flex: 1,
                padding: '5px 10px',
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                color: '#00ff00',
                border: '1px solid #00ff00',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            />
            <select
              value={logLevelFilter}
              onChange={(e) => setLogLevelFilter(e.target.value as any)}
              style={{
                padding: '5px 10px',
                backgroundColor: 'rgba(0, 255, 0, 0.1)',
                color: '#00ff00',
                border: '1px solid #00ff00',
                borderRadius: '4px',
                fontFamily: 'monospace',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              <option value="ALL">All Levels</option>
              <option value="ERROR">Errors</option>
              <option value="WARN">Warnings</option>
              <option value="INFO">Info</option>
              <option value="DEBUG">Debug</option>
            </select>
          </div>
          
          {/* Controls */}
          <div style={{
            display: 'flex',
            gap: '10px',
            marginBottom: '10px',
            flexWrap: 'wrap'
          }}>
            <button
              onClick={handleCopyLogs}
              style={{
                padding: '5px 10px',
                backgroundColor: '#00ff00',
                color: 'black',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            >
              {copied ? (
                <>
                  <Icon icon={Check} size="xs" color="black" />
                  Copied!
                </>
              ) : (
                <>
                  <Icon icon={Copy} size="xs" color="black" />
                  Copy Logs
                </>
              )}
            </button>
            <button
              onClick={handleExportLogs}
              style={{
                padding: '5px 10px',
                backgroundColor: '#0099ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            >
              <>
                <Icon icon={Save} size="xs" color="white" />
                Export to File
              </>
            </button>
            <button
              onClick={async () => {
                // Open log directory in file explorer
                if (window.__TAURI__?.invoke) {
                  try {
                    // Use Tauri's shell open command
                    await window.__TAURI__.invoke('tauri::shell::open', {
                      path: 'C:\\Users\\sierr\\.scorm-builder\\logs'
                    })
                  } catch (error) {
                    console.error('Failed to open log directory:', error)
                    // Fallback: try using the invoke command directly
                    try {
                      await window.__TAURI__.invoke('open_folder', {
                        path: 'C:\\Users\\sierr\\.scorm-builder\\logs'
                      })
                    } catch (e) {
                      console.error('Fallback also failed:', e)
                    }
                  }
                }
              }}
              style={{
                padding: '5px 10px',
                backgroundColor: '#9966ff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
              title="Open log directory in file explorer"
            >
              <>
                <Icon icon={Folder} size="xs" color="white" />
                Open Logs Folder
              </>
            </button>
            <button
              onClick={handleClearLogs}
              style={{
                padding: '5px 10px',
                backgroundColor: '#ff0000',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
            >
              🗑️ Clear Logs
            </button>
          </div>
          
          {/* Instructions */}
          <div style={{
            padding: '10px',
            backgroundColor: 'rgba(0, 255, 0, 0.1)',
            borderRadius: '4px',
            marginBottom: '10px',
            fontSize: '11px'
          }}>
            <strong>Instructions:</strong><br/>
            • Press Ctrl+Shift+D to toggle this panel<br/>
            • Logs are saved to localStorage for persistence<br/>
            • <strong>Log Files Location:</strong><br/>
            &nbsp;&nbsp;- JavaScript: C:\Users\sierr\.scorm-builder\logs\debug-*.log<br/>
            &nbsp;&nbsp;- Rust Backend: C:\Users\sierr\.scorm-builder\logs\rust-debug-{new Date().toISOString().split('T')[0]}.log<br/>
            • Click "Export to File" to save current session logs<br/>
            • Share exported logs when reporting issues
          </div>
          
          {/* Logs Display */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            backgroundColor: 'black',
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #00ff00'
          }}>
            {logs.length === 0 ? (
              <div style={{ color: '#666' }}>No logs yet...</div>
            ) : getFilteredLogs().length === 0 ? (
              <div style={{ color: '#666' }}>No logs match the current filter</div>
            ) : (
              getFilteredLogs().map((log, index) => (
                <div
                  key={index}
                  style={{
                    marginBottom: '2px',
                    wordBreak: 'break-all',
                    color: log.includes('ERROR') ? '#ff0000' : 
                           log.includes('WARN') ? '#ffff00' : 
                           '#00ff00'
                  }}
                >
                  {log}
                </div>
              ))
            )}
          </div>
          
          {/* Footer */}
          <div style={{
            marginTop: '10px',
            paddingTop: '10px',
            borderTop: '1px solid #00ff00',
            fontSize: '11px',
            color: '#666'
          }}>
            localStorage: {Object.keys(localStorage).length} items | 
            Last log: {logs[logs.length - 1]?.substring(0, 50)}...
          </div>
        </div>
      )}
    </>
  )
}