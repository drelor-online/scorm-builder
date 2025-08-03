import App from './App'

// Simple test version that bypasses storage
export function TestApp() {
  return (
    <div style={{ minHeight: '100vh', background: '#18181b', color: '#a1a1aa' }}>
      <App />
    </div>
  )
}