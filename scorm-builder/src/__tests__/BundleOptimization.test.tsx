import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import App from '../App'

// Mock heavy components to test lazy loading
vi.mock('../components/MediaEnhancementWizardRefactored', () => ({
  MediaEnhancementWizard: () => <div>MediaEnhancementWizard</div>
}))

vi.mock('../components/AudioNarrationWizardRefactored', () => ({
  AudioNarrationWizard: () => <div>AudioNarrationWizard</div>
}))

vi.mock('../components/SCORMPackageBuilderRefactored', () => ({
  SCORMPackageBuilder: () => <div>SCORMPackageBuilder</div>
}))

describe('Bundle Optimization - Lazy Loading', () => {
  it('should render initial app without loading heavy components', () => {
    render(<App />)
    
    // Initial step should show course configuration
    expect(screen.getByRole('heading', { name: /course configuration/i })).toBeInTheDocument()
  })

  it('should lazy load components when needed', async () => {
    const { container } = render(<App />)
    
    // Initially, heavy components shouldn't be in the DOM
    expect(container.innerHTML).not.toContain('MediaEnhancementWizard')
    expect(container.innerHTML).not.toContain('AudioNarrationWizard')
    expect(container.innerHTML).not.toContain('SCORMPackageBuilder')
  })

  it('should maintain app functionality with lazy loading', async () => {
    render(<App />)
    
    // Check that the app renders correctly
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /course configuration/i })).toBeInTheDocument()
    })
  })
})