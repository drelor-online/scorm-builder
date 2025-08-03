# How to View the Media Enhancement Mockups

## Quick Method: Add Button Component

1. Open any component file where you want to view the mockups (e.g., `App.tsx`, `ProjectDashboard.tsx`, etc.)

2. Add this import at the top:
```tsx
import { ViewMockupsButton } from './components/mockups/ViewMockupsButton'
```

3. Add the component anywhere in the JSX:
```tsx
<ViewMockupsButton />
```

4. You'll see a green button "🎨 View Media Enhancement Mockup" in the bottom-right corner

5. Click it to view the full mockup

## Alternative Method: Browser Console

1. Open your app in the browser
2. Open Developer Console (F12)
3. Paste this code:

```javascript
// Create mockup viewer in current page
import('./src/components/mockups/index.js').then(module => {
  const { MediaEnhancementMockupViewer } = module;
  const React = window.React || require('react');
  const ReactDOM = window.ReactDOM || require('react-dom');
  
  // Create container
  const container = document.createElement('div');
  container.id = 'mockup-viewer';
  container.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:9999;background:#0a0e27;overflow:auto';
  document.body.appendChild(container);
  
  // Render mockup
  ReactDOM.render(React.createElement(MediaEnhancementMockupViewer), container);
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.textContent = 'Close Mockup';
  closeBtn.style.cssText = 'position:fixed;top:20px;right:20px;z-index:10000;padding:10px 20px;background:#475569;color:white;border:none;border-radius:6px;cursor:pointer';
  closeBtn.onclick = () => document.body.removeChild(container);
  container.appendChild(closeBtn);
});
```

## What You'll See

The mockup viewer shows:

1. **Main Layout**
   - Visual page thumbnails (left sidebar)
   - Large rich text editor (top)
   - Tabbed media search (bottom)

2. **Three Tabs**
   - **Images**: Dedicated image search with filters
   - **Videos**: YouTube-specific search interface
   - **AI Tools**: Prompt generator and AI service links

3. **Interactive Features**
   - Click tabs to switch between different search types
   - Toggle between Desktop/Tablet/Mobile views
   - See feature highlights at the bottom

## Temporary Installation in App.tsx

If you want to add it temporarily to your main app, add this to `App.tsx`:

1. Import at the top:
```tsx
import { ViewMockupsButton } from '@/components/mockups/ViewMockupsButton'
```

2. Add inside your main App component (anywhere in the JSX):
```tsx
{/* Mockup viewer button - remove after review */}
<ViewMockupsButton />
```

This will show the button on all pages of your app.