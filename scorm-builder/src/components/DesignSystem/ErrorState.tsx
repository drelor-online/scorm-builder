import React from 'react'
import { Button } from './Button'
import { Icon } from './Icons'
import { Alert } from './Alert'
import { tokens } from './designTokens'
import './designSystem.css'
import { AlertTriangle, XCircle, WifiOff, RefreshCw, Home, ArrowLeft } from 'lucide-react'

export interface ErrorStateProps {
  title?: string
  message: string
  error?: Error | string
  variant?: 'inline' | 'full' | 'card'
  severity?: 'warning' | 'error' | 'network'
  onRetry?: () => void
  onGoBack?: () => void
  onGoHome?: () => void
  showDetails?: boolean
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title,
  message,
  error,
  variant = 'inline',
  severity = 'error',
  onRetry,
  onGoBack,
  onGoHome,
  showDetails = false,
  className = ''
}) => {
  const [detailsExpanded, setDetailsExpanded] = React.useState(false)

  // Icons for different severities
  const icons = {
    warning: AlertTriangle,
    error: XCircle,
    network: WifiOff
  }

  const icon = icons[severity]

  // Colors for different severities
  const colors = {
    warning: tokens.colors.warning[500],
    error: tokens.colors.danger[500],
    network: tokens.colors.secondary[500]
  }

  const color = colors[severity]

  // Default titles
  const defaultTitles = {
    warning: 'Warning',
    error: 'Something went wrong',
    network: 'Connection error'
  }

  const displayTitle = title || defaultTitles[severity]

  // Error details
  const errorDetails = error instanceof Error ? error.stack : error

  // Inline variant - minimal error display
  if (variant === 'inline') {
    return (
      <Alert variant={severity === 'warning' ? 'warning' : 'error'} className={className}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: tokens.spacing.md }}>
          <Icon icon={icon} size="md" color={color} />
          <div style={{ flex: 1 }}>
            <p style={{ margin: 0, fontWeight: 500 }}>{message}</p>
            {onRetry && (
              <Button
                variant="secondary"
                size="small"
                onClick={onRetry}
                style={{ marginTop: tokens.spacing.sm }}
              >
                <Icon icon={RefreshCw} size="sm" /> Try Again
              </Button>
            )}
          </div>
        </div>
      </Alert>
    )
  }

  // Card variant - contained error display
  if (variant === 'card') {
    return (
      <div
        className={`error-state error-state-card ${className}`}
        style={{
          backgroundColor: tokens.colors.background.secondary,
          border: `1px solid ${tokens.colors.border.default}`,
          borderRadius: tokens.borderRadius.lg,
          padding: tokens.spacing.xl,
          textAlign: 'center'
        }}
      >
        <div style={{ marginBottom: tokens.spacing.md }}>
          <Icon icon={icon} size="xl" color={color} />
        </div>
        <h3 style={{
          fontSize: tokens.typography.fontSize.lg,
          fontWeight: 600,
          color: tokens.colors.text.primary,
          marginBottom: tokens.spacing.sm
        }}>
          {displayTitle}
        </h3>
        <p style={{
          color: tokens.colors.text.secondary,
          marginBottom: tokens.spacing.lg,
          maxWidth: '400px',
          marginLeft: 'auto',
          marginRight: 'auto'
        }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: tokens.spacing.md, justifyContent: 'center' }}>
          {onRetry && (
            <Button variant="primary" onClick={onRetry}>
              <Icon icon={RefreshCw} size="sm" /> Try Again
            </Button>
          )}
          {onGoBack && (
            <Button variant="secondary" onClick={onGoBack}>
              <Icon icon={ArrowLeft} size="sm" /> Go Back
            </Button>
          )}
        </div>
        {showDetails && errorDetails && (
          <div style={{ marginTop: tokens.spacing.lg }}>
            <Button
              variant="tertiary"
              size="small"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
            >
              {detailsExpanded ? 'Hide' : 'Show'} Details
            </Button>
            {detailsExpanded && (
              <pre style={{
                marginTop: tokens.spacing.md,
                padding: tokens.spacing.md,
                backgroundColor: tokens.colors.background.primary,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.xs,
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: '200px',
                color: tokens.colors.text.tertiary
              }}>
                {errorDetails}
              </pre>
            )}
          </div>
        )}
      </div>
    )
  }

  // Full variant - full page error display
  return (
    <div
      className={`error-state error-state-full ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: tokens.spacing['2xl'],
        textAlign: 'center'
      }}
    >
      <div className="animate-fadeIn">
        <div style={{ 
          marginBottom: tokens.spacing.xl,
          opacity: 0.8
        }}>
          <Icon 
            icon={icon} 
            size="xl" 
            color={color} 
          />
        </div>
        <h1 style={{
          fontSize: tokens.typography.fontSize['2xl'],
          fontWeight: 600,
          color: tokens.colors.text.primary,
          marginBottom: tokens.spacing.md
        }}>
          {displayTitle}
        </h1>
        <p style={{
          fontSize: tokens.typography.fontSize.base,
          color: tokens.colors.text.secondary,
          marginBottom: tokens.spacing['2xl'],
          maxWidth: '500px',
          marginLeft: 'auto',
          marginRight: 'auto',
          lineHeight: 1.6
        }}>
          {message}
        </p>
        <div style={{ 
          display: 'flex', 
          gap: tokens.spacing.md, 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {onRetry && (
            <Button variant="primary" size="large" onClick={onRetry}>
              <Icon icon={RefreshCw} size="sm" /> Try Again
            </Button>
          )}
          {onGoBack && (
            <Button variant="secondary" size="large" onClick={onGoBack}>
              <Icon icon={ArrowLeft} size="sm" /> Go Back
            </Button>
          )}
          {onGoHome && (
            <Button variant="tertiary" size="large" onClick={onGoHome}>
              <Icon icon={Home} size="sm" /> Go Home
            </Button>
          )}
        </div>
        {showDetails && errorDetails && (
          <div style={{ marginTop: tokens.spacing['2xl'], width: '100%', maxWidth: '600px' }}>
            <Button
              variant="tertiary"
              size="small"
              onClick={() => setDetailsExpanded(!detailsExpanded)}
            >
              {detailsExpanded ? 'Hide' : 'Show'} Technical Details
            </Button>
            {detailsExpanded && (
              <pre style={{
                marginTop: tokens.spacing.md,
                padding: tokens.spacing.lg,
                backgroundColor: tokens.colors.background.secondary,
                border: `1px solid ${tokens.colors.border.default}`,
                borderRadius: tokens.borderRadius.md,
                fontSize: tokens.typography.fontSize.sm,
                textAlign: 'left',
                overflow: 'auto',
                maxHeight: '300px',
                color: tokens.colors.text.tertiary
              }}>
                {errorDetails}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Utility components for common error patterns
export const NetworkError: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => (
  <ErrorState
    severity="network"
    message="Unable to connect to the server. Please check your internet connection and try again."
    onRetry={onRetry}
    variant="card"
  />
)

export const NotFoundError: React.FC<{ onGoBack?: () => void; onGoHome?: () => void }> = ({ 
  onGoBack, 
  onGoHome 
}) => (
  <ErrorState
    title="Page Not Found"
    message="The page you're looking for doesn't exist or has been moved."
    onGoBack={onGoBack}
    onGoHome={onGoHome}
    variant="full"
  />
)

export const PermissionError: React.FC<{ message?: string }> = ({ 
  message = "You don't have permission to access this resource." 
}) => (
  <ErrorState
    title="Access Denied"
    message={message}
    variant="card"
    severity="warning"
  />
)