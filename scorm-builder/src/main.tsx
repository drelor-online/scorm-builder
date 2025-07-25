import React from 'react'
import ReactDOM from 'react-dom/client'
import { AppWithDashboard } from './App.dashboard'
import './index.css'
import './errorMonitor'
import './utils/debugLogger'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'

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
