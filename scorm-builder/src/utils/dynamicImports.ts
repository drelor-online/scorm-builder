/**
 * Dynamic import utilities for code splitting
 */

// Cache for loaded modules to avoid re-importing
const moduleCache = new Map<string, any>()

/**
 * Dynamically import SCORM generation services based on version
 */
export const loadSCORMGenerator = async (version: string) => {
  const cacheKey = `scorm-${version}`
  
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey)
  }
  
  let generator
  
  switch (version) {
    case '1.2':
      const rustModule = await import(
        /* webpackChunkName: "rust-scorm" */
        '@/services/rustScormGenerator'
      )
      generator = rustModule.generateRustSCORM
      break
      
    case '2004':
      // Future implementation
      throw new Error('SCORM 2004 not yet implemented')
      
    default:
      throw new Error(`Unsupported SCORM version: ${version}`)
  }
  
  moduleCache.set(cacheKey, generator)
  return generator
}

/**
 * Dynamically import course content converter
 */
export const loadCourseContentConverter = async () => {
  if (moduleCache.has('converter')) {
    return moduleCache.get('converter')
  }
  
  const converterModule = await import(
    /* webpackChunkName: "content-converter" */
    '@/services/courseContentConverter'
  )
  
  moduleCache.set('converter', converterModule.convertToEnhancedCourseContent)
  return converterModule.convertToEnhancedCourseContent
}

// Preview generator removed - progressivePreviewGenerator.ts was unused

/**
 * Dynamically import search services
 */
export const loadSearchService = async (searchType: 'image' | 'youtube') => {
  const cacheKey = `search-${searchType}`
  
  if (moduleCache.has(cacheKey)) {
    return moduleCache.get(cacheKey)
  }
  
  const searchModule = await import(
    /* webpackChunkName: "search-service" */
    '@/services/searchService'
  )
  
  const service = searchType === 'image' 
    ? searchModule.searchGoogleImages 
    : searchModule.searchYouTubeVideos
    
  moduleCache.set(cacheKey, service)
  return service
}

/**
 * Preload critical modules in the background
 */
export const preloadCriticalModules = () => {
  // Preload in the background after initial render
  setTimeout(() => {
    // Preload Rust SCORM generator since it's likely to be used
    import('@/services/rustScormGenerator')
    
    // Preload converter
    import('@/services/courseContentConverter')
  }, 2000)
}

/**
 * Clear module cache to free memory
 */
export const clearModuleCache = () => {
  moduleCache.clear()
}