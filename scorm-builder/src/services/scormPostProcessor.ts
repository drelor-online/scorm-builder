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
 * Convert YouTube video tags to iframe embeds
 */
function fixYouTubeVideos(html: string): string {
  // Match video tags with YouTube URLs
  const videoRegex = /<video[^>]*>[\s\S]*?<source[^>]*src="(https?:\/\/(www\.)?youtube\.com\/watch\?v=([^"]+)|https?:\/\/youtu\.be\/([^"]+))"[^>]*>[\s\S]*?<\/video>/gi
  
  return html.replace(videoRegex, (_match, _url, _domain, videoId1, videoId2) => {
    const videoId = videoId1 || videoId2
    
    // Extract video ID from YouTube URL
    let extractedId = videoId
    if (videoId1) {
      // Handle youtube.com/watch?v=ID format
      extractedId = videoId.split('&')[0] // Remove any additional parameters
    }
    
    // Create responsive iframe embed
    return `<div class="video-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden;">
      <iframe 
        src="https://www.youtube.com/embed/${extractedId}" 
        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowfullscreen>
      </iframe>
    </div>`
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