import React from 'react'
import { Modal, ProgressBar } from './DesignSystem'

interface ProjectLoadingDialogProps {
  isOpen: boolean
  progress: {
    phase: 'loading' | 'media' | 'content' | 'finalizing'
    percent: number
    message: string
    itemsLoaded?: number
    totalItems?: number
  }
}

export const ProjectLoadingDialog: React.FC<ProjectLoadingDialogProps> = ({
  isOpen,
  progress
}) => {
  const getPhaseMessage = () => {
    switch (progress.phase) {
      case 'loading':
        return 'Opening Project'
      case 'media':
        return 'Loading Media'
      case 'content':
        return 'Loading Content'
      case 'finalizing':
        return 'Almost Ready'
      default:
        return 'Loading...'
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Prevent closing during load
      title="Opening Project"
      size="small"
      showCloseButton={false}
    >
      <div style={{ padding: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ 
            fontSize: '1.25rem', 
            marginBottom: '0.75rem',
            fontWeight: '600'
          }}>
            {getPhaseMessage()}
          </h3>
          {progress.message && (
            <p style={{ 
              fontSize: '0.9375rem', 
              color: '#94a3b8', 
              marginBottom: '1rem',
              lineHeight: '1.5'
            }}>
              {progress.message}
            </p>
          )}
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <ProgressBar 
            value={progress.percent} 
            label="Loading project"
            showPercentage={true}
            size="medium"
            variant="primary"
          />
          <div style={{ 
            textAlign: 'center', 
            marginTop: '0.75rem',
            fontSize: '0.875rem',
            fontWeight: '500',
            color: '#e4e4e7'
          }}>
            {progress.percent}%
          </div>
        </div>

        {progress.itemsLoaded !== undefined && progress.totalItems !== undefined && (
          <p style={{ 
            fontSize: '0.8125rem', 
            color: '#94a3b8', 
            textAlign: 'center',
            marginTop: '0.5rem'
          }}>
            {progress.itemsLoaded} of {progress.totalItems} items loaded
          </p>
        )}

        {/* Phase indicator dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '0.5rem',
          marginTop: '1rem'
        }}>
          {['loading', 'media', 'content', 'finalizing'].map((phase, index) => (
            <div
              key={phase}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 
                  progress.phase === phase ? '#3b82f6' :
                  ['loading', 'media', 'content', 'finalizing'].indexOf(progress.phase) > index ? '#22c55e' :
                  '#374151',
                transition: 'background-color 0.3s ease'
              }}
            />
          ))}
        </div>
      </div>
    </Modal>
  )
}