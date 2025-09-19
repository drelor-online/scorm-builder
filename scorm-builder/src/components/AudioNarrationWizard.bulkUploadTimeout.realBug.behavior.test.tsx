/**
 * BEHAVIOR TEST: Bulk Caption Upload Timeout Issue
 *
 * This test reproduces the issue where bulk uploads of many files hang due to
 * the 30-second timeout triggering before the 120-second bulk timeout is properly set.
 *
 * ISSUE: The timeout is set BEFORE setBulkOperation(true) is called, causing
 * the 30-second normal timeout to apply instead of the 120-second bulk timeout.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AudioNarrationWizard } from './AudioNarrationWizard'
import { UnifiedMediaProvider } from '../contexts/UnifiedMediaContext'
import { PersistentStorageProvider } from '../contexts/PersistentStorageContext'
import { NotificationProvider } from '../contexts/NotificationContext'
import { UnsavedChangesProvider } from '../contexts/UnsavedChangesContext'
import { MockFileStorage } from '../services/MockFileStorage'
import JSZip from 'jszip'

// Mock course content with many narration blocks (simulating large project)
const createLargeCourseContent = (blockCount: number) => ({
  title: 'Large Test Course',
  welcomePage: { id: 'welcome', title: 'Welcome', content: 'Welcome content' },
  learningObjectivesPage: { id: 'objectives', title: 'Objectives', content: 'Objectives content' },
  topics: Array.from({ length: blockCount }, (_, i) => ({
    id: `topic-${i}`,
    title: `Topic ${i + 1}`,
    content: `Content for topic ${i + 1}`,
    media: []
  }))
})

// Mock course seed data
const mockCourseSeedData = {
  courseTitle: 'Large Test Course',
  difficulty: 2,
  template: 'default',
  topics: Array.from({ length: 20 }, (_, i) => `Topic ${i + 1}`)
}

// Create a ZIP file with many caption files
const createCaptionZip = async (fileCount: number): Promise<File> => {
  const zip = new JSZip()

  // Add many caption files to trigger timeout
  for (let i = 0; i < fileCount; i++) {
    const blockNumber = String(i).padStart(4, '0')
    const filename = `${blockNumber}-caption.vtt`
    const content = `WEBVTT

00:00:00.000 --> 00:00:05.000
Caption for block ${i}

00:00:05.000 --> 00:00:10.000
More content for block ${i}`

    zip.file(filename, content)
  }

  const blob = await zip.generateAsync({ type: 'blob' })
  return new File([blob], 'captions.zip', { type: 'application/zip' })
}

describe('AudioNarrationWizard - Bulk Upload Timeout Issue', () => {
  let mockStorage: MockFileStorage
  let timeoutSpy: ReturnType<typeof vi.spyOn>
  let clearTimeoutSpy: ReturnType<typeof vi.spyOn>

  beforeEach(async () => {
    vi.clearAllMocks()

    // Create mock storage
    mockStorage = new MockFileStorage()
    await mockStorage.initialize()

    // Create a project
    const project = await mockStorage.createProject('Large Test Project')

    // Spy on timeout functions to track timeout behavior
    timeoutSpy = vi.spyOn(global, 'setTimeout')
    clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')
  })

  const renderAudioWizardWithManyBlocks = (blockCount: number = 22) => {
    const courseContent = createLargeCourseContent(blockCount)

    return render(
      <NotificationProvider>
        <UnsavedChangesProvider>
          <PersistentStorageProvider fileStorage={mockStorage}>
            <UnifiedMediaProvider projectId={mockStorage.currentProjectId!} loadingTimeout={5000} bulkOperationTimeout={15000}>
              <AudioNarrationWizard
                courseSeedData={mockCourseSeedData}
                courseContent={courseContent}
                onNext={vi.fn()}
                onBack={vi.fn()}
                onSave={vi.fn()}
                onUpdateContent={vi.fn()}
                onAutoSave={vi.fn()}
              />
            </UnifiedMediaProvider>
          </PersistentStorageProvider>
        </UnsavedChangesProvider>
      </NotificationProvider>
    )
  }

  it('should reproduce the bulk upload timeout issue', async () => {
    console.log('🧪 REPRODUCING: Bulk caption upload timeout issue...')

    // Render with many blocks to simulate large project
    renderAudioWizardWithManyBlocks(22)

    await waitFor(() => {
      expect(screen.getByText('Bulk Upload')).toBeInTheDocument()
    })

    // Open bulk upload modal
    fireEvent.click(screen.getByText('Bulk Upload'))

    await waitFor(() => {
      expect(screen.getByText('Upload Caption ZIP')).toBeInTheDocument()
    })

    console.log('📊 Starting bulk upload simulation...')

    // Create a ZIP with many caption files (simulating user upload)
    const captionZip = await createCaptionZip(22)

    // Get the file input for caption upload
    const captionInput = screen.getByTestId('captions-zip-input')

    // Clear timeout spy calls from setup
    timeoutSpy.mockClear()
    clearTimeoutSpy.mockClear()

    console.log('⏰ Checking timeout behavior before upload...')

    // Simulate file upload
    const file = new File([await captionZip.arrayBuffer()], 'captions.zip', { type: 'application/zip' })

    // Track timeout calls during upload
    let timeoutCalls: number[] = []
    timeoutSpy.mockImplementation((callback, delay) => {
      timeoutCalls.push(delay as number)
      console.log(`⏰ setTimeout called with delay: ${delay}ms`)
      return window.setTimeout(callback, delay)
    })

    // Start the upload
    fireEvent.change(captionInput, { target: { files: [file] } })

    // Wait a moment for the upload to start
    await waitFor(() => {
      expect(timeoutSpy).toHaveBeenCalled()
    }, { timeout: 2000 })

    console.log('📊 Timeout calls during upload:', timeoutCalls)

    // The BUG: The first timeout call should be with bulkOperationTimeout (15000ms)
    // but instead it will be with normal loadingTimeout (5000ms)
    // This happens because the timeout is set BEFORE setBulkOperation(true) is called

    // Check if the loading timeout was set correctly
    const hasCorrectBulkTimeout = timeoutCalls.some(delay => delay >= 15000)
    const hasIncorrectNormalTimeout = timeoutCalls.some(delay => delay <= 5000)

    console.log('🔍 Timeout analysis:')
    console.log('- Has correct bulk timeout (>=15000ms):', hasCorrectBulkTimeout)
    console.log('- Has incorrect normal timeout (<=5000ms):', hasIncorrectNormalTimeout)

    // This should pass when the bug is fixed
    // Currently this test SHOULD FAIL because normal timeout is used first
    expect(hasCorrectBulkTimeout).toBe(true)
    expect(hasIncorrectNormalTimeout).toBe(false)

    console.log('✅ Test expects bulk timeout to be used from the start')
  })

  it('should not timeout during bulk upload of many files', async () => {
    console.log('🧪 TESTING: No timeout during bulk upload...')

    // Mock storeMedia to take some time (simulating real upload)
    let uploadCount = 0
    const mockStoreMedia = vi.fn().mockImplementation(async () => {
      uploadCount++
      console.log(`📁 Processing file ${uploadCount}/22...`)

      // Simulate each file taking 300ms (total 6.6 seconds for 22 files)
      await new Promise(resolve => setTimeout(resolve, 300))

      return {
        id: `caption-${uploadCount}`,
        url: 'mock-url'
      }
    })

    // Create a version that won't timeout
    renderAudioWizardWithManyBlocks(22)

    await waitFor(() => {
      expect(screen.getByText('Bulk Upload')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Bulk Upload'))

    await waitFor(() => {
      expect(screen.getByText('Upload Caption ZIP')).toBeInTheDocument()
    })

    const captionZip = await createCaptionZip(22)
    const captionInput = screen.getByTestId('captions-zip-input')

    const file = new File([await captionZip.arrayBuffer()], 'captions.zip', { type: 'application/zip' })

    console.log('⏰ Starting upload that should not timeout...')

    // Start upload
    fireEvent.change(captionInput, { target: { files: [file] } })

    // Wait for upload to complete (should not timeout)
    // With bulk timeout of 15000ms and files taking 6.6s total, this should work
    await waitFor(() => {
      // Look for completion indicators
      const progressElements = screen.queryAllByText(/Processing/i)
      const uploadingElements = screen.queryAllByText(/Uploading/i)

      console.log(`📊 Upload progress - Processing: ${progressElements.length}, Uploading: ${uploadingElements.length}`)

      // Should eventually complete without timeout error
      return progressElements.length === 0 && uploadingElements.length === 0
    }, { timeout: 20000 }) // Give extra time to complete

    // Should not see timeout error
    expect(screen.queryByText(/Loading timed out/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/timeout/i)).not.toBeInTheDocument()

    console.log('✅ Bulk upload completed without timeout')
  })

  it('should use bulk operation timeout when setBulkOperation is called first', async () => {
    console.log('🧪 TESTING: Timeout ordering fix...')

    renderAudioWizardWithManyBlocks(10)

    await waitFor(() => {
      expect(screen.getByText('Bulk Upload')).toBeInTheDocument()
    })

    // Clear previous timeout calls
    timeoutSpy.mockClear()

    // Track the order of operations
    const operationOrder: string[] = []

    // Mock setBulkOperation to track when it's called
    const originalSetTimeout = window.setTimeout
    timeoutSpy.mockImplementation((callback, delay) => {
      operationOrder.push(`setTimeout(${delay}ms)`)
      return originalSetTimeout(callback, delay)
    })

    fireEvent.click(screen.getByText('Bulk Upload'))

    await waitFor(() => {
      expect(screen.getByText('Upload Caption ZIP')).toBeInTheDocument()
    })

    const captionZip = await createCaptionZip(10)
    const file = new File([await captionZip.arrayBuffer()], 'captions.zip', { type: 'application/zip' })
    const captionInput = screen.getByTestId('captions-zip-input')

    // Start upload and track operation order
    fireEvent.change(captionInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(timeoutSpy).toHaveBeenCalled()
    })

    console.log('📊 Operation order:', operationOrder)

    // The fix should ensure that bulk timeout is used from the start
    // This test will currently fail because normal timeout comes first
    const firstTimeoutCall = operationOrder.find(op => op.startsWith('setTimeout'))

    console.log('🔍 First timeout call:', firstTimeoutCall)

    // Should use bulk timeout (15000ms) not normal timeout (5000ms)
    expect(firstTimeoutCall).toMatch(/setTimeout\(1[5-9]\d{3}ms\)/) // 15000+ ms

    console.log('✅ Test expects bulk timeout to be used from start')
  })
})