/**
 * Tracking Prevention Fallback Utility
 * 
 * Provides graceful degradation when browser tracking prevention blocks storage access.
 * Includes memory-based fallbacks and user notifications for privacy-conscious browsers.
 */

import { logger } from './logger'

interface NotificationAction {
  label: string
  action: string
}

interface TrackingPreventionNotification {
  type: 'info' | 'warning' | 'error'
  title: string
  message: string
  actions: NotificationAction[]
}

class TrackingPreventionFallback {
  private memoryStorage = new Map<string, string>()
  private trackingBlocked = false
  private hasWarnedAboutTracking = false

  constructor() {
    // Don't detect on construction - do it lazily on first access
  }

  /**
   * Detect if tracking prevention is active by attempting a test operation
   */
  private detectTrackingPrevention(): void {
    if (this.trackingBlocked) {
      return // Already detected
    }
    
    try {
      // Try to access localStorage with a test key
      localStorage.getItem('__tracking_test__')
      this.trackingBlocked = false
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tracking Prevention')) {
        this.trackingBlocked = true
        this.warnAboutTrackingPrevention()
      }
    }
  }

  /**
   * Warn about tracking prevention once per session
   */
  private warnAboutTrackingPrevention(): void {
    if (!this.hasWarnedAboutTracking) {
      logger.warn('[TrackingPreventionFallback] localStorage blocked, using memory fallback for session')
      this.hasWarnedAboutTracking = true
    }
  }

  /**
   * Safely get an item from storage with fallback to memory
   */
  async safeGetItem(key: string): Promise<string | null> {
    try {
      return localStorage.getItem(key)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tracking Prevention')) {
        this.trackingBlocked = true
        this.warnAboutTrackingPrevention()
        return this.memoryStorage.get(key) || null
      }
      throw error
    }
  }

  /**
   * Safely set an item in storage with fallback to memory
   */
  async safeSetItem(key: string, value: string): Promise<void> {
    try {
      localStorage.setItem(key, value)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tracking Prevention')) {
        this.trackingBlocked = true
        this.warnAboutTrackingPrevention()
        this.memoryStorage.set(key, value)
        return
      }
      throw error
    }
  }

  /**
   * Safely remove an item from storage with fallback to memory
   */
  async safeRemoveItem(key: string): Promise<void> {
    try {
      localStorage.removeItem(key)
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tracking Prevention')) {
        this.trackingBlocked = true
        this.warnAboutTrackingPrevention()
        this.memoryStorage.delete(key)
        return
      }
      throw error
    }
  }

  /**
   * Safely clear all storage with fallback to memory
   */
  async safeClear(): Promise<void> {
    try {
      localStorage.clear()
    } catch (error) {
      if (error instanceof Error && error.message.includes('Tracking Prevention')) {
        this.trackingBlocked = true
        this.warnAboutTrackingPrevention()
        this.memoryStorage.clear()
        return
      }
      throw error
    }
  }

  /**
   * Save disabled log categories with fallback
   */
  async saveDisabledCategories(categories: string[]): Promise<void> {
    const categoriesString = categories.join(',')
    await this.safeSetItem('loggerDisabledCategories', categoriesString)
  }

  /**
   * Load disabled log categories with fallback
   */
  async loadDisabledCategories(): Promise<string[]> {
    const stored = await this.safeGetItem('loggerDisabledCategories')
    if (!stored) {
      return []
    }
    return stored.split(',').filter(cat => cat.trim())
  }

  /**
   * Get notification to show to user when tracking prevention is detected
   */
  async getTrackingPreventionNotification(): Promise<TrackingPreventionNotification | null> {
    if (!this.trackingBlocked) {
      return null
    }

    return {
      type: 'info',
      title: 'Privacy Settings Detected',
      message: 'Your browser\'s privacy settings are limiting some storage features. The application will continue to work with reduced functionality.',
      actions: [
        { label: 'Learn More', action: 'showPrivacyHelp' },
        { label: 'Continue', action: 'dismiss' }
      ]
    }
  }

  /**
   * Check if tracking prevention is currently blocking storage
   */
  isTrackingBlocked(): boolean {
    return this.trackingBlocked
  }

  /**
   * Get current memory storage size for diagnostics
   */
  getMemoryStorageSize(): number {
    return this.memoryStorage.size
  }

  /**
   * Get all keys currently stored in memory fallback
   */
  getMemoryKeys(): string[] {
    return Array.from(this.memoryStorage.keys())
  }
}

// Create singleton instance
export const trackingPreventionFallback = new TrackingPreventionFallback()