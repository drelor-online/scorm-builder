import React from 'react'
import { render, screen, fireEvent, waitFor } from '../../test/testProviders'
import { describe, test, expect, beforeEach, vi } from 'vitest'
import App from '../../App'
// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_projects_dir') return Promise.resolve('/projects')
    if (cmd === 'list_projects') return Promise.resolve([])
    return Promise.reject(new Error(`Unknown command: ${cmd}`))
  })
}))

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
  save: vi.fn(),
  confirm: vi.fn()
}))

describe('Lazy Loading Navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  test('should handle lazy loading when navigating through steps', async () => {
    // This test reproduces the lazy loading error during navigation
    const { container } = render(<App />)

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByText(/Projects/i)).toBeInTheDocument()
    })

    // Create a new project
    const createButton = screen.getByText(/Create New Project/i)
    fireEvent.click(createButton)

    // Enter project name
    const projectNameInput = await screen.findByPlaceholderText(/Enter project name/i)
    fireEvent.change(projectNameInput, { target: { value: 'Test Project' } })

    // Create project
    const confirmButton = screen.getByRole('button', { name: /Create/i })
    fireEvent.click(confirmButton)

    // Navigate through steps to trigger lazy loading
    await waitFor(() => {
      const nextButton = screen.queryByText(/Next/i)
      if (nextButton) {
        fireEvent.click(nextButton)
      }
    })

    // Check if lazy loaded component renders without error
    await waitFor(() => {
      // Should not throw "Element type is invalid" error
      const appElement = container.querySelector('.app')
      expect(appElement).toBeInTheDocument()
    }, { timeout: 5000 })
  })
})