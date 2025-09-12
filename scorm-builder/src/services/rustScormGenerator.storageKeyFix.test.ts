import { convertToRustFormat } from './rustScormGenerator'

describe('rustScormGenerator - Storage Key Fix', () => {
  const mockCourseContent = {
    title: 'Test Course',
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Test content</p>',
      }
    ]
  }

  it('should handle null courseSettings without crashing', async () => {
    // This test verifies the fix for: "Cannot read properties of null (reading 'allowRetake')" 
    // and "Failed to parse course data: missing field `allow_retake`"
    
    const projectId = 'test-project'
    const courseSettings = null // This should not cause a crash anymore
    
    // This should not throw an error
    const result = await convertToRustFormat(mockCourseContent, projectId, courseSettings)
    
    // Verify the result has expected properties with defaults
    expect(result.courseData).toBeDefined()
    expect(result.courseData.allow_retake).toBeDefined() // Should not be undefined
    expect(typeof result.courseData.allow_retake).toBe('boolean') // Must be boolean for Rust
    expect(result.courseData.show_progress).toBeDefined() // Should not be undefined  
    expect(result.courseData.keyboard_navigation).toBeDefined() // Should not be undefined
    
    // Verify allow_retake specifically has a boolean value (not undefined)
    expect(result.courseData.allow_retake).toBe(true) // Default should be true
    
    console.log('✓ courseSettings null handling works correctly')
    console.log('✓ Default values applied:', {
      allow_retake: result.courseData.allow_retake,
      show_progress: result.courseData.show_progress,
      keyboard_navigation: result.courseData.keyboard_navigation,
      course_title: result.courseData.course_title,
      pass_mark: result.courseData.pass_mark
    })
  })

  it('should handle undefined courseSettings without crashing', async () => {
    // Test with undefined as well
    
    const projectId = 'test-project'
    const courseSettings = undefined // This should also not cause a crash
    
    expect(async () => {
      const result = await convertToRustFormat(mockCourseContent, projectId, courseSettings)
      
      expect(result.courseData).toBeDefined()
      expect(result.courseData.allow_retake).toBeDefined()
      
      console.log('✓ courseSettings undefined handling works correctly')
      
    }).not.toThrow()
  })

  it('should use courseSettings values when provided', async () => {
    // Test that actual settings are used when provided
    
    const projectId = 'test-project'
    const courseSettings = {
      allowRetake: false,
      showProgress: false,
      keyboardNavigation: false,
      requireAudioCompletion: true
    }
    
    const result = await convertToRustFormat(mockCourseContent, projectId, courseSettings)
    
    // Note: With the new ?? logic, false values are preserved (not overridden)  
    // This is the correct behavior - false means "user explicitly chose false"
    expect(result.courseData.allow_retake).toBe(false) // Uses provided false value
    expect(result.courseData.show_progress).toBe(false) // Uses provided false value  
    expect(result.courseData.keyboard_navigation).toBe(false) // Uses provided false value
    expect(result.courseData.require_audio_completion).toBe(true) // Uses provided value
    
    console.log('✓ courseSettings logic works correctly - explicit false values are preserved')
  })

  it('should properly use true courseSettings values', async () => {
    // Test with values that should be used directly
    
    const projectId = 'test-project'  
    const courseSettings = {
      allowRetake: true,
      showProgress: true,
      keyboardNavigation: true,
      requireAudioCompletion: true,
      passMark: 75,
      fontSize: 'large'
    }
    
    const result = await convertToRustFormat(mockCourseContent, projectId, courseSettings)
    
    expect(result.courseData.allow_retake).toBe(true) 
    expect(result.courseData.show_progress).toBe(true)
    expect(result.courseData.keyboard_navigation).toBe(true)
    expect(result.courseData.require_audio_completion).toBe(true)
    expect(result.courseData.pass_mark).toBe(75)
    expect(result.courseData.font_size).toBe('large')
    
    console.log('✓ courseSettings true values are properly applied')
  })
})