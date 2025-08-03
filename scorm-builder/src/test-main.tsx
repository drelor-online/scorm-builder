import React from 'react'
import * as ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary'

// Mock PersistentStorageProvider for testing
const MockStorageProvider = ({ children }: { children: React.ReactNode }) => {
  // Mock storage configuration - not used directly but available for child components

  return (
    <div>
      {React.Children.map(children, child => {
        if (React.isValidElement(child) && child.type === App) {
          // Render App directly without dashboard wrapper
          return <App />
        }
        return child
      })}
    </div>
  )
}

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <MockStorageProvider>
          <App />
        </MockStorageProvider>
      </ErrorBoundary>
    </React.StrictMode>
  )
}