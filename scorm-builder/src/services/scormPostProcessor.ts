import JSZip from 'jszip'

/**
 * Post-process a SCORM package to fix common issues with Rust-generated output
 */
export async function postProcessSCORMPackage(zip: JSZip): Promise<JSZip> {
  const processedZip = new JSZip()
  
  // Copy all files to new zip, processing HTML files
  const files = Object.keys(zip.files)
  
  for (const filename of files) {
    const file = zip.file(filename)
    if (!file) continue
    
    if (filename.endsWith('.html') && filename.startsWith('pages/')) {
      // Process HTML files
      const content = await file.async('string')
      const processedContent = await processHTMLFile(content, filename, zip)
      processedZip.file(filename, processedContent)
    } else {
      // Copy other files as-is
      const content = await file.async('uint8array')
      processedZip.file(filename, content)
    }
  }
  
  return processedZip
}

/**
 * Process an individual HTML file
 */
async function processHTMLFile(html: string, filename: string, zip: JSZip): Promise<string> {
  let processed = html
  
  // Fix YouTube videos
  processed = fixYouTubeVideos(processed)
  
  // Fix audio players
  processed = await fixAudioPlayers(processed, filename, zip)
  
  return processed
}

/**
 * Parse time string to seconds (supports hh:mm:ss, mm:ss, or raw seconds)
 */
function parseTimeToSeconds(timeStr: string): number | undefined {
  if (!timeStr || timeStr.trim() === '') return undefined
  
  // If it's already a number (seconds)
  if (/^\d+$/.test(timeStr)) {
    return Math.max(0, parseInt(timeStr, 10))
  }
  
  // Parse hh:mm:ss or mm:ss format
  const parts = timeStr.split(':').map(Number)
  if (parts.some(isNaN)) return undefined
  
  if (parts.length === 3) {
    // hh:mm:ss format
    const [hours, minutes, seconds] = parts
    return Math.max(0, hours * 3600 + minutes * 60 + seconds)
  } else if (parts.length === 2) {
    // mm:ss format  
    const [minutes, seconds] = parts
    return Math.max(0, minutes * 60 + seconds)
  }
  
  return undefined
}

/**
 * Convert YouTube video tags to iframe embeds with clip timing preservation
 */
function fixYouTubeVideos(html: string): string {
  // Match video tags with YouTube URLs
  const videoRegex = /<video[^>]*>[\s\S]*?<source[^>]*src="(https?:\/\/(?:www\.)?youtube\.com\/watch\?[^"]+|https?:\/\/youtu\.be\/[^"]+)"[^>]*>[\s\S]*?<\/video>/gi
  
  return html.replace(videoRegex, (_match, url) => {
    try {
      const urlObj = new URL(url)
      
      // Extract video ID
      let videoId: string
      if (url.includes('youtu.be/')) {
        // youtu.be/VIDEO_ID format
        videoId = urlObj.pathname.substring(1).split('?')[0]
      } else {
        // youtube.com/watch?v=VIDEO_ID format
        videoId = urlObj.searchParams.get('v') || ''
      }
      
      if (!videoId) return _match // Return original if we can't extract ID
      
      // Parse clip timing parameters (support both 'start'/'t' and 'end')
      const startParam = urlObj.searchParams.get('start') || urlObj.searchParams.get('t')
      const endParam = urlObj.searchParams.get('end')
      
      const startSeconds = startParam ? parseTimeToSeconds(startParam) : undefined
      const endSeconds = endParam ? parseTimeToSeconds(endParam) : undefined
      
      // Build embed URL with clip timing
      const embedParams = new URLSearchParams()
      if (startSeconds !== undefined) {
        embedParams.set('start', startSeconds.toString())
      }
      if (endSeconds !== undefined && (startSeconds === undefined || endSeconds > startSeconds)) {
        embedParams.set('end', endSeconds.toString())
      }
      
      const paramString = embedParams.toString() ? `?${embedParams.toString()}` : ''
      const embedUrl = `https://www.youtube.com/embed/${videoId}${paramString}`
      
      // Create responsive iframe embed
      return `<div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
      <iframe 
        src="${embedUrl}" 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    </div>`
    } catch (error) {
      // If URL parsing fails, return original match
      console.warn('[SCORM Post-processor] Failed to parse YouTube URL:', url, error)
      return _match
    }
  })
}

/**
 * Inject audio players where they're missing
 */
async function fixAudioPlayers(html: string, filename: string, zip: JSZip): Promise<string> {
  // Check if this page already has an audio player
  if (html.includes('audio-player') || html.includes('<audio')) {
    return html
  }
  
  // Extract page ID from filename (e.g., 'pages/welcome.html' -> 'welcome')
  const pageId = filename.replace('pages/', '').replace('.html', '')
  
  // Map page names to expected audio file indexes
  const pageAudioMap: Record<string, number> = {
    'welcome': 0,
    'learning-objectives': 1,
    'objectives': 1,
    'safety-fundamentals': 2,
    'hazard-identification': 3,
    'emergency-procedures': 4,
    'safety-equipment': 5,
    'reporting-procedures': 6,
    'summary': -1 // No audio for summary
  }
  
  const audioIndex = pageAudioMap[pageId]
  if (audioIndex === undefined || audioIndex === -1) {
    return html
  }
  
  // Check if the corresponding audio file exists
  const audioFile = zip.file(`media/audio-${audioIndex}.bin`)
  const audioMeta = zip.file(`media/audio-${audioIndex}.json`)
  
  if (!audioFile || !audioMeta) {
    return html
  }
  
  // Check if caption file exists
  const captionFile = zip.file(`media/caption-${audioIndex}.bin`)
  const hasCaptions = !!captionFile
  
  // Generate audio player HTML
  const audioPlayerHtml = `
            <div class="audio-player">
                <audio id="audio-player-${pageId}" 
                       src="../media/audio-${audioIndex}.bin" 
                       preload="metadata"
                       onloadedmetadata="parent.onAudioLoaded('${pageId}')"
                       ontimeupdate="parent.onAudioTimeUpdate('${pageId}')"
                       onended="parent.onAudioEnded('${pageId}')">
                    ${hasCaptions ? `<track kind="captions" src="../media/caption-${audioIndex}.bin" srclang="en" label="English" default>` : ''}
                </audio>
                <div class="audio-main">
                    <button class="play-pause" onclick="parent.toggleAudio('${pageId}', event)">▶</button>
                    <div class="audio-track">
                        <div class="track-progress" onclick="parent.seekAudio(event, '${pageId}')">
                            <div class="track-fill" id="track-fill-${pageId}">
                                <div class="track-handle"></div>
                            </div>
                        </div>
                        <div class="track-time">
                            <span id="current-time-${pageId}">0:00</span>
                            <span id="duration-${pageId}">0:00</span>
                        </div>
                    </div>
                </div>
                <div class="audio-controls">
                    <button class="audio-btn" onclick="parent.skip(-10, '${pageId}')">◀ 10s</button>
                    <button class="audio-btn" id="speed-btn-${pageId}" onclick="parent.changeSpeed('${pageId}')">1x</button>
                    <button class="audio-btn active" id="cc-btn-${pageId}" onclick="parent.toggleCaptions('${pageId}')">CC</button>
                    <button class="audio-btn" onclick="parent.toggleVolume('${pageId}', event)">🔊</button>
                    <button class="audio-btn" onclick="parent.skip(10, '${pageId}')">10s ▶</button>
                </div>
                <div class="caption-display" id="caption-display-${pageId}">
                    <p id="caption-text-${pageId}"></p>
                </div>
            </div>`
  
  // Find the media-panel div and inject the audio player
  const mediaPanelRegex = /<div class="media-panel">([\s\S]*?)<\/div>\s*<\/div>/
  
  return html.replace(mediaPanelRegex, (_match, content) => {
    // Check if there's already content in the media panel
    const hasContent = content.trim() !== '' && !content.includes('<!-- No audio')
    
    if (hasContent) {
      // Add audio player after existing content
      return `<div class="media-panel">${content}${audioPlayerHtml}</div>
    </div>`
    } else {
      // Replace empty content with audio player
      return `<div class="media-panel">${audioPlayerHtml}</div>
    </div>`
    }
  })
}