import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the Tauri invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn()
}));

import { WorkflowRecorder } from './WorkflowRecorder';
import { invoke } from '@tauri-apps/api/core';

const mockInvoke = vi.mocked(invoke);

describe('WorkflowRecorder Cleanup Functionality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue('Success message');
  });

  it('should show cleanup button when not recording and session exists', async () => {
    render(<WorkflowRecorder />);
    
    // Start and stop recording to create a session
    const startBtn = screen.getByText(/Start Recording/i);
    fireEvent.click(startBtn);
    
    const stopBtn = await screen.findByText(/Stop Recording/i);
    fireEvent.click(stopBtn);
    
    // Cleanup button should now be visible
    expect(screen.getByText(/Delete All Recordings/i)).toBeInTheDocument();
  });

  it('should not show cleanup button when recording', async () => {
    render(<WorkflowRecorder />);
    
    // Start recording
    const startBtn = screen.getByText(/Start Recording/i);
    fireEvent.click(startBtn);
    
    // Cleanup button should not be visible
    expect(screen.queryByText(/Delete All Recordings/i)).not.toBeInTheDocument();
  });

  it('should invoke clean_workflow_files when cleanup button is clicked', async () => {
    render(<WorkflowRecorder />);
    
    // Start and stop recording to create a session
    const startBtn = screen.getByText(/Start Recording/i);
    fireEvent.click(startBtn);
    
    const stopBtn = await screen.findByText(/Stop Recording/i);
    fireEvent.click(stopBtn);
    
    // Click cleanup button
    const cleanupBtn = screen.getByText(/Delete All Recordings/i);
    fireEvent.click(cleanupBtn);
    
    // Should call Tauri command
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith('clean_workflow_files');
    });
  });

  it('should display success message after successful cleanup', async () => {
    mockInvoke.mockResolvedValue('Successfully deleted 5 workflow files');
    
    render(<WorkflowRecorder />);
    
    // Start and stop recording to create a session
    const startBtn = screen.getByText(/Start Recording/i);
    fireEvent.click(startBtn);
    
    const stopBtn = await screen.findByText(/Stop Recording/i);
    fireEvent.click(stopBtn);
    
    // Click cleanup button
    const cleanupBtn = screen.getByText(/Delete All Recordings/i);
    fireEvent.click(cleanupBtn);
    
    // Should show success message
    await waitFor(() => {
      expect(screen.getByText(/Successfully deleted 5 workflow files/i)).toBeInTheDocument();
    });
  });

  it('should handle cleanup errors gracefully', async () => {
    mockInvoke.mockRejectedValue(new Error('Failed to delete files'));
    
    render(<WorkflowRecorder />);
    
    // Start and stop recording to create a session
    const startBtn = screen.getByText(/Start Recording/i);
    fireEvent.click(startBtn);
    
    const stopBtn = await screen.findByText(/Stop Recording/i);
    fireEvent.click(stopBtn);
    
    // Click cleanup button
    const cleanupBtn = screen.getByText(/Delete All Recordings/i);
    fireEvent.click(cleanupBtn);
    
    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/Failed to clean workflow files/i)).toBeInTheDocument();
    });
  });

  it('should disable cleanup button while cleaning', async () => {
    // Make invoke return a slow promise
    let resolvePromise: (value: string) => void;
    const slowPromise = new Promise<string>((resolve) => {
      resolvePromise = resolve;
    });
    mockInvoke.mockReturnValue(slowPromise);
    
    render(<WorkflowRecorder />);
    
    // Start and stop recording to create a session
    const startBtn = screen.getByText(/Start Recording/i);
    fireEvent.click(startBtn);
    
    const stopBtn = await screen.findByText(/Stop Recording/i);
    fireEvent.click(stopBtn);
    
    // Click cleanup button
    const cleanupBtn = screen.getByText(/Delete All Recordings/i);
    fireEvent.click(cleanupBtn);
    
    // Button should be disabled
    expect(cleanupBtn).toBeDisabled();
    expect(screen.getByText(/Cleaning.../i)).toBeInTheDocument();
    
    // Resolve the promise
    resolvePromise!('Success');
    
    // Button should be enabled again
    await waitFor(() => {
      expect(cleanupBtn).not.toBeDisabled();
    });
  });
});