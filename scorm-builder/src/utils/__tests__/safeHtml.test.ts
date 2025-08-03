import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from '../safeHtml';

describe('safeHtml', () => {
  it('should preserve href attributes in links', () => {
    const input = '<a href="https://example.com">Example</a>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<a href="https://example.com">Example</a>');
  });

  it('should preserve href with hash', () => {
    const input = '<a href="#">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<a href="#">Link</a>');
  });

  it('should handle complex HTML', () => {
    const input = '<p>And a link: <a href="https://example.com">Example</a></p>';
    const result = sanitizeHtml(input);
    expect(result).toBe('<p>And a link: <a href="https://example.com">Example</a></p>');
  });
});