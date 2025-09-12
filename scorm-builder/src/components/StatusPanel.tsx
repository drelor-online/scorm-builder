import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, ChevronDown, ChevronUp, Copy, Save, Folder, Check, Minimize2, Maximize2, Bell, MessageCircle, Circle, Zap, Bug, Wrench, Maximize, Minimize } from 'lucide-react'
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
  const [isMaximized, setIsMaximized] = useState(() => {
    try {
      const saved = localStorage.getItem('statusPanel_maximized')
      return saved === 'true'
    } catch {
      return false
    }
  })
  const [autoHideTimer, setAutoHideTimer] = useState<NodeJS.Timeout | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('activity')
  const [logs, setLogs] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [logLevelFilter, setLogLevelFilter] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO' | 'DEBUG' | 'SUCCESS'>('ALL')
  const [quickFilterActive, setQuickFilterActive] = useState<string | null>(null)
  const [timeFilter, setTimeFilter] = useState<'ALL' | '5MIN' | '15MIN' | '1HOUR'>('ALL')
  const [componentFilter, setComponentFilter] = useState<string>('All Components')
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
  
  // Auto-hide disabled - keep panel expanded by default for better UX
  // useEffect(() => {
  //   if (visibleMessages.length > 0) {
  //     if (autoHideTimer) clearTimeout(autoHideTimer)
  //     
  //     const timer = setTimeout(() => {
  //       setIsCollapsed(true)
  //     }, 30000) // 30 seconds
  //     
  //     setAutoHideTimer(timer)
  //     
  //     return () => clearTimeout(timer)
  //   }
  // }, [visibleMessages.length])

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

  // Enhanced filtering handlers
  const handleQuickFilter = (level: string) => {
    if (quickFilterActive === level) {
      setQuickFilterActive(null) // Toggle off if already active
    } else {
      setQuickFilterActive(level)
      setLogLevelFilter('ALL') // Reset dropdown filter
    }
  }

  const handleTimeFilter = (time: '5MIN' | '15MIN' | '1HOUR' | 'ALL') => {
    setTimeFilter(time)
  }

  const handleClearAllFilters = () => {
    setQuickFilterActive(null)
    setLogLevelFilter('ALL')
    setTimeFilter('ALL')
    setComponentFilter('All Components')
    setSearchFilter('')
  }

  // Check if any filters are active
  const hasActiveFilters = () => {
    return quickFilterActive !== null || 
           logLevelFilter !== 'ALL' || 
           timeFilter !== 'ALL' || 
           componentFilter !== 'All Components' || 
           searchFilter !== ''
  }

  // Get active filter descriptions for display
  const getActiveFilterText = () => {
    const filters = []
    if (quickFilterActive) {
      filters.push(`${quickFilterActive.toLowerCase()} only`)
    } else if (logLevelFilter !== 'ALL') {
      filters.push(`${logLevelFilter.toLowerCase()} only`)
    }
    if (timeFilter !== 'ALL') {
      const timeLabels = { '5MIN': 'last 5 minutes', '15MIN': 'last 15 minutes', '1HOUR': 'last hour' }
      filters.push(timeLabels[timeFilter])
    }
    if (componentFilter !== 'All Components') {
      filters.push(`${componentFilter} component`)
    }
    if (searchFilter) {
      filters.push(`search: "${searchFilter}"`)
    }
    return filters.join(', ')
  }

  // Parse log entry to extract level, component, message, and timestamp
  const parseLogEntry = (log: string) => {
    // Handle REAL ultraSimpleLogger format: [2024-01-15T10:30:15.123Z] [Component] ERROR: message
    
    // Extract ISO timestamp if present (first bracketed item)
    const isoTimestampMatch = log.match(/^\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\]/)
    let timestamp: number | null = null
    if (isoTimestampMatch) {
      timestamp = new Date(isoTimestampMatch[1]).getTime()
    }
    
    // Extract component name - second bracketed item after timestamp
    let componentMatch = null
    if (isoTimestampMatch) {
      // Look for component after timestamp: [timestamp] [Component] message
      const afterTimestamp = log.substring(isoTimestampMatch[0].length).trim()
      componentMatch = afterTimestamp.match(/^\[([A-Za-z][A-Za-z0-9_]*)\]/)
    } else {
      // Fallback: look for any [ComponentName] pattern (backwards compatibility)
      componentMatch = log.match(/\[([A-Za-z][A-Za-z0-9_]*)\](?!\s*\[)/)
    }
    const component = componentMatch ? componentMatch[1] : null
    
    // Extract log level from message content (ERROR:, WARN:, DEBUG:, etc.)
    let level = 'info' // Default to info
    let message = log
    
    // Remove timestamp from message if present
    if (isoTimestampMatch) {
      message = message.substring(isoTimestampMatch[0].length).trim()
    }
    
    // Remove component from message if present
    if (componentMatch && message.startsWith(componentMatch[0])) {
      message = message.substring(componentMatch[0].length).trim()
    }
    
    // Check for explicit level markers in message content
    const levelInMessageMatch = message.match(/^(ERROR|WARN|WARNING|DEBUG|SUCCESS):\s*(.+)$/)
    if (levelInMessageMatch) {
      level = levelInMessageMatch[1].toLowerCase()
      if (level === 'warning') level = 'warn' // Normalize
      message = levelInMessageMatch[2].trim() // Remove level prefix from message
    }
    // If no explicit level marker, check for old format [LEVEL] at start
    else {
      const oldFormatLevelMatch = log.match(/^\[?(ERROR|WARN|WARNING|INFO|DEBUG|SUCCESS)\]?/)
      if (oldFormatLevelMatch) {
        level = oldFormatLevelMatch[1].toLowerCase()
        if (level === 'warning') level = 'warn' // Normalize
      }
    }
    
    return { level, component, message, timestamp, originalLog: log }
  }

  // Get unique components from logs for filter dropdown
  const getUniqueComponents = () => {
    const components = new Set<string>()
    logs.forEach(log => {
      const parsed = parseLogEntry(log)
      if (parsed.component) {
        components.add(parsed.component)
      }
    })
    return Array.from(components).sort()
  }

  // Get icon for log level
  const getLogIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error': return AlertCircle
      case 'warn': case 'warning': return AlertTriangle  
      case 'info': return Info
      case 'debug': return Bug
      case 'success': return CheckCircle
      default: return Info
    }
  }

  // Filter logs based on search, log level, time, component, and quick filters
  const getFilteredLogs = () => {
    let filtered = logs
    
    // Apply quick filter (takes precedence over dropdown filter)
    const activeFilter = quickFilterActive || logLevelFilter
    if (activeFilter !== 'ALL') {
      filtered = filtered.filter(log => {
        const parsed = parseLogEntry(log)
        const parsedLevel = parsed.level.toUpperCase()
        
        // Match based on parsed level
        if (activeFilter === 'ERROR') return parsedLevel === 'ERROR'
        if (activeFilter === 'WARN') return parsedLevel === 'WARN'
        if (activeFilter === 'INFO') return parsedLevel === 'INFO'
        if (activeFilter === 'DEBUG') return parsedLevel === 'DEBUG'
        if (activeFilter === 'SUCCESS') return parsedLevel === 'SUCCESS'
        return true
      })
    }
    
    // Apply time-based filter
    if (timeFilter !== 'ALL') {
      const now = Date.now()
      let timeThreshold = 0
      
      switch (timeFilter) {
        case '5MIN':
          timeThreshold = now - (5 * 60 * 1000)
          break
        case '15MIN':
          timeThreshold = now - (15 * 60 * 1000)
          break
        case '1HOUR':
          timeThreshold = now - (60 * 60 * 1000)
          break
      }
      
      filtered = filtered.filter(log => {
        const parsed = parseLogEntry(log)
        // Only include logs that have timestamps and are within the time window
        if (!parsed.timestamp) {
          return false // Exclude logs without timestamps when time filter is active
        }
        return parsed.timestamp >= timeThreshold
      })
    }
    
    // Apply component filter
    if (componentFilter !== 'All Components') {
      filtered = filtered.filter(log => {
        const parsed = parseLogEntry(log)
        return parsed.component === componentFilter
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

  // Maximize/minimize functionality
  const handleMaximize = useCallback(() => {
    setIsMaximized(true)
    try {
      localStorage.setItem('statusPanel_maximized', 'true')
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  const handleMinimize = useCallback(() => {
    setIsMaximized(false)
    try {
      localStorage.setItem('statusPanel_maximized', 'false')
    } catch {
      // Ignore localStorage errors
    }
  }, [])

  // Always show the bell button - if undocked with no content, show as docked bell for accessibility
  const shouldShowAsBell = isDocked || (visibleMessages.length === 0 && logs.length === 0)

  // If docked OR no content to show, show fixed bell icon in bottom-right corner
  if (shouldShowAsBell) {
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
          <Icon icon={Bell} size="sm" />
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
      className={`${styles.statusPanel} ${isCollapsed ? styles.collapsed : ''} ${isMaximized ? styles.maximized : ''} ${isDragging ? styles.dragging : ''} ${className || ''}`}
      style={{
        transform: isMaximized ? 'none' : `translateX(${position.x}px) translateY(${position.y}px)`
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
            icon={isMaximized ? Minimize : Maximize}
            onClick={isMaximized ? handleMinimize : handleMaximize}
            data-testid="status-maximize-button"
            size="sm"
            variant="ghost"
            ariaLabel={isMaximized ? 'Minimize status panel' : 'Maximize status panel'}
          />
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
                {/* Enhanced Filtering Row 1: Search and Level Dropdown */}
                <div className={styles.debugFilters}>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className={styles.searchInput}
                  />
                  <select
                    value={quickFilterActive ? 'ALL' : logLevelFilter}
                    onChange={(e) => {
                      setLogLevelFilter(e.target.value as any)
                      setQuickFilterActive(null)
                    }}
                    className={styles.levelSelect}
                    disabled={quickFilterActive !== null}
                  >
                    <option value="ALL">All Levels</option>
                    <option value="ERROR">Errors</option>
                    <option value="WARN">Warnings</option>
                    <option value="SUCCESS">Success</option>
                    <option value="INFO">Info</option>
                    <option value="DEBUG">Debug</option>
                  </select>
                  <select
                    value={componentFilter}
                    onChange={(e) => setComponentFilter(e.target.value)}
                    className={styles.levelSelect}
                    style={{ minWidth: '140px' }}
                  >
                    <option value="All Components">All Components</option>
                    {getUniqueComponents().map(component => (
                      <option key={component} value={component}>{component}</option>
                    ))}
                  </select>
                </div>

                {/* Enhanced Filtering Row 2: Quick Filters */}
                <div className={styles.debugFilters} style={{ flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#a8a8a8', marginRight: '8px' }}>Quick:</span>
                    <button 
                      onClick={() => handleQuickFilter('ERROR')}
                      className={`${styles.debugActionButton} ${quickFilterActive === 'ERROR' ? styles.activeFilter : ''}`}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        backgroundColor: quickFilterActive === 'ERROR' ? '#ff6b6b' : undefined,
                        opacity: quickFilterActive === 'ERROR' ? 1 : 0.7
                      }}
                      role="button"
                      aria-label="Show only errors"
                    >
                      Errors
                    </button>
                    <button 
                      onClick={() => handleQuickFilter('WARN')}
                      className={`${styles.debugActionButton} ${quickFilterActive === 'WARN' ? styles.activeFilter : ''}`}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        backgroundColor: quickFilterActive === 'WARN' ? '#ffd43b' : undefined,
                        opacity: quickFilterActive === 'WARN' ? 1 : 0.7
                      }}
                      role="button"
                      aria-label="Show only warnings"
                    >
                      Warnings
                    </button>
                    <button 
                      onClick={() => handleQuickFilter('INFO')}
                      className={`${styles.debugActionButton} ${quickFilterActive === 'INFO' ? styles.activeFilter : ''}`}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        backgroundColor: quickFilterActive === 'INFO' ? '#74c0fc' : undefined,
                        opacity: quickFilterActive === 'INFO' ? 1 : 0.7
                      }}
                      role="button"
                      aria-label="Show only info"
                    >
                      Info
                    </button>
                    <button 
                      onClick={() => handleQuickFilter('DEBUG')}
                      className={`${styles.debugActionButton} ${quickFilterActive === 'DEBUG' ? styles.activeFilter : ''}`}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        backgroundColor: quickFilterActive === 'DEBUG' ? '#9775fa' : undefined,
                        opacity: quickFilterActive === 'DEBUG' ? 1 : 0.7
                      }}
                      role="button"
                      aria-label="Show only debug"
                    >
                      Debug
                    </button>
                    <button 
                      onClick={() => handleQuickFilter('SUCCESS')}
                      className={`${styles.debugActionButton} ${quickFilterActive === 'SUCCESS' ? styles.activeFilter : ''}`}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        backgroundColor: quickFilterActive === 'SUCCESS' ? '#51cf66' : undefined,
                        opacity: quickFilterActive === 'SUCCESS' ? 1 : 0.7
                      }}
                      role="button"
                      aria-label="Show only success"
                    >
                      Success
                    </button>
                    <button 
                      onClick={() => handleQuickFilter('ALL')}
                      className={styles.debugActionButton}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        opacity: 0.7
                      }}
                      role="button"
                      aria-label="Show all levels"
                    >
                      All
                    </button>
                  </div>
                  
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: '#a8a8a8', marginRight: '8px' }}>Time:</span>
                    <button 
                      onClick={() => handleTimeFilter('5MIN')}
                      className={`${styles.debugActionButton} ${timeFilter === '5MIN' ? styles.activeFilter : ''}`}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        backgroundColor: timeFilter === '5MIN' ? '#74c0fc' : undefined,
                        opacity: timeFilter === '5MIN' ? 1 : 0.7
                      }}
                      role="button"
                      aria-label="Last 5 minutes"
                    >
                      5 min
                    </button>
                    <button 
                      onClick={() => handleTimeFilter('15MIN')}
                      className={`${styles.debugActionButton} ${timeFilter === '15MIN' ? styles.activeFilter : ''}`}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        backgroundColor: timeFilter === '15MIN' ? '#74c0fc' : undefined,
                        opacity: timeFilter === '15MIN' ? 1 : 0.7
                      }}
                      role="button"
                      aria-label="Last 15 minutes"
                    >
                      15 min
                    </button>
                    <button 
                      onClick={() => handleTimeFilter('1HOUR')}
                      className={`${styles.debugActionButton} ${timeFilter === '1HOUR' ? styles.activeFilter : ''}`}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        backgroundColor: timeFilter === '1HOUR' ? '#74c0fc' : undefined,
                        opacity: timeFilter === '1HOUR' ? 1 : 0.7
                      }}
                      role="button"
                      aria-label="Last hour"
                    >
                      1 hour
                    </button>
                    <button 
                      onClick={() => handleTimeFilter('ALL')}
                      className={styles.debugActionButton}
                      style={{ 
                        fontSize: '10px', 
                        padding: '4px 8px',
                        opacity: 0.7
                      }}
                      role="button"
                      aria-label="All time"
                    >
                      All
                    </button>
                  </div>
                </div>

                {/* Active Filters Indicator */}
                {hasActiveFilters() && (
                  <div style={{ 
                    fontSize: '10px', 
                    color: '#74c0fc', 
                    padding: '4px 8px',
                    backgroundColor: 'rgba(116, 192, 252, 0.1)',
                    borderRadius: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <span>Active filters: {getActiveFilterText()}</span>
                    <button
                      onClick={handleClearAllFilters}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#74c0fc',
                        fontSize: '10px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                        marginLeft: '8px'
                      }}
                      role="button"
                      aria-label="Clear all filters"
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
                
                {/* Debug Actions */}
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
                  getFilteredLogs().map((log, index) => {
                    const parsedLog = parseLogEntry(log)
                    const LogIcon = getLogIcon(parsedLog.level)
                    
                    return (
                      <div
                        key={index}
                        className={`${styles.logEntry} ${
                          parsedLog.level === 'error' ? styles.logError :
                          parsedLog.level === 'warn' || parsedLog.level === 'warning' ? styles.logWarn :
                          parsedLog.level === 'debug' ? styles.logDebug :
                          parsedLog.level === 'success' ? styles.logSuccess :
                          styles.logInfo
                        }`}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                          {/* Log level icon */}
                          <Icon 
                            icon={LogIcon} 
                            size="xs" 
                            style={{ 
                              marginTop: '2px', 
                              flexShrink: 0,
                              opacity: 0.8 
                            }} 
                          />
                          
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Component badge if available */}
                            {parsedLog.component && (
                              <span 
                                style={{
                                  display: 'inline-block',
                                  fontSize: '9px',
                                  padding: '2px 6px',
                                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: '3px',
                                  marginRight: '8px',
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  fontWeight: '500',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.5px'
                                }}
                              >
                                {parsedLog.component}
                              </span>
                            )}
                            
                            {/* Log message */}
                            <span style={{ wordBreak: 'break-word' }}>
                              {parsedLog.message || parsedLog.originalLog}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
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