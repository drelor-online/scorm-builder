import { getCurrentWindow } from '@tauri-apps/api/window'
import { getAppNameWithVersion } from './version'

export async function updateWindowTitle(projectName?: string, hasUnsavedChanges: boolean = false) {
  try {
    const window = getCurrentWindow()
    const baseTitle = getAppNameWithVersion()
    
    let title = baseTitle
    if (projectName) {
      title = `${projectName} - ${baseTitle}`
    }
    
    if (hasUnsavedChanges) {
      title += ' •'
    }
    
    await window.setTitle(title)
  } catch (error) {
    // Silently fail if not in Tauri environment (e.g., during tests)
    console.debug('Failed to update window title:', error)
  }
}