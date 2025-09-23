/**
 * Dialog component for handling project import conflicts
 * Shows options when importing a project that already exists
 */

import React from 'react'
import { Modal, Button, Alert } from './DesignSystem'
import { COLORS, SPACING } from '../constants'

export interface ProjectImportConflictDialogProps {
  isOpen: boolean
  projectName: string
  existingProjectPath?: string
  onReplace: () => void
  onCreateNew: () => void
  onCancel: () => void
}

export const ProjectImportConflictDialog: React.FC<ProjectImportConflictDialogProps> = ({
  isOpen,
  projectName,
  existingProjectPath,
  onReplace,
  onCreateNew,
  onCancel
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title="Project Already Exists"
    >
      <div style={{ padding: SPACING.lg }}>
        <div style={{ marginBottom: SPACING.md }}>
          <Alert variant="warning">
            A project named "<strong>{projectName}</strong>" already exists.
          </Alert>
        </div>

        <div style={{ marginBottom: SPACING.lg, color: COLORS.text }}>
          <p style={{ marginBottom: SPACING.sm }}>
            What would you like to do?
          </p>

          {existingProjectPath && (
            <p style={{
              fontSize: '0.9em',
              color: COLORS.secondary,
              marginBottom: SPACING.md
            }}>
              Existing project location: {existingProjectPath}
            </p>
          )}
        </div>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.sm,
          marginBottom: SPACING.lg
        }}>

          <Button
            onClick={onReplace}
            variant="danger"
            style={{
              width: '100%',
              padding: SPACING.md,
              height: 'auto',
              minHeight: '60px'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              width: '100%'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                Replace Existing Project
              </div>
              <div style={{ fontSize: '0.85em', opacity: 0.8, lineHeight: '1.3' }}>
                Delete the existing project and import this one
              </div>
            </div>
          </Button>

          <Button
            onClick={onCreateNew}
            variant="primary"
            style={{
              width: '100%',
              padding: SPACING.md,
              height: 'auto',
              minHeight: '60px'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              width: '100%'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                Create New Copy
              </div>
              <div style={{ fontSize: '0.85em', opacity: 0.8, lineHeight: '1.3' }}>
                Import as "{projectName} (2)" or similar
              </div>
            </div>
          </Button>

          <Button
            onClick={onCancel}
            variant="secondary"
            style={{
              width: '100%',
              padding: SPACING.md,
              height: 'auto',
              minHeight: '60px'
            }}
          >
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              textAlign: 'left',
              width: '100%'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                Cancel Import
              </div>
              <div style={{ fontSize: '0.85em', opacity: 0.8, lineHeight: '1.3' }}>
                Don't import this project
              </div>
            </div>
          </Button>
        </div>

        <div style={{
          fontSize: '0.85em',
          color: COLORS.secondary,
          textAlign: 'center',
          paddingTop: SPACING.sm,
          borderTop: `1px solid ${COLORS.border}`
        }}>
          This action cannot be undone. Please choose carefully.
        </div>
      </div>
    </Modal>
  )
}