/**
 * Normalizes asset URLs to prevent double-encoding and double-prefixing issues
 * This fixes the tracking prevention and 500 errors caused by malformed URLs
 */
export function normalizeAssetUrl(url: string | null | undefined): string {
  // Handle null/undefined
  if (!url) {
    return ''
  }

  // Preserve blob: and data: URLs unchanged
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    return url
  }

  // Preserve regular http/https URLs (except asset.localhost)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // Check if it's an asset.localhost URL that needs normalization
    if (!url.includes('asset.localhost')) {
      return url // Regular URL, return unchanged
    }
  }

  // Handle multiple levels of encoding (decode recursively)
  let decodedUrl = url
  let previousUrl = ''
  while (decodedUrl !== previousUrl) {
    previousUrl = decodedUrl
    try {
      decodedUrl = decodeURIComponent(decodedUrl)
    } catch {
      // If decoding fails, stop trying
      break
    }
  }

  // Remove various asset.localhost prefixes
  decodedUrl = decodedUrl
    .replace(/^https?:\/\/asset\.localhost\//, '') // Remove http(s)://asset.localhost/
    .replace(/^asset\.localhost\//, '') // Remove asset.localhost/
    .replace(/^\/\/asset\.localhost\//, '') // Remove //asset.localhost/

  // Now we should have either:
  // 1. asset://localhost/... (correct)
  // 2. asset://... (missing localhost)
  // 3. 1754743011163/media/... (just the path)
  // 4. Something else

  // If it already starts with asset://, ensure it has localhost
  if (decodedUrl.startsWith('asset://')) {
    // Check if localhost is missing
    if (!decodedUrl.startsWith('asset://localhost/')) {
      // Add localhost after asset://
      decodedUrl = decodedUrl.replace(/^asset:\/\//, 'asset://localhost/')
    }
    return decodedUrl
  }

  // If it's just a path (e.g., "1754743011163/media/audio-0.bin")
  // This happens when asset.localhost prefix is removed
  if (/^\d+\/media\//.test(decodedUrl)) {
    return `asset://localhost/${decodedUrl}`
  }

  // If we still have encoded asset URL components, decode them
  if (decodedUrl.includes('asset%3A') || decodedUrl.includes('asset%253A')) {
    // Replace encoded characters
    decodedUrl = decodedUrl
      .replace(/asset%253A/g, 'asset:')
      .replace(/asset%3A/g, 'asset:')
      .replace(/%252F/g, '/')
      .replace(/%2F/g, '/')
    
    // Recursively normalize the decoded URL
    return normalizeAssetUrl(decodedUrl)
  }

  // Default: return the URL as-is
  return decodedUrl
}