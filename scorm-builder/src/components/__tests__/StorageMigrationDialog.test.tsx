/**
 * Storage Migration Dialog Tests
 * Tests for the UI component that handles the migration process
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent , waitFor } from '../../test/testProviders';
import React from 'react';
import { StorageMigrationDialog } from '../StorageMigrationDialog';
import { StorageRefactorMigration } from '../../services/storageRefactorMigration';
import { PersistentStorage } from '../../services/PersistentStorage';
import { FileMediaManager } from '../../services/fileMediaManager';

// Mock the migration service
vi.mock('../../services/storageRefactorMigration');
vi.mock('../../services/PersistentStorage');
vi.mock('../../services/fileMediaManager');

// Mock indexedDB for tests
global.indexedDB = {} as any;

describe('StorageMigrationDialog', () => {
  let mockMigration: any;
  // const mockOnClose = vi.fn();const mockOnComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockMigration = {
      migrateMedia: vi.fn().mockResolvedValue({
        success: true,
        migratedCount: 10,
        errors: []
      }),
      migrateProjectContent: vi.fn().mockResolvedValue({ success: true })
    };
    
    vi.mocked(StorageRefactorMigration).mockImplementation(() => mockMigration);
    
    // Mock PersistentStorage
    vi.mocked(PersistentStorage).mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      isInitialized: true
    } as any));
    
    // Mock FileMediaManager
    vi.mocked(FileMediaManager).mockImplementation(() => ({
      initializeProjectStructure: vi.fn().mockResolvedValue(undefined)
    } as any));
  });

  it('should display initial migration prompt', () => {
    // Intent: Users should see clear information about what will happen
    render(
      <StorageMigrationDialog
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    expect(screen.getByText(/Storage System Migration/i)).toBeInTheDocument();
    expect(screen.getByText(/This will migrate your project data/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Migration/i)).toBeInTheDocument();
    expect(screen.getByText(/Cancel/i)).toBeInTheDocument();
  });

  it('should show progress during migration', async () => {
    // Intent: Users should see real-time progress updates
    let progressCallback: any;
    mockMigration.migrateMedia.mockImplementation(async (options: any) => {
      progressCallback = options.onProgress;
      
      // Simulate async progress updates
      await new Promise(resolve => {
        setTimeout(() => {
          progressCallback({ current: 0, total: 10, phase: 'starting', message: 'Starting migration...' });
          resolve(undefined);
        }, 10);
      });
      
      await new Promise(resolve => {
        setTimeout(() => {
          progressCallback({ current: 5, total: 10, phase: 'migrating', message: 'Migrating files...' });
          resolve(undefined);
        }, 20);
      });
      
      await new Promise(resolve => {
        setTimeout(() => {
          progressCallback({ current: 10, total: 10, phase: 'complete', message: 'Complete' });
          resolve(undefined);
        }, 30);
      });
      
      return { success: true, migratedCount: 10 };
    });

    render(
      <StorageMigrationDialog
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const startButton = screen.getByText(/Start Migration/i);
    fireEvent.click(startButton);

    // Wait for progress to show
    await waitFor(() => {
      expect(screen.getByText(/Migrating: 5 \/ 10/i)).toBeInTheDocument();
    }, { timeout: 3000 });

    // Wait for completion
    await waitFor(() => {
      expect(screen.getByText(/Migration Complete/i)).toBeInTheDocument();
      expect(screen.getByText(/Successfully migrated 10 items/i)).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  it('should handle migration errors gracefully', async () => {
    // Intent: Errors should be displayed clearly to users
    mockMigration.migrateMedia.mockResolvedValue({
      success: false,
      migratedCount: 7,
      errors: [
        'Failed to migrate audio-0005: Disk full',
        'Failed to migrate image-0002: Permission denied'
      ]
    });

    render(
      <StorageMigrationDialog
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const startButton = screen.getByText(/Start Migration/i);
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(screen.getByText(/Migration Completed with Errors/i)).toBeInTheDocument();
      expect(screen.getByText(/Migrated 7 items successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to migrate audio-0005/i)).toBeInTheDocument();
      expect(screen.getByText(/Failed to migrate image-0002/i)).toBeInTheDocument();
    });
  });

  it('should disable cancel during migration', async () => {
    // Intent: Prevent users from canceling mid-migration to avoid data corruption
    // Make the migration take some time
    mockMigration.migrateMedia.mockImplementation(async (options: any) => {
      await new Promise(resolve => setTimeout(resolve, 100));
      return { success: true, migratedCount: 10 };
    });

    render(
      <StorageMigrationDialog
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const startButton = screen.getByText(/Start Migration/i);
    let cancelButton = screen.getByText(/Cancel/i);
    
    expect(cancelButton).not.toBeDisabled();
    
    fireEvent.click(startButton);

    // After clicking start, the cancel button should be disabled
    await waitFor(() => {
      cancelButton = screen.getByText(/Cancel/i);
      expect(cancelButton).toBeDisabled();
    });
  });

  it('should call onComplete after successful migration', async () => {
    // Intent: Parent component should be notified when migration completes
    render(
      <StorageMigrationDialog
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const startButton = screen.getByText(/Start Migration/i);
    fireEvent.click(startButton);

    await waitFor(() => {
      expect(mockOnComplete).toHaveBeenCalledWith({
        success: true,
        migratedCount: 10
      });
    });
  });

  it('should handle cancel before migration starts', () => {
    // Intent: Users can cancel if they change their mind
    render(
      <StorageMigrationDialog
        isOpen={true}
        onClose={mockOnClose}
        onComplete={mockOnComplete}
      />
    );

    const cancelButton = screen.getByText(/Cancel/i);
    fireEvent.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
    expect(mockOnComplete).not.toHaveBeenCalled();
  });
});