# YouTube URL Replacement Issue - Audit Findings

## Problem Description
YouTube videos are not displaying as iframes in generated SCORM packages. Instead, they are being replaced with asset.localhost URLs that point to JSON metadata files.

## Root Cause Analysis

### Data Flow
1. **User selects YouTube video** in MediaEnhancementWizard
2. **MediaEnhancementWizard stores YouTube as JSON metadata** (lines 580-601)
   - Creates a JSON file with YouTube URL
   - Registers with MediaRegistry as a file
   - Gets a storage ID like `video-0`
3. **MediaStore loads the JSON file** and creates asset.localhost URL
   - Uses `convertFileSrc` from Tauri API (mediaUrl.ts:73)
   - Creates URL like: `http://asset.localhost/C%3A%5CUsers%5Ctest%5Cmedia%5Cvideo-0.bin`
4. **rustScormGenerator receives asset.localhost URL** instead of YouTube URL
   - Tries to resolve it back (lines 234-261)
   - But the logic isn't always triggered or working correctly
5. **Rust backend doesn't recognize it as YouTube**
   - No `is_youtube` flag set
   - Generates regular video tag instead of iframe

### The Fix Already Attempted
In rustScormGenerator.ts (lines 234-261), there's code to detect asset.localhost URLs and restore YouTube URLs:
```typescript
if (media.url && media.url.includes('asset.localhost')) {
  // Extract media ID and load metadata
  // Replace URL with actual YouTube URL
}
```

However, this fix is in the wrong place - it happens too late in the process.

### The Real Solution
The issue should be fixed at the source in MediaEnhancementWizard (line 588):
```typescript
// Current problematic code:
} else if (mediaItem.url && mediaItem.type === 'video') {
  // For YouTube videos, don't store as file - preserve the URL
  if (mediaItem.url.includes('youtube.com') || mediaItem.url.includes('youtu.be')) {
    console.log(`[MediaEnhancement] YouTube video detected, preserving URL:`, mediaItem.url)
    storageId = undefined  // ← This is correct, but...
  } else {
    // Still stores as JSON metadata
  }
}
```

The code SAYS it preserves YouTube URLs, but it still ends up storing them as JSON metadata files.

## Impact
- All YouTube videos in SCORM packages fail to display
- Users see empty video players or broken content
- The iframe embed functionality is completely bypassed

## Related Code Locations
1. `MediaEnhancementWizardRefactored.tsx:588-601` - Where YouTube gets stored as JSON
2. `MediaStore.ts` - Creates asset.localhost URLs via ParallelMediaLoader
3. `mediaUrl.ts:73` - Uses convertFileSrc to create asset URLs
4. `rustScormGenerator.ts:234-261` - Attempts to fix URLs but too late
5. `src-tauri/src/scorm/templates/topic.html.hbs:111-119` - Expects is_youtube flag

## Duplicate/Confusing Code
- The fix is attempted in rustScormGenerator but should be prevented earlier
- Multiple places try to detect YouTube URLs with similar regex patterns
- The comment says "preserve URL" but the implementation doesn't match