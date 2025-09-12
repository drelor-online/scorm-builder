import type { CourseSettings, NavigationMode, CompletionCriteria, FontSize } from '../../src/components/CourseSettingsWizard'

export interface SettingsTestCase {
  name: string
  description: string
  settings: CourseSettings
  expectedFeatures: string[]
  testPriority: 'high' | 'medium' | 'low'
}

export interface SettingsCategory {
  learningControl: Partial<CourseSettings>[]
  assessment: Partial<CourseSettings>[]
  interface: Partial<CourseSettings>[]
  timing: Partial<CourseSettings>[]
  accessibility: Partial<CourseSettings>[]
}

export class SettingsMatrixGenerator {
  
  static getDefaultSettings(): CourseSettings {
    return {
      requireAudioCompletion: false,
      navigationMode: 'linear',
      autoAdvance: false,
      allowPreviousReview: true,
      passMark: 80,
      allowRetake: true,
      retakeDelay: 0,
      completionCriteria: 'view_and_pass',
      showProgress: true,
      showOutline: true,
      confirmExit: true,
      fontSize: 'medium',
      timeLimit: 0,
      sessionTimeout: 30,
      minimumTimeSpent: 0,
      keyboardNavigation: true,
      printable: false
    }
  }

  static getBasicVariations(): SettingsCategory {
    return {
      learningControl: [
        { requireAudioCompletion: true, navigationMode: 'linear' },
        { requireAudioCompletion: false, navigationMode: 'free' },
        { autoAdvance: true, allowPreviousReview: false },
        { autoAdvance: false, allowPreviousReview: true }
      ],
      assessment: [
        { passMark: 60, allowRetake: true, retakeDelay: 0 },
        { passMark: 80, allowRetake: true, retakeDelay: 1 },
        { passMark: 100, allowRetake: false, retakeDelay: 0 },
        { completionCriteria: 'view_all_pages' },
        { completionCriteria: 'pass_assessment' },
        { completionCriteria: 'time_spent', minimumTimeSpent: 30 },
        { completionCriteria: 'view_and_pass' }
      ],
      interface: [
        { showProgress: false, showOutline: false },
        { showProgress: true, showOutline: false },
        { showProgress: false, showOutline: true },
        { confirmExit: false },
        { fontSize: 'small' },
        { fontSize: 'large' }
      ],
      timing: [
        { timeLimit: 60, sessionTimeout: 15 },
        { timeLimit: 0, sessionTimeout: 60 },
        { minimumTimeSpent: 15 },
        { minimumTimeSpent: 45 }
      ],
      accessibility: [
        { keyboardNavigation: false, printable: true },
        { keyboardNavigation: true, printable: false },
        { fontSize: 'large', keyboardNavigation: true }
      ]
    }
  }

  static generateTestCases(): SettingsTestCase[] {
    const testCases: SettingsTestCase[] = []
    const baseSettings = this.getDefaultSettings()
    const variations = this.getBasicVariations()

    // High Priority: Critical feature combinations
    testCases.push({
      name: 'Audio Completion + Linear Navigation',
      description: 'Audio must complete before advancing, linear progression only',
      settings: {
        ...baseSettings,
        requireAudioCompletion: true,
        navigationMode: 'linear',
        allowPreviousReview: false
      },
      expectedFeatures: [
        'audio-completion-tracking',
        'linear-navigation-only',
        'no-previous-review'
      ],
      testPriority: 'high'
    })

    testCases.push({
      name: 'Free Navigation + High Pass Mark',
      description: 'Free navigation with strict assessment requirements',
      settings: {
        ...baseSettings,
        navigationMode: 'free',
        passMark: 100,
        allowRetake: false,
        completionCriteria: 'pass_assessment'
      },
      expectedFeatures: [
        'free-navigation',
        'strict-assessment',
        'no-retakes',
        'assessment-required-completion'
      ],
      testPriority: 'high'
    })

    testCases.push({
      name: 'Time-Based Completion',
      description: 'Course completion based on time spent',
      settings: {
        ...baseSettings,
        completionCriteria: 'time_spent',
        minimumTimeSpent: 30,
        timeLimit: 120,
        sessionTimeout: 20
      },
      expectedFeatures: [
        'time-tracking',
        'minimum-time-enforcement',
        'session-timeout',
        'time-limit-enforcement'
      ],
      testPriority: 'high'
    })

    // Medium Priority: Common use cases
    testCases.push({
      name: 'Corporate Training Standard',
      description: 'Typical corporate training configuration',
      settings: {
        ...baseSettings,
        requireAudioCompletion: false,
        navigationMode: 'linear',
        passMark: 80,
        allowRetake: true,
        retakeDelay: 24,
        showProgress: true,
        confirmExit: true
      },
      expectedFeatures: [
        'linear-navigation',
        'progress-tracking',
        'retake-delay',
        'exit-confirmation'
      ],
      testPriority: 'medium'
    })

    testCases.push({
      name: 'Accessibility Focused',
      description: 'Maximum accessibility features enabled',
      settings: {
        ...baseSettings,
        fontSize: 'large',
        keyboardNavigation: true,
        printable: true,
        showOutline: true,
        confirmExit: true
      },
      expectedFeatures: [
        'large-font-size',
        'keyboard-navigation',
        'printable-version',
        'course-outline'
      ],
      testPriority: 'medium'
    })

    testCases.push({
      name: 'Self-Paced Learning',
      description: 'Flexible self-paced learning configuration',
      settings: {
        ...baseSettings,
        navigationMode: 'free',
        autoAdvance: false,
        allowPreviousReview: true,
        completionCriteria: 'view_all_pages',
        timeLimit: 0,
        allowRetake: true,
        retakeDelay: 0
      },
      expectedFeatures: [
        'free-navigation',
        'page-review-allowed',
        'view-based-completion',
        'unlimited-time',
        'immediate-retakes'
      ],
      testPriority: 'medium'
    })

    // Low Priority: Edge cases and unusual combinations
    testCases.push({
      name: 'Minimal Features',
      description: 'Bare minimum feature set',
      settings: {
        ...baseSettings,
        showProgress: false,
        showOutline: false,
        confirmExit: false,
        keyboardNavigation: false,
        printable: false,
        allowRetake: false
      },
      expectedFeatures: [
        'no-progress-indicator',
        'no-outline',
        'no-exit-confirmation',
        'no-keyboard-nav',
        'single-attempt-only'
      ],
      testPriority: 'low'
    })

    testCases.push({
      name: 'Rapid Auto-Advance',
      description: 'Automatic progression through content',
      settings: {
        ...baseSettings,
        autoAdvance: true,
        navigationMode: 'linear',
        allowPreviousReview: false,
        timeLimit: 30,
        completionCriteria: 'view_all_pages'
      },
      expectedFeatures: [
        'auto-advance',
        'linear-only',
        'time-pressure',
        'no-backtracking'
      ],
      testPriority: 'low'
    })

    // Generate systematic variations for each category
    Object.entries(variations).forEach(([category, settings]) => {
      settings.forEach((variation, index) => {
        testCases.push({
          name: `${category.charAt(0).toUpperCase() + category.slice(1)} Variation ${index + 1}`,
          description: `Testing ${category} settings: ${Object.keys(variation).join(', ')}`,
          settings: { ...baseSettings, ...variation },
          expectedFeatures: Object.keys(variation).map(key => `${key}-enabled`),
          testPriority: 'medium'
        })
      })
    })

    return testCases
  }

  static generateCombinationMatrix(): SettingsTestCase[] {
    const testCases: SettingsTestCase[] = []
    const baseSettings = this.getDefaultSettings()

    // Navigation Mode combinations
    const navigationModes: NavigationMode[] = ['linear', 'free']
    const completionCriteria: CompletionCriteria[] = ['view_all_pages', 'pass_assessment', 'time_spent', 'view_and_pass']
    const fontSizes: FontSize[] = ['small', 'medium', 'large']

    // Generate systematic combinations
    navigationModes.forEach(navMode => {
      completionCriteria.forEach(criteria => {
        fontSizes.forEach(fontSize => {
          [true, false].forEach(audioCompletion => {
            [true, false].forEach(allowRetake => {
              const combinationName = `${navMode}-${criteria}-${fontSize}-audio${audioCompletion ? 'Required' : 'Optional'}-retake${allowRetake ? 'Allowed' : 'Blocked'}`
              
              testCases.push({
                name: combinationName,
                description: `Systematic combination: ${navMode} navigation, ${criteria} completion, ${fontSize} font, audio ${audioCompletion ? 'required' : 'optional'}, retake ${allowRetake ? 'allowed' : 'blocked'}`,
                settings: {
                  ...baseSettings,
                  navigationMode: navMode,
                  completionCriteria: criteria,
                  fontSize: fontSize,
                  requireAudioCompletion: audioCompletion,
                  allowRetake: allowRetake,
                  // Adjust related settings for consistency
                  minimumTimeSpent: criteria === 'time_spent' ? 15 : 0,
                  passMark: criteria === 'pass_assessment' || criteria === 'view_and_pass' ? 80 : 0
                },
                expectedFeatures: [
                  `navigation-${navMode}`,
                  `completion-${criteria}`,
                  `font-${fontSize}`,
                  `audio-${audioCompletion ? 'required' : 'optional'}`,
                  `retake-${allowRetake ? 'allowed' : 'blocked'}`
                ],
                testPriority: 'medium'
              })
            })
          })
        })
      })
    })

    return testCases
  }

  static filterTestCases(allTestCases: SettingsTestCase[], criteria: {
    priority?: ('high' | 'medium' | 'low')[]
    maxCount?: number
    includeNames?: string[]
    excludeNames?: string[]
  }): SettingsTestCase[] {
    let filtered = allTestCases

    // Filter by priority
    if (criteria.priority) {
      filtered = filtered.filter(tc => criteria.priority!.includes(tc.testPriority))
    }

    // Filter by include/exclude names
    if (criteria.includeNames) {
      filtered = filtered.filter(tc => 
        criteria.includeNames!.some(name => tc.name.includes(name))
      )
    }

    if (criteria.excludeNames) {
      filtered = filtered.filter(tc => 
        !criteria.excludeNames!.some(name => tc.name.includes(name))
      )
    }

    // Limit count
    if (criteria.maxCount) {
      filtered = filtered.slice(0, criteria.maxCount)
    }

    return filtered
  }

  static getQuickTestSuite(): SettingsTestCase[] {
    return this.filterTestCases(this.generateTestCases(), {
      priority: ['high'],
      maxCount: 10
    })
  }

  static getComprehensiveTestSuite(): SettingsTestCase[] {
    const basic = this.generateTestCases()
    const combinations = this.generateCombinationMatrix()
    return [...basic, ...combinations]
  }

  static getTestCaseByName(name: string): SettingsTestCase | undefined {
    const allCases = this.getComprehensiveTestSuite()
    return allCases.find(tc => tc.name === name)
  }
}

// Export convenience functions
export const generateQuickTestSuite = () => SettingsMatrixGenerator.getQuickTestSuite()
export const generateComprehensiveTestSuite = () => SettingsMatrixGenerator.getComprehensiveTestSuite()
export const getDefaultSettings = () => SettingsMatrixGenerator.getDefaultSettings()