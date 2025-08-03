import React from 'react'
import { tokens } from './DesignSystem/designTokens'

interface AutoSaveIndicatorProps {
  isSaving: boolean
  hasDraft: boolean
  timeSinceLastSave: string
}

export const AutoSaveIndicator: React.FC<AutoSaveIndicatorProps> = ({ 
  isSaving, 
  hasDraft, 
  timeSinceLastSave 
}) => {
  return (
    <div 
      role="status" 
      aria-label="Auto-save status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.25rem 0.75rem',
        borderRadius: '0.375rem',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        border: `1px solid ${tokens.colors.border.light}`,
        fontSize: '0.75rem',
        color: '#a1a1aa'
      }}
    >
      {isSaving ? (
        <>
          <span style={{ 
            display: 'inline-block',
            width: tokens.spacing.sm,
            height: tokens.spacing.sm,
            borderRadius: '50%',
            backgroundColor: '#fbbf24', // Warning yellow
            animation: 'pulse 1s infinite'
          }} />
          <span>Saving...</span>
          <style>
            {`
              @keyframes pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.3; }
              }
            `}
          </style>
        </>
      ) : hasDraft ? (
        <>
          <span style={{ 
            display: 'inline-block',
            width: tokens.spacing.sm,
            height: tokens.spacing.sm,
            borderRadius: '50%',
            backgroundColor: tokens.colors.success[500]
          }} />
          <span>Saved</span>
          {timeSinceLastSave !== 'Never' && (
            <span style={{ color: '#71717a' }}>• Last saved {timeSinceLastSave}</span>
          )}
        </>
      ) : (
        <span style={{ color: '#71717a' }}>No draft</span>
      )}
    </div>
  )
}