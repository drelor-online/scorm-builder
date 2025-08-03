import { invoke } from '@tauri-apps/api/core'

interface DownloadImageResponse {
  base64_data: string
  content_type: string
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
      console.warn('[ExternalImageDownloader] Tauri command not available, trying alternative method')
      
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
        // If direct fetch fails, try using a public CORS proxy as last resort
        console.warn('[ExternalImageDownloader] Direct fetch failed, trying CORS proxy')
        const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`
        const proxyResponse = await fetch(proxyUrl)
        if (!proxyResponse.ok) {
          throw new Error(`Proxy fetch failed! status: ${proxyResponse.status}`)
        }
        const blob = await proxyResponse.blob()
        console.log('[ExternalImageDownloader] Successfully downloaded image via CORS proxy, size:', blob.size)
        return blob
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
    'alamy.com'
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