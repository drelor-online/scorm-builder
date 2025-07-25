/**
 * Generate welcome page with media support
 */
export function generateWelcomePage(courseContent: any): string {
  const welcome = courseContent.welcome;
  // Use the original file names without replacement
  const audioFile = welcome.audioFile;
  const captionFile = welcome.captionFile;
  
  const hasAudio = audioFile;
  const hasCaptions = captionFile;
  const hasImage = welcome.media?.some((m: any) => m.type === 'image') || welcome.imageUrl;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome</title>
    <link rel="stylesheet" href="../styles/main.css">
</head>
<body style="margin: 0; padding: 20px; overflow-y: auto; height: 100vh; box-sizing: border-box;">
    <div class="content-layout">
        <div class="text-section">
            <h1>${welcome.title}</h1>
            ${welcome.content.split('\n\n').map((p: string) => `<p>${p}</p>`).join('\n            ')}
        </div>

        <div class="media-panel">
            ${hasImage ? `
            <div class="media-image">
                ${welcome.media?.filter((m: any) => m.type === 'image').map((media: any) => {
                        const ext = media.fileExtension || 'jpg';
                        const imagePath = `../media/images/${media.id}.${ext}`;
                        const escapedTitle = media.title.replace(/'/g, "\\'");
                        return `<img src="${imagePath}" alt="${media.title}" onclick="parent.enlargeImage('${imagePath}', '${escapedTitle}')" style="cursor: pointer;">`;
                    }).join('') || 
                    (welcome.imageUrl && !welcome.imageUrl.startsWith('blob:') ? 
                        `<img src="../media/images/${welcome.imageUrl}" alt="${welcome.title}" onclick="parent.enlargeImage('../media/images/${welcome.imageUrl}', '${welcome.title.replace(/'/g, "\\'")}')" style="cursor: pointer;">` : 
                        ''
                    )
                }
            </div>` : ''}
            
            ${hasAudio ? `
            <div class="audio-player">
                <audio id="audio-player-welcome" src="../media/audio/${audioFile || 'welcome-audio.mp3'}" preload="metadata">
                    ${hasCaptions ? `<track kind="subtitles" src="../media/captions/${captionFile || 'welcome-captions.vtt'}" srclang="en" label="English" default>` : ''}
                </audio>
                <div class="audio-main">
                    <button class="play-pause" onclick="toggleAudio('welcome')">▶</button>
                    <div class="audio-track">
                        <div class="track-progress" onclick="seekAudio(event, 'welcome')">
                            <div class="track-fill" id="track-fill-welcome">
                                <div class="track-handle"></div>
                            </div>
                        </div>
                        <div class="track-time">
                            <span id="current-time-welcome">0:00</span>
                            <span id="duration-welcome">0:00</span>
                        </div>
                    </div>
                </div>
                <div class="audio-controls">
                    <button class="audio-btn" onclick="skip(-10, 'welcome')">◀ 10s</button>
                    <button class="audio-btn" id="speed-btn-welcome" onclick="changeSpeed('welcome')">1x</button>
                    <button class="audio-btn active" id="cc-btn-welcome" onclick="toggleCaptions('welcome')">CC</button>
                    <button class="audio-btn" onclick="toggleVolume('welcome')">🔊</button>
                    <button class="audio-btn" onclick="skip(10, 'welcome')">10s ▶</button>
                </div>
                <div class="caption-display" id="captionDisplay-welcome">
                    <p id="caption-text-welcome"></p>
                </div>
            </div>` : ''}
        </div>
    </div>
    
    <!-- Navigation handled by main index.html sidebar and footer -->
    
    <script src="../scripts/navigation.js"></script>
</body>
</html>`
}

/**
 * Generate learning objectives page
 */
export function generateObjectivesPage(courseContent: any): string {
  const objectives = courseContent.objectives || [];
  const objectivesPage = courseContent.objectivesPage || {};
  
  const hasAudio = objectivesPage.audioFile;
  const hasCaptions = objectivesPage.captionFile;
  const hasImage = objectivesPage.media?.some((m: any) => m.type === 'image') || objectivesPage.imageUrl;
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Learning Objectives</title>
    <link rel="stylesheet" href="../styles/main.css">
</head>
<body style="margin: 0; padding: 20px; overflow-y: auto; height: 100vh; box-sizing: border-box;">
    <div class="content-layout">
        <div class="text-section">
            <h1>Learning Objectives</h1>
            ${objectives.length > 0 ? `
            <ul>
                ${objectives.map((obj: string) => `<li>${obj}</li>`).join('\n                ')}
            </ul>` : '<p>No specific objectives defined for this course.</p>'}
        </div>

        <div class="media-panel">
            ${hasImage ? `
            <div class="media-image">
                ${objectivesPage.media?.filter((m: any) => m.type === 'image').map((media: any) => {
                        const ext = media.fileExtension || 'jpg';
                        const imagePath = `../media/images/${media.id}.${ext}`;
                        const escapedTitle = media.title.replace(/'/g, "\\'");
                        return `<img src="${imagePath}" alt="${media.title}" onclick="parent.enlargeImage('${imagePath}', '${escapedTitle}')" style="cursor: pointer;">`;
                    }).join('') || 
                    (objectivesPage.imageUrl && !objectivesPage.imageUrl.startsWith('blob:') ? 
                        `<img src="../media/images/${objectivesPage.imageUrl}" alt="Learning Objectives" onclick="parent.enlargeImage('../media/images/${objectivesPage.imageUrl}', 'Learning Objectives')" style="cursor: pointer;">` : 
                        ''
                    )
                }
            </div>` : ''}
            
            ${hasAudio ? `
            <div class="audio-player">
                <audio id="audio-player-objectives" src="../media/audio/${objectivesPage.audioFile || 'objectives-audio.mp3'}" preload="metadata">
                    ${hasCaptions ? `<track kind="subtitles" src="../media/captions/${objectivesPage.captionFile || 'objectives-captions.vtt'}" srclang="en" label="English" default>` : ''}
                </audio>
                <div class="audio-main">
                    <button class="play-pause" onclick="toggleAudio('objectives')">▶</button>
                    <div class="audio-track">
                        <div class="track-progress" onclick="seekAudio(event, 'objectives')">
                            <div class="track-fill" id="track-fill-objectives">
                                <div class="track-handle"></div>
                            </div>
                        </div>
                        <div class="track-time">
                            <span id="current-time-objectives">0:00</span>
                            <span id="duration-objectives">0:00</span>
                        </div>
                    </div>
                </div>
                <div class="audio-controls">
                    <button class="audio-btn" onclick="skip(-10, 'objectives')">◀ 10s</button>
                    <button class="audio-btn" id="speed-btn-objectives" onclick="changeSpeed('objectives')">1x</button>
                    <button class="audio-btn active" id="cc-btn-objectives" onclick="toggleCaptions('objectives')">CC</button>
                    <button class="audio-btn" onclick="toggleVolume('objectives')">🔊</button>
                    <button class="audio-btn" onclick="skip(10, 'objectives')">10s ▶</button>
                </div>
                <div class="caption-display" id="captionDisplay-objectives">
                    <p id="caption-text-objectives"></p>
                </div>
            </div>` : ''}
        </div>
    </div>
    
    <!-- Navigation handled by main index.html sidebar and footer -->
    
    <script src="../scripts/navigation.js"></script>
</body>
</html>`;
}