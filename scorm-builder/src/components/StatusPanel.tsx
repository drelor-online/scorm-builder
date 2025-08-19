import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, ChevronDown, ChevronUp, Copy, Save, Folder, Check, Minimize2, Maximize2, Bell } from 'lucide-react'
import { IconButton } from './DesignSystem/IconButton'
import { Icon } from './DesignSystem/Icons'
import { debugLogger } from '../utils/ultraSimpleLogger'
import styles from './StatusPanel.module.css'

export interface StatusMessage {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  title: string
  message: string
  timestamp: number
  dismissed?: boolean
}

interface StatusPanelProps {
  messages: StatusMessage[]
  onDismiss: (messageId: string) => void
  onClearAll: () => void
  className?: string
  isDocked?: boolean
  onDock?: () => void
  onUndock?: () => void
}

type TabType = 'activity' | 'debug'

const getIconForType = (type: StatusMessage['type']) => {
  switch (type) {
    case 'success': return CheckCircle
    case 'error': return AlertCircle
    case 'warning': return AlertTriangle
    case 'info': return Info
    default: return Info
  }
}

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now()
  const diff = now - timestamp
  const seconds = Math.floor(diff / 1000)
  
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const StatusPanelComponent: React.FC<StatusPanelProps> = ({
  messages,
  onDismiss,
  onClearAll,
  className,
  isDocked = false,
  onDock,
  onUndock
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('activity')
  const [logs, setLogs] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG'>('ALL')
  const processedIds = useRef<Set<string>>(new Set())
  
  // Dragging and positioning state with localStorage persistence
  const [position, setPosition] = useState(() => {
    try {
      const saved = localStorage.getItem('statusPanel_position')
      if (saved) {
        const parsed = JSON.parse(saved)
        return { x: parsed.x || window.innerWidth - 100, y: parsed.y || 20 }
      }
    } catch (error) {
      // Ignore invalid JSON, use default
    }
    // Position in top-right area: 100px from right edge, 20px from top
    return { x: window.innerWidth - 100, y: 20 }
  })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, startX: 0, startY: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  
  // Filter out dismissed messages and sort by timestamp (newest first) - memoized for performance
  const visibleMessages = useMemo(() => {
    return messages
      .filter(msg => !msg.dismissed)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 5) // Show max 5 messages
  }, [messages])

  // Update debug logs every 500ms
  useEffect(() => {
    const interval = setInterval(() => {
      if (window.debugLogs) {
        setLogs([...window.debugLogs])
      }
    }, 500)
    
    return () => clearInterval(interval)
  }, [])
  
  // Auto-hide after 30 seconds of no new messages
  useEffect(() => {
    if (visibleMessages.length > 0) {
      if (autoHideTimer) clearTimeout(autoHideTimer)
      
      const timer = setTimeout(() => {
        setIsCollapsed(true)
      }, 30000) // 30 seconds
      
      setAutoHideTimer(timer)
      
      return () => clearTimeout(timer)
    }
  }, [visibleMessages.length])

  // Keyboard shortcut to toggle panel (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        e.preventDefault()
        if (isCollapsed) {
          setIsCollapsed(false)
          setActiveTab('debug')
        } else if (activeTab === 'activity') {
          setActiveTab('debug')
        } else {
          setIsCollapsed(true)
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isCollapsed, activeTab])

  // Handle window resize to keep panel in visible area
  useEffect(() => {
    const handleResize = () => {
      setPosition(prev => {
        const newX = Math.min(prev.x, window.innerWidth - 100) // Keep 100px from right edge
        const newY = Math.max(20, Math.min(prev.y, window.innerHeight - 200)) // Keep in visible area
        
        if (newX !== prev.x || newY !== prev.y) {
          const newPosition = { x: newX, y: newY }
          localStorage.setItem('statusPanel_position', JSON.stringify(newPosition))
          return newPosition
        }
        return prev
      })
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  
  // Debug functionality methods
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

  const handleOpenLogsFolder = async () => {
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

  // Dragging functionality
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      startX: position.x,
      startY: position.y
    })
  }, [position])

  // Constrain position within viewport bounds
  const constrainPosition = useCallback((x: number, y: number) => {
    // Adjust constraints based on whether panel is docked or expanded
    const panelWidth = isDocked ? 80 : 400 // Docked is max 80px, expanded is 400px
    const panelHeight = isDocked ? 48 : 300 // Docked is 48px, expanded is ~300px
    
    const maxX = window.innerWidth - panelWidth
    const maxY = window.innerHeight - panelHeight
    
    return {
      x: Math.max(0, Math.min(maxX, x)),
      y: Math.max(0, Math.min(maxY, y))
    }
  }, [isDocked])

  useEffect(() => {
    if (!isDragging) return

    let rafId: number

    const handleMouseMove = (e: MouseEvent) => {
      // Cancel any pending animation frame to prevent stacking
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      
      // Use requestAnimationFrame for smoother updates
      rafId = requestAnimationFrame(() => {
        const deltaX = e.clientX - dragStart.x
        const deltaY = e.clientY - dragStart.y
        const newX = dragStart.startX + deltaX
        const newY = dragStart.startY + deltaY
        
        setPosition(constrainPosition(newX, newY))
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [isDragging, dragStart, constrainPosition])

  // Save position to localStorage when dragging stops (debounced for performance)
  useEffect(() => {
    if (!isDragging) {
      // Debounce position saves to avoid excessive localStorage writes
      const timeoutId = setTimeout(() => {
        try {
          localStorage.setItem('statusPanel_position', JSON.stringify(position))
        } catch (error) {
          // Ignore localStorage errors
        }
      }, 100) // 100ms debounce
      
      return () => clearTimeout(timeoutId)
    }
  }, [isDragging, position])

  // Dock/undock functionality
  const handleDock = useCallback(() => {
    if (onDock) {
      onDock()
    }
  }, [onDock])

  const handleUndock = useCallback(() => {
    if (onUndock) {
      onUndock()
    }
  }, [onUndock])

  // Don't render if no visible messages and no debug logs (unless docked)
  if (visibleMessages.length === 0 && logs.length === 0 && !isDocked) {
    return null
  }

  // If docked, show fixed bell icon in bottom-right corner
  if (isDocked) {
    // Show total unread messages count, not just visible ones
    const messageCount = messages.filter(msg => !msg.dismissed).length
    const hasNotifications = messageCount > 0
    
    return (
      <div 
        className={`${styles.statusPanel} ${styles.fixedBell} ${className || ''}`}
        data-testid="status-panel"
      >
        <button
          onClick={handleUndock}
          className={styles.bellButton}
          aria-label={hasNotifications ? `${messageCount} unread notifications. Click to view` : "Status panel. Click to expand"}
          title={hasNotifications ? `${messageCount} unread messages` : "Expand status panel"}
        >
          <Icon icon={Bell} size="md" />
          {hasNotifications && (
            <span 
              className={styles.bellNotificationBadge}
              data-testid="notification-count"
            >
              {messageCount > 99 ? '99+' : messageCount}
            </span>
          )}
        </button>
      </div>
    )
  }
  
  return (
    <div 
      ref={panelRef}
      className={`${styles.statusPanel} ${isCollapsed ? styles.collapsed : ''} ${isDragging ? styles.dragging : ''} ${className || ''}`}
      style={{
        transform: `translateX(${position.x}px) translateY(${position.y}px)`
      }}
      data-testid="status-panel"
    >
      {/* Header with Tab Navigation */}
      <div 
        className={styles.header}
        onMouseDown={handleMouseDown}
        role="banner"
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className={styles.headerContent}>
          <div className={styles.tabs}>
            <button
              role="tab"
              aria-selected={activeTab === 'activity'}
              className={`${styles.tab} ${activeTab === 'activity' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('activity')}
            >
              Activity ({visibleMessages.length})
            </button>
            <button
              role="tab"
              aria-selected={activeTab === 'debug'}
              className={`${styles.tab} ${activeTab === 'debug' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('debug')}
            >
              Debug Logs ({logs.length})
            </button>
          </div>
        </div>
        <div className={styles.headerActions}>
          {activeTab === 'activity' && visibleMessages.length > 1 && (
            <button
              className={styles.clearAllButton}
              onClick={onClearAll}
              title="Clear all messages"
              data-testid="status-clear-all"
            >
              Clear All
            </button>
          )}
          <IconButton
            icon={Minimize2}
            onClick={handleDock}
            data-testid="status-dock-button"
            size="sm"
            variant="ghost"
            ariaLabel="Dock status panel"
          />
          <IconButton
            icon={isCollapsed ? ChevronUp : ChevronDown}
            onClick={() => setIsCollapsed(!isCollapsed)}
            data-testid="status-toggle-collapse"
            size="sm"
            variant="ghost"
            ariaLabel={isCollapsed ? 'Expand status panel' : 'Collapse status panel'}
          />
        </div>
      </div>
      
      {!isCollapsed && (
        <div className={styles.tabContent}>
          {/* Activity Tab Content */}
          {activeTab === 'activity' && (
            <div className={styles.messageList}>
              {visibleMessages.map((message) => (
                <div 
                  key={message.id} 
                  className={`${styles.message} ${styles[`message-${message.type}`]}`}
                  data-testid={`status-message-${message.id}`}
                >
                  <div className={styles.messageIcon}>
                    <Icon icon={getIconForType(message.type)} size="sm" />
                  </div>
                  <div className={styles.messageContent}>
                    <div className={styles.messageTitle}>{message.title}</div>
                    <div className={styles.messageText}>{message.message}</div>
                    <div className={styles.messageTime}>{formatTimeAgo(message.timestamp)}</div>
                  </div>
                  <IconButton
                    icon={X}
                    onClick={() => onDismiss(message.id)}
                    size="sm"
                    variant="ghost"
                    ariaLabel="Dismiss message"
                    className={styles.dismissButton}
                    data-testid={`status-dismiss-${message.id}`}
                  />
                </div>
              ))}
              {visibleMessages.length === 0 && (
                <div className={styles.emptyState}>No recent activity</div>
              )}
            </div>
          )}

          {/* Debug Tab Content */}
          {activeTab === 'debug' && (
            <div className={styles.debugPanel}>
              {/* Debug Controls */}
              <div className={styles.debugControls}>
                <div className={styles.debugFilters}>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className={styles.searchInput}
                  />
                  <select
                    value={logLevelFilter}
                    onChange={(e) => setLogLevelFilter(e.target.value as any)}
                    className={styles.levelSelect}
                  >
                    <option value="ALL">All Levels</option>
                    <option value="ERROR">Errors</option>
                    <option value="WARN">Warnings</option>
                    <option value="INFO">Info</option>
                    <option value="DEBUG">Debug</option>
                  </select>
                </div>
                
                <div className={styles.debugActions}>
                  <button onClick={handleCopyLogs} className={styles.debugActionButton}>
                    {copied ? (
                      <>
                        <Icon icon={Check} size="xs" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Icon icon={Copy} size="xs" />
                        Copy Logs
                      </>
                    )}
                  </button>
                  <button onClick={handleExportLogs} className={styles.debugActionButton}>
                    <Icon icon={Save} size="xs" />
                    Export
                  </button>
                  <button onClick={handleOpenLogsFolder} className={styles.debugActionButton}>
                    <Icon icon={Folder} size="xs" />
                    Open Folder
                  </button>
                  <button onClick={handleClearLogs} className={`${styles.debugActionButton} ${styles.dangerButton}`}>
                    🗑️ Clear
                  </button>
                </div>
              </div>

              {/* Debug Logs Display */}
              <div className={styles.debugLogs}>
                {getFilteredLogs().length === 0 ? (
                  <div className={styles.emptyState}>
                    {logs.length === 0 ? 'No debug logs yet...' : 'No logs match the current filter'}
                  </div>
                ) : (
                  getFilteredLogs().map((log, index) => (
                    <div
                      key={index}
                      className={`${styles.logEntry} ${
                        log.includes('ERROR') ? styles.logError :
                        log.includes('WARN') ? styles.logWarn :
                        log.includes('DEBUG') ? styles.logDebug :
                        styles.logInfo
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
              </div>

              {/* Debug Instructions */}
              <div className={styles.debugInstructions}>
                <strong>Keyboard:</strong> Ctrl+Shift+D to toggle • 
                <strong>Logs saved to:</strong> C:\Users\sierr\.scorm-builder\logs\
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Export memoized component for performance
export const StatusPanel = React.memo(StatusPanelComponent)
export default StatusPanel