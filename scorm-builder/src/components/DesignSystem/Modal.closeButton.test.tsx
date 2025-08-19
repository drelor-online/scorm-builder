import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { Modal } from './Modal';

describe('Modal Close Button data-testid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have data-testid on close button for test targeting', () => {
    const mockOnClose = vi.fn();
    
    render(
      <Modal 
        isOpen={true} 
        onClose={mockOnClose}
        title="Test Modal"
        showCloseButton={true}
      >
        <p>Modal content</p>
      </Modal>
    );
    
    // Should find close button by data-testid
    const closeButton = screen.getByTestId('modal-close-button');
    expect(closeButton).toBeInTheDocument();
    expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
  });

  it('should call onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    
    render(
      <Modal 
        isOpen={true} 
        onClose={mockOnClose}
        title="Test Modal"
        showCloseButton={true}
      >
        <p>Modal content</p>
      </Modal>
    );
    
    const closeButton = screen.getByTestId('modal-close-button');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should not render close button when showCloseButton is false', () => {
    const mockOnClose = vi.fn();
    
    render(
      <Modal 
        isOpen={true} 
        onClose={mockOnClose}
        title="Test Modal"
        showCloseButton={false}
      >
        <p>Modal content</p>
      </Modal>
    );
    
    // Should not find close button
    expect(screen.queryByTestId('modal-close-button')).not.toBeInTheDocument();
  });

  it('should have proper accessibility attributes on close button', () => {
    const mockOnClose = vi.fn();
    
    render(
      <Modal 
        isOpen={true} 
        onClose={mockOnClose}
        title="Test Modal"
        showCloseButton={true}
      >
        <p>Modal content</p>
      </Modal>
    );
    
    const closeButton = screen.getByTestId('modal-close-button');
    
    // Should have proper accessibility attributes
    expect(closeButton).toHaveAttribute('type', 'button');
    expect(closeButton).toHaveAttribute('aria-label', 'Close modal');
    expect(closeButton).toHaveClass('modal-close');
  });
});