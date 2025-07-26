import { Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber'
import { chromium, Browser, BrowserContext, Page } from '@playwright/test'
import { setupMockTauri } from './mockTauri'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { WaitHelpers } from './waitHelpers'
import { visualRegression } from './visualRegression'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

let browser: Browser
let context: BrowserContext

BeforeAll(async () => {
  // Check if we're testing against Tauri or regular browser
  const isTauriTest = process.env.TAURI_TEST === 'true'
  
  browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })
  
  if (isTauriTest) {
    console.log('🚀 Running tests against Tauri app window')
  } else {
    console.log('🌐 Running tests against browser with mock Tauri API')
  }
})

Before(async function (scenario) {
  // Store scenario for debug helpers
  this.currentScenario = scenario
  
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true
  })
  this.page = await context.newPage()
  
  // Set base URL from environment or default
  this.baseUrl = process.env.BASE_URL || 'http://localhost:1420'
  
  // Initialize wait helpers
  this.waitHelpers = new WaitHelpers(this.page)
  
  // Initialize console errors array
  this.consoleErrors = []
  
  // Initialize scenario name for debugging
  this.scenarioName = scenario.pickle.name
  
  // Set up console error tracking
  this.page.on('console', msg => {
    if (msg.type() === 'error') {
      console.error('Browser console error:', msg.text())
      this.consoleErrors.push(msg.text())
    }
  })
  
  // Capture page errors
  this.page.on('pageerror', error => {
    console.error('Page error:', error.message)
    this.consoleErrors.push(error.message)
  })
  
  // Inject mock Tauri API before any navigation
  await this.page.addInitScript(() => {
    console.log('🎭 Injecting mock Tauri API via Playwright...')
    
    // Create mock Tauri API
    const mockTauriAPI = {
      invoke: async (cmd, args) => {
        console.log(`Mock Tauri invoke: ${cmd}`, args)
        
        // Log all commands to help debug
        if (cmd.includes('save') || cmd.includes('course')) {
          console.log(`IMPORTANT: Saving command called: ${cmd}`, args)
        }
        
        // Handle common commands
        if (cmd === 'get_app_data_dir') {
          return 'C:\\Users\\Mock\\AppData\\Roaming\\scorm-builder'
        }
        if (cmd === 'get_projects_dir') {
          return 'C:\\Users\\Mock\\AppData\\Roaming\\scorm-builder\\projects'
        }
        if (cmd === 'list_projects') {
          return []
        }
        if (cmd === 'create_dir') {
          return true
        }
        if (cmd === 'read_dir') {
          return []
        }
        if (cmd === 'read_text_file') {
          throw new Error('File not found')
        }
        if (cmd === 'write_text_file') {
          return true
        }
        if (cmd === 'exists') {
          return false
        }
        if (cmd === 'get_cli_args') {
          return { args: [] }
        }
        if (cmd.startsWith('plugin:event|')) {
          return { unlisten: () => {} }
        }
        if (cmd === 'plugin:dialog|save') {
          // Return a mock file path for the saved project
          const filename = args?.defaultPath ? args.defaultPath.split(/[\\\\\\/]/).pop() : 'project.scormproj'
          return `C:\\\\Users\\\\Mock\\\\Projects\\\\${filename}`
        }
        if (cmd === 'create_project') {
          // Return a mock project with the name provided
          const projectId = `project-${args.name?.toLowerCase().replace(/\s+/g, '-') || 'test'}-${Date.now()}`
          const project = {
            id: projectId,
            name: args.name || 'Test Project',
            created: new Date().toISOString(),
            last_modified: new Date().toISOString()
          }
          
          // Store the project ID as the "current" project
          window.__MOCK_CURRENT_PROJECT_ID__ = projectId
          window.__MOCK_PROJECT_DATA__ = {
            projectId: projectId,
            metadata: {
              courseTitle: args.name || 'Test Project',
              difficulty: 3,
              topics: []
            }
          }
          
          return project
        }
        if (cmd === 'load_project') {
          // Return mock project data
          const projectId = args.project_id || window.__MOCK_CURRENT_PROJECT_ID__ || window.__MOCK_PROJECT_DATA__?.projectId || 'test-project-1'
          
          // Get any saved data
          const savedData = window.__MOCK_PROJECT_DATA__ || {}
          
          return {
            project: {
              id: projectId,
              name: 'Test Project',
              created: new Date().toISOString(),
              last_modified: new Date().toISOString(),
              version: '0.1.0'
            },
            course_data: savedData.course_data || {
              title: '',
              topics: [],
              difficulty: 3
            },
            media: savedData.media || {
              images: {},
              videos: {},
              audio: [],
              captions: {}
            },
            // Include any saved content
            courseSeedData: savedData.courseSeedData,
            currentStep: savedData.currentStep
          }
        }
        if (cmd === 'get_all_project_media') {
          // Return empty media list for new projects
          return []
        }
        if (cmd === 'save_project') {
          // Mock saving project data with file path
          console.log('IMPORTANT: Saving project', args)
          
          // Store the file path if provided
          if (args.filePath) {
            window.__MOCK_PROJECT_FILE_PATH__ = args.filePath
          }
          
          // Store project data
          if (args.projectData) {
            if (!window.__MOCK_PROJECT_DATA__) {
              window.__MOCK_PROJECT_DATA__ = {}
            }
            window.__MOCK_PROJECT_DATA__.projectData = args.projectData
          }
          
          return { success: true }
        }
        if (cmd === 'save_course_metadata') {
          // Mock saving course metadata
          console.log('IMPORTANT: Saving metadata', cmd, args)
          
          // Store course metadata
          if (!window.__MOCK_PROJECT_DATA__) {
            window.__MOCK_PROJECT_DATA__ = {}
          }
          
          if (args.metadata || args) {
            const metadata = args.metadata || args
            window.__MOCK_PROJECT_DATA__.course_data = {
              title: metadata.courseTitle || '',
              topics: metadata.topics || [],
              difficulty: metadata.difficulty || 3
            }
            
            // Also store the full metadata
            window.__MOCK_PROJECT_DATA__.metadata = metadata
            
            console.log('Stored metadata:', window.__MOCK_PROJECT_DATA__.metadata)
          }
          
          return { success: true }
        }
        if (cmd === 'save_course_seed_data') {
          // Mock saving course seed data
          console.log('IMPORTANT: Saving course seed data', args)
          return { success: true }
        }
        if (cmd === 'save_course_data') {
          // Mock saving course data
          console.log('IMPORTANT: Saving course data', args)
          return { success: true }
        }
        if (cmd === 'save_content' || cmd === 'saveContent') {
          // Mock saving content
          console.log('IMPORTANT: Saving content', args)
          
          // Store the data in our mock storage
          if (!window.__MOCK_PROJECT_DATA__) {
            window.__MOCK_PROJECT_DATA__ = {}
          }
          
          // Save based on content type
          if (args.contentType === 'courseSeedData') {
            window.__MOCK_PROJECT_DATA__.courseSeedData = args.content
            
            // Also update metadata with topics to prevent reset
            if (args.content && args.content.customTopics) {
              if (!window.__MOCK_PROJECT_DATA__.metadata) {
                window.__MOCK_PROJECT_DATA__.metadata = {}
              }
              window.__MOCK_PROJECT_DATA__.metadata.topics = args.content.customTopics
              window.__MOCK_PROJECT_DATA__.metadata.courseTitle = args.content.courseTitle
              window.__MOCK_PROJECT_DATA__.metadata.difficulty = args.content.difficulty
            }
          } else if (args.contentType === 'currentStep') {
            window.__MOCK_PROJECT_DATA__.currentStep = args.content
          } else if (args.contentType === 'courseContent') {
            window.__MOCK_PROJECT_DATA__.courseContent = args.content
          }
          
          return { success: true }
        }
        if (cmd === 'generate_scorm') {
          // Mock SCORM generation
          return { 
            success: true, 
            path: 'C:\\Users\\Mock\\Downloads\\scorm-package.zip' 
          }
        }
        if (cmd === 'plugin:dialog|save' && args?.filters?.[0]?.extensions?.includes('zip')) {
          // Mock save dialog for SCORM export
          return 'C:\\Users\\Mock\\Downloads\\course-scorm.zip'
        }
        if (cmd === 'save_scorm_package') {
          // Mock SCORM package saving
          return { success: true }
        }
        if (cmd === 'plugin:dialog|open') {
          // Mock file open dialog
          return null
        }
        if (cmd === 'get_api_keys' || cmd === 'load_api_keys') {
          // Return empty API keys in snake_case format
          return {
            google_image_api_key: '',
            google_cse_id: '',
            youtube_api_key: ''
          }
        }
        if (cmd === 'get_api_key') {
          // Return empty string for individual API key requests
          return ''
        }
        if (cmd === 'get_course_metadata') {
          // Return saved metadata
          console.log('Getting course metadata')
          const savedData = window.__MOCK_PROJECT_DATA__ || {}
          console.log('Available saved data:', savedData)
          const result = savedData.metadata || savedData.course_data || {
            courseTitle: '',
            difficulty: 3,
            topics: []
          }
          console.log('Returning metadata:', result)
          return result
        }
        if (cmd === 'save_api_keys') {
          // Mock saving API keys
          return { success: true }
        }
        if (cmd === 'get_content') {
          // Return saved content
          console.log('Getting content for:', args)
          const savedData = window.__MOCK_PROJECT_DATA__ || {}
          
          // Return content based on content ID
          if (args.contentId === 'courseSeedData') {
            return savedData.courseSeedData
          } else if (args.contentId === 'currentStep') {
            return savedData.currentStep
          } else if (args.contentId === 'courseContent') {
            return savedData.courseContent
          }
          
          // Return null for topic content IDs (we don't have individual topic content yet)
          return null
        }
        
        return null
      },
      event: {
        listen: () => ({ unlisten: () => {} }),
        emit: () => {},
        once: () => ({ unlisten: () => {} })
      },
      window: {
        getCurrent: () => ({
          listen: () => ({ unlisten: () => {} })
        })
      },
      path: {
        appDataDir: async () => '/mock/app/data',
        join: async (...parts) => parts.join('/')
      },
      fs: {
        createDir: async () => {},
        readDir: async () => [],
        readTextFile: async () => { throw new Error('File not found') },
        writeTextFile: async () => {},
        exists: async () => false
      }
    }
    
    // Set up window.__TAURI__ and __TAURI_INTERNALS__
    window.__TAURI__ = mockTauriAPI
    window.__TAURI_IPC__ = () => {}
    window.__TAURI_INTERNALS__ = {
      invoke: mockTauriAPI.invoke,
      convertFileSrc: (filePath, protocol = "asset") => `tauri://${protocol}/${filePath}`,
      transformCallback: (callback, once = false) => {
        const id = Math.random().toString(36).substring(7)
        return { id, callback }
      },
      ipc: () => {},
      metadata: {
        currentWindow: {
          label: "main"
        },
        webviews: []
      }
    }
    
    console.log('✅ Mock Tauri API injected')
  })
})

After(async function (scenario) {
  // Capture screenshot on failure
  const failureStatuses = ['FAILED', 'AMBIGUOUS', 'UNDEFINED', 'PENDING']
  if (this.page && scenario.result?.status && failureStatuses.includes(scenario.result.status)) {
    try {
      // Create screenshots directory if it doesn't exist
      const fs = await import('fs/promises')
      const path = await import('path')
      const screenshotsDir = path.join(process.cwd(), 'test-results', 'screenshots')
      
      try {
        await fs.mkdir(screenshotsDir, { recursive: true })
      } catch (e) {
        // Directory might already exist
      }
      
      // Generate filename with timestamp and scenario name
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const scenarioName = scenario.pickle.name.replace(/[^a-zA-Z0-9]/g, '-').substring(0, 50)
      const filename = `${timestamp}-${scenarioName}.png`
      const filepath = path.join(screenshotsDir, filename)
      
      // Take screenshot
      await this.page.screenshot({ 
        path: filepath,
        fullPage: true 
      })
      
      console.log(`📸 Screenshot saved: ${filepath}`)
      
      // Also capture HTML for debugging
      const htmlFilename = `${timestamp}-${scenarioName}.html`
      const htmlFilepath = path.join(screenshotsDir, htmlFilename)
      const html = await this.page.content()
      await fs.writeFile(htmlFilepath, html)
      
      console.log(`📄 HTML saved: ${htmlFilepath}`)
      
      // Log any console errors
      if (this.consoleErrors && this.consoleErrors.length > 0) {
        console.log('❌ Console errors:')
        this.consoleErrors.forEach(error => console.log(`  - ${error}`))
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error)
    }
  }
  
  // Clean up
  if (this.page) {
    await this.page.close()
  }
  if (context) {
    await context.close()
  }
})

AfterAll(async () => {
  if (browser) {
    await browser.close()
  }
  
  // Generate visual regression report if any tests were run
  try {
    const reportDir = path.join(process.cwd(), 'test-results', 'visual-regression', 'report')
    const reportPath = path.join(reportDir, 'index.html')
    
    // Check if report exists
    const fs = await import('fs/promises')
    try {
      await fs.access(reportPath)
      console.log(`\n📊 Visual regression report generated: ${reportPath}`)
    } catch {
      // No report generated
    }
  } catch (error) {
    // Ignore errors in report generation
  }
})
