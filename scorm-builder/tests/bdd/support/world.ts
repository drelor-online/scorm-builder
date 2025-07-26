import { setWorldConstructor } from '@cucumber/cucumber'
import { Page } from '@playwright/test'

export interface World {
  page: Page
  consoleErrors?: string[]
  baseUrl?: string
  lastDownload?: any
  courseConfig?: Record<string, string>
  originalPrompt?: string
  selectedTemplate?: string
  hasUnicodeTitle?: boolean
  topicCount?: number
  selectedFileName?: string
  jsonValidated?: boolean
}

export { World as CustomWorld } // Keep alias for compatibility

setWorldConstructor(function(this: World) {
  this.consoleErrors = []
})
