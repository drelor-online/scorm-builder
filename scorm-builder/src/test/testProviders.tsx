import React from 'react'
import { render, RenderOptions } from '@testing-library/react'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { StepNavigationProvider } from '../contexts/StepNavigationContext'
import { AutoSaveProvider } from '../contexts/AutoSaveContext'

interface AllTheProvidersProps {
  children: React.ReactNode
  projectId?: string
}

// Provider wrapper that includes all necessary providers
export const AllTheProviders: React.FC<AllTheProvidersProps> = ({ children, projectId = 'test-project' }) => {
  return (
    <PersistentStorageProvider>
      <UnifiedMediaProvider projectId={projectId}>
        <StepNavigationProvider>
          <AutoSaveProvider isSaving={false} lastSaved={null} hasUnsavedChanges={false}>
            {children}
          </AutoSaveProvider>
        </StepNavigationProvider>
      </UnifiedMediaProvider>
    </PersistentStorageProvider>
  )
}

// Custom render function that includes all providers
const customRender = (
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { projectId?: string }
) => {
  const { projectId, ...renderOptions } = options || {}
  
  return render(ui, {
    wrapper: ({ children }) => <AllTheProviders projectId={projectId}>{children}</AllTheProviders>,
    ...renderOptions,
  })
}

// Re-export everything
export * from '@testing-library/react'

// Override render method
export { customRender as render }