import React, { useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { Modal, Button, Icon } from './DesignSystem'
import { Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react'
import { screenshotManager } from '../utils/automationScreenshotManager'

interface Screenshot {
  id: string
  stepName: string
  timestamp: number
  dataUrl?: string
}

interface AutomationScreenshotViewerProps {
  isOpen: boolean
  onClose: () => void
  screenshots?: Screenshot[]
}

export const AutomationScreenshotViewer: React.FC<AutomationScreenshotViewerProps> = ({
  isOpen,
  onClose,
  screenshots: propScreenshots
}) => {
  const [screenshots, setScreenshots] = useState<Screenshot[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadScreenshots()
    }
  }, [isOpen])

  const loadScreenshots = async () => {
    setLoading(true)
    try {
      const allScreenshots = propScreenshots || screenshotManager.getAllScreenshots()
      
      // Load data URLs for each screenshot
      const screenshotsWithUrls = await Promise.all(
        allScreenshots.map(async (screenshot) => {
          const dataUrl = await screenshotManager.getScreenshotDataUrl(screenshot.id)
          return {
            ...screenshot,
            dataUrl: dataUrl || undefined
          }
        })
      )
      
      setScreenshots(screenshotsWithUrls)
    } catch (error) {
      console.error('Failed to load screenshots:', error)
    } finally {
      setLoading(false)
    }
  }

  const handlePrevious = () => {
    setCurrentIndex(prev => Math.max(0, prev - 1))
  }

  const handleNext = () => {
    setCurrentIndex(prev => Math.min(screenshots.length - 1, prev + 1))
  }

  const handleDownload = async () => {
    const current = screenshots[currentIndex]
    if (!current || !current.dataUrl) return

    const link = document.createElement('a')
    link.href = current.dataUrl
    link.download = `${current.stepName.replace(/\s+/g, '-')}-${current.timestamp}.jpg`
    link.click()
  }

  const handleDownloadAll = async () => {
    try {
      const zipBlob = await screenshotManager.exportScreenshots()
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `automation-screenshots-${Date.now()}.zip`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to export screenshots:', error)
    }
  }

  const handleZoomIn = () => {
    setZoom(prev => Math.min(3, prev + 0.25))
  }

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.5, prev - 0.25))
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        handlePrevious()
        break
      case 'ArrowRight':
        handleNext()
        break
      case 'Escape':
        onClose()
        break
    }
  }

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, currentIndex])

  const current = screenshots[currentIndex]

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Automation Screenshots"
      size="large"
      className="automation-screenshot-viewer"
    >
      {loading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Loading screenshots...</p>
          </div>
        </div>
      ) : screenshots.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-center text-gray-500">
            <p>No screenshots available</p>
            <p className="text-sm mt-2">Run automation with captureScreenshots: true</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Toolbar */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-4">
              <Button
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                variant="secondary"
                size="small"
              >
                <Icon icon={ChevronLeft} />
              </Button>
              <span className="text-sm font-medium">
                {currentIndex + 1} / {screenshots.length}
              </span>
              <Button
                onClick={handleNext}
                disabled={currentIndex === screenshots.length - 1}
                variant="secondary"
                size="small"
              >
                <Icon icon={ChevronRight} />
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <Button onClick={handleZoomOut} variant="secondary" size="small">
                <Icon icon={ZoomOut} />
              </Button>
              <span className="text-sm w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button onClick={handleZoomIn} variant="secondary" size="small">
                <Icon icon={ZoomIn} />
              </Button>
              <div className="w-px h-6 bg-gray-300 mx-2" />
              <Button onClick={handleDownload} variant="secondary" size="small">
                <Icon icon={Download} />
                Download
              </Button>
              <Button onClick={handleDownloadAll} variant="secondary" size="small">
                <Icon icon={Download} />
                Download All
              </Button>
            </div>
          </div>

          {/* Screenshot Info */}
          {current && (
            <div className="px-4 py-2 bg-gray-50 border-b">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{current.stepName}</h3>
                <span className="text-sm text-gray-500">
                  {new Date(current.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          )}

          {/* Screenshot Display */}
          <div className="flex-1 overflow-auto bg-gray-100 p-4">
            {current && current.dataUrl ? (
              <div className="flex items-center justify-center min-h-full">
                <img
                  src={current.dataUrl}
                  alt={current.stepName}
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center',
                    transition: 'transform 0.2s ease-in-out',
                    maxWidth: '100%',
                    height: 'auto'
                  }}
                  className="shadow-lg"
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <p className="text-gray-500">No screenshot available</p>
              </div>
            )}
          </div>

          {/* Thumbnail Strip */}
          <div className="border-t bg-white p-4">
            <div className="flex gap-2 overflow-x-auto">
              {screenshots.map((screenshot, index) => (
                <button
                  key={screenshot.id}
                  onClick={() => setCurrentIndex(index)}
                  className={`
                    flex-shrink-0 w-24 h-16 rounded overflow-hidden border-2 transition-all
                    ${index === currentIndex ? 'border-blue-500 shadow-md' : 'border-gray-300 hover:border-gray-400'}
                  `}
                >
                  {screenshot.dataUrl ? (
                    <img
                      src={screenshot.dataUrl}
                      alt={screenshot.stepName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-xs text-gray-500">Loading...</span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

// Global function to open screenshot viewer
let screenshotViewerRoot: any = null

export function openScreenshotViewer() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  
  const handleClose = () => {
    if (screenshotViewerRoot) {
      screenshotViewerRoot.unmount()
      screenshotViewerRoot = null
    }
    container.remove()
  }
  
  screenshotViewerRoot = createRoot(container)
  screenshotViewerRoot.render(
    <AutomationScreenshotViewer
      isOpen={true}
      onClose={handleClose}
    />
  )
}

// Make available globally
if (typeof window !== 'undefined') {
  (window as any).viewAutomationScreenshots = openScreenshotViewer
}