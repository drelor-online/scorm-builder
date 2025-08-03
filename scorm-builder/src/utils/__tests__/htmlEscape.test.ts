import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeJsString, escapeHtmlForJs } from '../htmlEscape';

describe('HTML Escape Functions', () => {
  describe('escapeHtml', () => {
    it('should escape basic HTML entities', () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      expect(escapeHtml('Tom & Jerry')).toBe('Tom &amp; Jerry');
      expect(escapeHtml("It's a test")).toBe("It&#39;s a test");
      expect(escapeHtml('<img src="x" />')).toBe('&lt;img src=&quot;x&quot; &#x2F;&gt;');
    });

    it('should handle empty and non-string inputs', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null as any)).toBe('');
      expect(escapeHtml(undefined as any)).toBe('');
      expect(escapeHtml(123 as any)).toBe('');
    });

    it('should not double-escape already escaped content', () => {
      const escaped = escapeHtml('<script>');
      expect(escapeHtml(escaped)).toBe('&amp;lt;script&amp;gt;');
    });
  });

  describe('escapeJsString', () => {
    it('should escape JavaScript special characters', () => {
      expect(escapeJsString('Hello\nWorld')).toBe('Hello\\nWorld');
      expect(escapeJsString('Tab\there')).toBe('Tab\\there');
      expect(escapeJsString('Back\\slash')).toBe('Back\\\\slash');
      expect(escapeJsString("It's \"quoted\"")).toBe("It\\'s \\\"quoted\\\"");
    });

    it('should handle line terminators', () => {
      expect(escapeJsString('Line\u2028separator')).toBe('Line\\u2028separator');
      expect(escapeJsString('Paragraph\u2029separator')).toBe('Paragraph\\u2029separator');
    });

    it('should handle empty and non-string inputs', () => {
      expect(escapeJsString('')).toBe('');
      expect(escapeJsString(null as any)).toBe('');
      expect(escapeJsString(undefined as any)).toBe('');
    });
  });

  describe('escapeHtmlForJs', () => {
    it('should escape HTML then JavaScript', () => {
      const malicious = '<script>alert("XSS")</script>';
      const result = escapeHtmlForJs(malicious);
      
      // Should contain both HTML and JS escaping
      expect(result).toContain('&lt;script&gt;');
      expect(result).toContain('&quot;'); // HTML entity for quote
      expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });

    it('should handle onclick injection attempts', () => {
      const injection = '" onclick="alert(\'XSS\')"';
      const result = escapeHtmlForJs(injection);
      
      // Should escape quotes to prevent breaking out
      expect(result).toBe('&quot; onclick=&quot;alert(&#39;XSS&#39;)&quot;');
    });

    it('should handle newlines in content', () => {
      const multiline = 'Line 1\n<script>alert("XSS")</script>';
      const result = escapeHtmlForJs(multiline);
      
      expect(result).toBe('Line 1\\n&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
    });
  });
});