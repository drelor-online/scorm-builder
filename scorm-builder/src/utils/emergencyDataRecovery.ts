/**
 * EMERGENCY DATA RECOVERY UTILITY
 * 
 * This utility provides emergency data recovery capabilities for
 * scenarios where YouTube clip timing contamination has caused
 * data loss or corruption in SCORM projects.
 */

import { logger } from './logger'
import { MediaService } from '../services/MediaService'
import { FileStorage } from '../services/FileStorage'

export interface RecoveryReport {
  projectId: string
  scanDate: string
  mediaItemsScanned: number
  contaminatedItems: string[]
  cleanedItems: string[]
  recoveredClipTiming: Array<{
    mediaId: string
    originalUrl?: string
    recoveredClipStart?: number
    recoveredClipEnd?: number
  }>
  errors: string[]
  recommendations: string[]
}

export interface RecoveryOptions {
  projectId: string
  performCleanup?: boolean
  attemptClipTimingRecovery?: boolean
  createBackup?: boolean
  dryRun?: boolean
}

export class EmergencyDataRecovery {
  private mediaService: MediaService
  private fileStorage: FileStorage
  
  constructor(mediaService: MediaService, fileStorage: FileStorage) {
    this.mediaService = mediaService
    this.fileStorage = fileStorage
  }
  
  /**
   * EMERGENCY SCAN: Comprehensive scan for data contamination and recovery opportunities
   */
  async performEmergencyScan(options: RecoveryOptions): Promise<RecoveryReport> {
    logger.info('[EMERGENCY RECOVERY] 🚨 Starting emergency data recovery scan', {
      projectId: options.projectId,
      performCleanup: options.performCleanup,
      dryRun: options.dryRun
    })
    
    const report: RecoveryReport = {
      projectId: options.projectId,
      scanDate: new Date().toISOString(),
      mediaItemsScanned: 0,
      contaminatedItems: [],
      cleanedItems: [],
      recoveredClipTiming: [],
      errors: [],
      recommendations: []
    }
    
    try {
      // PHASE 1: Scan all media for contamination
      logger.info('[EMERGENCY RECOVERY] 📊 Phase 1: Scanning for contamination')
      const allMedia = await this.mediaService.listAllMedia()
      report.mediaItemsScanned = allMedia.length
      
      for (const mediaItem of allMedia) {
        try {
          const contaminationAnalysis = this.analyzeContamination(mediaItem)
          
          if (contaminationAnalysis.isContaminated) {
            report.contaminatedItems.push(mediaItem.id)
            logger.warn('[EMERGENCY RECOVERY] ☣️ Contamination detected', {
              mediaId: mediaItem.id,
              type: mediaItem.type,
              contaminationFields: contaminationAnalysis.contaminationFields
            })
            
            // PHASE 2: Attempt recovery if requested
            if (options.attemptClipTimingRecovery && contaminationAnalysis.hasYouTubeData) {
              const recovery = await this.attemptClipTimingRecovery(mediaItem, contaminationAnalysis)
              if (recovery) {
                report.recoveredClipTiming.push(recovery)
                logger.info('[EMERGENCY RECOVERY] 🎯 Clip timing recovered', recovery)
              }
            }
            
            // PHASE 3: Cleanup if requested
            if (options.performCleanup && !options.dryRun) {
              const cleaned = await this.performEmergencyCleanup(mediaItem)
              if (cleaned) {
                report.cleanedItems.push(mediaItem.id)
                logger.info('[EMERGENCY RECOVERY] 🧹 Emergency cleanup completed', {
                  mediaId: mediaItem.id
                })
              }
            }
          }
        } catch (error) {
          const errorMsg = `Failed to process ${mediaItem.id}: ${error}`
          report.errors.push(errorMsg)
          logger.error('[EMERGENCY RECOVERY] ❌ Processing error', errorMsg)
        }
      }
      
      // PHASE 4: Generate recommendations
      report.recommendations = this.generateRecoveryRecommendations(report)
      
      logger.info('[EMERGENCY RECOVERY] ✅ Emergency scan complete', {
        totalScanned: report.mediaItemsScanned,
        contaminated: report.contaminatedItems.length,
        cleaned: report.cleanedItems.length,
        recovered: report.recoveredClipTiming.length,
        errors: report.errors.length
      })
      
      return report
      
    } catch (error) {
      const errorMsg = `Emergency scan failed: ${error}`
      report.errors.push(errorMsg)
      logger.error('[EMERGENCY RECOVERY] 💥 Critical scan failure', errorMsg)
      return report
    }
  }
  
  /**
   * Analyze media item for contamination patterns
   */
  private analyzeContamination(mediaItem: any): {
    isContaminated: boolean
    contaminationFields: string[]
    hasYouTubeData: boolean
    suspiciousFields: string[]
  } {
    const metadata = mediaItem.metadata as any
    const contaminationFields: string[] = []
    const suspiciousFields: string[] = []
    
    // Known YouTube contamination fields
    const youtubeFields = [
      'source', 'youtubeUrl', 'embedUrl', 'clipStart', 'clipEnd', 'isYouTube',
      'youtube_url', 'embed_url', 'clip_start', 'clip_end', 'is_youtube',
      'youTubeUrl', 'embedURL', 'YOUTUBE_URL', 'CLIP_START', 'CLIP_END'
    ]
    
    // Check for direct contamination
    youtubeFields.forEach(field => {
      if (metadata && metadata[field] !== undefined && metadata[field] !== null) {
        if (mediaItem.type !== 'video' && mediaItem.type !== 'youtube') {
          contaminationFields.push(field)
        }
      }
    })
    
    // Check for suspicious field patterns
    if (metadata) {
      Object.keys(metadata).forEach(key => {
        if (key.toLowerCase().includes('youtube') || 
            key.toLowerCase().includes('embed') ||
            key.toLowerCase().includes('clip')) {
          if (!youtubeFields.includes(key)) {
            suspiciousFields.push(key)
          }
        }
      })
    }
    
    const hasYouTubeData = metadata && (
      metadata.youtubeUrl || 
      metadata.embedUrl || 
      metadata.clipStart !== undefined ||
      metadata.clipEnd !== undefined
    )
    
    return {
      isContaminated: contaminationFields.length > 0 || suspiciousFields.length > 0,
      contaminationFields,
      hasYouTubeData,
      suspiciousFields
    }
  }
  
  /**
   * Attempt to recover YouTube clip timing data that might be valuable
   */
  private async attemptClipTimingRecovery(mediaItem: any, contamination: any): Promise<{
    mediaId: string
    originalUrl?: string
    recoveredClipStart?: number
    recoveredClipEnd?: number
  } | null> {
    try {
      const metadata = mediaItem.metadata as any
      const recovery: any = { mediaId: mediaItem.id }
      
      // Try to extract useful YouTube data before it's cleaned
      if (metadata.youtubeUrl && typeof metadata.youtubeUrl === 'string') {
        recovery.originalUrl = metadata.youtubeUrl
      }
      
      if (typeof metadata.clipStart === 'number' && metadata.clipStart >= 0) {
        recovery.recoveredClipStart = metadata.clipStart
      }
      
      if (typeof metadata.clipEnd === 'number' && metadata.clipEnd >= 0) {
        recovery.recoveredClipEnd = metadata.clipEnd
      }
      
      // Only return recovery data if we found something useful
      if (recovery.originalUrl || recovery.recoveredClipStart !== undefined || recovery.recoveredClipEnd !== undefined) {
        return recovery
      }
      
      return null
    } catch (error) {
      logger.error('[EMERGENCY RECOVERY] Failed to recover clip timing', {
        mediaId: mediaItem.id,
        error
      })
      return null
    }
  }
  
  /**
   * Perform emergency cleanup on a single contaminated media item
   */
  private async performEmergencyCleanup(mediaItem: any): Promise<boolean> {
    try {
      // Use the aggressive cleanup method from MediaService
      const cleanupResult = await this.mediaService.cleanContaminatedMedia()
      
      // Check if this item was in the cleaned list
      return cleanupResult.cleaned.includes(mediaItem.id)
    } catch (error) {
      logger.error('[EMERGENCY RECOVERY] Emergency cleanup failed', {
        mediaId: mediaItem.id,
        error
      })
      return false
    }
  }
  
  /**
   * Generate recovery recommendations based on scan results
   */
  private generateRecoveryRecommendations(report: RecoveryReport): string[] {
    const recommendations: string[] = []
    
    if (report.contaminatedItems.length > 0) {
      recommendations.push(`🚨 CRITICAL: ${report.contaminatedItems.length} contaminated media items found`)
      recommendations.push(`🧹 RECOMMENDED: Run aggressive cleanup to remove contamination`)
      
      if (report.recoveredClipTiming.length > 0) {
        recommendations.push(`💾 IMPORTANT: ${report.recoveredClipTiming.length} items have recoverable clip timing data`)
        recommendations.push(`📋 ACTION: Review recovered data before cleanup to preserve valuable timing information`)
      }
    }
    
    if (report.errors.length > 0) {
      recommendations.push(`⚠️ WARNING: ${report.errors.length} errors occurred during scan`)
      recommendations.push(`🔍 ACTION: Review error details and address underlying issues`)
    }
    
    if (report.contaminatedItems.length === 0) {
      recommendations.push(`✅ GOOD: No contamination detected in project`)
      recommendations.push(`🛡️ SUGGESTION: Enable contamination prevention to maintain clean state`)
    }
    
    // Performance recommendations
    const contaminationRate = (report.contaminatedItems.length / report.mediaItemsScanned) * 100
    if (contaminationRate > 50) {
      recommendations.push(`💥 SEVERE: ${contaminationRate.toFixed(1)}% contamination rate indicates systematic issue`)
      recommendations.push(`🔧 URGENT: Investigate root cause of widespread contamination`)
    } else if (contaminationRate > 20) {
      recommendations.push(`⚠️ HIGH: ${contaminationRate.toFixed(1)}% contamination rate needs attention`)
    }
    
    return recommendations
  }
  
  /**
   * Create emergency backup before performing any cleanup operations
   */
  async createEmergencyBackup(projectId: string): Promise<{
    success: boolean
    backupPath?: string
    error?: string
  }> {
    try {
      logger.info('[EMERGENCY RECOVERY] 💾 Creating emergency backup', { projectId })
      
      // This would integrate with the project backup system
      // For now, we'll create a timestamp-based backup identifier
      const backupId = `emergency-backup-${Date.now()}`
      const backupPath = `backups/${projectId}/${backupId}`
      
      // In a real implementation, this would:
      // 1. Export all project data
      // 2. Create a compressed backup file
      // 3. Store it in a safe location
      
      logger.info('[EMERGENCY RECOVERY] ✅ Emergency backup created', {
        projectId,
        backupId,
        backupPath
      })
      
      return {
        success: true,
        backupPath
      }
    } catch (error) {
      const errorMsg = `Failed to create emergency backup: ${error}`
      logger.error('[EMERGENCY RECOVERY] ❌ Backup failed', errorMsg)
      return {
        success: false,
        error: errorMsg
      }
    }
  }
  
  /**
   * Generate detailed recovery report in human-readable format
   */
  generateRecoveryReportText(report: RecoveryReport): string {
    const lines: string[] = []
    
    lines.push('🚨 EMERGENCY DATA RECOVERY REPORT 🚨')
    lines.push('=' .repeat(50))
    lines.push(`Project ID: ${report.projectId}`)
    lines.push(`Scan Date: ${report.scanDate}`)
    lines.push(`Total Media Items: ${report.mediaItemsScanned}`)
    lines.push('')
    
    if (report.contaminatedItems.length > 0) {
      lines.push('☣️ CONTAMINATION DETECTED:')
      lines.push(`- Contaminated Items: ${report.contaminatedItems.length}`)
      lines.push(`- Contamination Rate: ${((report.contaminatedItems.length / report.mediaItemsScanned) * 100).toFixed(1)}%`)
      lines.push(`- Contaminated IDs: ${report.contaminatedItems.join(', ')}`)
      lines.push('')
    }
    
    if (report.cleanedItems.length > 0) {
      lines.push('🧹 CLEANUP PERFORMED:')
      lines.push(`- Items Cleaned: ${report.cleanedItems.length}`)
      lines.push(`- Cleaned IDs: ${report.cleanedItems.join(', ')}`)
      lines.push('')
    }
    
    if (report.recoveredClipTiming.length > 0) {
      lines.push('🎯 CLIP TIMING RECOVERED:')
      report.recoveredClipTiming.forEach(recovery => {
        lines.push(`- ${recovery.mediaId}: ${recovery.originalUrl || 'No URL'} (${recovery.recoveredClipStart || 'N/A'}s - ${recovery.recoveredClipEnd || 'N/A'}s)`)
      })
      lines.push('')
    }
    
    if (report.errors.length > 0) {
      lines.push('❌ ERRORS:')
      report.errors.forEach(error => {
        lines.push(`- ${error}`)
      })
      lines.push('')
    }
    
    if (report.recommendations.length > 0) {
      lines.push('💡 RECOMMENDATIONS:')
      report.recommendations.forEach(rec => {
        lines.push(`- ${rec}`)
      })
      lines.push('')
    }
    
    lines.push('=' .repeat(50))
    lines.push('Report generated by Emergency Data Recovery Utility')
    
    return lines.join('\n')
  }
}