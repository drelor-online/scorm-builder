import { useState, useEffect } from 'react'
import App from './App'

// Simple test version that bypasses storage
export function TestApp() {
  const [step, setStep] = useState(0)
  
  // Mock data for testing
  const mockData = {
    courseData: {
      title: 'Test Course',
      difficulty: 3,
      template: 'Technical',
      topics: ['Topic 1', 'Topic 2', 'Topic 3']
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#18181b', color: '#a1a1aa' }}>
      <App />
    </div>
  )
}