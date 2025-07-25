# SCORM Builder Security Quick Start Guide

## 🔴 Immediate Actions (Do Today)

### 1. Install Security Dependencies
```bash
cd scorm-builder
npm install dompurify @types/dompurify
```

### 2. Apply Critical Security Patches

#### Path Traversal Fix (Rust)
Add to `src-tauri/src/commands.rs` at line 13:
```rust
use std::path::{Path, PathBuf};

fn validate_project_path(file_path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(file_path);
    let projects_dir = get_projects_directory()?;
    
    let canonical_path = path.canonicalize()
        .map_err(|_| "Invalid path")?;
    
    if !canonical_path.starts_with(&projects_dir.canonicalize()?) {
        return Err("Access denied: Path outside projects directory".into());
    }
    
    Ok(canonical_path)
}
```

Then update all file commands to use it.

#### XSS Prevention (TypeScript)
Update `src/services/FileStorage.ts` line 601:
```typescript
import { sanitizeContentItem } from '../utils/contentSanitizer';

async saveContent(id: string, content: ContentItem): Promise<void> {
    if (!this.currentProject) throw new Error('No project open');
    
    if (!this.currentProject.course_content) {
      this.currentProject.course_content = {}
    }
    
    // ADD THIS LINE
    this.currentProject.course_content[id] = sanitizeContentItem(content);
    this.scheduleAutoSave();
}
```

### 3. Run Security Tests
```bash
npm test src/tests/security.test.ts
```

## 🟡 This Week

### 1. Set Up Monitoring
Add to your main App.tsx:
```typescript
import { securityMonitor } from './utils/securityMonitor';
import { performanceMonitor } from './utils/performanceMonitor';

// Wrap key operations
const saveProject = async () => {
  return performanceMonitor.measureOperation('saveProject', async () => {
    // existing save logic
  });
};
```

### 2. Configure CI/CD Security
Create `.github/workflows/security.yml`:
```yaml
name: Security Check
on: [push, pull_request]
jobs:
  security:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    - run: npm audit --audit-level=moderate
    - run: npm test src/tests/security.test.ts
```

### 3. Add Pre-commit Hooks
```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run lint && npm test"
```

## 🟢 Ongoing

### Regular Security Checklist
- [ ] Run `npm audit` weekly
- [ ] Update dependencies monthly
- [ ] Review security logs
- [ ] Test with malicious inputs
- [ ] Monitor performance metrics

### Development Security Rules
1. **Never trust user input** - Always validate and sanitize
2. **Use allowlists, not blocklists** - Define what's allowed
3. **Fail securely** - Errors shouldn't expose info
4. **Log security events** - Track suspicious activity
5. **Keep dependencies updated** - Patch vulnerabilities

## 📊 How to Verify It's Working

### Test Path Traversal Protection
```javascript
// This should fail with "Access denied"
await saveProject(data, "../../../etc/passwd");
```

### Test XSS Protection
```javascript
// This should be sanitized
const content = {
  content: '<script>alert("xss")</script><p>Hello</p>'
};
// Should save as: '<p>Hello</p>'
```

### Check Performance
```javascript
// In browser console
performanceMonitor.generateReport()
```

### View Security Violations
```javascript
// In browser console
securityMonitor.getViolationSummary()
```

## 🚨 Emergency Response

If you discover a security issue:

1. **Don't panic** - Most issues are fixable
2. **Document it** - Screenshot/copy the issue
3. **Fix immediately** - Apply patch from this guide
4. **Test thoroughly** - Ensure fix doesn't break functionality
5. **Deploy quickly** - Get the fix to users ASAP
6. **Post-mortem** - Figure out how it happened

## 📞 Need Help?

- Security issue? Check `SECURITY_AUDIT_REPORT.md`
- Implementation question? See `REFACTORING_GUIDE.md`
- Performance problem? Run `performanceMonitor.generateReport()`

Remember: **Security is not a feature, it's a requirement!**