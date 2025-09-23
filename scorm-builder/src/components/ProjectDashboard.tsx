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
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { RefreshCw, FolderOpen, FileText, Palette, BarChart3, Package, Zap, Edit2, Check, X } from 'lucide-react'
import ProjectsList from './projects/ProjectsList'
import { ProjectRow } from './projects/types'
import './DesignSystem/transitions.css'
import { envConfig } from '../config/environment'
import { ExportProgressDialog, type ExportProgressState } from './ExportProgressDialog'
// Import removed: now using Rust-only import flow
import { ProjectImportConflictDialog } from './ProjectImportConflictDialog'
import { debugLogger } from '@/utils/ultraSimpleLogger'
import styles from './ProjectDashboard.module.css'
import JSZip from 'jszip'

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
  const [exportProgress, setExportProgress] = useState<ExportProgressState>({
    phase: 'preparing',
    progress: 0,
    filesProcessed: 0,
    totalFiles: 0,
    message: '',
    canCancel: true
  })
  const [showExportProgress, setShowExportProgress] = useState(false)
  const [exportProgressListener, setExportProgressListener] = useState<UnlistenFn | null>(null)
  const [exportCancelled, setExportCancelled] = useState(false)
  const [runningAutomation, setRunningAutomation] = useState(false)
  const [showAutomationMenu, setShowAutomationMenu] = useState(false)
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  // Import conflict dialog state (disabled for now - using Rust-only import)
  const [showConflictDialog, setShowConflictDialog] = useState(false)
  const [conflictResult, setConflictResult] = useState<any | null>(null)
  const [selectedFile, setSelectedFile] = useState<Uint8Array | null>(null)

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

  // Cleanup event listener on unmount
  useEffect(() => {
    return () => {
      if (exportProgressListener && typeof exportProgressListener === 'function') {
        exportProgressListener()
      }
    }
  }, [exportProgressListener])

  async function loadProjects() {
    if (!storage.isInitialized) {
      debugLogger.warn('ProjectDashboard.loadProjects', 'Storage not initialized, skipping load')
      console.warn('[ProjectDashboard] ⚠️ Storage not initialized, cannot load projects')
      return
    }

    try {
      setLoading(true)
      debugLogger.info('ProjectDashboard.loadProjects', 'Starting to load projects')
      console.log('[ProjectDashboard] 🔍 Starting to load projects...')

      await measureAsync('loadProjects', async () => {
        console.log('[ProjectDashboard] 📡 Calling storage.listProjects()...')
        const projectList = await storage.listProjects()
        console.log('[ProjectDashboard] 📡 Calling storage.getRecentProjects()...')
        const recentList = await storage.getRecentProjects()

        console.log('[ProjectDashboard] 📊 Raw backend response:', {
          projectListType: typeof projectList,
          projectListLength: Array.isArray(projectList) ? projectList.length : 'not an array',
          projectListSample: Array.isArray(projectList) && projectList.length > 0 ? projectList[0] : null,
          recentListType: typeof recentList,
          recentListLength: Array.isArray(recentList) ? recentList.length : 'not an array'
        })

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

        console.log('[ProjectDashboard] ✅ Final project counts:', {
          mainProjects: mainProjects.length,
          recentProjects: validRecentProjects.length,
          totalValidProjects: validProjects.length,
          mainProjectNames: mainProjects.map(p => p.name),
          recentProjectNames: validRecentProjects.map(p => p.name)
        })

        setProjects(mainProjects)
        setRecentProjects(validRecentProjects)
      })
    } catch (error) {
      debugLogger.error('ProjectDashboard.loadProjects', 'Failed to load projects', error)
      console.error('[ProjectDashboard] ❌ Error loading projects:', error)
      setProjects([]) // Set empty array on error
      setRecentProjects([])
    } finally {
      setLoading(false)
      debugLogger.debug('ProjectDashboard.loadProjects', 'Load complete')
      console.log('[ProjectDashboard] 🏁 Load complete')
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

  // State for import cancellation
  const [importAbortController, setImportAbortController] = useState<AbortController | null>(null)

  async function handleImportProject() {
    // Create abort controller for this import operation
    const abortController = new AbortController()
    setImportAbortController(abortController)

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

      // Check if import was cancelled
      if (abortController.signal.aborted) {
        debugLogger.debug('ProjectDashboard.handleImportProject', 'Import aborted during file selection')
        return
      }

      // Load the zip file using Tauri's file system API
      const { readFile } = await import('@tauri-apps/plugin-fs')

      debugLogger.debug('ProjectDashboard.handleImportProject', 'Reading ZIP file from disk')
      const fileData = await readFile(selected)

      // Check file size (limit to 500MB)
      const fileSizeBytes = fileData.length
      const fileSizeMB = fileSizeBytes / (1024 * 1024)
      debugLogger.debug('ProjectDashboard.handleImportProject', 'ZIP file size', { fileSizeMB: fileSizeMB.toFixed(2) })

      if (fileSizeMB > 500) {
        throw new Error(`File too large: ${fileSizeMB.toFixed(1)}MB. Maximum size is 500MB.`)
      }

      // Check if import was cancelled
      if (abortController.signal.aborted) {
        debugLogger.debug('ProjectDashboard.handleImportProject', 'Import aborted during file read')
        return
      }

      // Convert Uint8Array to Blob for Rust backend
      const blob = new Blob([new Uint8Array(fileData)], { type: 'application/zip' })

      // Extract filename for logging
      const fileName = selected.split(/[\\/]/).pop() || 'project.zip'

      // STEP 1: Check for duplicates by reading project name from ZIP
      debugLogger.debug('ProjectDashboard.handleImportProject', 'Checking for duplicate projects')

      // Read the ZIP to extract project name with timeout
      const zip = new JSZip()

      debugLogger.debug('ProjectDashboard.handleImportProject', 'Loading ZIP file into JSZip')

      // Add timeout for ZIP loading (30 seconds)
      const zipLoadPromise = zip.loadAsync(blob)
      const timeoutPromise = new Promise<never>((_, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('ZIP file loading timed out after 30 seconds. The file may be corrupted or too large.'))
        }, 30000)

        // Clear timeout if aborted
        abortController.signal.addEventListener('abort', () => {
          clearTimeout(timeoutId)
          reject(new Error('Import cancelled by user'))
        })
      })

      await Promise.race([zipLoadPromise, timeoutPromise])

      debugLogger.debug('ProjectDashboard.handleImportProject', 'ZIP file loaded successfully')

      // Check if import was cancelled
      if (abortController.signal.aborted) {
        debugLogger.debug('ProjectDashboard.handleImportProject', 'Import aborted during ZIP loading')
        return
      }

      let projectName: string | null = null

      // Try to find a .scormproj file in the ZIP (new format)
      for (const [fileName, zipEntry] of Object.entries(zip.files)) {
        if (fileName.endsWith('.scormproj') && !zipEntry.dir) {
          try {
            const projectData = await zipEntry.async('string')
            const parsed = JSON.parse(projectData)
            projectName = parsed.project?.name || parsed.course_data?.title
            debugLogger.debug('ProjectDashboard.handleImportProject', 'Found project name from .scormproj', { projectName })
            break
          } catch (error) {
            debugLogger.warn('ProjectDashboard.handleImportProject', 'Failed to parse .scormproj file', { fileName, error })
          }
        }
      }

      // Fallback: Try to read from manifest.json (old format)
      if (!projectName && zip.files['manifest.json']) {
        try {
          const manifestContent = await zip.files['manifest.json'].async('string')
          const manifest = JSON.parse(manifestContent)
          projectName = manifest.projectName
          debugLogger.debug('ProjectDashboard.handleImportProject', 'Found project name from manifest.json', { projectName })
        } catch (error) {
          debugLogger.warn('ProjectDashboard.handleImportProject', 'Failed to parse manifest.json', { error })
        }
      }

      if (!projectName) {
        debugLogger.warn('ProjectDashboard.handleImportProject', 'Could not determine project name, using filename')
        projectName = fileName.replace(/\.zip$/i, '')
      }

      // STEP 2: Check if project with this name already exists
      const allProjects = [...projects, ...recentProjects]
      const existingProject = allProjects.find(p =>
        p.name.toLowerCase().trim() === projectName!.toLowerCase().trim()
      )

      if (existingProject) {
        debugLogger.info('ProjectDashboard.handleImportProject', 'Duplicate project detected', {
          projectName,
          existingId: existingProject.id,
          existingPath: existingProject.path
        })

        // Show conflict dialog
        setSelectedFile(new Uint8Array(fileData))
        setConflictResult({
          data: {
            metadata: {
              projectName: projectName
            }
          },
          existingProjectId: existingProject.id,
          existingProjectPath: existingProject.path || ''
        })
        setShowConflictDialog(true)
        setImportingProject(false) // Reset loading state while dialog is shown
        return
      }

      // STEP 3: No conflict, proceed with import
      debugLogger.debug('ProjectDashboard.handleImportProject', 'No duplicate found, proceeding with import')
      await performImport(blob, fileName)

    } catch (error) {
      debugLogger.error('ProjectDashboard.handleImportProject', 'Failed to import project', error)

      // Don't show error if import was cancelled
      if (!abortController.signal.aborted) {
        notifyError(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      setImportingProject(false)
      setImportAbortController(null)
    }
  }

  // Helper function to perform the actual import
  async function performImport(blob: Blob, fileName: string) {
    try {
      debugLogger.debug('ProjectDashboard.performImport', 'Importing project using Rust backend')

      // Check if import was cancelled before starting Rust operation
      if (importAbortController?.signal.aborted) {
        debugLogger.debug('ProjectDashboard.performImport', 'Import aborted before Rust operation')
        return
      }

      // Use Rust extract_project_zip function directly via storage
      await storage.importProjectFromZip(blob)

      // Check if import was cancelled after Rust operation
      if (importAbortController?.signal.aborted) {
        debugLogger.debug('ProjectDashboard.performImport', 'Import aborted after Rust operation')
        return
      }

      // Reload projects list to show the imported project
      await loadProjects()

      // Navigate to the imported project - the Rust function should set the current project
      const projectId = storage.getCurrentProjectId()
      if (projectId) {
        debugLogger.info('ProjectDashboard.performImport', 'Project imported successfully', {
          projectId,
          fileName
        })
        success('Project imported successfully')
        onProjectSelected(projectId)
      } else {
        debugLogger.warn('ProjectDashboard.performImport', 'No project ID after import')
        success('Project imported successfully - please select the imported project from the list')
      }
    } catch (error) {
      debugLogger.error('ProjectDashboard.performImport', 'Failed to import project', error)

      // Enhanced error messages
      let errorMessage = 'Unknown error'
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Import timed out. The file may be too large or corrupted.'
        } else if (error.message.includes('ZIP')) {
          errorMessage = 'Invalid ZIP file. Please ensure the file is a valid SCORM project export.'
        } else if (error.message.includes('cancelled')) {
          errorMessage = 'Import was cancelled'
        } else {
          errorMessage = error.message
        }
      }

      // Don't show error if import was cancelled
      if (!importAbortController?.signal.aborted) {
        notifyError(`Failed to import project: ${errorMessage}`)
      }
    } finally {
      setImportingProject(false)
      setImportAbortController(null)
    }
  }

  // Cancel import function
  function cancelImport() {
    if (importAbortController) {
      debugLogger.info('ProjectDashboard.cancelImport', 'User cancelled import')
      importAbortController.abort()
      setImportingProject(false)
      setImportAbortController(null)
      info('Import cancelled')
    }
  }

  async function handleExportProject(projectId: string, projectPath?: string) {
    try {
      setExportingProjectId(projectId)
      setShowExportProgress(true)
      setExportCancelled(false)

      // Initialize progress state
      setExportProgress({
        phase: 'preparing',
        progress: 0,
        filesProcessed: 0,
        totalFiles: 0,
        message: 'Preparing export...',
        canCancel: true
      })

      // Set up progress event listener
      const unlisten = await listen<any>('export-progress', (event) => {
        // Skip progress updates if export was cancelled
        if (exportCancelled) {
          debugLogger.debug('ProjectDashboard.exportProgress', 'Skipping progress update - export cancelled')
          return
        }

        debugLogger.debug('ProjectDashboard.exportProgress', 'Received progress event', event.payload)
        const { phase, progress, message, filesProcessed, totalFiles, currentFile } = event.payload

        setExportProgress(prev => ({
          ...prev,
          phase: phase || prev.phase,
          progress: progress || prev.progress,
          message: message || prev.message,
          filesProcessed: filesProcessed || prev.filesProcessed,
          totalFiles: totalFiles || prev.totalFiles,
          currentFile: currentFile || prev.currentFile,
          canCancel: phase !== 'creating' && phase !== 'completing' // Can't cancel during final phases
        }))
      })
      setExportProgressListener(unlisten)

      debugLogger.info('ProjectDashboard.handleExportProject', 'Exporting project', { projectId, projectPath })

      // Find project name
      const allProjects = [...projects, ...recentProjects]
      const project = allProjects.find(p => p.id === projectId)
      const projectName = project?.name || 'project'

      // Load project data without opening/changing current project
      const effectivePath = projectPath || project?.path
      if (!effectivePath) {
        throw new Error('Project path not found')
      }

      // Check for cancellation before starting the export
      if (exportCancelled) {
        debugLogger.info('ProjectDashboard.handleExportProject', 'Export cancelled before starting')
        return
      }

      debugLogger.debug('ProjectDashboard.handleExportProject', 'Creating ZIP using Rust backend with progress', {
        projectPath: effectivePath,
        projectId,
        projectName
      })

      // Use the progress-enabled Rust command
      const zipResult = await invoke<{
        zipData: number[]
        fileCount: number
        totalSize: number
      }>('create_project_zip_with_progress', {
        projectPath: effectivePath,
        projectId: projectId,
        includeMedia: true
      })

      // Check for cancellation after the export completes
      if (exportCancelled) {
        debugLogger.info('ProjectDashboard.handleExportProject', 'Export cancelled after completion')
        return
      }

      // Debug: Log the actual structure received from Rust
      debugLogger.debug('ProjectDashboard.handleExportProject', 'ZIP result from Rust', {
        hasZipData: !!zipResult.zipData,
        zipDataLength: zipResult.zipData?.length || 0,
        fileCount: zipResult.fileCount,
        totalSize: zipResult.totalSize
      })

      // Error checking: Ensure we have valid ZIP data
      if (!zipResult.zipData || zipResult.zipData.length === 0) {
        throw new Error('Received empty ZIP data from Rust backend')
      }

      // Convert the ZIP data to a Blob
      const zipData = new Uint8Array(zipResult.zipData)
      const blob = new Blob([zipData], { type: 'application/zip' })

      // Download the zip file
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${projectName}.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      // Brief delay to show completion, then close dialog
      await new Promise(resolve => setTimeout(resolve, 1500))
      setShowExportProgress(false)

      debugLogger.info('ProjectDashboard.handleExportProject', 'Project exported successfully', {
        projectId,
        projectName,
        fileCount: zipResult.fileCount,
        zipSize: blob.size
      })
      success('Project exported successfully')

    } catch (error) {
      debugLogger.error('ProjectDashboard.handleExportProject', 'Failed to export project', { projectId, error })
      setShowExportProgress(false)
      notifyError(`Failed to export project: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      // Clean up event listener
      if (exportProgressListener && typeof exportProgressListener === 'function') {
        exportProgressListener()
        setExportProgressListener(null)
      }
      setExportingProjectId(null)
    }
  }

  function handleCancelExport() {
    debugLogger.info('ProjectDashboard.handleCancelExport', 'User cancelled export')

    // Set cancellation flag to stop processing
    setExportCancelled(true)

    // Update progress to show cancellation
    setExportProgress(prev => ({
      ...prev,
      message: 'Cancelling export...',
      canCancel: false
    }))

    // Brief delay to show cancellation message, then close
    setTimeout(() => {
      setShowExportProgress(false)
      setExportingProjectId(null)
      setExportCancelled(false)

      // Clean up event listener
      if (exportProgressListener && typeof exportProgressListener === 'function') {
        exportProgressListener()
        setExportProgressListener(null)
      }

      info('Export cancelled')
    }, 1000)
  }

  // Helper function to generate unique project name
  function generateUniqueProjectName(baseName: string, existingProjects: Project[]): string {
    const existingNames = existingProjects.map(p => p.name.toLowerCase())

    // If the base name doesn't exist, use it as-is
    if (!existingNames.includes(baseName.toLowerCase())) {
      return baseName
    }

    // Try adding numeric suffixes until we find a unique name
    let counter = 2
    while (true) {
      const candidateName = `${baseName} (${counter})`
      if (!existingNames.includes(candidateName.toLowerCase())) {
        return candidateName
      }
      counter++
    }
  }

  // Import conflict resolution handlers
  async function handleReplaceProject() {
    if (!selectedFile || !conflictResult) return

    try {
      setImportingProject(true)
      setShowConflictDialog(false)

      debugLogger.debug('ProjectDashboard.handleReplaceProject', 'Replacing existing project')

      // SAFETY: First, delete the existing project, then import the new one
      if (conflictResult.existingProjectId) {
        debugLogger.info('ProjectDashboard.handleReplaceProject', 'Deleting existing project', {
          existingProjectId: conflictResult.existingProjectId
        })
        await storage.deleteProject(conflictResult.existingProjectId)
      }

      // Now import the new project using our helper function
      const blob = new Blob([new Uint8Array(selectedFile)], { type: 'application/zip' })
      const fileName = conflictResult.data.metadata.projectName + '.zip'

      await performImport(blob, fileName)

      success('Project replaced successfully')
    } catch (error) {
      debugLogger.error('ProjectDashboard.handleReplaceProject', 'Failed to replace project', error)
      notifyError(`Failed to replace project: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setImportingProject(false)
    } finally {
      setSelectedFile(null)
      setConflictResult(null)
      setShowConflictDialog(false)
    }
  }

  async function handleCreateNewProject() {
    if (!selectedFile || !conflictResult) return

    try {
      setImportingProject(true)
      setShowConflictDialog(false)

      debugLogger.debug('ProjectDashboard.handleCreateNewProject', 'Creating new project with unique name')

      // Generate a unique name for the imported project
      const baseName = conflictResult.data.metadata.projectName
      const allProjects = [...projects, ...recentProjects]
      const uniqueName = generateUniqueProjectName(baseName, allProjects)

      debugLogger.info('ProjectDashboard.handleCreateNewProject', 'Generated unique name', {
        originalName: baseName,
        uniqueName
      })

      // For now, we'll import with the original name and then rename it
      // This is a limitation since Rust import doesn't support renaming during import yet
      const blob = new Blob([new Uint8Array(selectedFile)], { type: 'application/zip' })
      const fileName = baseName + '.zip'

      // Import the project first
      await performImport(blob, fileName)

      // Then rename it to the unique name
      // Find the newly imported project (it should be the most recent)
      await loadProjects()
      const newProjects = [...projects, ...recentProjects]
      const importedProject = newProjects.find(p => p.name === baseName)

      if (importedProject && importedProject.path) {
        debugLogger.info('ProjectDashboard.handleCreateNewProject', 'Renaming imported project', {
          projectId: importedProject.id,
          oldName: baseName,
          newName: uniqueName
        })

        await storage.renameProject(importedProject.path, uniqueName)
        await loadProjects()

        success(`Project imported as "${uniqueName}"`)
      } else {
        debugLogger.warn('ProjectDashboard.handleCreateNewProject', 'Could not find imported project to rename')
        success('Project imported successfully')
      }

    } catch (error) {
      debugLogger.error('ProjectDashboard.handleCreateNewProject', 'Failed to create new project', error)
      notifyError(`Failed to import project: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setImportingProject(false)
    } finally {
      setSelectedFile(null)
      setConflictResult(null)
      setShowConflictDialog(false)
    }
  }

  function handleCancelConflict() {
    setShowConflictDialog(false)
    setSelectedFile(null)
    setConflictResult(null)
    setImportingProject(false)
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
          <p className={styles.loadingDetails}>
            Please wait while we process the ZIP file and check for duplicates.
            <br />
            Large files may take a few minutes to import.
          </p>
          {importAbortController && (
            <Button
              variant="secondary"
              onClick={cancelImport}
              className={styles.cancelButton}
            >
              Cancel Import
            </Button>
          )}
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
      <div className={styles.pageClamp}>
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
              <Tooltip content="Reset to default folder location" position="bottom">
                <Button
                  variant="secondary"
                  size="small"
                  onClick={handleClearDefaultFolder}
                >
                  Reset
                </Button>
              </Tooltip>
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
        <div className={styles.pageClamp}>
          <div className={styles.mainContent}>
            <h2 className={styles.sectionTitle}>
              Projects
            </h2>
            <ProjectsList
              projects={[...recentProjects, ...projects] as ProjectRow[]}
              onOpen={(project: ProjectRow) => handleOpenProject(project.id, project.path || project.filePath || '')}
              onExport={(project: ProjectRow) => handleExportProject(project.id, project.path || project.filePath)}
              onDelete={(project: ProjectRow) => setDeleteConfirm({id: project.id, path: project.path || project.filePath})}
              onRename={(project: ProjectRow) => handleStartRename(project.id, project.name)}
            />
          </div>
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
      
      <Modal
        isOpen={renamingProjectId !== null}
        onClose={handleCancelRename}
        title="Rename Project"
      >
        <div className="rename-form">
          <input
            ref={(input) => {
              if (input && renamingProjectId) {
                // Focus the input after the modal animation completes
                setTimeout(() => input.focus(), 100);
              }
            }}
            type="text"
            placeholder="Enter project name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              const project = [...recentProjects, ...projects].find(p => p.id === renamingProjectId);
              const projectPath = project ? (project.path || project.id) : '';
              handleRenameKeyDown(e, projectPath);
            }}
            autoFocus
            aria-label="Project name"
            data-testid="rename-project-input"
            className={styles.projectNameInput}
          />
          {renameError && (
            <div className={styles.renameError}>{renameError}</div>
          )}
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={handleCancelRename}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const project = [...recentProjects, ...projects].find(p => p.id === renamingProjectId);
                const projectPath = project ? (project.path || project.id) : '';
                handleSaveRename(projectPath);
              }}
              disabled={!renameValue.trim()}
              data-testid="rename-project-confirm"
            >
              Rename
            </Button>
          </div>
        </div>
      </Modal>

      <ExportProgressDialog
        isOpen={showExportProgress}
        state={exportProgress}
        onCancel={handleCancelExport}
      />

      <ProjectImportConflictDialog
        isOpen={showConflictDialog}
        projectName={conflictResult?.data?.metadata.projectName || 'Unknown Project'}
        existingProjectPath={conflictResult?.existingProjectPath}
        onReplace={handleReplaceProject}
        onCreateNew={handleCreateNewProject}
        onCancel={handleCancelConflict}
      />
    </div>
  )
}