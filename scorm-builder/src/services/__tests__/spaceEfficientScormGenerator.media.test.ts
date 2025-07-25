import { describe, it, expect, beforeEach, vi } from 'vitest'
import JSZip from 'jszip'
import { generateSpaceEfficientSCORM12Buffer, type EnhancedCourseContent } from '../spaceEfficientScormGenerator'

describe('Space-Efficient SCORM Generator - Media and Interaction Tests', () => {
  let mockCourseContent: EnhancedCourseContent

  beforeEach(() => {
    mockCourseContent = {
      title: 'Comprehensive Media Test Course',
      duration: 45,
      passMark: 80,
      navigationMode: 'linear',
      allowRetake: true,
      welcome: {
        title: 'Welcome',
        content: 'Welcome to the Media Test Course',
        startButtonText: 'Start Course',
        media: [{
          id: 'welcome-uploaded',
          url: '/media/images/uploaded-welcome.jpg',
          title: 'Uploaded Welcome Image',
          type: 'image',
          blob: new Blob(['fake image data'], { type: 'image/jpeg' })
        }]
      },
      objectives: ['Learn about media handling', 'Test knowledge checks'],
      topics: [
        {
          id: 'topic-1',
          title: 'Media Handling',
          content: 'This topic demonstrates various media types.',
          media: [
            {
              id: 'google-searched-img',
              url: 'https://example.com/google-image.jpg',
              title: 'Google Searched Image',
              type: 'image',
              blob: new Blob(['google image data'], { type: 'image/jpeg' })
            },
            {
              id: 'media-library-img',
              url: '/media/library/stock-photo.png',
              title: 'Media Library Image',
              type: 'image',
              blob: new Blob(['library image data'], { type: 'image/png' })
            }
          ],
          audioFile: 'topic-1-narration.mp3',
          captionFile: 'topic-1-captions.vtt'
        },
        {
          id: 'topic-2',
          title: 'YouTube Videos',
          content: 'This topic includes YouTube videos.',
          media: [{
            id: 'youtube-video',
            url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
            title: 'YouTube Demo Video',
            type: 'video',
            embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ'
          }],
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'What did you learn from the video?',
            options: ['Option A', 'Option B', 'Option C', 'Option D'],
            correctAnswer: 1,
            explanation: 'Option B is correct because it accurately describes the video content.'
          }
        },
        {
          id: 'topic-3',
          title: 'Knowledge Check Feedback',
          content: 'This topic tests knowledge check feedback.',
          knowledgeCheck: {
            type: 'multiple-choice',
            question: 'What is 2 + 2?',
            options: ['3', '4', '5', '6'],
            correctAnswer: 1,
            explanation: 'The correct answer is 4. Remember: 2 + 2 = 4.'
          }
        }
      ],
      assessment: {
        questions: [
          {
            id: 'q1',
            question: 'What is the capital of France?',
            options: ['London', 'Berlin', 'Paris', 'Madrid'],
            correctAnswer: 2
          },
          {
            id: 'q2',
            question: 'What is 10 × 10?',
            options: ['90', '100', '110', '1000'],
            correctAnswer: 1
          }
        ]
      }
    }
  })

  describe('User wants uploaded images to be displayed correctly', () => {
    it('should include uploaded images with correct paths in the package', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check that the uploaded image blob is included in the package
      const uploadedImage = await zip.file('media/images/welcome-uploaded.png')?.async('uint8array')
      expect(uploadedImage).toBeTruthy()
      
      // Check that the welcome page HTML references the correct path
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      expect(welcomeHtml).toContain('media/images/welcome-uploaded.png')
    })

    it('should handle Google searched images properly', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check that Google searched images are included
      const googleImage = await zip.file('media/images/google-searched-img.png')?.async('uint8array')
      expect(googleImage).toBeTruthy()
      
      // Check the topic HTML references the image
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toContain('media/images/google-searched-img.png')
    })

    it('should include media library images with proper organization', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check media library image is included
      const libraryImage = await zip.file('media/images/media-library-img.png')?.async('uint8array')
      expect(libraryImage).toBeTruthy()
    })
  })

  describe('User wants YouTube videos to be embedded correctly', () => {
    it('should embed YouTube videos using iframe with proper embed URL', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-2.html')?.async('string')
      expect(topicHtml).toBeTruthy()
      
      // Check for YouTube iframe
      expect(topicHtml).toContain('<iframe')
      expect(topicHtml).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ')
      expect(topicHtml).toContain('allowfullscreen')
      
      // Check responsive iframe wrapper
      expect(topicHtml).toContain('class="video-container"')
    })

    it('should maintain 16:9 aspect ratio for YouTube videos', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const mainCss = await zip.file('styles/main.css')?.async('string')
      expect(mainCss).toContain('.video-container')
      expect(mainCss).toContain('aspect-ratio: 16/9')
    })
  })

  describe('User wants audio to load and play correctly', () => {
    it('should include audio files in the correct folder', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      // Check audio file exists
      const audioFile = await zip.file('media/audio/topic-1-narration.mp3')?.async('uint8array')
      expect(audioFile).toBeTruthy()
    })

    it('should create audio player with proper controls', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toContain('<audio')
      expect(topicHtml).toContain('id="audio-player-topic-1"')
      expect(topicHtml).toContain('src="../media/audio/topic-1-narration.mp3"')
      
      // Check custom controls
      expect(topicHtml).toContain('toggleAudio(')
      expect(topicHtml).toContain('skip(-10, 0)')
      expect(topicHtml).toContain('skip(10, 0)')
      expect(topicHtml).toContain('changeSpeed(0)')
    })
  })

  describe('User wants captions to load and display correctly', () => {
    it('should include caption files in WebVTT format', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const captionFile = await zip.file('media/captions/topic-1-captions.vtt')?.async('string')
      expect(captionFile).toBeTruthy()
      expect(captionFile).toContain('WEBVTT')
    })

    it('should link caption files to audio elements', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toContain('<track')
      expect(topicHtml).toContain('kind="captions"')
      expect(topicHtml).toContain('src="../media/captions/topic-1-captions.vtt"')
      expect(topicHtml).toContain('srclang="en"')
    })

    it('should have functioning caption toggle button', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      expect(topicHtml).toContain('toggleCaptions(0)')
      expect(topicHtml).toContain('class="audio-btn active"')
      expect(topicHtml).toContain('CC')
      
      // Check JavaScript implementation
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string')
      expect(navigationJs).toContain('function toggleCaptions')
      expect(navigationJs).toContain('textTracks')
    })
  })

  describe('User wants knowledge check questions to provide immediate feedback', () => {
    it('should show correct feedback when correct answer is selected', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-3.html')?.async('string')
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string')
      
      // Check feedback elements exist
      expect(topicHtml).toContain('id="kc-feedback-topic-3"')
      expect(topicHtml).toContain('class="kc-feedback"')
      
      // Check JavaScript handles correct answers
      expect(navigationJs).toContain('function checkAnswer')
      expect(navigationJs).toContain('showFeedback')
      expect(navigationJs).toContain('correctAnswer')
      expect(navigationJs).toContain('The correct answer is 4. Remember: 2 + 2 = 4.')
    })

    it('should flash correct answer and show explanation for incorrect answers', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string')
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      // Check JavaScript includes flash animation
      expect(navigationJs).toContain('flashCorrectAnswer')
      expect(navigationJs).toContain('classList.add(\'flash\')')
      
      // Check CSS includes flash animation
      expect(mainCss).toContain('@keyframes flash')
      expect(mainCss).toContain('.kc-option.flash')
    })

    it('should prevent navigation until knowledge check is attempted', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string')
      
      expect(navigationJs).toContain('knowledgeCheckAttempts')
      expect(navigationJs).toContain('if (hasKnowledgeCheck && !knowledgeCheckAttempts[currentPage])')
      expect(navigationJs).toContain('alert("Please attempt the knowledge check question before proceeding.")')
    })
  })

  describe('User wants assessment questions to show feedback only after submission', () => {
    it('should not show immediate feedback for assessment questions', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const assessmentHtml = await zip.file('pages/assessment.html')?.async('string')
      expect(assessmentHtml).toBeTruthy()
      
      // Check that feedback is hidden initially
      expect(assessmentHtml).toContain('class="assessment-feedback" style="display: none;"')
      expect(assessmentHtml).toContain('id="submit-assessment"')
    })

    it('should show all feedback after assessment submission', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string')
      
      expect(navigationJs).toContain('function submitAssessment')
      expect(navigationJs).toContain('calculateScore')
      expect(navigationJs).toContain('showAssessmentFeedback')
      expect(navigationJs).toContain('.assessment-feedback').toBeTruthy()
    })

    it('should calculate and display assessment score', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const assessmentHtml = await zip.file('pages/assessment.html')?.async('string')
      expect(assessmentHtml).toContain('id="assessment-score"')
      expect(assessmentHtml).toContain('class="score-display"')
    })
  })

  describe('User wants proper navigation restrictions', () => {
    it('should allow going back to previous pages at any time', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string')
      
      // Check that navigatePrevious has no restrictions
      expect(navigationJs).toContain('function navigatePrevious()')
      expect(navigationJs).not.toContain('if (currentIndex > 0 && hasAttemptedKnowledgeCheck)')
      
      // Previous button should not check for knowledge check attempts
      const prevButtonCheck = navigationJs.match(/navigatePrevious[\s\S]*?{[\s\S]*?}/)?.[0] || ''
      expect(prevButtonCheck).not.toContain('hasAttemptedKnowledgeCheck')
    })

    it('should block forward navigation if knowledge check not attempted', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-2.html')?.async('string')
      
      // Check that the page has data attribute for knowledge check
      expect(topicHtml).toContain('data-has-knowledge-check="true"')
    })
  })

  describe('User wants media to display in the correct layout', () => {
    it('should display images in the media panel with correct styling', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      // Check media panel structure
      expect(topicHtml).toContain('class="media-panel"')
      expect(topicHtml).toContain('class="visual-container"')
      
      // Check responsive image styling
      expect(mainCss).toContain('.visual-container img')
      expect(mainCss).toContain('max-width: 100%')
      expect(mainCss).toContain('height: auto')
    })

    it('should handle multiple media items in a carousel or stack', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      
      // Since topic-1 has multiple media items, check for proper handling
      expect(topicHtml).toContain('class="media-carousel"')
      expect(topicHtml).toContain('data-media-count="2"')
    })
  })

  describe('User wants to enlarge images by clicking on them', () => {
    it('should make images clickable to open enlarged view', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      
      // Check that images have click handlers
      expect(topicHtml).toContain('onclick="enlargeImage')
      expect(topicHtml).toContain('cursor: pointer')
    })

    it('should include lightbox/modal HTML for enlarged images', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const topicHtml = await zip.file('pages/topic-1.html')?.async('string')
      
      // Check for lightbox/modal structure
      expect(topicHtml).toContain('id="image-lightbox"')
      expect(topicHtml).toContain('class="lightbox-overlay"')
      expect(topicHtml).toContain('class="lightbox-content"')
    })

    it('should include JavaScript function to handle image enlargement', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string')
      
      // Check for enlargeImage function
      expect(navigationJs).toContain('function enlargeImage')
      expect(navigationJs).toContain('lightbox')
      expect(navigationJs).toContain('closeLightbox')
    })

    it('should include CSS for lightbox overlay and transitions', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      // Check for lightbox CSS
      expect(mainCss).toContain('.lightbox-overlay')
      expect(mainCss).toContain('position: fixed')
      expect(mainCss).toContain('z-index:')
      expect(mainCss).toContain('.lightbox-content')
      expect(mainCss).toContain('max-width:')
      expect(mainCss).toContain('max-height:')
    })

    it('should make welcome page images clickable too', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const welcomeHtml = await zip.file('pages/welcome.html')?.async('string')
      
      // Check that welcome page images are also clickable
      expect(welcomeHtml).toContain('onclick="parent.enlargeImage')
    })
  })

  describe('User wants content to scroll appropriately when it extends beyond screen bounds', () => {
    it('should have proper scrolling setup for main content area', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      // Check main area has proper overflow handling
      expect(mainCss).toContain('.content-scroll')
      expect(mainCss).toContain('overflow-y: auto')
      
      // Check that body prevents double scrollbars
      expect(mainCss).toContain('body')
      expect(mainCss).toContain('overflow: hidden')
      
      // Check main layout uses flexbox for proper height management
      expect(mainCss).toContain('.main-area')
      expect(mainCss).toContain('display: flex')
      expect(mainCss).toContain('flex-direction: column')
    })

    it('should have scrollable sidebar navigation for many topics', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      // Check sidebar nav is scrollable
      expect(mainCss).toContain('.sidebar-nav')
      expect(mainCss).toContain('overflow-y: auto')
      expect(mainCss).toContain('flex: 1')
    })

    it('should maintain sticky media panel while content scrolls', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      // Check media panel is sticky
      expect(mainCss).toContain('.media-panel')
      expect(mainCss).toContain('position: sticky')
      expect(mainCss).toContain('top: 0')
    })

    it('should prevent body scroll when lightbox is open', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const navigationJs = await zip.file('scripts/navigation.js')?.async('string')
      
      // Check that opening lightbox prevents body scroll
      expect(navigationJs).toContain("document.body.style.overflow = 'hidden'")
      
      // Check that closing lightbox restores body scroll
      expect(navigationJs).toContain("document.body.style.overflow = ''")
    })

    it('should have proper height constraints for full viewport usage', async () => {
      const result = await generateSpaceEfficientSCORM12Buffer(mockCourseContent)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const mainCss = await zip.file('styles/main.css')?.async('string')
      
      // Check viewport height usage
      expect(mainCss).toContain('height: 100vh')
      
      // Check flex containers for proper height distribution
      expect(mainCss).toContain('.content-container')
      expect(mainCss).toContain('flex: 1')
      expect(mainCss).toContain('overflow: hidden')
    })

    it('should test with content that has many topics to ensure scrolling', async () => {
      // Create course with many topics to test scrolling
      const manyTopicsCourse = {
        ...mockCourseContent,
        topics: Array.from({ length: 20 }, (_, i) => ({
          id: `topic-${i + 1}`,
          title: `Topic ${i + 1}: Long Title That Might Wrap`,
          content: `This is topic ${i + 1} with lots of content that will require scrolling. `.repeat(50),
          knowledgeCheck: i % 3 === 0 ? {
            type: 'multiple-choice' as const,
            question: `Question for topic ${i + 1}?`,
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 0,
            explanation: 'Test explanation'
          } : undefined
        }))
      }
      
      const result = await generateSpaceEfficientSCORM12Buffer(manyTopicsCourse)
      const zip = await JSZip.loadAsync(result.buffer)
      
      const indexHtml = await zip.file('index.html')?.async('string')
      
      // Check that all topics are in navigation
      expect(indexHtml).toContain('nav-topic-20')
      
      // Verify structure supports scrolling
      expect(indexHtml).toContain('class="sidebar-nav"')
      expect(indexHtml).toContain('class="content-scroll"')
    })
  })
})