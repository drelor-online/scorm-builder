export const DURATIONS = {
  // Toast notification duration
  toastDuration: 5000, // 5 seconds
  
  // Autosave interval
  autosaveInterval: 30000, // 30 seconds
  
  // Animation durations
  fadeIn: 300,
  fadeOut: 200,
  slideIn: 300,
  
  // Debounce/throttle delays
  searchDebounce: 500,
  inputDebounce: 300,
  
  // Loading states
  minimumLoadingTime: 500, // Show loading for at least 500ms
  
  // Timeouts
  apiTimeout: 30000, // 30 seconds for API calls
  fileUploadTimeout: 60000, // 60 seconds for file uploads
} as const

export type DurationKey = keyof typeof DURATIONS