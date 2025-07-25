# SCORM Builder - Security Implementation Plan

## Phase 1: Critical Security Fixes (Do Today)

### 1.1 Path Traversal Fix

**Step 1:** Update `src-tauri/src/main.rs` to include the error module:
```rust
mod error;
```

**Step 2:** Implement the security validation in commands.rs

**Step 3:** Test with malicious paths:
```bash
# Test cases to verify fix:
# 1. Try to save outside project directory
# 2. Try path with ../../../etc/passwd
# 3. Try absolute paths to system files
```

### 1.2 XSS Prevention

**Step 1:** Install DOMPurify:
```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

**Step 2:** Update FileStorage.ts to use sanitization

**Step 3:** Create test content with XSS attempts:
```javascript
// Test malicious content
const maliciousContent = {
  content: '<script>alert("XSS")</script><p>Normal content</p>',
  narration: '<img src=x onerror="alert(\'XSS\')">'
}
```

### 1.3 SSRF Protection

**Step 1:** Update Cargo.toml to include url crate:
```toml
[dependencies]
url = "2.5"
```

**Step 2:** Implement URL validation in download_image

**Step 3:** Test with various URLs:
- Internal IPs (192.168.1.1, 127.0.0.1)
- File URLs (file:///etc/passwd)
- Non-HTTPS URLs
- Redirect chains

## Phase 2: Automated Security Testing

### 2.1 Create Security Test Suite

```typescript
// src/tests/security.test.ts
import { describe, it, expect } from 'vitest';

describe('Security Tests', () => {
  describe('Path Traversal Prevention', () => {
    it('should reject paths outside project directory', async () => {
      const maliciousPath = '../../../etc/passwd';
      await expect(saveProject(data, maliciousPath))
        .rejects.toThrow('Access denied');
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize HTML content', () => {
      const dirty = '<script>alert("xss")</script><p>Hello</p>';
      const clean = sanitizeContent(dirty);
      expect(clean).toBe('<p>Hello</p>');
      expect(clean).not.toContain('script');
    });
  });

  describe('SSRF Prevention', () => {
    it('should reject internal IP addresses', async () => {
      await expect(downloadImage('https://192.168.1.1/image.jpg'))
        .rejects.toThrow('private IP');
    });
  });
});
```

### 2.2 Performance Baseline Tests

```typescript
// src/tests/performance.test.ts
describe('Performance Tests', () => {
  it('should handle large projects without memory leaks', async () => {
    const initialMemory = performance.memory.usedJSHeapSize;
    
    // Create and delete 10 projects
    for (let i = 0; i < 10; i++) {
      const project = await createLargeProject();
      await deleteProject(project.id);
    }
    
    // Force garbage collection
    if (global.gc) global.gc();
    
    const finalMemory = performance.memory.usedJSHeapSize;
    const memoryGrowth = finalMemory - initialMemory;
    
    // Should not grow more than 10MB
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
  });
});
```

## Phase 3: CI/CD Security Pipeline

### 3.1 GitHub Actions Security Workflow

```yaml
# .github/workflows/security.yml
name: Security Checks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    # Dependency scanning
    - name: Run npm audit
      run: npm audit --audit-level=moderate
    
    # Rust security audit
    - name: Install cargo-audit
      run: cargo install cargo-audit
    
    - name: Run cargo audit
      run: cd src-tauri && cargo audit
    
    # SAST scanning
    - name: Run Semgrep
      uses: returntocorp/semgrep-action@v1
      with:
        config: >-
          p/security-audit
          p/typescript
          p/rust
    
    # License compliance
    - name: Check licenses
      run: npx license-checker --onlyAllow 'MIT;Apache-2.0;BSD-3-Clause;BSD-2-Clause;ISC'
```

### 3.2 Pre-commit Hooks

```json
// package.json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run security:check && npm run lint",
      "pre-push": "npm run test:security"
    }
  },
  "scripts": {
    "security:check": "npm audit --audit-level=moderate && cd src-tauri && cargo audit",
    "test:security": "vitest run src/tests/security.test.ts"
  }
}
```

## Phase 4: Monitoring & Alerting

### 4.1 Runtime Security Monitoring

```typescript
// src/utils/securityMonitor.ts
class SecurityMonitor {
  private violations: SecurityViolation[] = [];
  
  logViolation(type: string, details: any) {
    const violation = {
      type,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    
    this.violations.push(violation);
    
    // Send to backend for analysis
    if (this.violations.length > 10) {
      this.reportViolations();
    }
  }
  
  private async reportViolations() {
    try {
      await invoke('report_security_violations', {
        violations: this.violations
      });
      this.violations = [];
    } catch (error) {
      console.error('Failed to report violations:', error);
    }
  }
}

export const securityMonitor = new SecurityMonitor();
```

### 4.2 Performance Monitoring

```typescript
// src/utils/performanceMonitor.ts
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  
  measureOperation<T>(name: string, operation: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const initialMemory = performance.memory?.usedJSHeapSize || 0;
    
    return operation().then(result => {
      const duration = performance.now() - start;
      const memoryDelta = (performance.memory?.usedJSHeapSize || 0) - initialMemory;
      
      this.recordMetric({
        name,
        duration,
        memoryDelta,
        timestamp: new Date().toISOString()
      });
      
      // Alert on slow operations
      if (duration > 1000) {
        console.warn(`Slow operation detected: ${name} took ${duration}ms`);
      }
      
      return result;
    });
  }
  
  getMetrics() {
    return this.metrics;
  }
}
```

## Phase 5: Security Documentation

### 5.1 Security Checklist for Developers

```markdown
# Developer Security Checklist

Before committing code, ensure:

- [ ] No hardcoded secrets or API keys
- [ ] All user input is validated and sanitized
- [ ] File paths are validated against allowed directories
- [ ] External URLs are validated against whitelist
- [ ] No use of `eval()` or `new Function()`
- [ ] All dependencies are up to date
- [ ] Error messages don't leak sensitive information
- [ ] Proper authentication checks on sensitive operations
```

### 5.2 Incident Response Plan

```markdown
# Security Incident Response

1. **Detection**
   - Monitor security logs
   - Watch for unusual patterns
   - User reports

2. **Containment**
   - Disable affected features
   - Revoke compromised credentials
   - Block malicious IPs

3. **Investigation**
   - Review logs
   - Identify attack vector
   - Assess damage

4. **Recovery**
   - Apply patches
   - Restore from backups
   - Update security measures

5. **Post-Mortem**
   - Document incident
   - Update procedures
   - Train team
```

## Implementation Timeline

- **Day 1-2**: Implement critical security fixes
- **Day 3-4**: Create and run security tests
- **Day 5**: Set up CI/CD security pipeline
- **Week 2**: Implement monitoring and alerting
- **Week 3**: Complete documentation and training

## Success Metrics

1. **Security**
   - Zero critical vulnerabilities in production
   - 100% of inputs sanitized
   - All file operations validated

2. **Performance**
   - Page load time < 2 seconds
   - Memory usage < 500MB for large projects
   - No memory leaks detected

3. **Code Quality**
   - 90%+ test coverage
   - Zero high-severity linting errors
   - All dependencies up to date

## Next Review Date: [2 weeks from implementation]