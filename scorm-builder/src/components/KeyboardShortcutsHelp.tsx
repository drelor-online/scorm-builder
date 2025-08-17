import React from 'react'
import { Keyboard } from 'lucide-react'
import { Modal } from './DesignSystem/Modal'
import styles from './KeyboardShortcutsHelp.module.css'

interface KeyboardShortcut {
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

interface KeyboardShortcutsHelpProps {
  isOpen: boolean
  onClose: () => void
  shortcuts: KeyboardShortcut[]
  formatShortcut: (shortcut: KeyboardShortcut) => string
}

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  isOpen,
  onClose,
  shortcuts,
  formatShortcut
}) => {
  // Group shortcuts by category (you can extend this logic)
  const enabledShortcuts = shortcuts.filter(s => s.enabled !== false)
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Keyboard Shortcuts"
      size="medium"
    >
      <div className={styles.container}>
        <div className={styles.header}>
          <Keyboard size={24} />
          <p className={styles.description}>
            Use these keyboard shortcuts to navigate and work more efficiently.
          </p>
        </div>
        
        <div className={styles.shortcutsList}>
          {enabledShortcuts.map((shortcut, index) => (
            <div key={index} className={styles.shortcutItem}>
              <div className={styles.shortcutKeys}>
                {formatShortcut(shortcut).split(' + ').map((key, keyIndex) => (
                  <React.Fragment key={keyIndex}>
                    <kbd className={styles.key}>{key}</kbd>
                    {keyIndex < formatShortcut(shortcut).split(' + ').length - 1 && (
                      <span className={styles.plus}>+</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className={styles.shortcutDescription}>
                {shortcut.description}
              </div>
            </div>
          ))}
        </div>
        
        {enabledShortcuts.length === 0 && (
          <div className={styles.noShortcuts}>
            No keyboard shortcuts are currently available.
          </div>
        )}
        
        <div className={styles.footer}>
          <p className={styles.note}>
            <strong>Note:</strong> Keyboard shortcuts are disabled when typing in text fields.
          </p>
        </div>
      </div>
    </Modal>
  )
}

export default KeyboardShortcutsHelp