import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AppWithDashboard } from '../App.dashboard'

// Mock Tauri API
vi.mock('@tauri-apps/api/tauri', () => ({
  invoke: vi.fn()
}))

// Mock storage hook
const mockUseStorage = vi.fn()
vi.mock('../contexts/PersistentStorageContext', () => ({
  PersistentStorageProvider: ({ children }: { children: React.ReactNode }) => children,
  useStorage: () => mockUseStorage()
}))

// Mock other contexts
vi.mock('../contexts/UnifiedMediaContext', () => ({
  UnifiedMediaProvider: ({ children }: { children: React.ReactNode }) => children
}))

vi.mock('../contexts/NotificationContext', () => ({
  NotificationProvider: ({ children }: { children: React.ReactNode }) => children,
  useNotifications: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn()
  })
}))

vi.mock('../contexts/UnsavedChangesContext', () => ({
  UnsavedChangesProvider: ({ children }: { children: React.ReactNode }) => children
}))

// Mock status messages hook
vi.mock('../hooks/useStatusMessages', () => ({
  useStatusMessages: () => ({
    messages: [],
    addMessage: vi.fn(),
    dismissMessage: vi.fn(),
    clearAllMessages: vi.fn()
  })
}))

// Mock performance monitor hook
vi.mock('../hooks/usePerformanceMonitor', () => ({
  usePerformanceMonitor: () => ({
    measureAsync: vi.fn().mockImplementation(async (fn) => fn()),
    measure: vi.fn()
  })
}))

const createMockStorage = (hasProject = false) => ({
  currentProjectId: hasProject ? 'test-project-123' : null,
  isInitialized: true,
  saveContent: vi.fn(),
  loadContent: vi.fn(),
  clearContent: vi.fn()
})

const renderDashboard = (hasProject = false) => {
  const mockStorage = createMockStorage(hasProject)
  mockUseStorage.mockReturnValue(mockStorage)
  
  return render(<AppWithDashboard />)
}

describe('StatusPanel Dashboard Visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should hide StatusPanel when there is no current project (on main dashboard)', () => {
    renderDashboard(false)
    
    // StatusPanel should NOT be visible on main dashboard
    const statusPanel = screen.queryByTestId('status-panel')
    expect(statusPanel).not.toBeInTheDocument()
  })

  it('should hide StatusPanel when there is a current project (user is working on project)', () => {
    renderDashboard(true) 
    
    // StatusPanel should NOT be visible when user is working on a project
    // (App.tsx should handle StatusPanel for project pages)
    const statusPanel = screen.queryByTestId('status-panel')
    expect(statusPanel).not.toBeInTheDocument()
  })
})