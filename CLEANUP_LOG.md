# SCORM Builder Cleanup Log

## Date: 2025-07-25

### Phase 1: Unused Components Removal

#### Components Removed:
1. **Button.polished.tsx** - Unused button variant, only referenced in tests
   - Also removed: button.polish.css
   - Also removed: Button.polish.test.tsx
   
2. **OpenProjectDialogRefactored.tsx** - Not used in main app, only in test files
   - Also removed: OpenProjectDialogRefactored.test.tsx
   
3. **PerformanceDashboard.tsx** - Standalone component not imported anywhere
   
4. **SecurityMonitorDashboard.tsx** - Standalone component not imported anywhere

#### Components Kept:
- **AutoSaveIndicatorConnected.tsx** - Used in multiple components for autosave functionality

### Phase 2: Documentation and Asset Archive

#### Files Moved to Archive:
1. **Documentation** - Moved to `archive/docs/`:
   - All *_SUMMARY.md files
   - All *_REPORT.md files  
   - All *_IMPROVEMENTS.md files
   - All *_FIX.md files
   - All *_ANALYSIS.md files
   - All *_PLAN.md files
   - CLEANUP.md, CODE_SPLITTING*.md, COVERAGE*.md, BUNDLE*.md
   
2. **Screenshots** - Moved to `archive/screenshots/`:
   - screenshots* folders
   - button-screenshots
   - design-system-screenshots
   
3. **Test Scripts** - Moved to `archive/`:
   - capture-*.js
   - playwright-*.js/mjs
   - quick-test.mjs
   - debug-page.mjs
   
4. **Mockups** - Moved to `archive/`:
   - mockups/ folder with all HTML mockup files

### Phase 3: Test Files Consolidation (TODO)