import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { readFile } from '@tauri-apps/plugin-fs'
import { importProject } from '../services/ProjectExportImport'

interface FileAssociationCallbacks {
  onProjectOpened?: (projectId: string) => void
  onError?: (error: string) => void
  onUnsavedChanges?: (filePath: string) => void
}

export async function handleFileAssociation(callbacks: FileAssociationCallbacks) {
  const handleFileOpen = async (filePath: string) => {
    if (!filePath.endsWith('.scormproj')) {
      return
    }
    
    try {
      // Read the file contents
      const fileContents = await readFile(filePath)
      
      // Create a File object from the binary data
      const blob = new Blob([fileContents])
      const fileName = filePath.split(/[\\/]/).pop() || 'project.scormproj'
      const file = new File([blob], fileName, { type: 'application/zip' })
      
      // Import the project using the existing import functionality
      const result = await importProject(file)
      
      if (result.success && result.data) {
        if (callbacks.onProjectOpened) {
          // Generate a project ID based on the project name and timestamp
          const projectId = `${result.data.metadata.projectName.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`
          callbacks.onProjectOpened(projectId)
        }
      } else {
        throw new Error(result.error || 'Failed to import project')
      }
    } catch (error: any) {
      if (error.message === 'UNSAVED_CHANGES') {
        callbacks.onUnsavedChanges?.(filePath)
      } else {
        callbacks.onError?.(error.message || 'Failed to open project file')
      }
    }
  }
  
  try {
    // Listen for file-drop events (when user drops a file on the window)
    await listen('tauri://file-drop', async (event: any) => {
      if (event.payload && event.payload.length > 0) {
        await handleFileOpen(event.payload[0])
      }
    })
    
    // Check if app was launched with a file argument
    const args = await invoke<string[]>('get_cli_args')
    if (args && Array.isArray(args) && args.length > 1) {
      await handleFileOpen(args[1])
    }
  } catch (error) {
    console.error('Failed to initialize file association:', error)
    callbacks.onError?.('Failed to initialize file association')
  }
}