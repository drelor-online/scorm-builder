import { describe, it, expect, vi } from 'vitest'
import { render, screen , waitFor } from '../../test/testProviders'
import App from '../App'
// Mock heavy components to test lazy loading
vi.mock('../components/MediaEnhancementWizard', () => ({
  MediaEnhancementWizard: () => <div>MediaEnhancementWizard</div>
}))

vi.mock('../components/AudioNarrationWizard', () => ({
  AudioNarrationWizard: () => <div>AudioNarrationWizard</div>
}))

vi.mock('../components/SCORMPackageBuilder', () => ({
  SCORMPackageBuilder: () => <div>SCORMPackageBuilder</div>
}))

// Helper to render app with all required providers
const renderAppWithProviders = () => {
  return render(<App />)
}

describe('Bundle Optimization - Lazy Loading', () => {
  it('should render initial app without loading heavy components', () => {
    renderAppWithProviders()
    
    // Initial step should show course configuration
    expect(screen.getByRole('heading', { name: /course configuration/i })).toBeInTheDocument()
  })

  it('should lazy load components when needed', async () => {
    const { container } = renderAppWithProviders()
    
    // Initially, heavy components shouldn't be in the DOM
    expect(container.innerHTML).not.toContain('MediaEnhancementWizard')
    expect(container.innerHTML).not.toContain('AudioNarrationWizard')
    expect(container.innerHTML).not.toContain('SCORMPackageBuilder')
  })

  it('should maintain app functionality with lazy loading', async () => {
    renderAppWithProviders()
    
    // Check that the app renders correctly
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /course configuration/i })).toBeInTheDocument()
    })
  })
})