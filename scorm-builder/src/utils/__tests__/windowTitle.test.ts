import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { updateWindowTitle } from '../windowTitle'
import { getCurrentWindow } from '@tauri-apps/api/window'

vi.mock('@tauri-apps/api/window')

describe('windowTitle', () => {
  let mockSetTitle: ReturnType<typeof vi.fn>
  let mockWindow: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'debug').mockImplementation(() => {})
    
    mockSetTitle = vi.fn()
    mockWindow = {
      setTitle: mockSetTitle
    }
    
    vi.mocked(getCurrentWindow).mockReturnValue(mockWindow)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('updateWindowTitle', () => {
    it('should set base title when no project name', async () => {
      await updateWindowTitle()
      
      expect(mockSetTitle).toHaveBeenCalledWith('SCORM Course Builder')
    })

    it('should include project name in title', async () => {
      await updateWindowTitle('My Project')
      
      expect(mockSetTitle).toHaveBeenCalledWith('My Project - SCORM Course Builder')
    })

    it('should add bullet for unsaved changes', async () => {
      await updateWindowTitle('My Project', true)
      
      expect(mockSetTitle).toHaveBeenCalledWith('My Project - SCORM Course Builder •')
    })

    it('should add bullet to base title for unsaved changes with no project', async () => {
      await updateWindowTitle(undefined, true)
      
      expect(mockSetTitle).toHaveBeenCalledWith('SCORM Course Builder •')
    })

    it('should handle empty project name', async () => {
      await updateWindowTitle('', false)
      
      expect(mockSetTitle).toHaveBeenCalledWith('SCORM Course Builder')
    })

    it('should handle errors silently', async () => {
      mockSetTitle.mockRejectedValue(new Error('Window API not available'))
      
      await updateWindowTitle('Test Project')
      
      expect(console.debug).toHaveBeenCalledWith('Failed to update window title:', expect.any(Error))
    })

    it('should handle getCurrentWindow errors', async () => {
      vi.mocked(getCurrentWindow).mockImplementation(() => {
        throw new Error('Not in Tauri environment')
      })
      
      await updateWindowTitle('Test Project')
      
      expect(console.debug).toHaveBeenCalledWith('Failed to update window title:', expect.any(Error))
      expect(mockSetTitle).not.toHaveBeenCalled()
    })

    it('should handle special characters in project name', async () => {
      await updateWindowTitle('Project "Test" & Co.')
      
      expect(mockSetTitle).toHaveBeenCalledWith('Project "Test" & Co. - SCORM Course Builder')
    })

    it('should handle very long project names', async () => {
      const longName = 'A'.repeat(200)
      await updateWindowTitle(longName)
      
      expect(mockSetTitle).toHaveBeenCalledWith(`${longName} - SCORM Course Builder`)
    })

    it('should not add extra bullet for false hasUnsavedChanges', async () => {
      await updateWindowTitle('My Project', false)
      
      expect(mockSetTitle).toHaveBeenCalledWith('My Project - SCORM Course Builder')
      expect(mockSetTitle).toHaveBeenCalledTimes(1)
    })
  })
})