import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generateSpaceEfficientSCORM12Buffer } from '../spaceEfficientScormGenerator'
import JSZip from 'jszip'

describe('SCORM Generator - Actual Output Validation', () => {
  const mockGetMedia = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetMedia.mockReset()
  })

  async function generateAndValidateSCORM(courseContent: any) {
    const result = await generateSpaceEfficientSCORM12Buffer(courseContent, mockGetMedia)
    const zip = await JSZip.loadAsync(result.buffer)
    
    // Extract HTML files for validation
    const indexHtml = await zip.file('index.html')?.async('string') || ''
    const welcomeHtml = await zip.file('pages/welcome.html')?.async('string') || ''
    const objectivesHtml = await zip.file('pages/objectives.html')?.async('string') || ''
    const topic1Html = await zip.file('pages/topic-1.html')?.async('string') || ''
    
    return { zip, indexHtml, welcomeHtml, objectivesHtml, topic1Html }
  }

  const createMockCourseContent = () => ({
    title: 'Test Course',
    duration: 30,
    passMark: 80,
    navigationMode: 'linear' as const,
    allowRetake: true,
    welcome: {
      title: 'Welcome',
      content: 'Welcome content',
      startButtonText: 'Start Course',
      audioFile: 'welcome-audio.mp3',
      audioBlob: new Blob(['audio data'], { type: 'audio/mp3' }),
      captionFile: 'welcome-captions.vtt',
      captionBlob: new Blob(['WEBVTT\n\n00:00.000 --> 00:05.000\nWelcome caption'], { type: 'text/vtt' })
    },
    objectives: ['Objective 1', 'Objective 2'],
    objectivesPage: {
      audioFile: 'objectives-audio.mp3',
      audioBlob: new Blob(['audio data'], { type: 'audio/mp3' }),
      captionFile: 'objectives-captions.vtt',
      captionBlob: new Blob(['WEBVTT\n\n00:00.000 --> 00:05.000\nObjectives caption'], { type: 'text/vtt' })
    },
    topics: [{
      id: 'topic-1',
      title: 'Topic 1',
      content: 'Topic content',
      narration: 'Topic narration',
      audioFile: 'topic-1-audio.mp3',
      audioBlob: new Blob(['audio data'], { type: 'audio/mp3' }),
      captionFile: 'topic-1-captions.vtt',
      captionBlob: new Blob(['WEBVTT\n\n00:00.000 --> 00:05.000\nTopic caption'], { type: 'text/vtt' }),
      media: [],
      knowledgeCheck: {
        question: 'Test question?',
        options: ['Option A', 'Option B', 'Option C'],
        correctAnswer: 'Option A',
        explanation: 'Option A is correct'
      }
    }],
    assessment: {
      questions: []
    }
  })

  describe('Audio Player Consistency', () => {
    it('should use same audio player design on all pages', async () => {
      const courseContent = createMockCourseContent()
      const { welcomeHtml, objectivesHtml, topic1Html } = await generateAndValidateSCORM(courseContent)
      
      // All pages should have the custom audio player structure
      const audioPlayerStructure = [
        'class="audio-player"',
        'class="audio-main"',
        'class="play-pause"',
        'class="audio-track"',
        'class="track-progress"',
        'class="track-fill"',
        'class="audio-controls"',
        'class="caption-display"'
      ]
      
      audioPlayerStructure.forEach(element => {
        expect(welcomeHtml).toContain(element)
        expect(objectivesHtml).toContain(element)
        expect(topic1Html).toContain(element)
      })
      
      // Should NOT have basic HTML5 audio controls
      expect(welcomeHtml).not.toContain('<audio controls')
      expect(objectivesHtml).not.toContain('<audio controls')
    })
  })

  describe('Media Panel Layout', () => {
    it('should have media panel on all pages', async () => {
      const courseContent = createMockCourseContent()
      const { welcomeHtml, objectivesHtml, topic1Html } = await generateAndValidateSCORM(courseContent)
      
      // All pages should have the media panel structure
      expect(welcomeHtml).toContain('class="media-panel"')
      expect(objectivesHtml).toContain('class="media-panel"')
      expect(topic1Html).toContain('class="media-panel"')
      
      // Should have content layout wrapper
      expect(welcomeHtml).toContain('class="content-layout"')
      expect(objectivesHtml).toContain('class="content-layout"')
      expect(topic1Html).toContain('class="content-layout"')
    })
  })

  describe('Caption Display', () => {
    it('should have caption track elements in audio tags', async () => {
      const courseContent = createMockCourseContent()
      const { welcomeHtml, objectivesHtml, topic1Html } = await generateAndValidateSCORM(courseContent)
      
      // Check for track elements
      expect(welcomeHtml).toContain('<track kind="captions"')
      expect(welcomeHtml).toContain('src="../media/captions/welcome-captions.vtt"')
      
      expect(objectivesHtml).toContain('<track kind="captions"')
      expect(objectivesHtml).toContain('src="../media/captions/objectives-captions.vtt"')
      
      // Check for caption display div
      expect(welcomeHtml).toContain('class="caption-display"')
      expect(welcomeHtml).toContain('id="caption-text-')
      
      expect(objectivesHtml).toContain('class="caption-display"')
      expect(objectivesHtml).toContain('id="caption-text-')
    })

    it('should include caption files in the package', async () => {
      const courseContent = createMockCourseContent()
      const { zip } = await generateAndValidateSCORM(courseContent)
      
      // Check caption files exist
      expect(zip.file('media/captions/welcome-captions.vtt')).toBeTruthy()
      expect(zip.file('media/captions/objectives-captions.vtt')).toBeTruthy()
    })
  })

  describe('Audio File Loading', () => {
    it('should include audio files with correct paths', async () => {
      const courseContent = createMockCourseContent()
      const { welcomeHtml, objectivesHtml, zip } = await generateAndValidateSCORM(courseContent)
      
      // Check audio source paths
      expect(welcomeHtml).toContain('src="../media/audio/welcome-audio.mp3"')
      expect(objectivesHtml).toContain('src="../media/audio/objectives-audio.mp3"')
      
      // Check audio files exist in package
      expect(zip.file('media/audio/welcome-audio.mp3')).toBeTruthy()
      expect(zip.file('media/audio/objectives-audio.mp3')).toBeTruthy()
      
      // Check preload attribute
      expect(welcomeHtml).toContain('preload="metadata"')
      expect(objectivesHtml).toContain('preload="metadata"')
    })
  })

  describe('Knowledge Check Formatting', () => {
    it('should have proper knowledge check styling and structure', async () => {
      const courseContent = createMockCourseContent()
      const { topic1Html } = await generateAndValidateSCORM(courseContent)
      
      // Check for knowledge check structure
      expect(topic1Html).toContain('class="knowledge-check"')
      expect(topic1Html).toContain('Knowledge Check')
      expect(topic1Html).toContain('class="kc-header"')
      expect(topic1Html).toContain('class="kc-question"')
      expect(topic1Html).toContain('class="kc-options"')
      expect(topic1Html).toContain('class="kc-option"')
      expect(topic1Html).toContain('<input type="radio"')
      expect(topic1Html).toContain('Test question?')
      expect(topic1Html).toContain('Option A')
      expect(topic1Html).toContain('Option B')
      expect(topic1Html).toContain('Option C')
      
      // Should have proper formatting classes
      expect(topic1Html).toContain('check-answer-btn')
      expect(topic1Html).toContain('class="kc-feedback"')
    })
  })

  describe('Knowledge Check Gating', () => {
    it('should disable next button when knowledge check exists', async () => {
      const courseContent = createMockCourseContent()
      const { topic1Html } = await generateAndValidateSCORM(courseContent)
      
      // Check for gating attributes
      expect(topic1Html).toContain('data-has-knowledge-check="true"')
      expect(topic1Html).toContain('disabled')
      expect(topic1Html).toContain('data-requires-answer="true"')
    })
  })

  describe('Navigation Script', () => {
    it('should include navigation.js with all required functions', async () => {
      const courseContent = createMockCourseContent()
      const { zip } = await generateAndValidateSCORM(courseContent)
      
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string') || ''
      
      // Check for required functions
      expect(navigationJs).toContain('function initializeAudio')
      expect(navigationJs).toContain('function toggleAudio')
      expect(navigationJs).toContain('function toggleCaptions')
      expect(navigationJs).toContain('function checkAnswer')
      expect(navigationJs).toContain('function checkKnowledgeCheckCompletion')
      expect(navigationJs).toContain('audio.textTracks')
      expect(navigationJs).toContain('track.mode = \'showing\'')
      expect(navigationJs).toContain('cuechange')
    })
  })

  describe('CSS Consistency', () => {
    it('should include all required CSS for audio player and knowledge check', async () => {
      const courseContent = createMockCourseContent()
      const { zip } = await generateAndValidateSCORM(courseContent)
      
      const mainCss = await zip.file('styles/main.css')?.async('string') || ''
      
      // Audio player styles
      expect(mainCss).toContain('.audio-player')
      expect(mainCss).toContain('.audio-main')
      expect(mainCss).toContain('.play-pause')
      expect(mainCss).toContain('.audio-controls')
      expect(mainCss).toContain('.caption-display')
      
      // Knowledge check styles - both new and legacy formats
      expect(mainCss).toContain('.knowledge-check')
      expect(mainCss).toContain('.kc-question')
      expect(mainCss).toContain('.kc-options')
      expect(mainCss).toContain('.kc-option')
      expect(mainCss).toContain('.check-answer-btn')
      // Legacy styles also included
      expect(mainCss).toContain('.question')
      expect(mainCss).toContain('.options')
      expect(mainCss).toContain('.option')
      
      // Caption styles
      expect(mainCss).toContain('background-color: #ffeb3b')
      expect(mainCss).toContain('color: #000')
    })
  })
})