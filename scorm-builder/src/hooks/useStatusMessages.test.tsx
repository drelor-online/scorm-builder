import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useStatusMessages } from './useStatusMessages';

describe('useStatusMessages Auto-save Notification Overlap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should prevent duplicate auto-save notifications', () => {
    const { result } = renderHook(() => useStatusMessages());

    // Add first auto-save notification
    act(() => {
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].title).toBe('Auto-save');
    expect(result.current.messages[0].message).toBe('Project changes saved automatically');

    // Add duplicate auto-save notification - should NOT create a new message if recent
    act(() => {
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
    });

    // Should still only have 1 message, not 2
    expect(result.current.messages).toHaveLength(1);
  });

  it('should allow duplicate notifications after enough time has passed', () => {
    const { result } = renderHook(() => useStatusMessages());

    // Mock Date.now to control timing
    const originalNow = Date.now;
    let mockTime = 1000000;
    Date.now = vi.fn(() => mockTime);

    // Add first auto-save notification
    act(() => {
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
    });

    expect(result.current.messages).toHaveLength(1);

    // Advance time by 5 seconds (more than the typical auto-save notification duration)
    mockTime += 5000;

    // Add duplicate auto-save notification - should be allowed after time gap
    act(() => {
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
    });

    // Should now have 2 messages
    expect(result.current.messages).toHaveLength(2);

    // Restore original Date.now
    Date.now = originalNow;
  });

  it('should allow different notification types and messages simultaneously', () => {
    const { result } = renderHook(() => useStatusMessages());

    act(() => {
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
      result.current.addSuccess('Manual Save', 'Project saved successfully');
      result.current.addInfo('Auto-save', 'Different message');
    });

    // Should have 3 messages: auto-save, manual save, and different auto-save message
    expect(result.current.messages).toHaveLength(3);
  });

  it('should handle rapid auto-save calls gracefully', () => {
    const { result } = renderHook(() => useStatusMessages());

    // Simulate rapid auto-save calls (like multiple component updates)
    act(() => {
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
      result.current.addInfo('Auto-save', 'Project changes saved automatically');
    });

    // Should only have 1 message despite 4 calls
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].title).toBe('Auto-save');
  });
});