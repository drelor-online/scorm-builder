import React, { useState, useEffect } from 'react'
import { Card, Button, Flex } from './DesignSystem'
import { logMemoryUsage } from '../utils/testRunner'

interface TestItem {
  id: string
  category: string
  description: string
  steps: string[]
  status: 'pending' | 'pass' | 'fail' | 'skip'
  notes?: string
}

const testItems: TestItem[] = [
  {
    id: 'new-project',
    category: 'Project Management',
    description: 'Create New Project',
    steps: [
      'Click "Create New Project"',
      'Enter project name',
      'Choose save location',
      'Verify .scormproj file created',
      'Verify project opens'
    ],
    status: 'pending'
  },
  {
    id: 'course-seed',
    category: 'Course Creation',
    description: 'Course Seed Data Entry',
    steps: [
      'Enter course title',
      'Select difficulty level',
      'Choose template or custom topics',
      'Click Next',
      'Verify data is saved'
    ],
    status: 'pending'
  },
  {
    id: 'ai-generation',
    category: 'Content Generation',
    description: 'AI Content Generation',
    steps: [
      'Review AI prompt',
      'Click Generate Content',
      'Wait for completion',
      'Verify all topics have content',
      'Check welcome and objectives pages'
    ],
    status: 'pending'
  },
  {
    id: 'audio-recording',
    category: 'Audio',
    description: 'Audio Recording',
    steps: [
      'Click record button for a topic',
      'Record 5-10 seconds',
      'Stop and save recording',
      'Verify playback works',
      'Check audio waveform displays'
    ],
    status: 'pending'
  },
  {
    id: 'audio-upload',
    category: 'Audio',
    description: 'Audio File Upload',
    steps: [
      'Click upload for a topic',
      'Select MP3 file',
      'Verify upload success',
      'Play uploaded audio',
      'Check file persists after reload'
    ],
    status: 'pending'
  },
  {
    id: 'media-images',
    category: 'Media',
    description: 'Image Enhancement',
    steps: [
      'Go to Media Enhancement',
      'Upload local image',
      'Search and add Google image',
      'Verify images display',
      'Check images in preview'
    ],
    status: 'pending'
  },
  {
    id: 'media-videos',
    category: 'Media',
    description: 'Video Enhancement',
    steps: [
      'Add YouTube video URL',
      'Verify video preview',
      'Save and continue',
      'Check video embeds correctly'
    ],
    status: 'pending'
  },
  {
    id: 'activities',
    category: 'Activities',
    description: 'Knowledge Check Editing',
    steps: [
      'Edit a knowledge check question',
      'Add new answer option',
      'Change correct answer',
      'Save changes',
      'Verify in preview'
    ],
    status: 'pending'
  },
  {
    id: 'scorm-generation',
    category: 'SCORM',
    description: 'SCORM Package Generation',
    steps: [
      'Go to SCORM Builder',
      'Select SCORM version',
      'Click Generate Package',
      'Save ZIP file',
      'Extract and verify contents'
    ],
    status: 'pending'
  },
  {
    id: 'scorm-testing',
    category: 'SCORM',
    description: 'SCORM Package Testing',
    steps: [
      'Open index.html in browser',
      'Test navigation between pages',
      'Verify audio plays',
      'Check captions display',
      'Test knowledge checks',
      'Verify assessment scoring'
    ],
    status: 'pending'
  },
  {
    id: 'persistence',
    category: 'Data',
    description: 'Project Persistence',
    steps: [
      'Make changes to project',
      'Close application',
      'Reopen application',
      'Open same project',
      'Verify all data intact'
    ],
    status: 'pending'
  },
  {
    id: 'memory-check',
    category: 'Performance',
    description: 'Memory Usage Check',
    steps: [
      'Open DevTools Memory tab',
      'Take heap snapshot',
      'Perform various actions',
      'Take another snapshot',
      'Check for memory leaks'
    ],
    status: 'pending'
  }
]

export const TestChecklist: React.FC = () => {
  const [tests, setTests] = useState<TestItem[]>(testItems)
  const [showNotes, setShowNotes] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  const updateTestStatus = (id: string, status: TestItem['status']) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, status } : test
    ))
  }

  const updateTestNotes = (id: string, notes: string) => {
    setTests(prev => prev.map(test => 
      test.id === id ? { ...test, notes } : test
    ))
    setShowNotes(null)
    setNoteText('')
  }

  const getStatusColor = (status: TestItem['status']) => {
    switch (status) {
      case 'pass': return '#22c55e'
      case 'fail': return '#ef4444'
      case 'skip': return '#6b7280'
      default: return '#3b82f6'
    }
  }

  const getStats = () => {
    const total = tests.length
    const passed = tests.filter(t => t.status === 'pass').length
    const failed = tests.filter(t => t.status === 'fail').length
    const skipped = tests.filter(t => t.status === 'skip').length
    const pending = tests.filter(t => t.status === 'pending').length
    return { total, passed, failed, skipped, pending }
  }

  const stats = getStats()

  // Log memory on mount
  useEffect(() => {
    logMemoryUsage('TestChecklist mounted')
    return () => {
      logMemoryUsage('TestChecklist unmounted')
    }
  }, [])

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <Card title="End-to-End Test Checklist" padding="large">
        <div style={{ marginBottom: '2rem' }}>
          <h3>Test Progress</h3>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
            <span>Total: {stats.total}</span>
            <span style={{ color: '#22c55e' }}>Passed: {stats.passed}</span>
            <span style={{ color: '#ef4444' }}>Failed: {stats.failed}</span>
            <span style={{ color: '#6b7280' }}>Skipped: {stats.skipped}</span>
            <span style={{ color: '#3b82f6' }}>Pending: {stats.pending}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '1rem' }}>
          {tests.map(test => (
            <Card key={test.id} padding="medium">
              <Flex justify="space-between" align="start">
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: 0, color: getStatusColor(test.status) }}>
                    [{test.category}] {test.description}
                  </h4>
                  <ul style={{ margin: '0.5rem 0', paddingLeft: '1.5rem' }}>
                    {test.steps.map((step, i) => (
                      <li key={i} style={{ fontSize: '0.875rem', color: '#a1a1aa' }}>
                        {step}
                      </li>
                    ))}
                  </ul>
                  {test.notes && (
                    <div style={{ 
                      marginTop: '0.5rem', 
                      padding: '0.5rem', 
                      backgroundColor: '#27272a',
                      borderRadius: '0.25rem',
                      fontSize: '0.875rem'
                    }}>
                      <strong>Notes:</strong> {test.notes}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button
                    size="small"
                    variant={test.status === 'pass' ? 'success' : 'primary'}
                    onClick={() => updateTestStatus(test.id, 'pass')}
                  >
                    ✓
                  </Button>
                  <Button
                    size="small"
                    variant={test.status === 'fail' ? 'danger' : 'primary'}
                    onClick={() => updateTestStatus(test.id, 'fail')}
                  >
                    ✗
                  </Button>
                  <Button
                    size="small"
                    variant={test.status === 'skip' ? 'secondary' : 'primary'}
                    onClick={() => updateTestStatus(test.id, 'skip')}
                  >
                    →
                  </Button>
                  <Button
                    size="small"
                    variant="secondary"
                    onClick={() => {
                      setShowNotes(test.id)
                      setNoteText(test.notes || '')
                    }}
                  >
                    📝
                  </Button>
                </div>
              </Flex>

              {showNotes === test.id && (
                <div style={{ marginTop: '1rem' }}>
                  <textarea
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add notes about this test..."
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      backgroundColor: '#18181b',
                      border: '1px solid #27272a',
                      borderRadius: '0.375rem',
                      padding: '0.5rem',
                      color: '#e4e4e7',
                      resize: 'vertical'
                    }}
                  />
                  <Flex gap="small" style={{ marginTop: '0.5rem' }}>
                    <Button
                      size="small"
                      onClick={() => updateTestNotes(test.id, noteText)}
                    >
                      Save
                    </Button>
                    <Button
                      size="small"
                      variant="secondary"
                      onClick={() => {
                        setShowNotes(null)
                        setNoteText('')
                      }}
                    >
                      Cancel
                    </Button>
                  </Flex>
                </div>
              )}
            </Card>
          ))}
        </div>

        <div style={{ marginTop: '2rem' }}>
          <Button 
            onClick={() => {
              logMemoryUsage('Before reset')
              setTests(testItems.map(t => ({ ...t, status: 'pending', notes: undefined })))
              logMemoryUsage('After reset')
            }}
          >
            Reset All Tests
          </Button>
        </div>
      </Card>
    </div>
  )
}

// Export for lazy loading
export default TestChecklist