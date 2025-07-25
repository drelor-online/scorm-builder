/**
 * Adjusts VTT caption timing to match the actual audio duration
 * @param vttContent - The original VTT content
 * @param audioDuration - The actual duration of the audio file in seconds
 * @param captionDuration - Optional: The total duration of captions. If not provided, will be calculated from VTT
 * @returns Adjusted VTT content with scaled timestamps
 */
export function adjustCaptionTiming(
  vttContent: string,
  audioDuration: number,
  captionDuration?: number
): string {
  // If caption duration is 0 or audio duration is 0, return original
  if (audioDuration === 0 || captionDuration === 0) {
    return vttContent
  }

  // Parse VTT content
  const lines = vttContent.split('\n')
  const adjustedLines: string[] = []
  
  // Find the last timestamp if caption duration not provided
  let lastTimestamp = captionDuration || 0
  if (!captionDuration) {
    const timestampRegex = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const match = lines[i].match(timestampRegex)
      if (match) {
        lastTimestamp = parseTimestamp(match[2])
        break
      }
    }
    
    // If no timestamps found, return original
    if (lastTimestamp === 0) {
      return vttContent
    }
  }

  // Calculate scaling factor
  const scaleFactor = audioDuration / lastTimestamp

  // Process each line
  const timestampRegex = /(\d{2}:\d{2}:\d{2}\.\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}\.\d{3})/
  
  for (const line of lines) {
    const match = line.match(timestampRegex)
    if (match) {
      const startTime = parseTimestamp(match[1])
      const endTime = parseTimestamp(match[2])
      
      const adjustedStart = startTime * scaleFactor
      const adjustedEnd = endTime * scaleFactor
      
      const newLine = line.replace(
        match[0],
        `${formatTimestamp(adjustedStart)} --> ${formatTimestamp(adjustedEnd)}`
      )
      adjustedLines.push(newLine)
    } else {
      adjustedLines.push(line)
    }
  }

  return adjustedLines.join('\n')
}

/**
 * Parse VTT timestamp to seconds
 * @param timestamp - Format: "00:00:00.000"
 * @returns Time in seconds
 */
function parseTimestamp(timestamp: string): number {
  const parts = timestamp.split(':')
  const hours = parseInt(parts[0], 10)
  const minutes = parseInt(parts[1], 10)
  const seconds = parseFloat(parts[2])
  
  return hours * 3600 + minutes * 60 + seconds
}

/**
 * Format seconds to VTT timestamp
 * @param seconds - Time in seconds
 * @returns Timestamp in format "00:00:00.000"
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  return `${hours.toString().padStart(2, '0')}:${minutes
    .toString()
    .padStart(2, '0')}:${secs.toFixed(3).padStart(6, '0')}`
}