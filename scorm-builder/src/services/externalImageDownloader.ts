import { invoke } from '@tauri-apps/api/core'

/*
 * EXPECTED BROWSER WARNINGS:
 * - "Tracking Prevention: Connection was blocked" - Normal browser security feature
 * - "CORS policy: No 'Access-Control-Allow-Origin' header" - Expected for external domains
 * - These warnings do not affect functionality as we have fallback handling
 * - External images like www.aga.org may trigger these warnings but are handled gracefully
 */

interface DownloadImageResponse {
  base64_data: string
  content_type: string
}

/**
 * Sleep helper for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Downloads an external image through Tauri to avoid CORS issues
 * @param url The URL of the image to download
 * @returns A blob containing the downloaded image
 */
export async function downloadExternalImage(url: string): Promise<Blob> {
  try {
    console.log('[ExternalImageDownloader] Downloading image:', url)
    
    // First, try to use Tauri command if available
    try {
      const response = await invoke<DownloadImageResponse>('download_image', { url })
      
      // Convert base64 to blob
      const byteCharacters = atob(response.base64_data)
      const byteNumbers = new Array(byteCharacters.length)
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i)
      }
      const byteArray = new Uint8Array(byteNumbers)
      const blob = new Blob([byteArray], { type: response.content_type })
      
      console.log('[ExternalImageDownloader] Successfully downloaded image via Tauri, size:', blob.size)
      return blob
    } catch (tauriError) {
      console.warn('[ExternalImageDownloader] Tauri command not available, trying alternative methods')
      
      // Fallback: Try to fetch directly (might work for some CORS-enabled sites)
      try {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        const blob = await response.blob()
        console.log('[ExternalImageDownloader] Successfully downloaded image via direct fetch, size:', blob.size)
        return blob
      } catch (fetchError) {
        // If direct fetch fails, try using CORS proxies with retry logic
        console.warn('[ExternalImageDownloader] Direct fetch failed, trying CORS proxies')
        
        // List of proxy services to try (in order of preference)
        const proxyServices = [
          (url: string) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
          (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
          (url: string) => `https://proxy.cors.sh/${url}`
        ]
        
        let lastError: Error | null = null
        
        for (let i = 0; i < proxyServices.length; i++) {
          const proxyUrl = proxyServices[i](url)
          console.log(`[ExternalImageDownloader] Trying proxy service ${i + 1}/${proxyServices.length}`)
          
          // Retry logic with exponential backoff for rate limiting (429 errors)
          let retries = 3
          let delay = 1000 // Start with 1 second delay
          
          while (retries > 0) {
            try {
              const proxyResponse = await fetch(proxyUrl, {
                signal: AbortSignal.timeout(15000) // 15 second timeout
              })
              
              if (proxyResponse.status === 429) {
                // Rate limited - wait and retry with exponential backoff
                console.warn(`[ExternalImageDownloader] Rate limited (429), retrying in ${delay}ms...`)
                await sleep(delay)
                delay *= 2 // Exponential backoff
                retries--
                continue
              }
              
              if (!proxyResponse.ok) {
                throw new Error(`Proxy fetch failed! status: ${proxyResponse.status}`)
              }
              
              const blob = await proxyResponse.blob()
              
              // Validate that we actually got an image
              if (blob.size === 0 || !blob.type.startsWith('image/')) {
                throw new Error(`Invalid image data received: size=${blob.size}, type=${blob.type}`)
              }
              
              console.log(`[ExternalImageDownloader] Successfully downloaded image via proxy ${i + 1}, size:`, blob.size)
              return blob
            } catch (error) {
              lastError = error as Error
              retries--
              
              if (retries > 0 && (error as any).name !== 'AbortError') {
                console.warn(`[ExternalImageDownloader] Proxy attempt failed, ${retries} retries left:`, error)
                await sleep(delay)
                delay *= 2
              } else {
                // Move to next proxy service
                break
              }
            }
          }
        }
        
        // All proxy attempts failed - provide user-friendly error message
        if (lastError?.message?.includes('CORS') || lastError?.message?.includes('blocked')) {
          throw new Error('Unable to download this external image due to security restrictions. Please save the image to your computer and upload it locally instead.')
        } else if (lastError?.message?.includes('Network') || lastError?.message?.includes('network')) {
          throw new Error('Network connection issue prevented downloading the image. Please check your internet connection and try again.')
        } else {
          throw new Error('Unable to download this external image. Please save the image to your computer and upload it locally instead.')
        }
      }
    }
  } catch (error) {
    console.error('[ExternalImageDownloader] Failed to download image:', error)
    
    // Provide user-friendly error messages instead of technical details
    const errorMessage = (error as Error).message
    if (errorMessage.includes('CORS') || errorMessage.includes('blocked')) {
      throw new Error('Unable to download this external image due to security restrictions. Please save the image to your computer and upload it locally instead.')
    } else if (errorMessage.includes('Network') || errorMessage.includes('network')) {
      throw new Error('Network connection issue prevented downloading the image. Please check your internet connection and try again.')
    } else if (errorMessage.includes('Unable to download')) {
      // Already user-friendly, re-throw as-is
      throw error
    } else {
      throw new Error('Unable to download this external image. Please save the image to your computer and upload it locally instead.')
    }
  }
}

/**
 * Checks if a URL is external (not a local blob or data URL)
 */
export function isExternalUrl(url: string): boolean {
  return url.startsWith('http://') || url.startsWith('https://')
}

/**
 * Checks if a URL is from a known CORS-restricted domain
 */
export function isKnownCorsRestrictedDomain(url: string): boolean {
  const restrictedDomains = [
    'sciencephoto.com',
    'gettyimages.com',
    'shutterstock.com',
    'istockphoto.com',
    'alamy.com',
    'adobe.com',
    'stock.adobe.com',
    '123rf.com',
    'dreamstime.com',
    'aga.org', // Added from workflow recording CORS error
    'depositphotos.com',
    'vectorstock.com',
    'pond5.com',
    'bigstockphoto.com'
  ]
  
  try {
    const urlObj = new URL(url)
    return restrictedDomains.some(domain => urlObj.hostname.includes(domain))
  } catch {
    return false
  }
}

/**
 * Force download mode with aggressive insecure methods for VPN/corporate networks
 * @param url The URL of the image to download
 * @returns A blob containing the downloaded image
 */
export async function forceDownloadExternalImage(url: string): Promise<Blob> {
  console.log('[ExternalImageDownloader] Force download mode - using aggressive insecure methods for:', url)
  
  // Method 1: Try the new unsafe Tauri command first (bypasses all security)
  try {
    console.log('[ExternalImageDownloader] Trying unsafe Tauri command...')
    const response = await invoke<DownloadImageResponse>('unsafe_download_image', { url })
    
    // Convert base64 to blob
    const byteCharacters = atob(response.base64_data)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    const blob = new Blob([byteArray], { type: response.content_type })
    
    console.log('[ExternalImageDownloader] Unsafe Tauri download successful, size:', blob.size)
    return blob
  } catch (tauriError) {
    console.warn('[ExternalImageDownloader] Unsafe Tauri command failed, trying browser methods:', tauriError)
  }
  
  // Method 2: Ultra-aggressive browser fetch with disabled security
  try {
    console.log('[ExternalImageDownloader] Trying ultra-aggressive fetch...')
    const response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors', // Bypass CORS entirely
      credentials: 'include', // Include corporate credentials
      cache: 'no-cache',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Dest': 'image',
        'Sec-Fetch-Mode': 'no-cors',
        'Sec-Fetch-Site': 'cross-site'
      }
    })
    
    // For no-cors, we can't check response.ok, but try to get the blob anyway
    const blob = await response.blob()
    if (blob && blob.size > 0) {
      console.log('[ExternalImageDownloader] Ultra-aggressive fetch successful, size:', blob.size)
      return blob
    }
    throw new Error('Empty response from ultra-aggressive fetch')
  } catch (fetchError) {
    console.warn('[ExternalImageDownloader] Ultra-aggressive fetch failed:', fetchError)
  }
  
  // Method 3: Image element with crossOrigin bypass
  try {
    console.log('[ExternalImageDownloader] Trying image element bypass...')
    const blob = await downloadWithImageElement(url)
    if (blob && blob.size > 0) {
      console.log('[ExternalImageDownloader] Image element bypass successful, size:', blob.size)
      return blob
    }
  } catch (imageError) {
    console.warn('[ExternalImageDownloader] Image element bypass failed:', imageError)
  }
  
  // Method 4: Last resort - try original proxy methods
  try {
    console.log('[ExternalImageDownloader] Trying alternative proxies as last resort...')
    return await downloadWithAlternativeProxies(url)
  } catch (proxyError) {
    console.warn('[ExternalImageDownloader] Alternative proxies failed:', proxyError)
  }
  
  // All methods failed
  throw new Error(
    'All aggressive download methods failed. Your corporate network may be blocking all image download methods. ' +
    'Please save the image manually to your computer and use the local upload feature instead.'
  )
}

/**
 * Method: Image element with aggressive crossOrigin bypass
 */
async function downloadWithImageElement(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('Image element download timeout'))
    }, 30000) // Longer timeout for corporate networks
    
    img.onload = () => {
      clearTimeout(timeout)
      try {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Canvas to blob conversion failed'))
          }
        }, 'image/png', 1.0) // Max quality
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Image element failed to load'))
    }
    
    // Try multiple crossOrigin strategies
    try {
      // First try without crossOrigin (for same-origin or permissive servers)
      img.src = url
    } catch (error) {
      // If that fails, try with anonymous
      img.crossOrigin = 'anonymous'
      img.src = url + '?cache-bust=' + Date.now()
    }
  })
}

/**
 * Method 1: Download with spoofed headers to avoid detection
 */
async function downloadWithSpoofedHeaders(url: string): Promise<Blob> {
  const spoofedHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': new URL(url).origin,
    'Sec-Fetch-Dest': 'image',
    'Sec-Fetch-Mode': 'no-cors',
    'Sec-Fetch-Site': 'cross-site'
  }
  
  // Try with no-cors first
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'no-cors',
      credentials: 'omit',
      headers: spoofedHeaders,
      signal: AbortSignal.timeout(20000)
    })
    
    if (response.type === 'opaque') {
      // Can't read opaque response, but try anyway
      throw new Error('Opaque response - trying alternative method')
    }
    
    return await response.blob()
  } catch (error) {
    // Try with cors mode and different headers
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*'
      },
      signal: AbortSignal.timeout(20000)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    return await response.blob()
  }
}

/**
 * Method 2: Canvas extraction method for cross-origin images
 */
async function downloadWithCanvasExtraction(url: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('Canvas context not available'))
      return
    }
    
    const timeout = setTimeout(() => {
      reject(new Error('Canvas extraction timeout'))
    }, 15000)
    
    img.onload = () => {
      clearTimeout(timeout)
      try {
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        ctx.drawImage(img, 0, 0)
        
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Canvas to blob conversion failed'))
          }
        }, 'image/png', 0.9)
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      clearTimeout(timeout)
      reject(new Error('Image load failed for canvas extraction'))
    }
    
    // Try with crossOrigin anonymous first
    img.crossOrigin = 'anonymous'
    img.src = url
  })
}

/**
 * Method 3: Try alternative and lesser-known CORS proxies
 */
async function downloadWithAlternativeProxies(url: string): Promise<Blob> {
  const alternativeProxies = [
    (url: string) => `https://images.weserv.nl/?url=${encodeURIComponent(url)}`,
    (url: string) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    (url: string) => `https://thingproxy.freeboard.io/fetch/${url}`,
    (url: string) => `https://yacdn.org/proxy/${url}`,
    (url: string) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`
  ]
  
  let lastError: Error | null = null
  
  for (const proxy of alternativeProxies) {
    try {
      const proxyUrl = proxy(url)
      const response = await fetch(proxyUrl, {
        signal: AbortSignal.timeout(10000) // Shorter timeout for proxies
      })
      
      if (response.status === 429) {
        // Rate limited - wait before trying next proxy
        await sleep(2000)
        continue
      }
      
      if (!response.ok) {
        throw new Error(`Proxy returned ${response.status}`)
      }
      
      const blob = await response.blob()
      
      // Validate it's actually an image
      if (blob.size === 0 || !blob.type.startsWith('image/')) {
        throw new Error(`Invalid response: size=${blob.size}, type=${blob.type}`)
      }
      
      return blob
    } catch (error) {
      lastError = error as Error
      continue
    }
  }
  
  throw lastError || new Error('All alternative proxies failed')
}

/**
 * Method 4: Try to convert to data URL if possible
 */
async function downloadWithDataUrlConversion(url: string): Promise<Blob> {
  // This method tries to fetch and convert to data URL, then back to blob
  // Useful for some edge cases where direct blob conversion fails
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      mode: 'cors',
      credentials: 'omit',
      signal: AbortSignal.timeout(15000)
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const arrayBuffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') || 'image/png'
    
    // Convert to base64 data URL
    const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
    const dataUrl = `data:${contentType};base64,${base64}`
    
    // Convert back to blob
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    return new Blob([bytes], { type: contentType })
  } catch (error) {
    throw new Error(`Data URL conversion failed: ${(error as Error).message}`)
  }
}

/**
 * Downloads an image if it's external, otherwise returns null
 */
export async function downloadIfExternal(url: string): Promise<Blob | null> {
  if (!isExternalUrl(url)) {
    return null
  }
  
  return downloadExternalImage(url)
}