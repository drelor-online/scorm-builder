# Code Splitting Implementation Guide

## Example: Implementing Code Splitting in App.tsx

### Before (Current Implementation)
```typescript
import { MediaLibraryEnhanced } from './components/MediaLibraryEnhanced'
import { CourseGeneratorRefactored } from './components/CourseGeneratorRefactored'
import { CourseContentBuilderAIRefactored } from './components/CourseContentBuilderAIRefactored'
import { SCORMPackageBuilder } from './components/SCORMPackageBuilderRefactored'
```

### After (With Code Splitting)
```typescript
import { lazy, Suspense } from 'react'
import { LoadingSpinner } from './components/DesignSystem'

// Lazy load heavy components
const MediaLibraryEnhanced = lazy(() => 
  import('./components/MediaLibraryEnhanced')
    .then(module => ({ default: module.MediaLibraryEnhanced }))
)

const CourseGeneratorRefactored = lazy(() => 
  import('./components/CourseGeneratorRefactored')
    .then(module => ({ default: module.CourseGeneratorRefactored }))
)

const CourseContentBuilderAIRefactored = lazy(() => 
  import('./components/CourseContentBuilderAIRefactored')
    .then(module => ({ default: module.CourseContentBuilderAIRefactored }))
)

const SCORMPackageBuilder = lazy(() => 
  import('./components/SCORMPackageBuilderRefactored')
    .then(module => ({ default: module.SCORMPackageBuilder }))
)

// In the render method:
<Suspense fallback={<LoadingSpinner message="Loading component..." />}>
  {currentStep === 0 && (
    <CourseGeneratorRefactored 
      onNext={handleCourseDataSubmit} 
      courseSeedData={courseSeedData}
    />
  )}
  {currentStep === 1 && (
    <CourseContentBuilderAIRefactored 
      courseSeedData={courseSeedData}
      onNext={handleCourseContentSubmit}
      onBack={() => setCurrentStep(0)}
    />
  )}
  {currentStep === 2 && (
    <SCORMPackageBuilder 
      courseContent={courseContent}
      courseSeedData={courseSeedData}
      onNext={() => {}}
      onBack={() => setCurrentStep(1)}
    />
  )}
</Suspense>
```

## Service Layer Code Splitting

### SCORM Generator Dynamic Import
```typescript
// services/scormLoader.ts
export const loadSCORMGenerator = async (version: string) => {
  switch (version) {
    case '1.2':
      const { generateSpaceEfficientSCORM12Buffer } = await import(
        /* webpackChunkName: "scorm-1.2" */
        './spaceEfficientScormGenerator'
      )
      return generateSpaceEfficientSCORM12Buffer
    
    case '2004':
      // Future implementation
      const { generateSCORM2004Buffer } = await import(
        /* webpackChunkName: "scorm-2004" */
        './scorm2004Generator'
      )
      return generateSCORM2004Buffer
    
    default:
      throw new Error(`Unsupported SCORM version: ${version}`)
  }
}

// Usage in component
const handleGenerateSCORM = async () => {
  setIsGenerating(true)
  try {
    const generator = await loadSCORMGenerator('1.2')
    const result = await generator(courseContent)
    // Handle result
  } finally {
    setIsGenerating(false)
  }
}
```

## Route-Based Code Splitting

### App Router Setup
```typescript
import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'

// Lazy load route components
const Dashboard = lazy(() => import('./pages/Dashboard'))
const CourseBuilder = lazy(() => import('./pages/CourseBuilder'))
const MediaLibrary = lazy(() => import('./pages/MediaLibrary'))
const Settings = lazy(() => import('./pages/Settings'))

function App() {
  return (
    <Suspense fallback={<PageLoadingIndicator />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/builder/*" element={<CourseBuilder />} />
        <Route path="/media/*" element={<MediaLibrary />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Suspense>
  )
}
```

## Utility Function for Conditional Loading

```typescript
// utils/dynamicImport.ts
export const conditionalImport = async <T,>(
  condition: boolean,
  importFn: () => Promise<{ default: T }>,
  fallback: T
): Promise<T> => {
  if (condition) {
    const module = await importFn()
    return module.default
  }
  return fallback
}

// Usage
const MediaComponent = await conditionalImport(
  hasMediaFiles,
  () => import('./components/MediaGallery'),
  EmptyMediaPlaceholder
)
```

## Performance Monitoring

```typescript
// Add performance marks around lazy loads
const loadComponent = async (componentName: string) => {
  performance.mark(`${componentName}-load-start`)
  
  const Component = await import(`./components/${componentName}`)
  
  performance.mark(`${componentName}-load-end`)
  performance.measure(
    `${componentName}-load-time`,
    `${componentName}-load-start`,
    `${componentName}-load-end`
  )
  
  return Component
}
```

## Benefits After Implementation

1. **Initial Bundle Size**: Reduced by ~40-50%
2. **Time to Interactive**: Improved from 2.7s to ~1.5s
3. **Code Caching**: Better browser caching with smaller chunks
4. **Progressive Loading**: Users only download what they use

## Testing Code Splitting

```typescript
// __tests__/App.lazy.test.tsx
import { render, waitFor } from '@testing-library/react'
import App from '../App'

test('lazy loads components correctly', async () => {
  const { getByText } = render(<App />)
  
  // Should show loading state initially
  expect(getByText(/loading/i)).toBeInTheDocument()
  
  // Should load component
  await waitFor(() => {
    expect(getByText(/course builder/i)).toBeInTheDocument()
  })
})
```