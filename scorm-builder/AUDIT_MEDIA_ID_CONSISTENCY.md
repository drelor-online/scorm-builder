# Media ID Consistency Issues - Audit Findings

## Problem Description
Multiple competing ID generation systems create inconsistent media IDs across the application, leading to:
- Media files not found after saving/loading
- Audio files appearing on wrong pages
- Confusion about which ID format to use

## Competing ID Systems

### 1. idGenerator.ts (Simple Numeric)
```typescript
generateMediaId('audio', 0) → 'audio-0'
generateMediaId('image', 1) → 'image-1'
```
- Uses simple numeric patterns
- Index based on page position (welcome=0, objectives=1, topics start at 2)

### 2. MediaRegistry.ts (Different Logic)
```typescript
generateId('welcome', 'audio') → 'audio-0'
generateId('topic-safety', 'audio') → 'audio-2' // Uses topic mapping
generateId('welcome', 'image') → 'image-0' // Global counter for images
```
- Audio/captions: Uses page index mapping
- Images/videos: Uses global sequential counter
- Maintains internal topic index mapping

### 3. rustScormGenerator.ts (Runtime Counter)
```typescript
mediaCounter: { [type: string]: number } = {}
// Generates: image-1, image-2, image-3 based on processing order
```
- Creates IDs at SCORM generation time
- Counter based on order of processing, not page structure
- Different IDs every time SCORM is generated

### 4. Legacy Formats Still Present
- `welcome-audio-0` (page-prefixed format)
- `content-0` (content-prefixed IDs)
- Topic names like `safety-fundamentals` instead of `topic-0`
- Random GUIDs in some places

## Specific Inconsistencies Found

### Audio ID Mismatch
1. **AudioNarrationWizard** saves with one ID format
2. **MediaRegistry** generates different IDs
3. **SCORM generation** creates yet another set of IDs
4. Result: Audio files can't be found or play on wrong pages

### Image Numbering Conflicts
- MediaRegistry: Global counter starting at 0
- rustScormGenerator: Per-generation counter
- FileStorage: May use different naming
- Result: `image-0` might refer to different images in different contexts

### Topic Ordering Issues
- MediaRegistry maintains its own topic→index mapping
- This mapping isn't persisted
- On reload, topics might get different indices
- Result: `audio-2` might become `audio-3` after reload

## Impact on Code

### Where IDs Are Generated
1. `MediaRegistry.registerMedia()` - When media is uploaded
2. `rustScormGenerator.resolveImageUrl()` - During SCORM generation
3. `courseContentConverter` - During format conversion
4. `AudioNarrationWizard` - When saving audio

### Where IDs Are Used
1. `FileStorage` - Storing/retrieving files
2. `MediaStore` - Caching and URL generation
3. `SCORM templates` - Referencing media files
4. `Preview components` - Displaying media

## Root Cause
No single source of truth for media IDs. Each component generates IDs independently based on different logic.

## Related Code Patterns

### Pattern 1: ID Generation During Upload
```typescript
// MediaRegistry
const id = this.generateId(pageId, type)
await this.storage.storeFile(file, id)
```

### Pattern 2: ID Generation During SCORM
```typescript
// rustScormGenerator
mediaCounter.image++
const filename = `image-${mediaCounter.image}.${ext}`
```

### Pattern 3: ID Lookup Confusion
```typescript
// Some code expects: 'audio-0'
// Other code expects: 'welcome-audio-0'
// Storage might have: 'audio-abc123'
```

## Recommendations
1. **Single ID Generator**: Use only idGenerator.ts
2. **Consistent Format**: Always use `type-index` format
3. **Stable Indices**: Base on page structure, not processing order
4. **Remove Legacy**: Clean up old ID formats
5. **Persist Mapping**: Store ID→file mappings explicitly