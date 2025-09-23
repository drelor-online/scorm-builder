import React from 'react'
import { Modal } from './DesignSystem/Modal'
import { ProgressBar } from './DesignSystem/ProgressBar'
import { Button } from './DesignSystem/Button'
import { LoadingSpinner } from './DesignSystem/LoadingSpinner'

export interface ExportProgressState {
  phase: 'preparing' | 'validating' | 'processing' | 'creating' | 'completing'
  progress: number
  currentFile?: string
  filesProcessed: number
  totalFiles: number
  message: string
  canCancel: boolean
}

interface ExportProgressDialogProps {
  isOpen: boolean
  state: ExportProgressState
  onCancel: () => void
}

const PHASE_MESSAGES = {
  preparing: 'Preparing export...',
  validating: 'Validating project data...',
  processing: 'Processing media files...',
  creating: 'Creating archive...',
  completing: 'Finalizing export...'
}

const PHASE_PROGRESS_RANGES = {
  preparing: [0, 10],
  validating: [10, 20],
  processing: [20, 80],
  creating: [80, 95],
  completing: [95, 100]
}

export function ExportProgressDialog({ isOpen, state, onCancel }: ExportProgressDialogProps) {
  const getPhaseProgress = () => {
    const [min, max] = PHASE_PROGRESS_RANGES[state.phase]
    const phaseProgress = Math.min(100, Math.max(0, state.progress))
    return min + (phaseProgress * (max - min)) / 100
  }

  const getFileProgressText = () => {
    if (state.totalFiles > 0) {
      return `${state.filesProcessed}/${state.totalFiles} files`
    }
    return ''
  }

  const getDetailedMessage = () => {
    const baseMessage = state.message || PHASE_MESSAGES[state.phase]

    if (state.phase === 'processing' && state.currentFile) {
      return `${baseMessage}\nProcessing: ${state.currentFile}`
    }

    if (state.totalFiles > 0) {
      const fileProgress = getFileProgressText()
      return `${baseMessage}\n${fileProgress}`
    }

    return baseMessage
  }

  const isIndeterminate = state.phase === 'preparing' || state.phase === 'completing'

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}} // Prevent closing during export
      title="Exporting Project"
      size="medium"
    >
      <div className="export-progress-content">
        <div className="export-progress-header">
          <h3 className="export-progress-title">Creating project export...</h3>
          <p className="export-progress-subtitle">
            This may take a few moments depending on the size of your project.
          </p>
        </div>

        <div className="export-progress-body">
          <div className="export-progress-status">
            <div className="export-progress-message">
              {getDetailedMessage().split('\n').map((line, index) => (
                <div key={index} className={index === 0 ? 'primary-message' : 'secondary-message'}>
                  {line}
                </div>
              ))}
            </div>

            {isIndeterminate ? (
              <div className="export-progress-spinner">
                <LoadingSpinner size="small" text="" />
              </div>
            ) : (
              <div className="export-progress-bar-container">
                <ProgressBar
                  value={getPhaseProgress()}
                  variant="primary"
                  showPercentage={true}
                  showTimeRemaining={state.phase === 'processing'}
                />
              </div>
            )}
          </div>

          {state.totalFiles > 0 && (
            <div className="export-progress-stats">
              <div className="stat">
                <span className="stat-label">Files:</span>
                <span className="stat-value">{getFileProgressText()}</span>
              </div>
              {state.phase === 'processing' && state.filesProcessed > 0 && (
                <div className="stat">
                  <span className="stat-label">Phase:</span>
                  <span className="stat-value">{PHASE_MESSAGES[state.phase]}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="export-progress-actions">
          {state.canCancel && (
            <Button
              variant="secondary"
              onClick={onCancel}
              disabled={!state.canCancel}
            >
              Cancel Export
            </Button>
          )}
        </div>
      </div>

      <style>{`
        .export-progress-content {
          padding: 24px 0;
          min-height: 300px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .export-progress-header {
          text-align: center;
        }

        .export-progress-title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
          margin: 0 0 8px 0;
        }

        .export-progress-subtitle {
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .export-progress-body {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .export-progress-status {
          display: flex;
          flex-direction: column;
          gap: 16px;
          align-items: center;
        }

        .export-progress-message {
          text-align: center;
          min-height: 48px;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 4px;
        }

        .primary-message {
          font-size: 16px;
          font-weight: 500;
          color: var(--text-primary);
        }

        .secondary-message {
          font-size: 14px;
          color: var(--text-secondary);
        }

        .export-progress-spinner {
          margin: 8px 0;
        }

        .export-progress-bar-container {
          width: 100%;
          max-width: 400px;
        }

        .export-progress-stats {
          display: flex;
          justify-content: center;
          gap: 32px;
          padding: 16px;
          background: var(--background-secondary);
          border-radius: 8px;
          margin: 0 24px;
        }

        .stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .stat-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .stat-value {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .export-progress-actions {
          display: flex;
          justify-content: center;
          padding-top: 8px;
          border-top: 1px solid var(--border-light);
        }
      `}</style>
    </Modal>
  )
}