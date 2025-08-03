import React, { useState } from 'react'
import { 
  Card, 
  Button, 
  ButtonGroup,
  Section,
  PageContainer,
  LoadingState,
  PageLoading,
  ContentLoading,
  FormLoading,
  UploadProgress,
  ErrorState,
  NetworkError,
  PermissionError,
  EmptyState
} from './index'
import { Search, Plus } from 'lucide-react'

export const LoadingErrorDemo: React.FC = () => {
  const [loadingVariant, setLoadingVariant] = useState<'spinner' | 'skeleton' | 'progress'>('spinner')
  const [errorVariant, setErrorVariant] = useState<'inline' | 'card' | 'full'>('card')
  const [showFullPageLoading, setShowFullPageLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  // Simulate upload progress
  const simulateUpload = () => {
    setUploadProgress(0)
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 500)
  }

  return (
    <PageContainer>
      <h1>Loading & Error States Demo</h1>
      
      {/* Loading States Section */}
      <Section>
        <h2>Loading States</h2>
        
        <Card title="Loading Variants" style={{ marginBottom: '2rem' }}>
          <ButtonGroup gap="medium" style={{ marginBottom: '2rem' }}>
            <Button 
              variant={loadingVariant === 'spinner' ? 'primary' : 'secondary'}
              onClick={() => setLoadingVariant('spinner')}
            >
              Spinner
            </Button>
            <Button 
              variant={loadingVariant === 'skeleton' ? 'primary' : 'secondary'}
              onClick={() => setLoadingVariant('skeleton')}
            >
              Skeleton
            </Button>
            <Button 
              variant={loadingVariant === 'progress' ? 'primary' : 'secondary'}
              onClick={() => setLoadingVariant('progress')}
            >
              Progress
            </Button>
          </ButtonGroup>

          <div style={{ minHeight: '300px', position: 'relative', border: '1px dashed #3f3f46', borderRadius: '8px', padding: '2rem' }}>
            {loadingVariant === 'spinner' && (
              <LoadingState variant="spinner" text="Loading content..." />
            )}
            {loadingVariant === 'skeleton' && (
              <LoadingState variant="skeleton" layout="list" count={3} />
            )}
            {loadingVariant === 'progress' && (
              <LoadingState variant="progress" progress={75} text="Processing..." />
            )}
          </div>
        </Card>

        <Card title="Specialized Loading Components" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gap: '2rem' }}>
            <div>
              <h4>Content Loading (List)</h4>
              <ContentLoading count={2} layout="list" />
            </div>
            
            <div>
              <h4>Content Loading (Grid)</h4>
              <ContentLoading count={4} layout="grid" />
            </div>
            
            <div>
              <h4>Form Loading</h4>
              <FormLoading />
            </div>
          </div>
        </Card>

        <Card title="Interactive Examples">
          <ButtonGroup gap="medium">
            <Button onClick={() => setShowFullPageLoading(true)}>
              Show Full Page Loading
            </Button>
            <Button onClick={simulateUpload}>
              Simulate Upload
            </Button>
          </ButtonGroup>
        </Card>
      </Section>

      {/* Error States Section */}
      <Section>
        <h2>Error States</h2>
        
        <Card title="Error Variants" style={{ marginBottom: '2rem' }}>
          <ButtonGroup gap="medium" style={{ marginBottom: '2rem' }}>
            <Button 
              variant={errorVariant === 'inline' ? 'primary' : 'secondary'}
              onClick={() => setErrorVariant('inline')}
            >
              Inline
            </Button>
            <Button 
              variant={errorVariant === 'card' ? 'primary' : 'secondary'}
              onClick={() => setErrorVariant('card')}
            >
              Card
            </Button>
            <Button 
              variant={errorVariant === 'full' ? 'primary' : 'secondary'}
              onClick={() => setErrorVariant('full')}
            >
              Full
            </Button>
          </ButtonGroup>

          <div style={{ minHeight: '400px' }}>
            <ErrorState
              variant={errorVariant}
              severity="error"
              title="Failed to Load Data"
              message="We couldn't load your data. This might be a temporary issue."
              error={new Error('Network request failed')}
              onRetry={() => console.log('Retry clicked')}
              onGoBack={() => console.log('Go back clicked')}
              showDetails
            />
          </div>
        </Card>

        <Card title="Specialized Error Components" style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'grid', gap: '2rem' }}>
            <NetworkError onRetry={() => console.log('Retry network')} />
            <PermissionError message="You need admin access to view this content." />
          </div>
        </Card>
      </Section>

      {/* Empty States Section */}
      <Section>
        <h2>Empty States</h2>
        
        <Card title="Empty State Examples">
          <div style={{ display: 'grid', gap: '2rem' }}>
            <EmptyState
              icon={Search}
              title="No Results Found"
              description="Try adjusting your search criteria or filters"
              action={{
                label: 'Clear Filters',
                onClick: () => console.log('Clear filters')
              }}
              size="small"
            />
            
            <EmptyState
              icon={Plus}
              title="No Projects Yet"
              description="Get started by creating your first project"
              action={{
                label: 'Create Project',
                onClick: () => console.log('Create project'),
                variant: 'primary'
              }}
              secondaryAction={{
                label: 'Import Project',
                onClick: () => console.log('Import project')
              }}
              variant="default"
              size="medium"
            />
            
            <EmptyState
              title="Successfully Deleted"
              description="The item has been permanently removed"
              variant="success"
              size="small"
            />
          </div>
        </Card>
      </Section>

      {/* Full page loading overlay */}
      {showFullPageLoading && (
        <PageLoading text="Loading application..." />
      )}
      
      {/* Upload progress overlay */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <UploadProgress progress={uploadProgress} text="Uploading files..." />
      )}
      
      {showFullPageLoading && (
        <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 1001 }}>
          <Button onClick={() => setShowFullPageLoading(false)}>
            Close Loading
          </Button>
        </div>
      )}
    </PageContainer>
  )
}

export default LoadingErrorDemo