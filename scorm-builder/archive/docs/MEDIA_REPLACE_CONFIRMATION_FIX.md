# Media Replace Confirmation Fix Summary

## Issue
When a topic already had media selected, attempting to upload or select new media would either do nothing or silently replace the existing media without warning. This could lead to accidental loss of previously selected media.

## Solution
Implemented a confirmation dialog that appears when users try to add media to a page that already has media, giving them the choice to replace or cancel.

## Changes Made

### 1. Added State Management
```typescript
const [showReplaceConfirm, setShowReplaceConfirm] = useState(false)
const [pendingMedia, setPendingMedia] = useState<Media | null>(null)
```

### 2. Modified handleAddMedia Function
- Now checks if media already exists before adding
- If media exists, shows confirmation dialog
- If no media exists, adds directly

### 3. Created addMediaToPage Function
- Separated the actual media addition logic
- Changed from appending to array to replacing (single media per topic)
- Ensures only one media item per page

### 4. Added handleConfirmReplaceMedia Function
- Handles the confirmation action
- Adds the pending media and clears state

### 5. Added Replace Media Dialog
```typescript
<ConfirmDialog
  isOpen={showReplaceConfirm}
  title="Replace Media"
  message="This topic already has media. Do you want to replace it with the new selection?"
  confirmText="Replace"
  cancelText="Cancel"
  variant="warning"
  onConfirm={handleConfirmReplaceMedia}
  onCancel={() => {
    setShowReplaceConfirm(false)
    setPendingMedia(null)
  }}
/>
```

## Behavior Changes

### Before
- Clicking upload/select when media existed would either:
  - Do nothing (confusing)
  - Add multiple media items (if array-based)
  - Silently replace (data loss risk)

### After
- Clicking upload/select when media exists:
  - Shows confirmation dialog
  - User must explicitly choose to replace
  - Can cancel to keep existing media
- Only one media item allowed per topic (replaced array logic)

## Benefits
1. **Prevents Accidental Loss**: Users are warned before replacing existing media
2. **Clear Intent**: Users must explicitly confirm replacement
3. **Better UX**: No more confusion about why uploads "don't work"
4. **Consistency**: Uses the same ConfirmDialog component as other features

## User Flow
1. User has existing media on a topic
2. User tries to upload or select new media
3. Confirmation dialog appears: "This topic already has media. Do you want to replace it with the new selection?"
4. User can:
   - Click "Replace" to proceed with replacement
   - Click "Cancel" to keep existing media