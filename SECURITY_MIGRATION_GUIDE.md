# Security Migration Guide

## 🚨 Critical Security Fixes - Apply Immediately

### Step 1: Install Dependencies

```bash
cd scorm-builder
npm install dompurify @types/dompurify
```

### Step 2: Apply Rust Security Fixes

1. **Backup current commands.rs**
   ```bash
   cd src-tauri/src
   cp commands.rs commands.rs.backup
   ```

2. **Replace with secure version**
   - Copy content from `commands_secure.rs` to `commands.rs`
   - Or apply the specific changes:

   **Add imports at the top:**
   ```rust
   use std::path::{Path, PathBuf};
   use url::Url;
   use std::net::IpAddr;
   ```

   **Add validation functions:**
   ```rust
   fn validate_project_path(file_path: &str) -> Result<PathBuf, String> {
       // Copy from commands_secure.rs lines 30-64
   }

   fn validate_image_url(url_str: &str) -> Result<Url, String> {
       // Copy from commands_secure.rs lines 79-104
   }
   ```

   **Update commands to use validation:**
   ```rust
   #[tauri::command]
   pub async fn save_project(project_data: ProjectFile, file_path: String) -> Result<(), String> {
       let path = validate_project_path(&file_path)?; // ADD THIS
       save_project_file(&project_data, &path)
   }
   ```

3. **Update Cargo.toml**
   ```toml
   [dependencies]
   url = "2.5"
   ```

### Step 3: Apply TypeScript Security Fixes

1. **FileStorage.ts is already updated with sanitization import and usage**

2. **Verify the changes:**
   - Check line 5 has: `import { sanitizeContentItem } from '../utils/contentSanitizer'`
   - Check saveContent method (around line 606) sanitizes content

### Step 4: Run Tests

```bash
# Install test dependencies if needed
npm install --save-dev vitest @vitest/ui

# Run security tests
npm test src/tests/security.test.ts

# Run integration tests (requires Tauri running)
npm run tauri dev
# In another terminal:
npm test src/tests/integration/security-integration.test.ts
```

### Step 5: Build and Verify

```bash
# Build TypeScript
npm run build

# Build Rust
cd src-tauri
cargo build --release

# Run the app
cd ..
npm run tauri dev
```

## 🧪 Testing the Security Fixes

### Test 1: Path Traversal
```javascript
// In browser console, this should fail:
await invoke('save_project', {
  projectData: { /* ... */ },
  filePath: '../../../etc/passwd.scormproj'
})
// Expected: "Access denied" error
```

### Test 2: XSS Prevention
```javascript
// Create content with XSS
fileStorage.saveContent('test', {
  topicId: 'test',
  content: '<script>alert("xss")</script><p>Hello</p>'
})

// Retrieve and check
const saved = await fileStorage.getContent('test')
console.log(saved.content) // Should be: <p>Hello</p>
```

### Test 3: URL Validation
```javascript
// These should fail:
await invoke('download_image', { url: 'http://example.com/image.jpg' })
// Expected: "Only HTTPS URLs are allowed"

await invoke('download_image', { url: 'https://evil.com/image.jpg' })
// Expected: "Domain 'evil.com' is not in the allowed list"
```

## 📋 Verification Checklist

- [ ] DOMPurify installed
- [ ] Rust url crate added to Cargo.toml
- [ ] commands.rs has validate_project_path function
- [ ] commands.rs has validate_image_url function
- [ ] All file commands use path validation
- [ ] download_image uses URL validation
- [ ] FileStorage.ts imports contentSanitizer
- [ ] saveContent method sanitizes input
- [ ] Security tests pass
- [ ] App builds without errors
- [ ] Manual security tests pass

## 🚀 Deployment

After verification:

1. **Commit changes**
   ```bash
   git add -A
   git commit -m "SECURITY: Fix critical vulnerabilities
   
   - Add path traversal protection
   - Add XSS sanitization  
   - Add URL validation for downloads
   - Add input size limits"
   ```

2. **Create a security release**
   ```bash
   npm version patch
   git tag -a v1.0.1-security -m "Security patch release"
   git push origin main --tags
   ```

3. **Build release**
   ```bash
   npm run tauri build
   ```

4. **Notify users**
   - Create GitHub release with security notes
   - Email users about critical update
   - Update documentation

## 🔄 Rollback Plan

If issues occur:

1. **Revert Rust changes**
   ```bash
   cd src-tauri/src
   cp commands.rs.backup commands.rs
   cd ../..
   npm run tauri build
   ```

2. **Revert TypeScript changes**
   ```bash
   git checkout HEAD~1 src/services/FileStorage.ts
   npm run build
   ```

3. **Emergency hotfix**
   - Disable affected features temporarily
   - Deploy minimal fix
   - Plan proper fix for next release

## 📞 Support

If you encounter issues:

1. Check error logs in `~/.scorm-builder/logs/`
2. Run with debug logging: `RUST_LOG=debug npm run tauri dev`
3. File issue with security label on GitHub
4. For critical issues, email security@yourcompany.com

Remember: **Security fixes should be applied and deployed as soon as possible!**