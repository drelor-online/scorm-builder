/**
 * Timeout constants for SCORM Builder operations
 *
 * Centralized timeout configuration with explanations for maintainability
 */

/**
 * Per-file media fetch timeout (10 seconds)
 *
 * Rationale: Individual media files should load quickly. 10s allows for
 * network hiccups but prevents hanging on truly missing files.
 * Used in: SCORMPackageBuilder per-media fetch operations
 */
export const MEDIA_FETCH_TIMEOUT = 10_000 // 10 seconds

/**
 * Batch generation timeout for large operations (10 minutes)
 *
 * Rationale: Large SCORM packages with many media files can take several
 * minutes to process. 10 minutes provides buffer for worst-case scenarios
 * while preventing infinite hangs.
 * Used in: Rust SCORM generator for full package builds
 */
export const BATCH_GENERATION_TIMEOUT = 600_000 // 10 minutes

/**
 * UI progress update interval (100ms)
 *
 * Rationale: 10fps provides smooth progress updates without overwhelming
 * the UI thread. Fast enough to feel responsive, slow enough to be efficient.
 * Used in: Progress bars and loading indicators
 */
export const PROGRESS_UPDATE_INTERVAL = 100 // 100ms

/**
 * Auto-save debounce timeout (1 second)
 *
 * Rationale: Prevents excessive saves while typing, but quick enough that
 * users don't lose much work if they navigate away quickly.
 * Used in: Form auto-save operations
 */
export const AUTOSAVE_DEBOUNCE_TIMEOUT = 1_000 // 1 second

/**
 * Media cache cleanup interval (5 minutes)
 *
 * Rationale: Regular cleanup prevents memory bloat from accumulated blob URLs
 * without being so frequent as to impact performance.
 * Used in: BlobURLManager periodic cleanup
 */
export const CACHE_CLEANUP_INTERVAL = 300_000 // 5 minutes

/**
 * Network request retry delay (2 seconds)
 *
 * Rationale: Quick retry for transient network issues, but long enough
 * to avoid overwhelming servers with rapid-fire requests.
 * Used in: API call retry logic
 */
export const NETWORK_RETRY_DELAY = 2_000 // 2 seconds

/**
 * Toast notification auto-dismiss (5 seconds)
 *
 * Rationale: Long enough to read the message, short enough to not clutter
 * the UI. Follows common UX patterns.
 * Used in: Notification system
 */
export const TOAST_AUTO_DISMISS = 5_000 // 5 seconds

/**
 * File watcher debounce (500ms)
 *
 * Rationale: Multiple file system events can fire rapidly. This debounces
 * them to a manageable rate while still feeling responsive.
 * Used in: File system watching operations
 */
export const FILE_WATCHER_DEBOUNCE = 500 // 500ms

/**
 * Search input debounce (300ms)
 *
 * Rationale: Balance between responsiveness and avoiding excessive API calls
 * while typing. Standard UX pattern for search inputs.
 * Used in: Search input components
 */
export const SEARCH_INPUT_DEBOUNCE = 300 // 300ms

/**
 * Animation duration constants
 */
export const ANIMATION = {
  /** Fast animations (150ms) - micro-interactions */
  FAST: 150,
  /** Normal animations (250ms) - most UI transitions */
  NORMAL: 250,
  /** Slow animations (400ms) - major layout changes */
  SLOW: 400,
} as const