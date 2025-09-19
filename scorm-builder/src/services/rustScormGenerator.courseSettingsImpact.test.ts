import { describe, it, expect, beforeAll, vi, afterAll } from 'vitest'

vi.mock('../utils/ultraSimpleLogger', () => ({
  debugLogger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

vi.mock('../utils/youTubeClippingDiagnostics', () => ({
  generateYouTubeClipReport: vi.fn(),
  logYouTubeClipReport: vi.fn(),
  diagnoseYouTubeVideo: vi.fn()
}))

vi.mock('./externalImageDownloader', () => ({
  downloadIfExternal: vi.fn(async () => ({ data: new Uint8Array(), mimeType: 'image/png' })),
  isExternalUrl: vi.fn(() => false)
}))

vi.mock('./FileStorage', () => {
  class MockFileStorage {
    _currentProjectId?: string
    async openProject() {
      this._currentProjectId = 'project-123'
    }
    async getMedia() {
      return null
    }
    async listAllMedia() {
      return []
    }
  }
  return { FileStorage: MockFileStorage }
})

vi.mock('./MediaService', () => ({
  createMediaService: () => ({
    getMedia: vi.fn(async () => null),
    listAllMedia: vi.fn(async () => []),
    storeYouTubeVideo: vi.fn(async () => ({}))
  })
}))

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn(async () => null) }))
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn(async () => ({ unlisten: () => {} })) }))

let convertToRustFormat: typeof import('./rustScormGenerator').convertToRustFormat

const consoleSpies: Array<ReturnType<typeof vi.spyOn>> = []

beforeAll(async () => {
  consoleSpies.push(vi.spyOn(console, 'log').mockImplementation(() => {}))
  consoleSpies.push(vi.spyOn(console, 'warn').mockImplementation(() => {}))
  consoleSpies.push(vi.spyOn(console, 'error').mockImplementation(() => {}))

  ;({ convertToRustFormat } = await import('./rustScormGenerator'))
})

afterAll(() => {
  consoleSpies.forEach(spy => spy.mockRestore())
})

describe('convertToRustFormat course settings impact', () => {
  const baseCourseContent = {
    title: 'Settings Impact Course',
    courseTitle: 'Settings Impact Course',
    description: 'Testing course settings wiring',
    topics: [
      {
        id: 'topic-1',
        title: 'Topic 1',
        content: '<p>Sample</p>',
        narration: 'Narration text',
        media: []
      }
    ],
    passMark: 60,
    navigationMode: 'linear',
    allowRetake: true
  }

  it('copies every CourseSettings toggle into the rust course data payload', async () => {
    const customSettings = {
      requireAudioCompletion: true,
      navigationMode: 'free' as const,
      autoAdvance: true,
      allowPreviousReview: false,
      passMark: 92,
      allowRetake: false,
      retakeDelay: 12,
      completionCriteria: 'pass_assessment' as const,
      showProgress: false,
      showOutline: false,
      confirmExit: false,
      fontSize: 'large' as const,
      timeLimit: 45,
      sessionTimeout: 10,
      minimumTimeSpent: 15,
      keyboardNavigation: false,
      printable: true
    }

    const { courseData } = await convertToRustFormat(baseCourseContent as any, 'project-123', customSettings)

    expect(courseData).toMatchObject({
      require_audio_completion: true,
      navigation_mode: 'free',
      auto_advance: true,
      allow_previous_review: false,
      pass_mark: 92,
      allow_retake: false,
      retake_delay: 12,
      completion_criteria: 'pass_assessment',
      show_progress: false,
      show_outline: false,
      confirm_exit: false,
      font_size: 'large',
      time_limit: 45,
      session_timeout: 10,
      minimum_time_spent: 15,
      keyboard_navigation: false,
      printable: true
    })
  })

  it('falls back to defaults when settings are undefined', async () => {
    const { courseData } = await convertToRustFormat(baseCourseContent as any, 'project-123', undefined)

    expect(courseData).toMatchObject({
      require_audio_completion: false,
      navigation_mode: 'linear',
      auto_advance: false,
      allow_previous_review: true,
      pass_mark: 60,
      allow_retake: true,
      retake_delay: 0,
      completion_criteria: 'view_and_pass',
      show_progress: true,
      show_outline: true,
      confirm_exit: true,
      font_size: 'medium',
      time_limit: 0,
      session_timeout: 30,
      minimum_time_spent: 0,
      keyboard_navigation: true,
      printable: false
    })
  })
})
