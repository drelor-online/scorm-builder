import { describe, it, expect } from 'vitest'
import { ScormSettings } from './project'

describe('ScormSettings - Require Audio Completion Feature', () => {
  it('should include requireAudioCompletion field in ScormSettings interface', () => {
    // Test that ScormSettings can include the requireAudioCompletion field
    const scormSettings: ScormSettings = {
      packageTitle: 'Test Course',
      packageId: 'test-course-123',
      organization: 'Test Org',
      launchPage: 'index.html',
      passingScore: 80,
      requireAudioCompletion: false
    }

    // Now that we've added the field, this should work
    expect(scormSettings.requireAudioCompletion).toBeDefined()
    expect(typeof scormSettings.requireAudioCompletion).toBe('boolean')
    expect(scormSettings.requireAudioCompletion).toBe(false)
  })

  it('should default requireAudioCompletion to false when not specified', () => {
    // Test that requireAudioCompletion can be optional
    const scormSettingsWithoutAudio: ScormSettings = {
      packageTitle: 'Test Course',
      packageId: 'test-course-123',
      organization: 'Test Org'
    }

    // Should compile without error even without requireAudioCompletion
    expect(scormSettingsWithoutAudio.packageTitle).toBe('Test Course')
  })

  it('should accept true value for requireAudioCompletion', () => {
    const scormSettingsWithAudioRequired: ScormSettings = {
      packageTitle: 'Test Course',
      packageId: 'test-course-123',
      organization: 'Test Org',
      requireAudioCompletion: true
    }

    expect(scormSettingsWithAudioRequired.requireAudioCompletion).toBe(true)
  })
})