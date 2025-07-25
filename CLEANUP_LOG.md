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

### Phase 2: Test Files Consolidation (TODO)

### Phase 3: Documentation Archive (TODO)