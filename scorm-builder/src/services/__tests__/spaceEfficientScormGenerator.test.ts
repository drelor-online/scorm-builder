import { describe, it, expect, beforeEach, vi } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer, type EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('Space-Efficient SCORM Generator - Intent-Based Tests', () => {
  let mockCourseContent: EnhancedCourseContent

  beforeEach(() => {
    mockCourseContent = {
      title: 'Understanding Arc-Flash Hazards',
      duration: 30,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the Arc-Flash Safety Training',
        startButtonText: 'Start Course',
        media: [{
          id: 'welcome-img',
          url: 'data:image/png;base64,mock',
          title: 'Welcome Image',
          type: 'image'
        }]
      },
      objectives: [
        'Understand the science behind electrical explosions',
        'Identify arc-flash risk factors',
        'Learn proper PPE requirements'
      ],
      topics: [{
        id: 'topic-1',
        title: 'The Science Behind Electrical Explosions',
        content: `Arc-flash is a dangerous electrical explosion that occurs when electrical current travels through the air between conductors or from a conductor to ground. These incidents can reach temperatures of 35,000°F (19,400°C) - four times hotter than the surface of the sun.

The intense heat, light, and pressure wave can cause severe burns, blindness, hearing loss, and even death in milliseconds. Understanding the physics behind arc-flash events is crucial for electrical safety professionals who work with high-voltage systems on a daily basis.`,
        knowledgeCheck: {
          type: 'multiple-choice',
          question: 'What temperature can an arc-flash reach?',
          options: ['5,000°F', '15,000°F', '35,000°F', '50,000°F'],
          correctAnswer: 2,
          explanation: 'Arc-flash can reach 35,000°F - four times hotter than the surface of the sun.'
        },
        media: [{
          id: 'arc-flash-demo',
          url: 'data:image/png;base64,mock',
          title: 'Arc-Flash Hazard Visual Demonstration',
          type: 'image'
        }],
        audioFile: 'narration-topic-1.mp3',
        captionFile: 'captions-topic-1.vtt'
      }],
      assessment: {
        questions: [{
          id: 'q1',
          question: 'What is the maximum temperature an arc-flash can reach?',
          options: ['5,000°F', '15,000°F', '35,000°F', '50,000°F'],
          correctAnswer: 2
        }]
      }
    }
  })

  describe('User wants to generate a space-efficient SCORM package that matches the mockup design', () => {
    it('should create a package with sidebar navigation layout', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      
      // Extract and check the generated HTML
      const zip = await JSZip.loadAsync(result.buffer)
      const indexHtml = await zip.file('index.html')?.async('string')
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      expect(indexHtml).toBeTruthy()
      expect(mainCss).toBeTruthy()
      
      // Check for sidebar navigation structure
      expect(indexHtml).toContain('class="sidebar"')
      expect(indexHtml).toContain('class="sidebar-nav"')
      expect(indexHtml).toContain('class="nav-item"')
      
      // Check sidebar width matches mockup (180px) in CSS
      expect(mainCss).toContain('.sidebar')
      expect(mainCss).toContain('width: 180px')
    })

    it('should include Entrust branding with correct colors', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const indexHtml = await zip.file('index.html')?.async('string')
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      // Check for Entrust branding in HTML
      expect(indexHtml).toContain('ENTRUST')
      expect(indexHtml).toContain('class="logo"')
      
      // Check for brand colors in CSS
      expect(mainCss).toContain('#8fbb40') // Brand green color
      expect(mainCss).toContain('#241f20') // Brand dark color
      expect(mainCss).toContain('#439c45') // Secondary green
    })

    it('should display progress bar with percentage', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const indexHtml = await zip.file('index.html')?.async('string')
      
      expect(indexHtml).toContain('class="progress-bar"')
      expect(indexHtml).toContain('class="progress-fill"')
      expect(indexHtml).toContain('class="progress-info"')
    })

    it('should create navigation items for all course sections', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const indexHtml = await zip.file('index.html')?.async('string')
      
      // Should have nav items for welcome, objectives, topics, and assessment
      expect(indexHtml).toContain('>1.</span> Welcome')
      expect(indexHtml).toContain('>2.</span> Objectives')
      expect(indexHtml).toContain('>3.</span> The Science Behind Electrical Explosions')
      expect(indexHtml).toContain('>4.</span> Assessment')
    })

    it('should implement two-column content layout for topics', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      expect(topicHtml).toBeTruthy()
      
      // Check for grid layout with text and media sections
      expect(topicHtml).toContain('class="content-layout"')
      expect(topicHtml).toContain('class="text-section"')
      expect(topicHtml).toContain('class="media-panel"')
      
      // Check CSS for grid layout
      expect(mainCss).toContain('.content-layout')
      expect(mainCss).toContain('grid-template-columns: 1.5fr 1fr')
    })

    it('should include custom audio player with controls', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      
      // Check for custom audio player structure
      expect(topicHtml).toContain('class="audio-player"')
      expect(topicHtml).toContain('class="play-pause"')
      expect(topicHtml).toContain('class="track-progress"')
      expect(topicHtml).toContain('class="audio-controls"')
      
      // Check for specific controls
      expect(topicHtml).toContain('◀ 10s') // Rewind button
      expect(topicHtml).toContain('1x')     // Speed control
      expect(topicHtml).toContain('CC')      // Captions toggle
      expect(topicHtml).toContain('10s ▶')  // Forward button
    })

    it('should integrate captions display with audio player', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      expect(topicHtml).toContain('class="caption-display"')
      expect(topicHtml).toContain('toggleCaptions(0)') // Function call with index parameter
      
      // Check caption styling matches mockup in CSS
      expect(mainCss).toContain('.caption-display')
      expect(mainCss).toContain('background: #ffe4b5') // Caption background color
      expect(mainCss).toContain('border: 1px solid #ffd090')
    })

    it('should embed knowledge checks within topic content', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      expect(topicHtml).toContain('class="knowledge-check"')
      expect(topicHtml).toContain('Quick Check')
      expect(topicHtml).toContain('What temperature can an arc-flash reach?')
      expect(topicHtml).toContain('class="kc-option"')
      
      // Check for 2x2 grid layout for options in CSS
      expect(mainCss).toContain('.kc-options')
      expect(mainCss).toContain('grid-template-columns: repeat(2, 1fr)')
    })

    it('should implement minimal navigation footer', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const indexHtml = await zip.file('index.html')?.async('string')
      
      expect(indexHtml).toContain('class="nav-footer"')
      expect(indexHtml).toContain('◀ Previous Topic')
      expect(indexHtml).toContain('Next Topic ▶')
    })

    it('should track and update progress as user navigates', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const scriptContent = await zip.file('scripts/navigation.js')?.async('string')
      
      expect(scriptContent).toBeTruthy()
      expect(scriptContent).toContain('updateProgress')
      expect(scriptContent).toContain('markAsCompleted')
      expect(scriptContent).toContain('calculateProgress')
    })

    it('should include SCORM 1.2 API integration', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const scormJs = await zip.file('scripts/scorm-api.js')?.async('string')
      
      expect(scormJs).toBeTruthy()
      expect(scormJs).toContain('LMSInitialize')
      expect(scormJs).toContain('LMSSetValue')
      expect(scormJs).toContain('LMSGetValue')
      expect(scormJs).toContain('LMSCommit')
      expect(scormJs).toContain('LMSFinish')
    })

    it('should generate responsive design with mobile breakpoints', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const stylesContent = await zip.file('styles/main.css')?.async('string')
      
      expect(stylesContent).toBeTruthy()
      expect(stylesContent).toContain('@media (max-width: 1200px)')
      expect(stylesContent).toContain('@media (max-width: 768px)')
      
      // Check sidebar collapses on mobile
      expect(stylesContent).toContain('width: 60px') // Collapsed sidebar width
    })

    it('should include all media assets in correct folders', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check audio file exists
      const audioFile = await zip.file('media/audio/narration-topic-1.mp3')?.async('uint8array')
      expect(audioFile).toBeTruthy()
      
      // Check caption file exists
      const captionFile = await zip.file('media/captions/captions-topic-1.vtt')?.async('string')
      expect(captionFile).toBeTruthy()
      
      // Check images exist
      const files = Object.keys(zip.files)
      const imageFiles = files.filter(f => f.startsWith('media/images/'))
      expect(imageFiles.length).toBeGreaterThan(0)
    })

    it('should validate SCORM manifest contains all required elements', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const manifest = await zip.file('imsmanifest.xml')?.async('string')
      
      expect(manifest).toBeTruthy()
      expect(manifest).toContain('<manifest')
      expect(manifest).toContain('<organizations')
      expect(manifest).toContain('<resources')
      expect(manifest).toContain('adlcp:scormtype="sco"')
      expect(manifest).toContain('index.html')
    })

    it('should handle missing media gracefully', async () => {
      // Remove media from content
      mockCourseContent.topics[0].media = []
      mockCourseContent.topics[0].audioFile = undefined
      mockCourseContent.topics[0].captionFile = undefined
      
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      
      expect(topicHtml).toBeTruthy()
      // Should still have media panel structure but with placeholder
      expect(topicHtml).toContain('class="media-panel"')
      expect(topicHtml).not.toContain('class="audio-player"')
    })
  })

  describe('User wants the generated package to be functionally correct', () => {
    it('should create a valid zip file that can be extracted', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      
      expect(result.buffer).toBeInstanceOf(Uint8Array)
      expect(result.buffer.length).toBeGreaterThan(0)
      
      // Should be able to load as zip
      const zip = await JSZip.loadAsync(result.buffer)
      expect(Object.keys(zip.files).length).toBeGreaterThan(0)
    })

    it('should include all required SCORM files at root level', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      expect(zip.file('imsmanifest.xml')).toBeTruthy()
      expect(zip.file('index.html')).toBeTruthy()
    })

    it('should generate unique IDs for all interactive elements', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      const indexHtml = await zip.file('index.html')?.async('string')
      
      // Check for unique IDs on navigation items
      expect(indexHtml).toMatch(/id="nav-\w+"/g)
      
      // Check for unique IDs on interactive elements
      expect(indexHtml).toMatch(/id="progress-bar-\w+"/g)
    })
  })
})