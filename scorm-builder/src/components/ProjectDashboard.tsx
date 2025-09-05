import { useState, useEffect, useCallback, useRef } from 'react'
import { useStorage } from '../contexts/PersistentStorageContext'
import { useNotifications } from '../contexts/NotificationContext'
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor'
import { Button } from './DesignSystem/Button'
import { ButtonGroup } from './DesignSystem/ButtonGroup'
import { Card } from './DesignSystem/Card'
import { Modal } from './DesignSystem/Modal'
import { LoadingSpinner } from './DesignSystem/LoadingSpinner'
import { Tooltip } from './DesignSystem/Tooltip'
import { Icon } from './DesignSystem/Icons'
import { formatDistanceToNow } from 'date-fns'
// Removed notifyError, info, success - using NotificationContext instead
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { RefreshCw, FolderOpen, FileText, Palette, BarChart3, Package, Zap, Edit2, Check, X } from 'lucide-react'
import { ProjectsList } from './projects/ProjectsList'
import './DesignSystem/transitions.css'
import { envConfig } from '../config/environment'
import { debugLogger } from '@/utils/ultraSimpleLogger'
import styles from './ProjectDashboard.module.css'

interface Project {
  id: string
  name: string
  path?: string
  created: string
  lastAccessed?: string
  last_modified?: string
}

interface ProjectDashboardProps {
  onProjectSelected: (projectId: string) => void
  onSecretClick?: () => void // For beta feature activation
}

// Helper function to safely format dates
function formatLastAccessed(project: Project): string {
  const dateString = project.last_modified || project.lastAccessed || project.created
  if (!dateString) return 'Never'
  
  try {
    const date = new Date(dateString)
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'Never'
    }
    return formatDistanceToNow(date, { addSuffix: true })
  } catch (error) {
    debugLogger.warn('ProjectDashboard.formatLastAccessed', 'Error formatting date', { dateString, error })
    return 'Never'
  }
}

// Helper function to format date in long format (for display)
function formatProjectDate(project: Project): string {
  const dateString = project.last_modified || project.lastAccessed || project.created
  if (!dateString) return 'Never'
  
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) {
      return 'Never'
    }
    // Format as "January 15, 2024"
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  } catch (error) {
    return 'Never'
  }
}

// Enhanced filename validation for cross-platform compatibility
function validateProjectFilename(name: string): { isValid: boolean; errorMessage: string } {
  // Check for invalid characters that cause problems across different OS
  const invalidChars = /[<>:"\/\\|?*]/
  const invalidMatch = name.match(invalidChars)
  
  if (invalidMatch) {
    const invalidChar = invalidMatch[0]
    return {
      isValid: false,
      errorMessage: `Project name contains invalid character '${invalidChar}'. Cannot contain < > : " / \\ | ? *. Try using letters, numbers, spaces, hyphens, underscores, or parentheses instead.`
    }
  }
  
  // Check for reserved Windows filenames (case-insensitive)
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']
  if (reservedNames.includes(name.toUpperCase())) {
    return {
      isValid: false,
      errorMessage: `'${name}' is a reserved system name and cannot be used. Please choose a different name.`
    }
  }
  
  // Check for names ending with periods or spaces (problematic on Windows)
  if (name.endsWith('.') || name.endsWith(' ')) {
    return {
      isValid: false,
      errorMessage: `Project name cannot end with a period or space. Please remove trailing characters.`
    }
  }
  
  // Check length (most filesystems support 255 chars, but we're more conservative) 
  if (name.length > 100) {
    return {
      isValid: false,
      errorMessage: `Project name is too long (${name.length} characters). Please use 100 characters or less.`
    }
  }
  
  // All checks passed
  return { isValid: true, errorMessage: '' }
}

export function ProjectDashboard({ onProjectSelected, onSecretClick }: ProjectDashboardProps) {
  const storage = useStorage()
  const { success, error: notifyError, info } = useNotifications()
  const { measureAsync } = usePerformanceMonitor({
    componentName: 'ProjectDashboard',
    trackRenders: false
  })
  const [projects, setProjects] = useState<Project[]>([])
  const [recentProjects, setRecentProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{id: string, path?: string} | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [defaultFolder, setDefaultFolder] = useState<string | null>(null)
  const [importingProject, setImportingProject] = useState(false)
  const [exportingProjectId, setExportingProjectId] = useState<string | null>(null)
  const [runningAutomation, setRunningAutomation] = useState(false)
  const [showAutomationMenu, setShowAutomationMenu] = useState(false)
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)
  
  // Secret click functionality for beta features
  const [clickCount, setClickCount] = useState(0)
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  const handleSecretClick = useCallback(() => {
    if (!onSecretClick) return
    
    setClickCount(prev => {
      const newCount = prev + 1
      
      // Clear existing timeout
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current)
      }
      
      // Set new timeout - reset after 2 seconds of no clicks
      clickTimeoutRef.current = setTimeout(() => {
        setClickCount(0)
      }, 2000)
      
      // Trigger secret functionality after 5 clicks
      if (newCount >= 5) {
        onSecretClick()
        setClickCount(0) // Reset counter
        if (clickTimeoutRef.current) {
          clearTimeout(clickTimeoutRef.current)
        }
      }
      
      return newCount
    })
  }, [onSecretClick])
  
  useEffect(() => {
    if (storage.isInitialized) {
      debugLogger.info('ProjectDashboard', 'Storage initialized, loading projects')
      loadProjects()
    } else {
      debugLogger.warn('ProjectDashboard', 'Storage not initialized yet')
    }
  }, [storage.isInitialized])
  
  useEffect(() => {
    // Load default folder from backend settings
    async function loadDefaultFolder() {
      try {
        // First try to get from backend
        const settings = await invoke<any>('get_app_settings')
        if (settings?.projects_directory) {
          debugLogger.debug('ProjectDashboard.loadDefaultFolder', 'Loaded default folder from backend', {
            folder: settings.projects_directory
          })
          setDefaultFolder(settings.projects_directory)
          localStorage.setItem('defaultProjectsFolder', settings.projects_directory)
        } else {
          // Fall back to localStorage
          const savedFolder = localStorage.getItem('defaultProjectsFolder')
          debugLogger.debug('ProjectDashboard.loadDefaultFolder', 'Using localStorage folder', {
            folder: savedFolder
          })
          setDefaultFolder(savedFolder)
        }
      } catch (error) {
        debugLogger.error('ProjectDashboard.loadDefaultFolder', 'Failed to load default folder', error)
        // Fall back to localStorage
        const savedFolder = localStorage.getItem('defaultProjectsFolder')
        setDefaultFolder(savedFolder)
      }
    }
    loadDefaultFolder()
  }, [])
  
  async function loadProjects() {
    if (!storage.isInitialized) {
      debugLogger.warn('ProjectDashboard.loadProjects', 'Storage not initialized, skipping load')
      return
    }
    
    try {
      setLoading(true)
      debugLogger.info('ProjectDashboard.loadProjects', 'Starting to load projects')
      
      await measureAsync('loadProjects', async () => {
        const projectList = await storage.listProjects()
        const recentList = await storage.getRecentProjects()
        
        debugLogger.debug('ProjectDashboard.loadProjects', 'Projects retrieved', {
          totalProjects: projectList.length,
          recentProjects: recentList.length
        })
        
        // Validate project data before setting
        const validProjects = projectList.filter(project => {
          if (!project || !project.id || !project.name) {
            debugLogger.warn('ProjectDashboard.loadProjects', 'Invalid project data', project)
            return false
          }
          return true
        })
        
        debugLogger.debug('ProjectDashboard.loadProjects', 'Validated projects', {
          validCount: validProjects.length,
          invalidCount: projectList.length - validProjects.length
        })
      
        // Separate recent projects from the main list
        const recentIds = recentList.map((p: any) => p.id)
        const mainProjects = validProjects.filter(p => !recentIds.includes(p.id))
        const validRecentProjects = recentList.filter((project: any) => {
          if (!project || !project.id || !project.name) {
            debugLogger.warn('ProjectDashboard.loadProjects', 'Invalid recent project data', project)
            return false
          }
          return true
        }).slice(0, 5) // Show only top 5 recent projects
        
        debugLogger.info('ProjectDashboard.loadProjects', 'Projects loaded successfully', {
          mainProjects: mainProjects.length,
          recentProjects: validRecentProjects.length,
          projectNames: validProjects.map(p => p.name)
        })
        
        setProjects(mainProjects)
        setRecentProjects(validRecentProjects)
      })
    } catch (error) {
      debugLogger.error('ProjectDashboard.loadProjects', 'Failed to load projects', error)
      setProjects([]) // Set empty array on error
      setRecentProjects([])
    } finally {
      setLoading(false)
      debugLogger.debug('ProjectDashboard.loadProjects', 'Load complete')
    }
  }
  
  async function handleCreateProject() {
    try {
      debugLogger.info('ProjectDashboard.handleCreateProject', 'Creating new project', {
        projectName: newProjectName,
        storageInitialized: storage.isInitialized,
        defaultFolder
      })
      
      // Trim whitespace from project name
      const trimmedName = newProjectName.trim()
      
      if (!trimmedName) {
        notifyError('Please enter a project name')
        return
      }
      
      // Enhanced filename validation for cross-platform compatibility
      const validationResult = validateProjectFilename(trimmedName)
      if (!validationResult.isValid) {
        notifyError(validationResult.errorMessage)
        return
      }
      
      if (!storage.isInitialized) {
        debugLogger.error('ProjectDashboard.handleCreateProject', 'Storage not initialized')
        notifyError('Storage system not ready. Please refresh the page.')
        return
      }
      
      // Check for duplicate project names (case-insensitive)
      debugLogger.debug('ProjectDashboard.handleCreateProject', 'Checking for duplicate names', {
        existingCount: projects.length + recentProjects.length
      })
      
      const allProjects = [...projects, ...recentProjects]
      const normalizedNewName = trimmedName.toLowerCase()
      const duplicateProject = allProjects.find(p => 
        p.name.toLowerCase() === normalizedNewName
      )
      
      if (duplicateProject) {
        notifyError(`A project with the name "${duplicateProject.name}" already exists. Please choose a different name.`)
        return
      }
      
      debugLogger.debug('ProjectDashboard.handleCreateProject', 'Calling storage.createProject')
      const project = await storage.createProject(trimmedName, defaultFolder || undefined)
      
      debugLogger.info('ProjectDashboard.handleCreateProject', 'Project created successfully', {
        projectId: project.id,
        projectName: project.name,
        projectPath: project.path
      })
      
      // Don't open the project here - let the parent handle it
      setShowNewProjectDialog(false)
      setNewProjectName('')
      info('Project created successfully')
      
      debugLogger.info('ProjectDashboard.handleCreateProject', 'Calling onProjectSelected', {
        path: project.path,
        projectId: project.id,
        projectName: project.name
      })
      onProjectSelected(project.path)
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleCreateProject', 'Failed to create project', error)
      
      const errorMessage = error instanceof Error ? error.message : String(error)
      
      // Don't show error if user cancelled
      if (errorMessage.includes('cancelled')) {
        setShowNewProjectDialog(false)
        setNewProjectName('')
        return
      }
      
      // Show error to user
      notifyError(`Failed to create project: ${errorMessage}`)
    }
  }
  
  async function handleOpenProject(projectIdOrPath: string, projectPath?: string) {
    try {
      // Use path if available, otherwise use ID (for backward compatibility)
      const pathToOpen = projectPath || projectIdOrPath;
      
      debugLogger.info('ProjectDashboard.handleOpenProject', 'Opening project', {
        idOrPath: projectIdOrPath,
        path: projectPath,
        pathToOpen
      })
      
      onProjectSelected(pathToOpen)
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleOpenProject', 'Failed to open project', error)
      notifyError('Failed to open project')
    }
  }
  
  
  async function handleDeleteProject(projectId: string) {
    try {
      debugLogger.info('ProjectDashboard.handleDeleteProject', 'Deleting project', { projectId })
      
      await storage.deleteProject(projectId)
      await loadProjects()
      setDeleteConfirm(null)
      
      debugLogger.info('ProjectDashboard.handleDeleteProject', 'Project deleted successfully', { projectId })
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleDeleteProject', 'Failed to delete project', { projectId, error })
      notifyError(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async function handleStartRename(projectId: string, currentName: string) {
    setRenamingProjectId(projectId)
    setRenameValue(currentName)
    setRenameError(null)
  }

  async function handleCancelRename() {
    setRenamingProjectId(null)
    setRenameValue('')
    setRenameError(null)
  }

  async function handleSaveRename(projectPath: string) {
    const trimmedName = renameValue.trim()
    
    if (!trimmedName) {
      setRenameError('Project name cannot be empty')
      return
    }
    
    if (trimmedName.length > 100) {
      setRenameError('Project name is too long (max 100 characters)')
      return
    }
    
    try {
      debugLogger.info('ProjectDashboard.handleSaveRename', 'Renaming project', { 
        projectPath, 
        newName: trimmedName 
      })
      
      await storage.renameProject(projectPath, trimmedName)
      await loadProjects()
      
      setRenamingProjectId(null)
      setRenameValue('')
      setRenameError(null)
      
      success('Project renamed successfully')
      debugLogger.info('ProjectDashboard.handleSaveRename', 'Project renamed successfully')
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleSaveRename', 'Failed to rename project', error)
      setRenameError(error instanceof Error ? error.message : 'Failed to rename project')
    }
  }

  function handleRenameKeyDown(e: React.KeyboardEvent, projectPath: string) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSaveRename(projectPath)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      handleCancelRename()
    }
  }

  async function handleImportProject() {
    try {
      setImportingProject(true)
      debugLogger.info('ProjectDashboard.handleImportProject', 'Starting project import')
      
      // Open file dialog for zip files
      const selected = await open({
        filters: [{
          name: 'ZIP Files',
          extensions: ['zip']
        }],
        multiple: false
      })
      
      if (!selected || typeof selected !== 'string') {
        debugLogger.debug('ProjectDashboard.handleImportProject', 'Import cancelled by user')
        return
      }
      
      debugLogger.debug('ProjectDashboard.handleImportProject', 'File selected for import', {
        path: selected
      })
      
      // Load the zip file using Tauri's file system API
      const { readFile } = await import('@tauri-apps/plugin-fs')
      const fileData = await readFile(selected)
      // Convert Uint8Array to Blob - fileData is already a Uint8Array which is a valid BlobPart
      const blob = new Blob([new Uint8Array(fileData)], { type: 'application/zip' })
      
      // Import the project
      debugLogger.debug('ProjectDashboard.handleImportProject', 'Importing project from zip')
      await storage.importProjectFromZip(blob)
      
      // Reload projects list
      await loadProjects()
      
      // Navigate to the imported project
      const projectId = storage.getCurrentProjectId()
      if (projectId) {
        debugLogger.info('ProjectDashboard.handleImportProject', 'Project imported successfully', { projectId })
        success('Project imported successfully')
        onProjectSelected(projectId)
      } else {
        debugLogger.warn('ProjectDashboard.handleImportProject', 'No project ID after import')
      }
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleImportProject', 'Failed to import project', error)
      notifyError(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setImportingProject(false)
    }
  }

  async function handleExportProject(projectId: string, projectPath?: string) {
    try {
      setExportingProjectId(projectId)
      debugLogger.info('ProjectDashboard.handleExportProject', 'Exporting project', { projectId, projectPath })
      
      // Export directly using the project path and ID without opening/navigating
      // This prevents unwanted navigation away from the dashboard
      const effectivePath = projectPath || projectId
      
      // Call the create_project_zip command directly
      const { invoke } = await import('@tauri-apps/api/core')
      const zipResult = await invoke<any>('create_project_zip', {
        projectPath: effectivePath,
        projectId: projectId,
        includeMedia: true
      })
      
      // Create blob from the ZIP data
      const zipBlob = new Blob([new Uint8Array(zipResult.zipData)], { type: 'application/zip' })
      
      // Find project name
      const allProjects = [...projects, ...recentProjects]
      const project = allProjects.find(p => p.id === projectId)
      const projectName = project?.name || 'project'
      
      debugLogger.debug('ProjectDashboard.handleExportProject', 'Exporting as zip', {
        projectName,
        blobSize: zipBlob.size
      })
      
      // Download the zip file
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${projectName}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      debugLogger.info('ProjectDashboard.handleExportProject', 'Project exported successfully', { 
        projectId,
        fileCount: zipResult.fileCount,
        totalSize: zipResult.totalSize,
        zipSize: zipBlob.size
      })
      success('Project exported successfully')
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleExportProject', 'Failed to export project', { projectId, error })
      notifyError(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExportingProjectId(null)
    }
  }


  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    const scormProjFile = files.find(file => file.name.endsWith('.scormproj'))

    if (scormProjFile) {
      try {
        // In Tauri, we get the file path from the drop event
        // Check if webkitRelativePath or path is available
        const filePath = (scormProjFile as any).path || (scormProjFile as any).webkitRelativePath || scormProjFile.name
        
        // Open the project using the storage API
        await storage.openProjectFromPath(filePath)
        
        // Navigate to the project
        if (storage.currentProjectId) {
          onProjectSelected(storage.currentProjectId)
        }
      } catch (error: any) {
        if (error.message === 'UNSAVED_CHANGES') {
          // The project has unsaved changes, need to show the dialog
          // Get the project ID from the file path to open after confirmation
          try {
            // Try to extract project ID from the filename
            const filePath = (scormProjFile as any).path || (scormProjFile as any).webkitRelativePath || scormProjFile.name
            const filename = filePath.split(/[\\\/]/).pop()
            const projectName = filename?.replace('.scormproj', '')
            // Find the project by name to get its ID
            const allProjects = [...projects, ...recentProjects]
            const project = allProjects.find(p => p.name === projectName)
            if (project && project.path) {
              onProjectSelected(project.path)
            } else {
              // If we have the file path, use it directly
              onProjectSelected(filePath)
            }
          } catch (innerError) {
            notifyError('Unable to open project: Could not determine project ID')
          }
          return
        }
        notifyError(`Failed to open project: ${error.message || 'Unknown error'}`)
      }
    } else {
      notifyError('Please drop a .scormproj file')
    }
  }

  async function handleChangeDefaultFolder() {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Default Projects Folder'
      })
      
      if (selected && typeof selected === 'string') {
        // Update the backend settings
        await storage.setProjectsDirectory(selected)
        
        // Update local state
        setDefaultFolder(selected)
        
        // Store in localStorage for quick access
        localStorage.setItem('defaultProjectsFolder', selected)
        
        // Reload projects from the new directory
        await loadProjects()
        
        success(`Default folder set to: ${selected}`)
      }
    } catch (error) {
      console.error('Failed to change default folder:', error)
      notifyError(`Failed to change default folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  function handleClearDefaultFolder() {
    setDefaultFolder(null)
    localStorage.removeItem('defaultProjectsFolder')
    info('Default folder cleared')
  }

  async function handleRunAutomation() {
    // Automation features have been removed
    // UI should handle this by hiding the automation button
  }
  
  if (loading) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.loadingState}>
          <LoadingSpinner />
          <p>Loading projects...</p>
        </div>
      </div>
    )
  }
  
  if (importingProject) {
    return (
      <div className={styles.dashboardContainer}>
        <div className={styles.loadingState}>
          <LoadingSpinner />
          <p>Importing project...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className={`${styles.dashboardContainer} ${isDragging ? styles.dropZoneActive : ''}`}
      data-testid="project-drop-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={styles.dashboardHeader}>
        <h1 
          className={styles.headerTitle}
          onClick={handleSecretClick}
          style={{ cursor: onSecretClick ? 'pointer' : 'default' }}
          title={onSecretClick ? `Click ${5 - clickCount} more times to activate beta features` : undefined}
        >
          SCORM Builder Projects
        </h1>
        <div className={styles.folderInfo}>
          <span className={styles.folderLabel}>Default Folder:</span>
          <span 
            className={defaultFolder ? styles.folderPath : styles.folderPathEmpty}
            title={defaultFolder || 'Not set'}
          >
            {defaultFolder || 'Not set'}
          </span>
          <div className={styles.folderActions}>
            <Button
              variant="secondary"
              size="small"
              onClick={handleChangeDefaultFolder}
            >
              Change Folder
            </Button>
            {defaultFolder && (
              <Button
                variant="secondary"
                size="small"
                onClick={handleClearDefaultFolder}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Tooltip content="Import a project from a ZIP file" position="bottom">
            <Button 
              variant="secondary"
              onClick={handleImportProject}
              disabled={importingProject}
            >
              {importingProject ? 'Importing...' : 'Import Project'}
            </Button>
          </Tooltip>
          <Tooltip content="Start a new SCORM course project" position="bottom">
            <Button 
              variant="primary"
              onClick={() => setShowNewProjectDialog(true)}
              data-testid="new-project-button"
            >
              Create New Project
            </Button>
          </Tooltip>
          <Tooltip content="Clear cache to fix stuck or problematic projects" position="bottom">
            <Button 
              variant="secondary"
              size="small"
              onClick={async () => {
                try {
                  await storage.clearRecentFilesCache()
                  await loadProjects()
                  info('Cache cleared successfully. Stuck projects should be removed.')
                } catch (error) {
                  console.error('Failed to clear cache:', error)
                  notifyError('Failed to clear cache')
                }
              }}
              className={styles.sessionButton}
              aria-label="Clear cache to fix stuck projects"
              title="Clear cache to fix stuck or problematic projects"
            >
              <Icon icon={RefreshCw} size="sm" className={loading ? 'animate-spin' : ''} />
            </Button>
          </Tooltip>
        </div>
      </div>
      
      
      {projects.length === 0 && recentProjects.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 4.5v15m7.5-7.5h-15" />
              <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
            </svg>
          </div>
          <h2>Welcome to SCORM Builder</h2>
          <p className="empty-state-description">
            Create professional e-learning courses that work with any Learning Management System (LMS).
          </p>
          <div className="empty-state-features">
            <div className="feature">
              <span className="feature-icon"><Icon icon={FileText} size="lg" /></span>
              <span>Build interactive courses with AI assistance</span>
            </div>
            <div className="feature">
              <span className="feature-icon"><Icon icon={Palette} size="lg" /></span>
              <span>Add images, videos, and narration to engage learners</span>
            </div>
            <div className="feature">
              <span className="feature-icon"><Icon icon={BarChart3} size="lg" /></span>
              <span>Create assessments with automatic scoring</span>
            </div>
            <div className="feature">
              <span className="feature-icon"><Icon icon={Package} size="lg" /></span>
              <span>Export SCORM packages ready for any LMS</span>
            </div>
          </div>
          <p className="empty-state-get-started">
            Ready to create your first course? The app automatically scans your working folder for existing projects. 
            If you don't see your existing projects listed, check that the working folder is set correctly above.
          </p>
          <div className="empty-state-actions">
            <Button 
              variant="primary"
              size="large"
              onClick={() => setShowNewProjectDialog(true)}
            >
              Create Your First Project
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.mainContent}>
          <ProjectsList
            projects={[...recentProjects, ...projects]}
            onOpen={(projectId, projectPath) => handleOpenProject(projectId, projectPath)}
            onExport={(projectId) => {
              const project = [...recentProjects, ...projects].find(p => p.id === projectId)
              if (project) {
                handleExportProject(projectId, (project as any).path)
              }
            }}
            onDelete={(projectId) => {
              const project = [...recentProjects, ...projects].find(p => p.id === projectId)
              if (project) {
                setDeleteConfirm({id: projectId, path: (project as any).path})
              }
            }}
            onRename={(projectId, currentName) => handleStartRename(projectId, currentName)}
            onOpenFolder={(projectId) => {
              const project = [...recentProjects, ...projects].find(p => p.id === projectId)
              if (project && (project as any).path) {
                invoke('open_folder', { path: (project as any).path })
                  .catch((error) => console.error('Failed to open folder:', error))
              }
            }}
            className="h-full"
          />
        </div>
      )}
      
      <Modal
        isOpen={showNewProjectDialog}
        onClose={() => {
          setShowNewProjectDialog(false)
          setNewProjectName('')
        }}
        title="Create New Project"
      >
        <div className="new-project-form">
          <input
            ref={(input) => {
              if (input && showNewProjectDialog) {
                // Focus the input after the modal animation completes
                setTimeout(() => input.focus(), 100);
              }
            }}
            type="text"
            placeholder="Enter project name (Press Enter to create)"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
            autoFocus
            aria-label="Project title"
            data-testid="project-name-input"
            className={styles.projectNameInput}
          />
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setShowNewProjectDialog(false)
                setNewProjectName('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                console.log('[ProjectDashboard] Create button clicked!')
                handleCreateProject()
              }}
              disabled={!newProjectName.trim()}
              data-testid="create-project-confirm"
            >
              Create
            </Button>
          </div>
        </div>
      </Modal>
      
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Project"
      >
        <div className="delete-confirm">
          <p>Are you sure you want to delete this project? This action cannot be undone.</p>
          <ButtonGroup gap="medium" justify="end">
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirm(null)}
              data-testid="delete-cancel-button"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && handleDeleteProject(deleteConfirm.path || deleteConfirm.id)}
              data-testid="delete-confirm-button"
            >
              Delete
            </Button>
          </ButtonGroup>
        </div>
      </Modal>
    </div>
  )
}