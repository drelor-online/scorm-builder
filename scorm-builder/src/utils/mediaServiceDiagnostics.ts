/**
 * MediaService Diagnostic Utility
 * 
 * This utility helps debug media storage and retrieval issues
 * by providing detailed information about what's stored in MediaService
 */

import { createMediaService } from '../services/MediaService'

export interface MediaDiagnosticResult {
  projectId: string
  totalMediaCount: number
  mediaByType: Record<string, number>
  mediaDetails: Array<{
    id: string
    type: string
    size: number
    mimeType?: string
    hasData: boolean
    storageKey?: string
  }>
  missingMediaIds: string[]
  errors: string[]
}

/**
 * Comprehensive diagnostic scan of MediaService for a specific project
 */
export async function diagnoseMedieServiceForProject(
  projectId: string, 
  expectedMediaIds?: string[]
): Promise<MediaDiagnosticResult> {
  console.log(`[Media Diagnostics] 🔍 Starting diagnostic scan for project: ${projectId}`)
  
  const result: MediaDiagnosticResult = {
    projectId,
    totalMediaCount: 0,
    mediaByType: {},
    mediaDetails: [],
    missingMediaIds: [],
    errors: []
  }

  try {
    const mediaService = createMediaService(projectId)
    console.log(`[Media Diagnostics] 📋 MediaService created for project: ${projectId}`)

    // List all media in the project
    const allMedia = await mediaService.listAllMedia()
    result.totalMediaCount = allMedia.length
    
    console.log(`[Media Diagnostics] 📊 Found ${allMedia.length} total media items`)
    
    if (allMedia.length === 0) {
      console.log(`[Media Diagnostics] ⚠️  No media found in MediaService for project ${projectId}`)
      result.errors.push(`No media found in MediaService for project ${projectId}`)
    }

    // Analyze each media item
    for (const mediaInfo of allMedia) {
      console.log(`[Media Diagnostics] 📁 Analyzing media: ${mediaInfo.id}`)
      
      try {
        const fileData = await mediaService.getMedia(mediaInfo.id)
        
        const details = {
          id: mediaInfo.id,
          type: mediaInfo.id.split('-')[0] || 'unknown', // Extract type from ID
          size: fileData?.data ? (fileData.data.byteLength || fileData.data.length) : 0,
          mimeType: fileData?.metadata?.mimeType,
          hasData: !!(fileData?.data),
          storageKey: `project_${projectId}_media_${mediaInfo.id}`
        }
        
        result.mediaDetails.push(details)
        
        // Count by type
        const type = details.type
        result.mediaByType[type] = (result.mediaByType[type] || 0) + 1
        
        console.log(`[Media Diagnostics] ✅ ${mediaInfo.id}: ${details.size} bytes, ${details.mimeType || 'no mime type'}`)
        
      } catch (error) {
        const errorMsg = `Failed to load media ${mediaInfo.id}: ${error instanceof Error ? error.message : String(error)}`
        result.errors.push(errorMsg)
        console.log(`[Media Diagnostics] ❌ ${errorMsg}`)
      }
    }
    
    // Check for expected media IDs that are missing
    if (expectedMediaIds && expectedMediaIds.length > 0) {
      const foundIds = new Set(result.mediaDetails.map(d => d.id))
      result.missingMediaIds = expectedMediaIds.filter(id => !foundIds.has(id))
      
      if (result.missingMediaIds.length > 0) {
        console.log(`[Media Diagnostics] ❌ Missing expected media IDs:`, result.missingMediaIds)
      } else {
        console.log(`[Media Diagnostics] ✅ All expected media IDs found`)
      }
    }

  } catch (error) {
    const errorMsg = `MediaService diagnostic failed: ${error instanceof Error ? error.message : String(error)}`
    result.errors.push(errorMsg)
    console.error(`[Media Diagnostics] 💥 ${errorMsg}`)
  }

  // Log summary
  console.log(`[Media Diagnostics] 📊 Summary for project ${projectId}:`)
  console.log(`  Total media: ${result.totalMediaCount}`)
  console.log(`  By type:`, result.mediaByType)
  console.log(`  Errors: ${result.errors.length}`)
  console.log(`  Missing expected: ${result.missingMediaIds.length}`)

  // Log to console for now (structured logger not available)
  console.log(`[Media Diagnostics] 📝 Diagnostic completed for project ${projectId}`)

  return result
}

/**
 * Quick diagnostic that just checks if specific media IDs exist
 */
export async function quickMediaCheck(projectId: string, mediaIds: string[]): Promise<{
  found: string[]
  missing: string[]
  errors: string[]
}> {
  console.log(`[Media Diagnostics] 🚀 Quick check for ${mediaIds.length} media IDs in project ${projectId}`)
  
  const result = {
    found: [] as string[],
    missing: [] as string[],
    errors: [] as string[]
  }

  try {
    const mediaService = createMediaService(projectId)

    for (const mediaId of mediaIds) {
      try {
        const fileData = await mediaService.getMedia(mediaId)
        if (fileData && fileData.data) {
          result.found.push(mediaId)
          console.log(`[Media Diagnostics] ✅ Found: ${mediaId}`)
        } else {
          result.missing.push(mediaId)
          console.log(`[Media Diagnostics] ❌ Missing: ${mediaId}`)
        }
      } catch (error) {
        result.missing.push(mediaId)
        result.errors.push(`${mediaId}: ${error instanceof Error ? error.message : String(error)}`)
        console.log(`[Media Diagnostics] 💥 Error checking ${mediaId}: ${error}`)
      }
    }
  } catch (error) {
    result.errors.push(`MediaService creation failed: ${error instanceof Error ? error.message : String(error)}`)
  }

  console.log(`[Media Diagnostics] 📊 Quick check results: ${result.found.length} found, ${result.missing.length} missing, ${result.errors.length} errors`)
  
  return result
}