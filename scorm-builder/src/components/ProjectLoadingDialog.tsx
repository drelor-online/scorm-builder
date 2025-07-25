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
        return 'Loading project file...'
      case 'media':
        return 'Loading media files...'
      case 'content':
        return 'Loading course content...'
      case 'finalizing':
        return 'Finalizing project...'
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
          <h3 style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
            {getPhaseMessage()}
          </h3>
          {progress.message && (
            <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>
              {progress.message}
            </p>
          )}
        </div>

        <ProgressBar 
          value={progress.percent} 
          label={`${progress.percent}%`}
          className="mb-4"
        />

        {progress.itemsLoaded !== undefined && progress.totalItems !== undefined && (
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>
            {progress.itemsLoaded} of {progress.totalItems} items loaded
          </p>
        )}
      </div>
    </Modal>
  )
}