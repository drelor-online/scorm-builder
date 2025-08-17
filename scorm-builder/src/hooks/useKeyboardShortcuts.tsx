import { useEffect, useCallback, useRef } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  metaKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  description: string
  action: () => void
  preventDefault?: boolean
  enabled?: boolean
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[]
  enableWhenInputFocused?: boolean
}

export const useKeyboardShortcuts = ({
  shortcuts,
  enableWhenInputFocused = false
}: UseKeyboardShortcutsOptions) => {
  const shortcutsRef = useRef(shortcuts)
  
  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts
  }, [shortcuts])
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // Skip if shortcuts are disabled when input is focused
    if (!enableWhenInputFocused) {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.contentEditable === 'true' ||
          target.closest('[contenteditable="true"]')) {
        return
      }
    }
    
    const normalizedKey = event.key.toLowerCase()
    
    for (const shortcut of shortcutsRef.current) {
      // Skip disabled shortcuts
      if (shortcut.enabled === false) continue
      
      const keyMatches = shortcut.key.toLowerCase() === normalizedKey
      const ctrlMatches = (shortcut.ctrlKey ?? false) === event.ctrlKey
      const metaMatches = (shortcut.metaKey ?? false) === event.metaKey
      const shiftMatches = (shortcut.shiftKey ?? false) === event.shiftKey
      const altMatches = (shortcut.altKey ?? false) === event.altKey
      
      // Handle Ctrl/Cmd key compatibility (Ctrl on Windows/Linux, Cmd on Mac)
      const modifierMatches = shortcut.ctrlKey 
        ? (event.ctrlKey || event.metaKey)
        : ctrlMatches && metaMatches
      
      if (keyMatches && modifierMatches && shiftMatches && altMatches) {
        if (shortcut.preventDefault !== false) {
          event.preventDefault()
        }
        shortcut.action()
        break // Only execute the first matching shortcut
      }
    }
  }, [enableWhenInputFocused])
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
  
  // Helper function to format shortcut display
  const formatShortcut = useCallback((shortcut: KeyboardShortcut): string => {
    const parts: string[] = []
    
    if (shortcut.ctrlKey) {
      parts.push(navigator.platform.toLowerCase().includes('mac') ? '⌘' : 'Ctrl')
    }
    if (shortcut.shiftKey) parts.push('Shift')
    if (shortcut.altKey) parts.push('Alt')
    if (shortcut.metaKey && !shortcut.ctrlKey) parts.push('⌘')
    
    parts.push(shortcut.key.toUpperCase())
    
    return parts.join(' + ')
  }, [])
  
  return {
    formatShortcut,
    shortcuts: shortcutsRef.current
  }
}

// Predefined common shortcuts
export const commonShortcuts = {
  save: (action: () => void): KeyboardShortcut => ({
    key: 's',
    ctrlKey: true,
    description: 'Save',
    action,
    preventDefault: true
  }),
  
  undo: (action: () => void): KeyboardShortcut => ({
    key: 'z',
    ctrlKey: true,
    description: 'Undo',
    action,
    preventDefault: true
  }),
  
  redo: (action: () => void): KeyboardShortcut => ({
    key: 'z',
    ctrlKey: true,
    shiftKey: true,
    description: 'Redo',
    action,
    preventDefault: true
  }),
  
  toggleTreeView: (action: () => void): KeyboardShortcut => ({
    key: 't',
    ctrlKey: true,
    shiftKey: true,
    description: 'Toggle tree view',
    action,
    preventDefault: true
  }),
  
  showHelp: (action: () => void): KeyboardShortcut => ({
    key: '/',
    ctrlKey: true,
    description: 'Show keyboard shortcuts',
    action,
    preventDefault: true
  }),
  
  escape: (action: () => void): KeyboardShortcut => ({
    key: 'Escape',
    description: 'Close modal/dialog',
    action,
    preventDefault: false
  })
}

export { useKeyboardShortcuts as default }
export type { KeyboardShortcut }