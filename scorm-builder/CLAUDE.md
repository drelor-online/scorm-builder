TEST DRIVEN DEVELOPMENT IS NON-NEGOTIABLE!!!!!
DO NOT TRY TO BYPASS ANY HOOKS (tdd-guard)!!!!!
ALWAYS CREATE FAILING TESTS BEFORE IMPLEMENTING NEW FEATURES!!!!!
FOLLOW RED-GREEN-REFACTOR PROCESS EVERY SINGLE TIME!!!! NO EXCEPTIONS!!!!

BEHAVIOR-BASED TDD PROCESS (MANDATORY FOR ALL CHANGES):
1. When asked to "fix errors" or make ANY code change:
   - FIRST: Write a failing test that reproduces the error
   - SECOND: Make the test pass with minimal code
   - THIRD: Refactor if needed
   
2. For runtime errors:
   - Create integration/behavior tests that simulate the user action causing the error
   - The test MUST fail with the same error before fixing
   
3. For TypeScript errors:
   - Write a test that would catch the type issue
   - Fix the type error to make the test compile and pass

4. NO DIRECT CODE EDITS WITHOUT TESTS - Even for "obvious" fixes!

5. Test file naming convention:
   - Unit tests: `*.test.ts` or `*.test.tsx`  
   - Integration tests: `*.integration.test.tsx`
   - Behavior tests: `*.behavior.test.tsx`

6. If user says "just fix it" or "fix errors":
   - Respond: "I'll write a test first to reproduce this error, then fix it"
   - ALWAYS write the test first, no exceptions

ENFORCEMENT: This file is checked by git hooks and CI/CD. Any code changes without corresponding test changes will be rejected.

CURRENT ARCHITECTURE (as of Phase 2):
1. Media Management - SIMPLIFIED!
   - Old: FileStorage → FileStorageAdapter → MediaRegistry → MediaContext (complex)
   - New: MediaService → UnifiedMediaContext (simple, direct)
   - Automatic blob URL cleanup with BlobURLManager
   - See docs/migration/media-service-migration.md for details

2. Key Services:
   - MediaService: Unified media operations (store, get, delete, list)
   - UnifiedMediaContext: React context providing media functionality
   - BlobURLManager: Automatic memory leak prevention
   - Performance monitoring available but needs integration

CURRENT ISSUES TO TEST:
1. Performance optimization integration
   - BlobURLManager is working but could be optimized further
   - PerformanceMonitor exists but not fully integrated
2. Security improvements needed
   - No URL validation for external media
   - No path traversal protection
3. Test coverage gaps
   - New MediaService needs comprehensive tests
   - Integration tests for full upload → generate flow missing

RESOLVED ISSUES (Confirmed fixed in Phase 2):
- YouTube videos not displaying - FIXED (using storeYouTubeVideo() method)
- Migration from old to new architecture - COMPLETED (all components updated)
- Media ID chaos - FIXED (unified idGenerator.ts)
- Multiple media systems - FIXED (single MediaService + UnifiedMediaContext)
- Memory leaks - FIXED (BlobURLManager with auto-cleanup)
- Audio indexing - WORKING CORRECTLY (welcome=audio-0, objectives=audio-1, topics start at audio-2)
- blockCount error - FALSE (actual variable is navigationBlockCount, working fine)
- Knowledge check undefined variables - FALSE (radioInput/textInput only in old comments)

For each current issue above, create a behavior test that reproduces the issue BEFORE fixing it.

UNIFIED SAVE ARCHITECTURE (Fixed in commit d9855f3):
The application now uses a unified save system to prevent data loss and state inconsistencies:

1. ARCHITECTURE OVERVIEW:
   - App.tsx manages the master project state (courseSeedData + courseContent)
   - All saves flow through App.tsx's handleSave() (manual) or handleAutosave() (silent)
   - Child components trigger saves via onSave callbacks, not direct storage calls
   - Single source of truth for all project data

2. COURSESEEDINPUT INTEGRATION:
   - Auto-save: Calls onSave() callback → App.handleAutosave() → unified storage
   - Manual save: Calls onSave() callback → App.handleAutosave() → unified storage  
   - No direct storage.saveCourseSeedData() calls (prevents double-save)
   - Fallback: Direct storage save if no onSave callback (standalone usage)

3. SAVE FLOW:
   ```
   User changes → CourseSeedInput detects change → Debounced auto-save (1s) →
   onSave(seedData) → App.setCourseSeedData() + App.handleAutosave() →
   storage.saveCourseSeedData() + storage.saveProject() → State synchronized
   ```

4. BENEFITS:
   - ✅ No data loss when navigating between components
   - ✅ App state always synchronized with storage
   - ✅ No duplicate save operations
   - ✅ Consistent error handling across all saves
   - ✅ Silent auto-save vs user-visible manual save

5. KEY FILES:
   - App.tsx: handleSave(), handleAutosave(), onSave callback (lines 1633-1646)
   - CourseSeedInput.tsx: Auto-save useEffect (lines 241-339), onSave integration
   - Tests: CourseSeedInput.isSavingState.test.tsx, CourseSeedInput.unifiedSave.*.test.tsx

MUTATION SAFETY (CRITICAL FOR PRODUCTION):
- Deep freezing is DISABLED in production for performance
- ALL object mutations MUST use cloning utilities or immutable patterns
- See MUTATION_SAFETY.md for detailed guidelines
- Use utils/productionSafeClone.ts for safe cloning patterns
- NEVER mutate objects directly - always clone first
- Pattern: `setState(prev => ({ ...prev, newProperty: value }))`