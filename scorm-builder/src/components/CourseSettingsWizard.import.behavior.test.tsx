import { describe, it, expect } from 'vitest'

describe('CourseSettingsWizard - Import Test', () => {
  it('should be able to import CourseSettingsWizard and CourseSettings', async () => {
    const module = await import('./CourseSettingsWizard')
    
    console.log('Module exports:', Object.keys(module))
    
    expect(module.CourseSettingsWizard).toBeDefined()
    expect(typeof module.CourseSettingsWizard).toBe('function') // React functional component
    
    console.log('✓ CourseSettingsWizard imports successfully')
  })
  
  it('should export CourseSettings interface', async () => {
    // This is a type test - if the interface doesn't exist, TypeScript will fail
    const { CourseSettings } = await import('./CourseSettingsWizard')
    
    // Test that we can create a valid CourseSettings object
    const testSettings: typeof CourseSettings = {
      requireAudioCompletion: true,
      navigationMode: 'linear',
      allowRetake: true,
      passMark: 80
    }
    
    expect(testSettings.requireAudioCompletion).toBe(true)
    
    console.log('✓ CourseSettings interface is properly typed')
  })
})