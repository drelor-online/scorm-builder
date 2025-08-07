import { useState, useEffect } from 'react'
import { useStorage } from '../contexts/PersistentStorageContext'
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor'
import { Button } from './DesignSystem/Button'
import { Card } from './DesignSystem/Card'
import { Modal } from './DesignSystem/Modal'
import { LoadingSpinner } from './DesignSystem/LoadingSpinner'
import { Tooltip } from './DesignSystem/Tooltip'
import { Icon } from './DesignSystem/Icons'
import { formatDistanceToNow } from 'date-fns'
import { showError, showInfo, showSuccess } from './ErrorNotification'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { RefreshCw, FolderOpen, FileText, Palette, BarChart3, Package, Zap } from 'lucide-react'
import './DesignSystem/transitions.css'
import { envConfig } from '../config/environment'
import { debugLogger } from '@/utils/ultraSimpleLogger'

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

export function ProjectDashboard({ onProjectSelected }: ProjectDashboardProps) {
  const storage = useStorage()
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
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(new Set())
  const [runningAutomation, setRunningAutomation] = useState(false)
  const [showAutomationMenu, setShowAutomationMenu] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  
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
        showError('Please enter a project name')
        return
      }
      
      // Validate project name length
      if (trimmedName.length > 100) {
        showError('Project name must be 100 characters or less')
        return
      }
      
      // Validate project name characters (allow alphanumeric, spaces, hyphens, underscores)
      const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/
      if (!validNameRegex.test(trimmedName)) {
        showError('Project name can only contain letters, numbers, spaces, hyphens, and underscores')
        return
      }
      
      if (!storage.isInitialized) {
        debugLogger.error('ProjectDashboard.handleCreateProject', 'Storage not initialized')
        showError('Storage system not ready. Please refresh the page.')
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
        showError(`A project with the name "${duplicateProject.name}" already exists. Please choose a different name.`)
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
      showInfo('Project created successfully')
      
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
      showError(`Failed to create project: ${errorMessage}`, {
        label: 'Retry',
        onClick: () => handleCreateProject()
      })
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
      showError('Failed to open project', {
        label: 'Retry',
        onClick: () => handleOpenProject(projectIdOrPath, projectPath)
      })
    }
  }
  
  async function handleOpenFromFile() {
    try {
      debugLogger.info('ProjectDashboard.handleOpenFromFile', 'Opening project from file dialog')
      
      await storage.openProjectFromFile()
      const currentProjectId = storage.currentProjectId
      
      if (currentProjectId) {
        debugLogger.debug('ProjectDashboard.handleOpenFromFile', 'Project opened', {
          projectId: currentProjectId
        })
        onProjectSelected(currentProjectId)
      } else {
        debugLogger.warn('ProjectDashboard.handleOpenFromFile', 'No project ID after opening file')
      }
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleOpenFromFile', 'Failed to open project file', error)
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
      showError(`Failed to delete project: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
      
      // Load the zip file
      const response = await fetch(`file://${selected}`)
      const blob = await response.blob()
      
      // Import the project
      debugLogger.debug('ProjectDashboard.handleImportProject', 'Importing project from zip')
      await storage.importProjectFromZip(blob)
      
      // Reload projects list
      await loadProjects()
      
      // Navigate to the imported project
      const projectId = storage.getCurrentProjectId()
      if (projectId) {
        debugLogger.info('ProjectDashboard.handleImportProject', 'Project imported successfully', { projectId })
        showSuccess('Project imported successfully')
        onProjectSelected(projectId)
      } else {
        debugLogger.warn('ProjectDashboard.handleImportProject', 'No project ID after import')
      }
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleImportProject', 'Failed to import project', error)
      showError(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setImportingProject(false)
    }
  }

  async function handleExportProject(projectId: string) {
    try {
      setExportingProjectId(projectId)
      debugLogger.info('ProjectDashboard.handleExportProject', 'Exporting project', { projectId })
      
      // Open the project first
      await storage.openProject(projectId)
      
      // Export the project
      const zipBlob = await storage.exportProject()
      
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
      
      debugLogger.info('ProjectDashboard.handleExportProject', 'Project exported successfully', { projectId })
      showSuccess('Project exported successfully')
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleExportProject', 'Failed to export project', { projectId, error })
      showError(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setExportingProjectId(null)
    }
  }

  async function handleBulkExport() {
    if (selectedProjects.size === 0) {
      showError('Please select at least one project to export')
      return
    }
    
    debugLogger.info('ProjectDashboard.handleBulkExport', 'Starting bulk export', {
      projectCount: selectedProjects.size
    })
    
    try {
      for (const projectId of selectedProjects) {
        await handleExportProject(projectId)
      }
      
      setSelectionMode(false)
      setSelectedProjects(new Set())
      
      debugLogger.info('ProjectDashboard.handleBulkExport', 'Bulk export completed')
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleBulkExport', 'Failed to export projects', error)
      showError(`Failed to export projects: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  function toggleProjectSelection(projectId: string) {
    const newSelection = new Set(selectedProjects)
    if (newSelection.has(projectId)) {
      newSelection.delete(projectId)
    } else {
      newSelection.add(projectId)
    }
    setSelectedProjects(newSelection)
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
            showError('Unable to open project: Could not determine project ID')
          }
          return
        }
        showError(`Failed to open project: ${error.message || 'Unknown error'}`)
      }
    } else {
      showError('Please drop a .scormproj file')
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
        
        showSuccess(`Default folder set to: ${selected}`)
      }
    } catch (error) {
      console.error('Failed to change default folder:', error)
      showError(`Failed to change default folder: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  function handleClearDefaultFolder() {
    setDefaultFolder(null)
    localStorage.removeItem('defaultProjectsFolder')
    showInfo('Default folder cleared')
  }

  async function handleRunAutomation() {
    // Automation features have been removed
    showInfo('Automation features are currently disabled')
  }
  
  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <LoadingSpinner />
          <p>Loading projects...</p>
        </div>
      </div>
    )
  }
  
  if (importingProject) {
    return (
      <div className="dashboard-container">
        <div className="loading-state">
          <LoadingSpinner />
          <p>Importing project...</p>
        </div>
      </div>
    )
  }
  
  return (
    <div 
      className="dashboard-container"
      data-testid="project-drop-zone"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        minHeight: '100vh',
        border: isDragging ? '2px dashed #3b82f6' : 'none',
        backgroundColor: isDragging ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
        transition: 'all 0.2s'
      }}
    >
      <div className="dashboard-header">
        <h1>SCORM Builder Projects</h1>
        <div className="header-actions">
          <Tooltip content="Open a .scormproj file from your computer" position="bottom">
            <Button 
              variant="secondary"
              onClick={handleOpenFromFile}
            >
              Open Project File
            </Button>
          </Tooltip>
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
          
          {/* Manual Recording Button - Only show in development */}
          {envConfig.isDevelopment && (
            <Tooltip content={isRecording ? "Stop recording your actions" : "Record your manual testing session"} position="bottom">
              <Button
                onClick={() => {
                  // Recording features have been removed
                  showInfo('Recording features are currently disabled')
                }}
                variant={isRecording ? "danger" : "secondary"}
                data-testid="manual-recording-button"
              >
                {isRecording ? (
                  <>
                    <span style={{ color: '#ef4444', marginRight: '0.5rem' }}>●</span>
                    Stop Recording
                  </>
                ) : (
                  <>
                    <span style={{ marginRight: '0.5rem' }}>🎬</span>
                    Record Session
                  </>
                )}
              </Button>
            </Tooltip>
          )}
          <Tooltip content="Enable bulk export mode" position="bottom">
            <Button 
              variant="secondary"
              onClick={() => {
                setSelectionMode(!selectionMode)
                setSelectedProjects(new Set())
              }}
            >
              {selectionMode ? 'Cancel Selection' : 'Bulk Export'}
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
                  showInfo('Cache cleared successfully. Stuck projects should be removed.')
                } catch (error) {
                  console.error('Failed to clear cache:', error)
                  showError('Failed to clear cache')
                }
              }}
              style={{ padding: '0.5rem', minWidth: 'auto' }}
            >
              <Icon icon={RefreshCw} size="sm" className={loading ? 'animate-spin' : ''} />
            </Button>
          </Tooltip>
        </div>
      </div>
      
      <div className="default-folder-section" style={{ 
        marginTop: '2rem',
        marginBottom: '2rem',
        padding: '1rem',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span style={{ fontWeight: 500 }}>Default Folder:</span>
          <span style={{ 
            color: defaultFolder ? '#333' : '#999',
            fontStyle: defaultFolder ? 'normal' : 'italic'
          }}>
            {defaultFolder || 'Not set'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
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
      
      {recentProjects.length > 0 && (
        <div className="recent-section" style={{ marginBottom: '3rem' }}>
          <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>Recent Projects</h2>
          <div className="projects-grid recent-grid stagger-children" style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '1.5rem'
          }}>
            {recentProjects.map((project, index) => (
              <Card 
                key={`recent-${project.id}`}
                data-testid="recent-project-card"
                className="project-card recent-card animate-fadeInUp"
                style={{ animationDelay: `${index * 0.05}s` }}
                role="article"
                aria-label={`Project: ${project.name}`}
              >
                <div style={{ position: 'relative', padding: '1rem', overflow: 'hidden' }}>
                  <div style={{ 
                    position: 'absolute', 
                    top: '0.5rem', 
                    right: '0.5rem',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    Recent
                  </div>
                  <div className="project-info" style={{ marginBottom: '1rem', overflow: 'hidden' }}>
                    <h3 style={{ 
                      margin: '0 0 0.5rem 0',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>{project.name}</h3>
                    <p className="project-date" style={{ 
                      margin: 0, 
                      color: '#888',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      Last accessed {formatLastAccessed(project)}
                    </p>
                    <p className="project-date-full" style={{ 
                      margin: 0, 
                      color: '#666', 
                      fontSize: '0.875rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {formatProjectDate(project)}
                    </p>
                    {(project as any).path && (
                      <Tooltip content={(project as any).path} position="top">
                        <p className="project-path" style={{ 
                          margin: '0.25rem 0 0 0', 
                          color: '#999', 
                          fontSize: '0.75rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'help'
                        }}>
                          <Icon icon={FolderOpen} size="xs" /> {(project as any).path.split(/[\\\/]/).slice(-2).join('/')}
                        </p>
                      </Tooltip>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {selectionMode && (
                      <input
                        type="checkbox"
                        checked={selectedProjects.has(project.id)}
                        onChange={() => toggleProjectSelection(project.id)}
                        aria-label={`Select ${project.name}`}
                      />
                    )}
                    <Tooltip content="Open this project" position="top">
                      <Button
                        variant="primary"
                        size="small"
                        onClick={() => handleOpenProject(project.id, project.path)}
                        aria-label={`Open project ${project.name}`}
                      >
                        Open
                      </Button>
                    </Tooltip>
                    <Tooltip content="Export this project as ZIP" position="top">
                      <Button
                        variant="secondary"
                        size="small"
                        onClick={() => handleExportProject(project.id)}
                        disabled={exportingProjectId === project.id}
                        aria-label={`Export project ${project.name}`}
                      >
                        {exportingProjectId === project.id ? 'Exporting...' : 'Export'}
                      </Button>
                    </Tooltip>
                    <Tooltip content="Delete this project" position="top">
                      <Button
                        variant="danger"
                        size="small"
                        onClick={() => setDeleteConfirm({id: project.id, path: (project as any).path})}
                        aria-label={`Delete project ${project.name}`}
                      >
                        Delete
                      </Button>
                    </Tooltip>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
      
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
            Ready to create your first course? You can start from scratch or open an existing project.
          </p>
          <div className="empty-state-actions">
            <Button 
              variant="primary"
              size="large"
              onClick={() => setShowNewProjectDialog(true)}
            >
              Create Your First Project
            </Button>
            <Button 
              variant="secondary"
              size="large"
              onClick={handleOpenFromFile}
            >
              Open Existing Project
            </Button>
          </div>
        </div>
      ) : (
        <div className="main-projects-section">
          {projects.length > 0 && (
            <>
              <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>All Projects</h2>
              <div className="projects-grid stagger-children" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: '1.5rem'
              }}>
          {projects.map((project, index) => (
            <Card 
              key={project.id}
              data-testid="project-card"
              className="project-card animate-fadeInUp"
              style={{ animationDelay: `${index * 0.05}s` }}
              role="article"
              aria-label={`Project: ${project.name}`}
            >
              <div style={{ padding: '1rem', overflow: 'hidden' }}>
                <div className="project-info" style={{ marginBottom: '1rem' }}>
                  <h3 style={{ 
                    margin: '0 0 0.5rem 0',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>{project.name}</h3>
                  <p className="project-date" style={{ 
                    margin: 0, 
                    color: '#888',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    Last accessed {formatLastAccessed(project)}
                  </p>
                  <p className="project-date-full" style={{ 
                    margin: 0, 
                    color: '#666', 
                    fontSize: '0.875rem',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}>
                    {formatProjectDate(project)}
                  </p>
                  {(project as any).path && (
                    <Tooltip content={(project as any).path} position="top">
                      <p className="project-path" style={{ 
                        margin: '0.25rem 0 0 0', 
                        color: '#999', 
                        fontSize: '0.75rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        cursor: 'help'
                      }}>
                        <Icon icon={FolderOpen} size="xs" /> {(project as any).path.split(/[\\\/]/).slice(-2).join('/')}
                      </p>
                    </Tooltip>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {selectionMode && (
                    <input
                      type="checkbox"
                      checked={selectedProjects.has(project.id)}
                      onChange={() => toggleProjectSelection(project.id)}
                      aria-label={`Select ${project.name}`}
                    />
                  )}
                  <Button
                    variant="primary"
                    size="small"
                    onClick={() => handleOpenProject(project.id)}
                    aria-label={`Open project ${project.name}`}
                  >
                    Open
                  </Button>
                  <Button
                    variant="secondary"
                    size="small"
                    onClick={() => handleExportProject(project.id)}
                    disabled={exportingProjectId === project.id}
                    aria-label={`Export project ${project.name}`}
                  >
                    {exportingProjectId === project.id ? 'Exporting...' : 'Export'}
                  </Button>
                  <Button
                    variant="danger"
                    size="small"
                    onClick={() => setDeleteConfirm({id: project.id, path: (project as any).path})}
                    aria-label={`Delete project ${project.name}`}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </Card>
          ))}
              </div>
            </>
          )}
        </div>
      )}
      
      {selectionMode && selectedProjects.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          zIndex: 1000
        }}>
          <Button
            variant="primary"
            size="large"
            onClick={handleBulkExport}
            style={{
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              padding: '1rem 2rem'
            }}
          >
            Export Selected ({selectedProjects.size})
          </Button>
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
            type="text"
            placeholder="Enter project name"
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleCreateProject()}
            autoFocus
            aria-label="Project title"
            data-testid="project-name-input"
            style={{
              width: 'calc(100% - 2rem)',
              padding: '0.75rem',
              fontSize: '1rem',
              borderRadius: '0.375rem',
              border: '1px solid #27272a',
              backgroundColor: '#09090b',
              color: '#e4e4e7',
              marginBottom: '1rem'
            }}
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
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => setDeleteConfirm(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => deleteConfirm && handleDeleteProject(deleteConfirm.path || deleteConfirm.id)}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
      
      <style>{`
        .dashboard-container {
          padding: 2rem;
          max-width: 1200px;
          margin: 0 auto;
        }
        
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 4rem 2rem;
        }
        
        .loading-state p {
          margin: 0;
          color: #a1a1aa;
        }
        
        .dashboard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }
        
        .dashboard-header h1 {
          margin: 0;
          font-size: 2rem;
          color: #e4e4e7;
        }
        
        .header-actions {
          display: flex;
          gap: 1rem;
        }
        
        .empty-state {
          text-align: center;
          padding: 4rem 2rem;
          max-width: 600px;
          margin: 0 auto;
        }
        
        .empty-state-icon {
          margin-bottom: 2rem;
          color: #a1a1aa;
        }
        
        .empty-state-icon svg {
          width: 120px;
          height: 120px;
        }
        
        .empty-state h2 {
          font-size: 2rem;
          margin-bottom: 1rem;
          color: #e4e4e7;
          font-weight: 600;
        }
        
        .empty-state-description {
          margin-bottom: 2rem;
          color: #a1a1aa;
          font-size: 1.125rem;
          line-height: 1.75;
        }
        
        .empty-state-get-started {
          margin: 2rem 0 3rem 0;
          color: #d4d4d8;
          font-size: 1rem;
        }
        
        .empty-state-features {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          text-align: left;
          max-width: 400px;
          margin-left: auto;
          margin-right: auto;
        }
        
        .feature {
          display: flex;
          align-items: center;
          gap: 1rem;
          color: #d4d4d8;
          font-size: 1rem;
        }
        
        .feature-icon {
          font-size: 1.5rem;
          width: 2rem;
          text-align: center;
        }
        
        .empty-state-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        
        .projects-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }
        
        .project-card {
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
          position: relative;
          padding: 1.5rem;
        }
        
        .project-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }
        
        .project-info h3 {
          margin: 0 0 0.5rem 0;
          font-size: 1.25rem;
          color: #e4e4e7;
        }
        
        .project-date {
          margin: 0;
          font-size: 0.875rem;
          color: #a1a1aa;
        }
        
        .delete-button {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: none;
          border: none;
          font-size: 1.25rem;
          cursor: pointer;
          opacity: 0.6;
          transition: opacity 0.2s;
        }
        
        .delete-button:hover {
          opacity: 1;
        }
        
        .new-project-form input {
          width: 100%;
          padding: 0.75rem;
          font-size: 1rem;
          border: 1px solid #374151;
          border-radius: 4px;
          margin-bottom: 1.5rem;
          background-color: #1f2937;
          color: #e4e4e7;
        }
        
        .new-project-form input::placeholder {
          color: #6b7280;
        }
        
        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
        }
        
        .delete-confirm p {
          margin-bottom: 1.5rem;
          color: #d4d4d8;
        }
      `}</style>
    </div>
  )
}