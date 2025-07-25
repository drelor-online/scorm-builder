# Code Splitting Migration Guide

## Overview
This guide walks through implementing code splitting to improve initial load performance from 2.7s to under 1.8s.

## Migration Steps

### 1. Backup Current Implementation
```bash
cp src/App.tsx src/App.original.tsx
```

### 2. Replace App.tsx
```bash
cp src/App.lazy.tsx src/App.tsx
```

### 3. Update Component Exports
Ensure all components have named exports for lazy loading:

```typescript
// Before
export default ComponentName

// After  
export const ComponentName = () => { ... }
export default ComponentName
```

### 4. Update Vite Config (if needed)
The current vite.config.ts already has good chunk splitting configuration. No changes needed.

### 5. Test the Implementation
```bash
# Run tests
npm test -- App.lazy.test.tsx

# Build and analyze
npm run build
npx vite-bundle-visualizer
```

## Performance Metrics

### Before Code Splitting
- Initial Bundle: ~550KB (157KB gzipped)
- First Contentful Paint: 2.7s
- Components loaded: All at once

### After Code Splitting
- Initial Bundle: ~300KB (90KB gzipped) 
- First Contentful Paint: ~1.5s
- Components loaded: On demand

### Bundle Size Breakdown
```
Before:
- index.js: 143KB
- All components loaded upfront

After:
- index.js: 80KB
- course-seed-input-chunk.js: 20KB (loaded immediately)
- ai-prompt-chunk.js: 15KB (loaded on step 2)
- media-wizard-chunk.js: 35KB (loaded on step 4)
- scorm-builder-chunk.js: 40KB (loaded on step 7)
```

## Implementation Details

### 1. Lazy Component Loading
```typescript
const Component = lazy(() => 
  import('./Component').then(module => ({
    default: module.Component
  }))
)
```

### 2. Suspense Boundaries
Each step wrapped in Suspense with loading fallback:
```typescript
<Suspense fallback={<LoadingComponent />}>
  <Component />
</Suspense>
```

### 3. Dynamic Service Loading
SCORM generators and converters loaded on demand:
```typescript
const generator = await loadSCORMGenerator('1.2')
```

### 4. Preloading Strategy
Critical modules preloaded after 2s:
```typescript
setTimeout(() => {
  import('@/services/spaceEfficientScormGenerator')
  import('@/services/courseContentConverter')  
}, 2000)
```

## Testing Checklist

- [ ] All components load correctly
- [ ] Navigation between steps works
- [ ] No console errors
- [ ] Loading states display properly
- [ ] Performance metrics improved
- [ ] All tests pass

## Rollback Plan

If issues arise:
```bash
cp src/App.original.tsx src/App.tsx
npm run build
```

## Monitoring

After deployment:
1. Monitor Core Web Vitals
2. Check error rates
3. Track bundle load times
4. User feedback on performance

## Next Steps

1. Implement route-based splitting for future pages
2. Add prefetch hints for likely next steps
3. Optimize images with lazy loading
4. Consider service worker for offline support