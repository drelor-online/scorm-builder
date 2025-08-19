import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { StatusPanel, StatusMessage } from './StatusPanel';

describe('StatusPanel Data-TestId Implementation', () => {
  const mockMessages: StatusMessage[] = [
    {
      id: 'test-1',
      type: 'info',
      title: 'Auto-save',
      message: 'Project changes saved automatically',
      timestamp: Date.now()
    },
    {
      id: 'test-2',
      type: 'success',
      title: 'Manual Save',
      message: 'Project saved successfully',
      timestamp: Date.now() - 1000
    }
  ];

  const mockProps = {
    messages: mockMessages,
    onDismiss: vi.fn(),
    onClearAll: vi.fn()
  };

  it('should have data-testid on status panel container', () => {
    render(<StatusPanel {...mockProps} />);
    
    expect(screen.getByTestId('status-panel')).toBeInTheDocument();
  });

  it('should have data-testid on individual status messages', () => {
    render(<StatusPanel {...mockProps} />);
    
    expect(screen.getByTestId('status-message-test-1')).toBeInTheDocument();
    expect(screen.getByTestId('status-message-test-2')).toBeInTheDocument();
  });

  it('should have data-testid on message dismiss buttons', () => {
    render(<StatusPanel {...mockProps} />);
    
    expect(screen.getByTestId('status-dismiss-test-1')).toBeInTheDocument();
    expect(screen.getByTestId('status-dismiss-test-2')).toBeInTheDocument();
  });

  it('should have data-testid on clear all button', () => {
    render(<StatusPanel {...mockProps} />);
    
    expect(screen.getByTestId('status-clear-all')).toBeInTheDocument();
  });

  it('should have data-testid on collapse/expand button', () => {
    render(<StatusPanel {...mockProps} />);
    
    expect(screen.getByTestId('status-toggle-collapse')).toBeInTheDocument();
  });

  it('should have data-testid attributes for automated testing', () => {
    render(<StatusPanel {...mockProps} />);
    
    // Verify essential elements have data-testid for automation
    expect(screen.getByTestId('status-panel')).toBeInTheDocument();
    expect(screen.getByTestId('status-clear-all')).toBeInTheDocument();
    expect(screen.getByTestId('status-toggle-collapse')).toBeInTheDocument();
    
    // Verify each message and dismiss button has unique testid
    mockMessages.forEach(message => {
      expect(screen.getByTestId(`status-message-${message.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`status-dismiss-${message.id}`)).toBeInTheDocument();
    });
  });
});