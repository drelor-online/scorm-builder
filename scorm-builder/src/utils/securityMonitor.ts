import { invoke } from '@tauri-apps/api/core';

interface SecurityViolation {
  type: 'xss_attempt' | 'path_traversal' | 'invalid_url' | 'size_limit' | 'rate_limit';
  details: any;
  timestamp: string;
  userAgent: string;
  source?: string;
}

class SecurityMonitor {
  private violations: SecurityViolation[] = [];
  private reportThreshold = 10;
  private reportInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Report violations every 5 minutes if any exist
    this.reportInterval = setInterval(() => {
      if (this.violations.length > 0) {
        this.reportViolations();
      }
    }, 5 * 60 * 1000);
  }

  logViolation(type: SecurityViolation['type'], details: any, source?: string) {
    const violation: SecurityViolation = {
      type,
      details,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      source
    };
    
    this.violations.push(violation);
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.warn('Security violation detected:', violation);
    }
    
    // Report immediately if threshold reached
    if (this.violations.length >= this.reportThreshold) {
      this.reportViolations();
    }
  }

  logXSSAttempt(content: string, source: string) {
    this.logViolation('xss_attempt', {
      content: content.substring(0, 100), // Don't log full content
      blocked: true
    }, source);
  }

  logPathTraversal(path: string, source: string) {
    this.logViolation('path_traversal', {
      path,
      blocked: true
    }, source);
  }

  logInvalidURL(url: string, reason: string) {
    this.logViolation('invalid_url', {
      url,
      reason,
      blocked: true
    }, 'download_image');
  }

  logSizeViolation(size: number, limit: number, fileType: string) {
    this.logViolation('size_limit', {
      size,
      limit,
      fileType,
      blocked: true
    }, 'file_upload');
  }

  private async reportViolations() {
    if (this.violations.length === 0) return;
    
    try {
      // In production, this would send to a logging service
      await invoke('log_security_violations', {
        violations: this.violations
      });
      
      // Clear reported violations
      this.violations = [];
    } catch (error) {
      console.error('Failed to report security violations:', error);
      
      // Keep only last 100 violations if reporting fails
      if (this.violations.length > 100) {
        this.violations = this.violations.slice(-100);
      }
    }
  }

  getViolationCount(): number {
    return this.violations.length;
  }

  getViolationSummary(): Record<SecurityViolation['type'], number> {
    const summary: Record<SecurityViolation['type'], number> = {
      xss_attempt: 0,
      path_traversal: 0,
      invalid_url: 0,
      size_limit: 0,
      rate_limit: 0
    };
    
    this.violations.forEach(v => {
      summary[v.type]++;
    });
    
    return summary;
  }

  destroy() {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
    
    // Report any remaining violations
    this.reportViolations();
  }
}

export const securityMonitor = new SecurityMonitor();

// Export for testing
export { SecurityMonitor, type SecurityViolation };