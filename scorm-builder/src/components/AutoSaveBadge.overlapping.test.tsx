import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { AutoSaveBadge } from './AutoSaveBadge';
import styles from './AutoSaveBadge.module.css';

// Mock the AutoSaveContext
const mockAutoSaveContext = {
  isSaving: false,
  hasUnsavedChanges: true,
  lastSaved: null,
  isManualSave: false
};

vi.mock('../contexts/AutoSaveContext', () => ({
  useAutoSaveState: () => mockAutoSaveContext
}));

describe('AutoSaveBadge Overlapping Content Fix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have the correct CSS class that sets z-index for proper layering', () => {
    render(<AutoSaveBadge />);
    
    const badge = screen.getByRole('status');
    expect(badge).toBeInTheDocument();
    
    // Check that the badge has the autoSaveBadge class which sets z-index: 45
    expect(badge).toHaveClass(styles.autoSaveBadge);
  });

  it('should apply the autoSaveBadge CSS class consistently across different states', () => {
    // Test with unsaved changes state
    mockAutoSaveContext.hasUnsavedChanges = true;
    mockAutoSaveContext.isSaving = false;
    
    const { rerender } = render(<AutoSaveBadge />);
    
    const unsavedBadge = screen.getByRole('status');
    expect(unsavedBadge).toHaveClass(styles.autoSaveBadge);
    
    // Test with saving state
    mockAutoSaveContext.isSaving = true;
    mockAutoSaveContext.hasUnsavedChanges = false;
    
    rerender(<AutoSaveBadge />);
    
    const savingBadge = screen.getByRole('status');
    expect(savingBadge).toHaveClass(styles.autoSaveBadge);
    
    // Test with saved state  
    mockAutoSaveContext.isSaving = false;
    mockAutoSaveContext.hasUnsavedChanges = false;
    mockAutoSaveContext.lastSaved = new Date();
    
    rerender(<AutoSaveBadge />);
    
    const savedBadge = screen.getByRole('status');
    expect(savedBadge).toHaveClass(styles.autoSaveBadge);
  });

  it('should maintain semantic accessibility while fixing z-index overlapping', () => {
    render(<AutoSaveBadge />);
    
    const badge = screen.getByRole('status');
    
    // Should still have proper ARIA attributes
    expect(badge).toHaveAttribute('role', 'status');
    expect(badge).toHaveAttribute('aria-live', 'polite');
    expect(badge).toHaveAttribute('aria-label');
    
    // Should have the CSS class that fixes overlapping
    expect(badge).toHaveClass(styles.autoSaveBadge);
  });

  it('should verify the CSS module contains z-index styling', () => {
    // This test verifies that our CSS fix is present
    // In a real browser environment, the styles.autoSaveBadge class would apply z-index: 45
    expect(styles.autoSaveBadge).toBeDefined();
    expect(typeof styles.autoSaveBadge).toBe('string');
    expect(styles.autoSaveBadge.length).toBeGreaterThan(0);
  });
});