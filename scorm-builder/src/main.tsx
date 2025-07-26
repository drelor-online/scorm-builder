import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppWithDashboard } from './App.dashboard'
import './index.css'
import './errorMonitor'
import './utils/debugLogger'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'
import { setupMockTauri } from './mocks/mockTauriAPI'

// Set up mock Tauri API in test mode or when Tauri is not available
console.log('🔍 Environment check:', {
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  hasTauri: typeof window.__TAURI__ !== 'undefined'
});

if (import.meta.env.MODE === 'test' || (import.meta.env.DEV && !window.__TAURI__)) {
  console.log('🎭 Setting up mock Tauri API...');
  setupMockTauri();
  console.log('✅ Mock Tauri API ready');
}

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
