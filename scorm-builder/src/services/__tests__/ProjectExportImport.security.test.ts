import { describe, it, expect } from 'vitest'
import { exportProject, ProjectExportData } from '../ProjectExportImport'
import JSZip from 'jszip'

describe('ProjectExportImport Security', () => {
  describe('API Key Protection', () => {
    it('should strip API keys from course data during export', async () => {
      const projectData: ProjectExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          projectName: 'Test Project'
        },
        courseData: {
          title: 'Test Course',
          // Add various API key fields that should be stripped
          apiKey: 'secret-api-key-123',
          api_key: 'another-secret-key',
          googleImageApiKey: 'google-key-123',
          youtubeApiKey: 'youtube-key-456',
          topics: [{
            title: 'Topic 1',
            content: 'Topic content',
            // Nested API keys should also be stripped
            metadata: {
              apiKey: 'nested-api-key',
              password: 'secret-password',
              token: 'auth-token-123'
            }
          }],
          // These fields should be preserved
          language: 'en',
          keywords: ['test', 'course']
        },
        media: {
          images: [],
          audio: [],
          captions: []
        }
      }

      const result = await exportProject(projectData)
      expect(result.success).toBe(true)
      expect(result.blob).toBeDefined()

      // Extract and check the exported content
      const zip = new JSZip()
      await zip.loadAsync(result.blob!)
      
      const courseDataContent = await zip.files['course-data.json'].async('string')
      const exportedCourseData = JSON.parse(courseDataContent)

      // Verify API keys are removed
      expect(exportedCourseData.apiKey).toBeUndefined()
      expect(exportedCourseData.api_key).toBeUndefined()
      expect(exportedCourseData.googleImageApiKey).toBeUndefined()
      expect(exportedCourseData.youtubeApiKey).toBeUndefined()
      
      // Verify nested API keys are removed
      expect(exportedCourseData.topics[0].metadata).toBeDefined()
      expect(exportedCourseData.topics[0].metadata.apiKey).toBeUndefined()
      expect(exportedCourseData.topics[0].metadata.password).toBeUndefined()
      expect(exportedCourseData.topics[0].metadata.token).toBeUndefined()

      // Verify non-sensitive data is preserved
      expect(exportedCourseData.title).toBe('Test Course')
      expect(exportedCourseData.language).toBe('en')
      expect(exportedCourseData.keywords).toEqual(['test', 'course'])
      expect(exportedCourseData.topics[0].title).toBe('Topic 1')
      expect(exportedCourseData.topics[0].content).toBe('Topic content')
    })

    it('should strip various forms of sensitive fields', async () => {
      const projectData: ProjectExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          projectName: 'Test Project'
        },
        courseData: {
          title: 'Test Course',
          // Various forms of sensitive fields
          password: 'secret123',
          passwd: 'secret456',
          pwd: 'secret789',
          accessToken: 'token123',
          access_token: 'token456',
          secretKey: 'key123',
          secret_key: 'key456',
          privateKey: 'private123',
          private_key: 'private456',
          credentials: { user: 'admin', pass: 'admin123' },
          authorization: 'Bearer token123',
          auth: 'Basic auth123',
          // Mixed case should also be caught
          ApiKey: 'mixed-case-key',
          API_KEY: 'upper-case-key',
          topics: []
        },
        media: {
          images: [],
          audio: [],
          captions: []
        }
      }

      const result = await exportProject(projectData)
      expect(result.success).toBe(true)

      const zip = new JSZip()
      await zip.loadAsync(result.blob!)
      
      const courseDataContent = await zip.files['course-data.json'].async('string')
      const exportedCourseData = JSON.parse(courseDataContent)

      // Verify all forms of sensitive fields are removed
      const sensitiveFields = [
        'password', 'passwd', 'pwd',
        'accessToken', 'access_token',
        'secretKey', 'secret_key',
        'privateKey', 'private_key',
        'credentials', 'authorization', 'auth',
        'ApiKey', 'API_KEY'
      ]

      sensitiveFields.forEach(field => {
        expect(exportedCourseData[field]).toBeUndefined()
      })

      // Verify safe fields are preserved
      expect(exportedCourseData.title).toBe('Test Course')
    })

    it('should handle deeply nested sensitive data', async () => {
      const projectData: ProjectExportData = {
        metadata: {
          version: '1.0.0',
          exportDate: new Date().toISOString(),
          projectName: 'Test Project'
        },
        courseData: {
          title: 'Test Course',
          settings: {
            general: {
              theme: 'dark',
              apiKey: 'should-be-removed'
            },
            advanced: {
              features: {
                integration: {
                  googleApiKey: 'google-secret',
                  token: 'auth-token'
                }
              }
            }
          },
          topics: [{
            title: 'Topic',
            media: [{
              id: 'media-1',
              type: 'image',
              url: 'image.jpg',
              name: 'Test Image',
              metadata: {
                uploadedBy: 'user123',
                apiKey: 'media-api-key'
              }
            }]
          }]
        },
        media: {
          images: [],
          audio: [],
          captions: []
        }
      }

      const result = await exportProject(projectData)
      const zip = new JSZip()
      await zip.loadAsync(result.blob!)
      
      const courseDataContent = await zip.files['course-data.json'].async('string')
      const exportedCourseData = JSON.parse(courseDataContent)

      // Check deeply nested sensitive fields are removed
      expect(exportedCourseData.settings.general.apiKey).toBeUndefined()
      expect(exportedCourseData.settings.advanced.features.integration.googleApiKey).toBeUndefined()
      expect(exportedCourseData.settings.advanced.features.integration.token).toBeUndefined()
      expect(exportedCourseData.topics[0].media[0].metadata.apiKey).toBeUndefined()

      // Check structure is preserved
      expect(exportedCourseData.settings.general.theme).toBe('dark')
      expect(exportedCourseData.topics[0].media[0].metadata.uploadedBy).toBe('user123')
    })
  })
})