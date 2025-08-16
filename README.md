# SCORM Builder

A modern, user-friendly application for creating SCORM-compliant e-learning packages with AI assistance.

## 🎯 Features

- **7-Step Course Creation Wizard**
  - Course configuration with templates
  - AI prompt generation
  - JSON import/validation
  - Media enhancement
  - Audio narration
  - Content editing
  - SCORM package generation

- **SCORM 1.2 Compliance**
  - Generates standard-compliant packages
  - Progress tracking
  - Assessment scoring
  - Mobile-responsive output
  - Space-efficient design with sidebar navigation

- **Project Management**
  - Save/load projects
  - Auto-save functionality
  - Import/export capabilities
  - Media library with bulk operations

- **Accessibility**
  - WCAG 2.1 AA compliant components
  - Keyboard navigation support
  - Screen reader optimized
  - High contrast mode support

## 🚀 Quick Start

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation
```bash
# Clone the repository
git clone [repository-url]

# Navigate to project directory
cd scorm-builder

# Install dependencies
npm install
```

### Development
```bash
# Run development server
npm run dev

# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Type check
npm run type-check

# Lint code
npm run lint

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🏗️ Architecture

```
src/
├── components/          # React components
│   ├── DesignSystem/   # Reusable UI components
│   └── __tests__/      # Component tests
├── services/           # Business logic
│   └── __tests__/      # Service tests
├── hooks/              # Custom React hooks
│   └── __tests__/      # Hook tests
├── types/              # TypeScript types
├── utils/              # Utility functions
├── config/             # Configuration files
└── styles/             # Global styles
```

## 🧪 Testing

### Test Suite Status (Updated Post-Consolidation)
- **Test Files**: 210 (including 29 consolidated test suites)
- **Individual Tests**: 2,519 test cases
- **Consolidated Architecture**: Large test files merged for better maintainability
- **Coverage**: ~83%+ (varies by module)
- **Status**: Stable with comprehensive behavior and integration testing
- **BDD Features**: 38 feature files for behavior-driven testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests once (no watch)
npm test -- --run

# Run specific test file
npm test -- [filename]

# Run tests matching pattern
npm test -- --grep "accessibility"

# Check coverage
npm test -- --coverage

# Run tests in UI mode
npm test -- --ui
```

### Testing Generated SCORM Packages

#### Important: Browser Security Restrictions
When testing SCORM packages by opening them directly in a browser (file:// protocol), you will encounter security restrictions:

1. **Cross-origin errors**: Browsers block access to local files for security reasons
2. **Caption files (VTT) blocked**: CORS policy prevents loading caption files
3. **Media may not load**: Some browsers restrict loading media from file:// URLs

#### Recommended Testing Methods

1. **Use a Local Web Server** (Recommended)
   ```bash
   # Using Python (if installed)
   cd /path/to/extracted/scorm/package
   python -m http.server 8000
   # Then open http://localhost:8000 in your browser
   
   # Using Node.js http-server
   npx http-server /path/to/extracted/scorm/package -p 8000
   # Then open http://localhost:8000 in your browser
   ```

2. **Upload to an LMS**
   - Upload the .zip file to a SCORM-compliant LMS (Moodle, Canvas, etc.)
   - This is the most accurate testing method

3. **Use SCORM Cloud**
   - Free testing service: https://cloud.scorm.com/
   - Upload your package for testing

4. **Disable Browser Security** (Not Recommended for Production)
   - Chrome: `--disable-web-security --user-data-dir=/tmp/chrome_dev`
   - Firefox: Set `security.fileuri.strict_origin_policy` to false in about:config

### Testing Guidelines

#### 1. Test-Driven Development (TDD)
All new features must follow the Red-Green-Refactor cycle:
```typescript
// 1. Write failing test (Red)
it('should handle user input', () => {
  expect(component.handleInput('test')).toBe('processed')
})

// 2. Implement feature (Green)
// 3. Refactor and optimize
```

#### 2. Test Organization
```typescript
describe('ComponentName', () => {
  describe('rendering', () => {
    it('should render without errors', () => {})
    it('should display correct content', () => {})
  })
  
  describe('user interactions', () => {
    it('should handle click events', () => {})
    it('should validate input', () => {})
  })
  
  describe('accessibility', () => {
    it('should have no violations', async () => {})
    it('should support keyboard navigation', () => {})
  })
})
```

#### 3. Accessibility Testing
Every interactive component must have accessibility tests:
```typescript
import { axe } from 'jest-axe'

it('should have no accessibility violations', async () => {
  const { container } = render(<Component />)
  const results = await axe(container)
  expect(results).toHaveNoViolations()
})
```

## 🎨 Design System

The application uses a custom design system with:
- Consistent color palette
- Reusable components
- CSS modules for scoping
- Responsive design patterns

### Key Components
- `Button` - Primary interactive element
- `Input` - Form inputs with validation
- `Modal` - Overlay dialogs
- `Card` - Content containers
- `Toast` - Notification system
- `PageLayout` - Consistent page structure

## 📊 Performance

### Lighthouse Scores (Production Build)
- **Performance**: 89/100
- **Accessibility**: 89/100
- **Best Practices**: 100/100
- **SEO**: 82/100

### Bundle Sizes (Gzipped)
- Main bundle: 34.92 KB
- React vendor: 56.49 KB
- Utilities: 36.19 KB
- Services: 22.37 KB
- Total: ~157 KB

## 🔧 Configuration

### API Keys Setup
The application requires Google API keys for enhanced media search functionality:

#### Required API Keys
- **Google Image Search API Key**: Enables image search in Media Enhancement Wizard
- **Google Custom Search Engine ID**: Required for filtering Google Image searches
- **YouTube API Key**: Enables YouTube video search and embedding

#### Quick Setup
1. Copy the example environment file:
   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your API keys:
   ```env
   VITE_GOOGLE_IMAGE_API_KEY=your_google_api_key_here
   VITE_GOOGLE_CSE_ID=your_custom_search_engine_id_here
   VITE_YOUTUBE_API_KEY=your_youtube_api_key_here
   ```

#### Obtaining API Keys

**Google Image Search API Key:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Custom Search JSON API"
4. Create credentials (API Key)
5. Restrict the key to the Custom Search JSON API

**Google Custom Search Engine ID:**
1. Go to [Google Custom Search Engine](https://cse.google.com/)
2. Create a new search engine
3. Set "Sites to search" to "Search the entire web"
4. Copy the Search Engine ID

**YouTube API Key:**
1. In Google Cloud Console, enable the "YouTube Data API v3"
2. Use the same API key or create a new one
3. Restrict to YouTube Data API v3

#### Offline Mode
If you don't have API keys, you can run in offline mode with limited functionality:

```bash
# Set offline mode in .env.local
VITE_OFFLINE_MODE=true

# Or build with offline mode
npm run build -- --skip-api-check
```

#### Build Configuration
For CI/CD environments, set `VITE_SKIP_API_VALIDATION=true` to build without API keys.

#### Feature-Specific API Usage
- **Media Enhancement Wizard**:
  - `VITE_GOOGLE_IMAGE_API_KEY` + `VITE_GOOGLE_CSE_ID`: Enables image search and selection
  - `VITE_YOUTUBE_API_KEY`: Enables YouTube video search and embedding
  - Without keys: Manual image/video URL entry only

- **Course Content**:
  - All core functionality works without API keys
  - Local file uploads always available
  - Manual media URL entry supported

- **Offline Limitations**:
  - No image search from Google
  - No YouTube video search  
  - No automatic video thumbnails
  - Manual media workflows still fully functional

### Security Configuration
The application includes:
- Content Security Policy (CSP)
- XSS protection via DOMPurify
- Secure local storage
- Input sanitization

## 📦 Building

### Web Build
```bash
# Development build
npm run build

# Production build with optimizations
npm run build -- --mode production

# Analyze bundle size
npx vite-bundle-visualizer
```

### Desktop App (Tauri)
```bash
# Development
npm run tauri dev

# Production build
npm run tauri build
```

## 🚀 Deployment

### Static Hosting
The built files in `dist/` can be served from any static host:
- Netlify
- Vercel
- GitHub Pages
- AWS S3

### Performance Optimizations
- Enable gzip/brotli compression
- Set proper cache headers
- Use CDN for assets
- Enable HTTP/2

## 🤝 Contributing

### Development Process
1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests first (TDD)
4. Implement your feature
5. Ensure all tests pass (`npm test`)
6. Check types (`npm run type-check`)
7. Commit your changes (`git commit -m 'Add some amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

### Code Standards
- TypeScript strict mode
- ESLint configuration
- Prettier formatting
- Comprehensive tests
- Accessibility compliance

## 📄 License

[Add your license here]

## 🔗 Links

- [Project Documentation](./PROJECT_SUMMARY.md)
- [Test Improvement Summary](./TEST_IMPROVEMENT_SUMMARY.md)
- [Performance Audit](./PERFORMANCE_AUDIT_SUMMARY.md)
- [Bundle Optimization Guide](./BUNDLE_OPTIMIZATION_ANALYSIS.md)
- [Code Splitting Guide](./CODE_SPLITTING_EXAMPLE.md)

## 🐛 Known Issues

- SCORM 2004 support not yet implemented (removed from UI)
- Media search requires API keys

## ⚙️ Dependencies & Compatibility

### Core Dependencies
This project uses current stable versions of major frameworks:

- **React 19.1.1** - Latest stable React with concurrent features
- **React Router 7.2.0** - Modern routing with data loading
- **Vite 6.0.7** - Fast build tool with optimized bundling
- **TypeScript 5.x** - Strict type checking enabled
- **Tauri 2.x** - Desktop app framework

### Version Strategy
- **Current Stable**: All dependencies use stable, published versions (not beta/RC)
- **LTS Support**: For enterprise environments requiring LTS, consider using:
  - React 18.x (LTS)
  - React Router 6.x (stable)
  - Vite 5.x (stable)

### Compatibility Notes
- **Node.js**: Requires Node 18+ (for React 19 support)
- **npm**: Version 9+ recommended
- **Browser Support**: Modern browsers (ES2022+ features used)

## 🎯 Roadmap

- [ ] Implement code splitting for better performance
- [ ] Add SCORM 2004 support
- [ ] Implement offline mode
- [ ] Add more course templates
- [ ] Enhance AI prompt generation

## 📞 Support

[Add support information]

## 🏆 Recent Improvements

### Memory Management & Performance (Latest)
- **Implemented LRU Cache with Memory Management** for BlobURLCache to prevent memory leaks
- **Added automatic cache eviction** based on size limits and memory thresholds
- **Performance monitoring** with hit ratios and cache statistics
- **Configurable cache limits** for optimal memory usage in long-running sessions

### Previous Improvements
- **Fixed all remaining TypeScript strict typing issues** (Record, Map, Promise generics)
- **Enhanced test suite consolidation** - merged 200+ separate test files into 29 consolidated suites
- **Fixed Husky git hooks configuration** for reliable pre-commit checks
- **Enhanced metadata typing** with additional SCORM-specific fields
- **Resolved test timeout issues** in Toast, AIPromptGenerator, and retryWithBackoff
- **Comprehensive BDD test coverage** with step definitions for all major features
- Added comprehensive test coverage for SCORM generators
- Improved UI spacing and layout
- Added accessibility tests for key components
- Achieved 100% test coverage for security and error monitoring
- Optimized bundle configuration
- Documented performance metrics and optimization strategies