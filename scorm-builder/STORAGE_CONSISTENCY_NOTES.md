# Storage Consistency Notes for SCORM Builder

## Issue: Audio and Captions Disappearing After SCORM Generation

### Problem Description
After generating a SCORM package, when users return to the audio narration page, the learning objectives audio and all captions appear to be missing.

### Root Cause Analysis
The issue is not that media files are being deleted during SCORM generation. Instead, there's a mismatch in how media is stored and retrieved:

1. **Storage Pattern**:
   - Audio files are stored with ID pattern: `audio-XXXX` (e.g., `audio-0002` for objectives)
   - Caption files are stored with ID pattern: `caption-XXXX`
   - Metadata includes `topicId` field (e.g., `topicId: 'objectives'`)

2. **Retrieval Pattern**:
   - Direct retrieval uses the ID (e.g., `storage.getMedia('audio-0002')`)
   - Topic-based retrieval uses metadata (e.g., `storage.getMediaForTopic('objectives')`)

3. **The Issue**:
   - The `getMediaForTopic()` method searches by the `topicId` metadata field
   - If the storage context changes or metadata is not properly persisted, the search fails
   - This makes it appear as if the media has been deleted

### Storage Locations
- **IndexedDB**: Used by PersistentStorage for binary media data
- **Project File**: Used by FileStorage to save project data including base64-encoded media

### Key Code Locations
- **Storage**: `AudioNarrationWizardRefactored.tsx` lines 772-785 (audio storage)
- **Retrieval**: `AudioNarrationWizardRefactored.tsx` lines 314-337 (objectives media loading)
- **SCORM Loading**: `SCORMPackageBuilderRefactored.tsx` lines 257-277 (objectives audio loading)

### Solution Approach
1. **Ensure Consistent IDs**: Always use the same ID pattern for storage and retrieval
2. **Verify Metadata Persistence**: Ensure the `topicId` metadata is properly saved and retrieved
3. **Add Fallback Logic**: If `getMediaForTopic()` fails, try direct ID retrieval
4. **Project Save Verification**: Ensure media is properly saved to the project file

### Testing Recommendations
1. Upload audio/captions for objectives page
2. Save the project
3. Generate SCORM package
4. Close and reopen the project
5. Verify media is still available

### Future Improvements
- Add logging to track when media is stored and retrieved
- Implement a media verification check before SCORM generation
- Add a recovery mechanism if media references are lost