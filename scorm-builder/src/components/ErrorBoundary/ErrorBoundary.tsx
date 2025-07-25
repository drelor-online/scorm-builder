import React, { Component, ReactNode, ErrorInfo } from 'react'
import { Alert } from '@/components/DesignSystem'
import { Button } from '@/components/DesignSystem'
import { PageContainer, Section } from '@/components/DesignSystem'
import { COLORS, SPACING } from '@/constants'

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackRender?: (props: {
    error: Error
    errorInfo: ErrorInfo | null
    resetError: () => void
  }) => ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  showInDevelopment?: boolean
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { onError, showInDevelopment = true } = this.props
    
    // Log error to console in development
    if (import.meta.env.MODE === 'development') {
      console.error('Error caught by ErrorBoundary:', error)
      console.error('Component stack:', errorInfo.componentStack)
    }
    
    // Call custom error handler if provided
    if (onError) {
      onError(error, errorInfo)
    }
    
    // In development, optionally let errors bubble up for better debugging
    if (import.meta.env.MODE === 'development' && !showInDevelopment) {
      throw error
    }
    
    this.setState({
      errorInfo
    })
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    const { hasError, error, errorInfo } = this.state
    const { children, fallbackRender } = this.props

    if (hasError && error) {
      // Use custom fallback render if provided
      if (fallbackRender) {
        return fallbackRender({
          error,
          errorInfo,
          resetError: this.resetError
        })
      }

      // Default error UI
      return (
        <PageContainer>
          <Section>
            <div style={{
              textAlign: 'center',
              padding: SPACING.xl,
              maxWidth: '600px',
              margin: '0 auto'
            }}>
              <div style={{ marginBottom: SPACING.xl }}>
                <svg
                  width="80"
                  height="80"
                  viewBox="0 0 24 24"
                  fill="none"
                  style={{ margin: '0 auto' }}
                >
                  <circle cx="12" cy="12" r="10" stroke={COLORS.error} strokeWidth="2"/>
                  <path d="M12 8v4m0 4h.01" stroke={COLORS.error} strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              
              <h1 style={{ 
                fontSize: '2rem',
                marginBottom: SPACING.md,
                color: COLORS.text
              }}>
                Something went wrong
              </h1>
              
              <Alert variant="error">
                <div style={{ marginBottom: SPACING.lg }}>
                  <p style={{ marginBottom: SPACING.sm }}>
                    <strong>Error:</strong> {error.message}
                  </p>
                  {import.meta.env.MODE === 'development' && errorInfo && (
                    <details style={{ marginTop: SPACING.md, textAlign: 'left' }}>
                      <summary style={{ cursor: 'pointer', marginBottom: SPACING.sm }}>
                        Technical details
                      </summary>
                      <pre style={{
                        backgroundColor: COLORS.backgroundDark,
                        padding: SPACING.md,
                        borderRadius: '4px',
                        fontSize: '0.875rem',
                        overflow: 'auto',
                        maxHeight: '300px'
                      }}>
                        {errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              </Alert>
              
              <div style={{ display: 'flex', gap: SPACING.md, justifyContent: 'center' }}>
                <Button 
                  onClick={() => window.location.reload()}
                  variant="primary"
                >
                  Reload Page
                </Button>
                
                <Button 
                  onClick={this.resetError}
                  variant="secondary"
                >
                  Try Again
                </Button>
              </div>
              
              <p style={{ 
                marginTop: SPACING.xl,
                color: COLORS.textMuted,
                fontSize: '0.875rem'
              }}>
                If this problem persists, please contact support or try clearing your browser cache.
              </p>
            </div>
          </Section>
        </PageContainer>
      )
    }

    return children
  }
}

// Hook for using error boundary functionality
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null)

  React.useEffect(() => {
    if (error) {
      throw error
    }
  }, [error])

  const resetError = React.useCallback(() => {
    setError(null)
  }, [])

  const captureError = React.useCallback((error: Error) => {
    setError(error)
  }, [])

  return { resetError, captureError }
}