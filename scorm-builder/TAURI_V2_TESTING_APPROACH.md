# Tauri v2 Testing Approaches

## Current Situation

After research, Tauri v2 has changed its testing approach compared to v1:

1. **WebDriver Mode**: The `TAURI_WEBDRIVER` environment variable from v1 is not directly supported in v2
2. **Native Testing**: Tauri v2 focuses more on Rust-side testing with JavaScript integration

## Recommended Testing Approaches for Tauri v2

### Option 1: Mock Mode (Easiest)

Create a conditional initialization in your app that checks for test mode:

```typescript
// src/services/FileStorage.ts
export class FileStorage {
  async initialize() {
    // Check if we're in test mode
    if (import.meta.env.MODE === 'test' || window.__TEST_MODE__) {
      console.log('Running in test mode - using mock storage');
      return this.initializeMockStorage();
    }
    
    // Normal Tauri initialization
    const appDir = await invoke('check_app_dir');
    // ...
  }
}
```

Then run tests with:
```bash
# Start dev server in test mode
VITE_MODE=test npm run dev

# Run BDD tests
npm run test:bdd
```

### Option 2: Conditional Tauri Loading

Modify the app to delay Tauri initialization:

```typescript
// src/hooks/usePersistentStorage.ts
export function usePersistentStorage() {
  const [initialized, setInitialized] = useState(false);
  
  useEffect(() => {
    // Wait for Tauri or mock to be available
    const initStorage = async () => {
      // In test mode, wait for mock injection
      if (window.__WAIT_FOR_MOCK__) {
        await new Promise(resolve => {
          window.__MOCK_READY__ = resolve;
        });
      }
      
      await storage.initialize();
      setInitialized(true);
    };
    
    initStorage();
  }, []);
}
```

### Option 3: E2E Testing with Built App

1. Build the Tauri app
2. Use Tauri's `beforeDevCommand` to inject test helpers
3. Connect Playwright to the running app window

```json
// tauri.test.conf.json
{
  "build": {
    "beforeDevCommand": "npm run dev -- --mode test"
  }
}
```

### Option 4: Hybrid Approach (Recommended)

1. **Unit/Integration Tests**: Test React components with mocked Tauri
2. **E2E Tests**: Test critical paths with real Tauri app
3. **Manual Tests**: Use BDD scenarios as checklist

## Implementation Plan

Given the complexity of Tauri v2 WebDriver setup, I recommend:

1. **Short Term**: Add test mode checks to the app
2. **Medium Term**: Create a test build configuration
3. **Long Term**: Investigate Tauri v2's official testing solution when documented

## Quick Win Solution

The fastest path to automated testing:

1. Add environment check in `App.tsx`:
```typescript
if (import.meta.env.DEV && !window.__TAURI__) {
  // Development mode without Tauri - inject mocks
  window.__TAURI__ = mockTauriAPI;
}
```

2. Run regular dev server
3. Run existing BDD tests

This requires minimal changes and provides immediate testing capability.