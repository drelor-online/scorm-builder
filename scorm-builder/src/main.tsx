import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppWithDashboard } from './App.dashboard'
// Import CSS in correct order - variables first, then global styles
import './components/DesignSystem/designSystem.css' // CSS variables and design tokens
import './styles/theme.css' // Theme overrides  
import './index.css' // Global application styles
import './errorMonitor'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import { setupMockTauri } from './mocks/mockTauriAPI'

// AUDIT FIX: Guard debug logger behind environment flags
if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true') {
  await import('./utils/ultraSimpleLogger') // Load ultra-simple debug logger synchronously
}

// AUDIT FIX: Gate debug logging behind environment flags
const shouldShowDebugLogs = import.meta.env.DEV || import.meta.env.VITE_DEBUG_LOGS === 'true'

// Set up mock Tauri API in test mode or when Tauri is not available
if (shouldShowDebugLogs) {
  console.log('🔍 Environment check:', {
    mode: import.meta.env.MODE,
    isDev: import.meta.env.DEV,
    hasTauri: typeof window.__TAURI__ !== 'undefined'
  });
}

if (import.meta.env.MODE === 'test' || (import.meta.env.DEV && !window.__TAURI__)) {
  if (shouldShowDebugLogs) {
    console.log('🎭 Setting up mock Tauri API...');
  }
  setupMockTauri();
  if (shouldShowDebugLogs) {
    console.log('✅ Mock Tauri API ready');
  }
}

// Debug logger is now loaded synchronously above

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    React.createElement(React.StrictMode, null,
      React.createElement(ErrorBoundary, null,
        React.createElement(AppWithDashboard)
      )
    )
  )
}
