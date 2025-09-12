/**
 * Application version management
 */

// Version should match package.json, tauri.conf.json, and Cargo.toml
export const APP_VERSION = '1.0.4'

/**
 * Get formatted version string for display in UI
 */
export function getVersionDisplay(): string {
  return `v${APP_VERSION}`
}

/**
 * Get full application name with version
 */
export function getAppNameWithVersion(): string {
  return `SCORM Course Builder ${getVersionDisplay()}`
}