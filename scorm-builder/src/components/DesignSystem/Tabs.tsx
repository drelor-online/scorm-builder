import React, { useState, useRef, useEffect } from 'react'
import { tokens } from './designTokens'

interface TabProps {
  label: string
  icon?: React.ReactNode
  children: React.ReactNode
  tabKey: string
}

interface TabsProps {
  children: React.ReactElement<TabProps>[]
  activeTab?: string
  onChange?: (tabKey: string) => void
}

export const Tab: React.FC<TabProps> = ({ children }) => {
  return <>{children}</>
}

export const Tabs: React.FC<TabsProps> = ({ children, activeTab: controlledActiveTab, onChange }) => {
  const [localActiveTab, setLocalActiveTab] = useState(children[0]?.props.tabKey || '')
  const activeTab = controlledActiveTab !== undefined ? controlledActiveTab : localActiveTab
  
  const handleTabClick = (tabKey: string) => {
    if (onChange) {
      onChange(tabKey)
    } else {
      setLocalActiveTab(tabKey)
    }
  }
  
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowRight') {
      const nextIndex = (index + 1) % children.length
      handleTabClick(children[nextIndex].props.tabKey)
      const nextButton = e.currentTarget.parentElement?.children[nextIndex] as HTMLButtonElement
      nextButton?.focus()
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (index - 1 + children.length) % children.length
      handleTabClick(children[prevIndex].props.tabKey)
      const prevButton = e.currentTarget.parentElement?.children[prevIndex] as HTMLButtonElement
      prevButton?.focus()
    }
  }
  
  const activeChild = children.find(child => child.props.tabKey === activeTab)
  
  return (
    <div>
      {/* Tab List */}
      <div 
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: `2px solid ${tokens.colors.border.default}`,
          marginBottom: '1.5rem'
        }}
      >
        {children.map((child, index) => {
          const isActive = child.props.tabKey === activeTab
          
          return (
            <button
              key={child.props.tabKey}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${child.props.tabKey}`}
              id={`tab-${child.props.tabKey}`}
              className={isActive ? 'active' : ''}
              onClick={() => handleTabClick(child.props.tabKey)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? tokens.colors.primary[500] : 'transparent'}`,
                color: isActive ? tokens.colors.primary[500] : tokens.colors.text.secondary,
                fontWeight: isActive ? 600 : 400,
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: '-2px',
                outline: 'none',
                ...(isActive && {
                  backgroundColor: tokens.colors.background.primary
                })
              }}
            >
              {child.props.icon && (
                <span style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  opacity: isActive ? 1 : 0.7
                }}>
                  {child.props.icon}
                </span>
              )}
              {child.props.label}
            </button>
          )
        })}
      </div>
      
      {/* Tab Panel */}
      <div
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        id={`tabpanel-${activeTab}`}
      >
        {activeChild}
      </div>
    </div>
  )
}