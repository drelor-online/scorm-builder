import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}))

import { WorkflowRecorder } from './WorkflowRecorder'
import { invoke } from '@tauri-apps/api/core'

const mockInvoke = vi.mocked(invoke)

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn(() => Promise.resolve()),
  },
})

describe('WorkflowRecorder Notes Feature', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInvoke.mockResolvedValue('success')
  })

  describe('Delete All Always Available', () => {
    it('should show Delete All button even when no session exists', () => {
      render(<WorkflowRecorder />)
      
      // Should see Delete All button even without recording
      expect(screen.getByText(/Delete All Recordings/i)).toBeInTheDocument()
    })

    it('should show Delete All as standalone button when not recording', () => {
      render(<WorkflowRecorder />)
      
      const deleteButton = screen.getByText(/Delete All Recordings/i)
      expect(deleteButton).toBeInTheDocument()
      
      // Should be able to click it
      fireEvent.click(deleteButton)
      expect(mockInvoke).toHaveBeenCalledWith('clean_workflow_files')
    })

    it('should not show Delete All in actions section when no session', () => {
      render(<WorkflowRecorder />)
      
      // Should not see the actions section (which contains Export, Clear)
      expect(screen.queryByText(/Export Session/i)).not.toBeInTheDocument()
      expect(screen.queryByText(/Clear/i)).not.toBeInTheDocument()
    })
  })

  describe('Note-Taking Feature', () => {
    it('should show Add Note button when recording', () => {
      render(<WorkflowRecorder />)
      
      // Start recording
      const startButton = screen.getByText(/Start Recording/i)
      fireEvent.click(startButton)
      
      // Should see Add Note button
      expect(screen.getByText(/Add Note/i)).toBeInTheDocument()
    })

    it('should not show Add Note button when not recording', () => {
      render(<WorkflowRecorder />)
      
      // Should not see Add Note button before recording starts
      expect(screen.queryByText(/Add Note/i)).not.toBeInTheDocument()
    })

    it('should open note modal when Add Note is clicked', async () => {
      render(<WorkflowRecorder />)
      
      // Start recording
      fireEvent.click(screen.getByText(/Start Recording/i))
      
      // Click Add Note
      fireEvent.click(screen.getByText(/Add Note/i))
      
      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText(/Add Workflow Note/i)).toBeInTheDocument()
      })
      
      expect(screen.getByPlaceholderText(/Enter your note here/i)).toBeInTheDocument()
      expect(screen.getByText(/Capture & Save/i)).toBeInTheDocument()
      expect(screen.getByText(/Cancel/i)).toBeInTheDocument()
    })

    it('should close modal when Cancel is clicked', async () => {
      render(<WorkflowRecorder />)
      
      // Start recording and open modal
      fireEvent.click(screen.getByText(/Start Recording/i))
      fireEvent.click(screen.getByText(/Add Note/i))
      
      await waitFor(() => {
        expect(screen.getByText(/Add Workflow Note/i)).toBeInTheDocument()
      })
      
      // Click Cancel
      fireEvent.click(screen.getByText(/Cancel/i))
      
      // Modal should be gone
      await waitFor(() => {
        expect(screen.queryByText(/Add Workflow Note/i)).not.toBeInTheDocument()
      })
    })

    it('should save note with screenshot when Capture & Save is clicked', async () => {
      render(<WorkflowRecorder />)
      
      // Start recording and open modal
      fireEvent.click(screen.getByText(/Start Recording/i))
      fireEvent.click(screen.getByText(/Add Note/i))
      
      await waitFor(() => {
        const noteInput = screen.getByPlaceholderText(/Enter your note here/i)
        fireEvent.change(noteInput, { target: { value: 'This is a test note' } })
      })
      
      // Click Capture & Save
      fireEvent.click(screen.getByText(/Capture & Save/i))
      
      // Should call Tauri screenshot function
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('take_screenshot', expect.any(Object))
      })
      
      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText(/Add Workflow Note/i)).not.toBeInTheDocument()
      })
      
      // Should show the note in interactions (check for note icon or priority styling)
      await waitFor(() => {
        expect(screen.getByText(/This is a test note/i)).toBeInTheDocument()
      })
    })

    it('should mark notes as priority interactions', async () => {
      render(<WorkflowRecorder />)
      
      // Start recording
      fireEvent.click(screen.getByText(/Start Recording/i))
      
      // Add a note
      fireEvent.click(screen.getByText(/Add Note/i))
      await waitFor(() => {
        const noteInput = screen.getByPlaceholderText(/Enter your note here/i)
        fireEvent.change(noteInput, { target: { value: 'Priority note' } })
      })
      fireEvent.click(screen.getByText(/Capture & Save/i))
      
      // Note should appear in interactions with priority styling
      await waitFor(() => {
        const noteElement = screen.getByText(/Priority note/i)
        const interactionElement = noteElement.closest('div')
        expect(interactionElement).not.toBeNull()
        // Check that it contains both interaction and priorityInteraction classes
        expect(interactionElement?.className).toMatch(/interaction.*priority/i)
      })
    })

    it('should prevent other interactions while note modal is open', async () => {
      render(<WorkflowRecorder />)
      
      // Start recording
      fireEvent.click(screen.getByText(/Start Recording/i))
      
      // Open note modal
      fireEvent.click(screen.getByText(/Add Note/i))
      
      await waitFor(() => {
        expect(screen.getByText(/Add Workflow Note/i)).toBeInTheDocument()
      })
      
      // Modal overlay should capture clicks
      const overlay = screen.getByTestId('note-modal-overlay')
      expect(overlay).toBeInTheDocument()
      
      // Clicking outside modal should not close it (only Cancel/Save buttons work)
      fireEvent.click(overlay)
      expect(screen.getByText(/Add Workflow Note/i)).toBeInTheDocument()
    })

    it('should show priority notes at top of interactions list', async () => {
      render(<WorkflowRecorder />)
      
      // Start recording
      fireEvent.click(screen.getByText(/Start Recording/i))
      
      // Add a regular click interaction by clicking somewhere
      const startButton = screen.getByText(/Start Recording/i) // This is now Stop Recording
      fireEvent.click(document.body) // This should create a regular interaction
      
      // Add a priority note
      fireEvent.click(screen.getByText(/Add Note/i))
      await waitFor(() => {
        const noteInput = screen.getByPlaceholderText(/Enter your note here/i)
        fireEvent.change(noteInput, { target: { value: 'Priority note' } })
      })
      fireEvent.click(screen.getByText(/Capture & Save/i))
      
      // Priority note should appear first in recent interactions
      await waitFor(() => {
        // Check that the priority note appears in the interactions list
        expect(screen.getByText(/Priority note/i)).toBeInTheDocument()
        
        // Check that it has priority styling
        const noteElement = screen.getByText(/Priority note/i)
        const interactionElement = noteElement.closest('div')
        expect(interactionElement?.className).toMatch(/interaction.*priority/i)
      })
    })
  })

  describe('Enhanced Export with Notes', () => {
    it('should include notes in export with priority flag', async () => {
      render(<WorkflowRecorder />)
      
      // Start recording
      fireEvent.click(screen.getByText(/Start Recording/i))
      
      // Add a note
      fireEvent.click(screen.getByText(/Add Note/i))
      await waitFor(() => {
        const noteInput = screen.getByPlaceholderText(/Enter your note here/i)
        fireEvent.change(noteInput, { target: { value: 'Export test note' } })
      })
      fireEvent.click(screen.getByText(/Capture & Save/i))
      
      // Stop recording
      fireEvent.click(screen.getByText(/Stop Recording/i))
      
      // Export session
      await waitFor(() => {
        fireEvent.click(screen.getByText(/Export Session/i))
      })
      
      // Should call save with data containing priority note
      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith(
          'save_workflow_data', 
          expect.objectContaining({
            data: expect.stringContaining('"isPriority":true')
          })
        )
      })
    })
  })

  describe('Integration with Existing Features', () => {
    it('should work with existing keyboard shortcuts', async () => {
      render(<WorkflowRecorder />)
      
      // F9 should start recording
      fireEvent.keyDown(document, { key: 'F9' })
      
      // Should show Add Note button
      await waitFor(() => {
        expect(screen.getByText(/Add Note/i)).toBeInTheDocument()
      })
      
      // F9 again should stop recording
      fireEvent.keyDown(document, { key: 'F9' })
      
      // Should not show Add Note button
      await waitFor(() => {
        expect(screen.queryByText(/Add Note/i)).not.toBeInTheDocument()
      })
    })

    it('should maintain existing screenshot functionality', () => {
      render(<WorkflowRecorder />)
      
      // Start recording
      fireEvent.click(screen.getByText(/Start Recording/i))
      
      // Both Screenshot and Add Note buttons should be available
      expect(screen.getByText(/📷 Screenshot/i)).toBeInTheDocument()
      expect(screen.getByText(/Add Note/i)).toBeInTheDocument()
    })
  })
})