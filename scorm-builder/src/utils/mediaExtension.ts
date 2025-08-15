/**
 * Robust media extension detection utilities
 */

/**
 * Extract file extension from a filename or path
 * Handles edge cases like multiple dots, query parameters, and paths
 */
export function getMediaExtension(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return '';
  }

  // Remove query parameters and fragments
  const cleanName = filename.split('?')[0].split('#')[0];
  
  // Extract just the filename from path
  const basename = cleanName.split('/').pop()?.split('\\').pop() || '';
  
  // Handle hidden files that start with dot
  const parts = basename.split('.');
  if (parts.length === 1) {
    return ''; // No extension
  }
  
  // Get the last part as extension
  const extension = parts[parts.length - 1];
  
  // Return lowercase extension
  return extension.toLowerCase();
}

/**
 * Detect media type and extension from a Blob's MIME type and content
 */
export async function detectMediaTypeFromBlob(blob: Blob): Promise<{ 
  type: string; 
  extension: string; 
  mimeType?: string;
  isImage?: boolean;
  isVideo?: boolean;
  isAudio?: boolean;
}> {
  const mimeType = blob.type || 'application/octet-stream';
  
  // Map common MIME types to extensions
  const mimeToExtension: Record<string, string> = {
    // Images
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    
    // Videos
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    'video/x-msvideo': 'avi',
    
    // Audio
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'audio/ogg': 'ogg',
    'audio/aac': 'aac',
    'audio/flac': 'flac',
    
    // Documents
    'application/pdf': 'pdf',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
  };

  // Get initial extension from MIME type
  let extension = mimeToExtension[mimeType];
  let isImage = false;
  let isVideo = false;
  let isAudio = false;
  
  // If extension not found from MIME type, try to detect from content
  if (!extension || mimeType === 'application/octet-stream' || mimeType === 'text/plain' || mimeType === 'text/xml') {
    try {
      // Read first part of blob as text to check for SVG
      const textSlice = blob.slice(0, 1024);
      let text: string;
      
      // Try the text() method if available, otherwise use FileReader
      if (typeof textSlice.text === 'function') {
        text = await textSlice.text();
      } else {
        // Fallback for environments without Blob.text()
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsText(textSlice);
        });
      }
      
      // Check for SVG content
      const lowerText = text.toLowerCase();
      if (lowerText.includes('<svg') || (lowerText.includes('<?xml') && lowerText.includes('svg'))) {
        extension = 'svg';
        isImage = true;
      }
      
      // If still no extension, check magic bytes
      if (!extension) {
        const arrayBuffer = await blob.slice(0, 12).arrayBuffer();
        const bytes = new Uint8Array(arrayBuffer);
        
        // Check PNG signature
        if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
          extension = 'png';
          isImage = true;
        }
        // Check JPEG signature
        else if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
          extension = 'jpg';
          isImage = true;
        }
        // Check GIF signature
        else if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
          extension = 'gif';
          isImage = true;
        }
        // Check WebP signature
        else if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
                 bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
          extension = 'webp';
          isImage = true;
        }
      }
    } catch {
      // If reading fails, fall back to default
    }
  }

  // If still no extension, use default
  if (!extension) {
    extension = 'bin';
  }

  // Determine media type from MIME type or detected extension
  let type = 'unknown';
  if (mimeType.startsWith('image/') || isImage) {
    type = 'image';
    isImage = true;
  } else if (mimeType.startsWith('video/')) {
    type = 'video';
    isVideo = true;
  } else if (mimeType.startsWith('audio/')) {
    type = 'audio';
    isAudio = true;
  } else if (mimeType === 'application/pdf') {
    type = 'document';
  }

  return { 
    type, 
    extension,
    mimeType: mimeType !== 'application/octet-stream' ? mimeType : undefined,
    isImage,
    isVideo,
    isAudio
  };
}