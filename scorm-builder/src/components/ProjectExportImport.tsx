import React, { useState, useRef } from 'react'
import { Button, Alert, Modal, LoadingSpinner } from './DesignSystem'
import { exportProject, importProject, ProjectExportData, ImportResult } from '../services/ProjectExportImport'
import { COLORS, SPACING } from '../constants'

interface ProjectExportButtonProps {
  projectData: ProjectExportData
  onExport?: (result: { success: boolean; error?: string }) => void
  disabled?: boolean
  buttonText?: string
  className?: string
}

export const ProjectExportButton: React.FC<ProjectExportButtonProps> = ({
  projectData,
  onExport,
  disabled = false,
  buttonText = 'Export Project',
  className = ''
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleExport = async () => {
    setIsExporting(true)
    setError(null)

    try {
      const result = await exportProject(projectData)
      
      if (result.success && result.blob && result.filename) {
        // Create download link
        const url = URL.createObjectURL(result.blob)
        const link = document.createElement('a')
        link.href = url
        link.download = result.filename
        document.body.appendChild(link)
        link.click()
        link.remove()
        URL.revokeObjectURL(url)
        
        onExport?.({ success: true })
      } else {
        const errorMsg = result.error || 'Export failed'
        setError(errorMsg)
        onExport?.({ success: false, error: errorMsg })
      }
    } catch (err) {
      const errorMsg = 'An unexpected error occurred during export'
      setError(errorMsg)
      onExport?.({ success: false, error: errorMsg })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <>
      <Button
        onClick={handleExport}
        disabled={disabled || isExporting}
        className={className}
      >
        {isExporting ? (
          <>
            <LoadingSpinner size="small" />
            <span style={{ marginLeft: SPACING.xs }}>Exporting...</span>
          </>
        ) : (
          buttonText
        )}
      </Button>
      
      {error && (
        <Alert 
          variant="error"
        >
          {error}
        </Alert>
      )}
    </>
  )
}

interface ProjectImportButtonProps {
  onImport: (result: ImportResult | { success: false; error: string }) => void
  disabled?: boolean
  buttonText?: string
  showConfirmation?: boolean
  maxFileSize?: number
  className?: string
}

export const ProjectImportButton: React.FC<ProjectImportButtonProps> = ({
  onImport,
  disabled = false,
  buttonText = 'Import Project',
  showConfirmation = false,
  maxFileSize = 100 * 1024 * 1024, // 100MB default
  className = ''
}) => {
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFileDialog, setShowFileDialog] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleButtonClick = () => {
    setShowFileDialog(true)
    setError(null)
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.name.endsWith('.zip')) {
      setError('Please select a .zip file')
      setShowFileDialog(false)
      event.target.value = '' // Reset input
      return
    }

    // Check file size
    if (file.size > maxFileSize) {
      setError(`File is too large. Maximum size is ${Math.round(maxFileSize / 1024 / 1024)}MB`)
      setShowFileDialog(false)
      event.target.value = '' // Reset input
      return
    }

    setSelectedFile(file)
    
    if (showConfirmation) {
      setShowConfirmDialog(true)
    } else {
      await performImport(file)
    }
  }

  const performImport = async (file: File) => {
    setIsImporting(true)
    setError(null)
    setShowFileDialog(false)
    setShowConfirmDialog(false)

    try {
      const result = await importProject(file)
      onImport(result)
      
      if (!result.success) {
        setError(result.error || 'Import failed')
      }
    } catch (err) {
      const errorMsg = 'An unexpected error occurred during import'
      setError(errorMsg)
      onImport({ success: false, error: errorMsg })
    } finally {
      setIsImporting(false)
      setSelectedFile(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleConfirmImport = () => {
    if (selectedFile) {
      performImport(selectedFile)
    }
  }

  const handleCancelImport = () => {
    setShowConfirmDialog(false)
    setSelectedFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <>
      <Button
        onClick={handleButtonClick}
        disabled={disabled || isImporting}
        className={className}
      >
        {isImporting ? (
          <>
            <LoadingSpinner size="small" />
            <span style={{ marginLeft: SPACING.xs }}>Importing...</span>
          </>
        ) : (
          buttonText
        )}
      </Button>
      
      {error && (
        <Alert 
          variant="error"
        >
          {error}
        </Alert>
      )}
      
      {/* File selection dialog */}
      <Modal
        isOpen={showFileDialog}
        onClose={() => setShowFileDialog(false)}
        title="Import Project"
      >
        <div style={{ padding: SPACING.md }}>
          <label htmlFor="project-file-input" style={{ 
            display: 'block',
            marginBottom: SPACING.sm,
            color: COLORS.text
          }}>
            Select project file (.zip):
          </label>
          <input
            ref={fileInputRef}
            id="project-file-input"
            type="file"
            accept=".zip"
            onChange={handleFileSelect}
            aria-label="Select project file"
            style={{
              display: 'block',
              width: '100%',
              padding: SPACING.sm,
              border: `1px solid ${COLORS.border}`,
              borderRadius: '4px',
              backgroundColor: COLORS.background,
              color: COLORS.text
            }}
          />
          <div style={{ 
            marginTop: SPACING.md,
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <Button 
              variant="secondary" 
              onClick={() => setShowFileDialog(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
      
      {/* Confirmation dialog */}
      <Modal
        isOpen={showConfirmDialog}
        onClose={handleCancelImport}
        title="Confirm Import"
      >
        <div style={{ padding: SPACING.md }}>
          <p style={{ marginBottom: SPACING.md, color: COLORS.text }}>
            Are you sure you want to import this project? This will replace your current project data.
          </p>
          <div style={{ 
            display: 'flex', 
            gap: SPACING.sm,
            justifyContent: 'flex-end'
          }}>
            <Button variant="secondary" onClick={handleCancelImport}>
              Cancel
            </Button>
            <Button onClick={handleConfirmImport}>
              Continue
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}