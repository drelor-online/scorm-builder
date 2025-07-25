import React, { useState, useMemo } from 'react'
import type { SavedProject } from '../types/project'
import { Modal } from './DesignSystem/Modal'
import { Button } from './DesignSystem/Button'
import { Card } from './DesignSystem/Card'
import { Input } from './DesignSystem/Input'
import { Grid, Flex, Section } from './DesignSystem/Layout'
import { tokens } from './DesignSystem/designTokens'

interface OpenProjectDialogProps {
  isOpen: boolean
  projects: SavedProject[]
  onOpen: (projectId: string) => void | Promise<void>
  onDelete: (projectId: string, projectName: string) => void | Promise<void>
  onClose: () => void
  onNewProject: () => void
  onDuplicate?: (projectId: string, projectName: string) => void
}

export const OpenProjectDialog: React.FC<OpenProjectDialogProps> = ({
  isOpen,
  projects,
  onOpen,
  onDelete,
  onClose,
  onNewProject,
  onDuplicate
}) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    projectId: string
    projectName: string
  } | null>(null)
  const [loadingState, setLoadingState] = useState<{
    type: 'opening' | 'deleting' | null
    projectId?: string
  }>({ type: null })

  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return projects
    
    const query = searchQuery.toLowerCase()
    return projects.filter(project => 
      project.title.toLowerCase().includes(query) ||
      project.template.toLowerCase().includes(query)
    )
  }, [projects, searchQuery])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return ''
    const kb = bytes / 1024
    if (kb < 1024) return `${kb.toFixed(1)} KB`
    const mb = kb / 1024
    return `${mb.toFixed(1)} MB`
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Open Project"
      size="large"
      data-testid="open-project-dialog"
    >
      <Section>
        <Input
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          fullWidth
        />
      </Section>

      <div style={{ flex: 1, overflowY: 'auto', padding: tokens.spacing.md }}>
        {filteredProjects.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: tokens.spacing['3xl'] }}>
            {projects.length === 0 ? (
              <>
                <p style={{ 
                  fontSize: tokens.typography.fontSize.lg, 
                  marginBottom: tokens.spacing.sm,
                  color: tokens.colors.text.secondary
                }}>
                  No saved projects
                </p>
                <p style={{ 
                  marginBottom: tokens.spacing.xl,
                  color: tokens.colors.text.muted
                }}>
                  Create your first project to get started
                </p>
                <Button
                  variant="primary"
                  onClick={onNewProject}
                >
                  New Project
                </Button>
              </>
            ) : (
              <p style={{ color: tokens.colors.text.muted }}>
                No projects match your search
              </p>
            )}
            </div>
          </Card>
        ) : (
          <Grid cols={2} gap="large" className="grid">
            {filteredProjects.map(project => (
              <Card
                key={project.id}
                data-testid={`project-card-${project.id}`}
                className="project-card"
              >
                <div style={{ marginBottom: tokens.spacing.lg }}>
                  <h3 style={{
                    fontSize: tokens.typography.fontSize.lg,
                    fontWeight: tokens.typography.fontWeight.semibold,
                    color: tokens.colors.text.primary,
                    margin: `0 0 ${tokens.spacing.xs} 0`
                  }}>
                    {project.title}
                  </h3>
                  <Flex gap="small" align="center" style={{ fontSize: tokens.typography.fontSize.xs }}>
                    <span style={{
                      backgroundColor: tokens.colors.primary.main,
                      color: 'white',
                      padding: `${tokens.spacing.xs} ${tokens.spacing.sm}`,
                      borderRadius: tokens.borderRadius.sm
                    }}>
                      {project.template}
                    </span>
                    <span style={{ color: tokens.colors.text.muted }}>
                      {project.preview}
                    </span>
                  </Flex>
                </div>

                <div style={{
                  fontSize: tokens.typography.fontSize.xs,
                  color: tokens.colors.text.muted,
                  marginBottom: tokens.spacing.lg
                }}>
                  <div>Last modified: {formatDate(project.lastModified)}</div>
                  {project.size && <div>Size: {formatFileSize(project.size)}</div>}
                </div>

                <Flex gap="small" justify="end">
                  {onDuplicate && (
                    <Button
                      variant="secondary"
                      size="small"
                      onClick={() => onDuplicate(project.id, project.title)}
                    >
                      Duplicate
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => setDeleteConfirmation({
                      projectId: project.id,
                      projectName: project.title
                    })}
                    style={{
                      backgroundColor: 'transparent',
                      border: `1px solid ${tokens.colors.danger.main}`
                    }}
                    disabled={loadingState.type !== null}
                  >
                    Delete
                  </Button>
                  <Button
                    variant="primary"
                    size="small"
                    onClick={async () => {
                      setLoadingState({ type: 'opening', projectId: project.id })
                      
                      try {
                        const result = onOpen(project.id)
                        // Handle both sync and async onOpen
                        if (result instanceof Promise) {
                          await result
                        }
                      } finally {
                        setLoadingState({ type: null })
                      }
                    }}
                    disabled={loadingState.type !== null}
                  >
                    {loadingState.type === 'opening' && loadingState.projectId === project.id 
                      ? 'Opening...' 
                      : 'Open'}
                  </Button>
                </Flex>
              </Card>
            ))}
          </Grid>
        )}
      </div>

      <div style={{ 
        borderTop: `1px solid ${tokens.colors.border.default}`,
        padding: tokens.spacing.md
      }}>
        <Flex justify="space-between" align="center">
          <Button
            variant="primary"
            onClick={onNewProject}
            style={{
              backgroundColor: 'transparent',
              border: `1px solid ${tokens.colors.primary.main}`
            }}
            disabled={loadingState.type !== null}
          >
            New Project
          </Button>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={loadingState.type !== null}
          >
            Cancel
          </Button>
        </Flex>
      </div>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmation && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1100
        }}>
          <Card style={{
            maxWidth: '400px',
            margin: '1rem',
            padding: tokens.spacing.lg
          }}>
            <h3 style={{
              marginTop: 0,
              marginBottom: tokens.spacing.md,
              color: tokens.colors.text.primary
            }}>
              Delete Project
            </h3>
            <p style={{
              marginBottom: tokens.spacing.md,
              color: tokens.colors.text.secondary
            }}>
              Are you sure you want to delete "{deleteConfirmation.projectName}"?
            </p>
            <p style={{
              marginBottom: tokens.spacing.lg,
              color: tokens.colors.danger.main,
              fontSize: '0.875rem'
            }}>
              This action cannot be undone.
            </p>
            <Flex gap="small" justify="end">
              <Button
                variant="secondary"
                onClick={() => setDeleteConfirmation(null)}
                autoFocus
                disabled={loadingState.type !== null}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  setLoadingState({ type: 'deleting', projectId: deleteConfirmation.projectId })
                  
                  try {
                    const result = onDelete(deleteConfirmation.projectId, deleteConfirmation.projectName)
                    // Handle both sync and async onDelete
                    if (result instanceof Promise) {
                      await result
                    }
                  } finally {
                    setLoadingState({ type: null })
                    setDeleteConfirmation(null)
                  }
                }}
                disabled={loadingState.type !== null}
              >
                {loadingState.type === 'deleting' ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </Flex>
          </Card>
        </div>
      )}
    </Modal>
  )
}