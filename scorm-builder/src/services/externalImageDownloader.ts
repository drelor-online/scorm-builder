import { invoke } from '@tauri-apps/api/core'

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
        
        // All proxy attempts failed
        throw new Error(`All download methods failed. Last error: ${lastError?.message || 'Unknown error'}`)
      }
    }
  } catch (error) {
    console.error('[ExternalImageDownloader] Failed to download image:', error)
    throw new Error(`Failed to download image: ${error}`)
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
 * Downloads an image if it's external, otherwise returns null
 */
export async function downloadIfExternal(url: string): Promise<Blob | null> {
  if (!isExternalUrl(url)) {
    return null
  }
  
  return downloadExternalImage(url)
}