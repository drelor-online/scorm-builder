/**
 * Storage Migration Dialog Component
 * Provides UI for migrating from IndexedDB to file-based storage
 */

import React, { useState, useCallback } from 'react';
import { Modal, Button, ProgressBar, Alert } from './DesignSystem';
import { StorageRefactorMigration, MigrationProgress } from '../services/storageRefactorMigration';
import { PersistentStorage } from '../services/PersistentStorage';
import { FileMediaManager } from '../services/fileMediaManager';

interface StorageMigrationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: { success: boolean; migratedCount: number }) => void;
  projectPath?: string;
}

export const StorageMigrationDialog: React.FC<StorageMigrationDialogProps> = ({
  isOpen,
  onClose,
  onComplete,
  projectPath = '/default/project/path'
}) => {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [result, setResult] = useState<{ success: boolean; migratedCount: number } | null>(null);

  const startMigration = useCallback(async () => {
    setIsRunning(true);
    setErrors([]);
    setResult(null);

    try {
      // Initialize services
      const persistentStorage = new PersistentStorage();
      await persistentStorage.initialize();
      
      const fileManager = new FileMediaManager(projectPath);
      await fileManager.initializeProjectStructure();

      const migration = new StorageRefactorMigration(persistentStorage, fileManager);

      // Run migration
      const migrationResult = await migration.migrateMedia({
        onProgress: (prog) => setProgress(prog),
        cleanupAfter: true
      });

      // Also migrate project content
      const contentIds = ['welcome', 'objectives']; // Add actual content IDs
      await migration.migrateProjectContent(contentIds);

      setResult({
        success: migrationResult.success,
        migratedCount: migrationResult.migratedCount
      });

      if (migrationResult.errors && migrationResult.errors.length > 0) {
        setErrors(migrationResult.errors);
      }

      // Notify parent
      onComplete({
        success: migrationResult.success,
        migratedCount: migrationResult.migratedCount
      });
    } catch (error) {
      console.error('Migration failed:', error);
      setErrors([`Migration failed: ${error}`]);
      setResult({ success: false, migratedCount: 0 });
    } finally {
      setIsRunning(false);
    }
  }, [projectPath, onComplete]);

  const getProgressPercentage = () => {
    if (!progress || progress.total === 0) return 0;
    return Math.round((progress.current / progress.total) * 100);
  };

  const renderContent = () => {
    if (!isRunning && !result) {
      // Initial state
      return (
        <>
          <p>This will migrate your project data from the browser storage to file-based storage.</p>
          <p className="text-sm text-gray-600 mt-2">
            This is a one-time process that will improve performance and reliability.
          </p>
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Do not close the application during migration.
            </p>
          </div>
        </>
      );
    }

    if (isRunning && progress) {
      // Migration in progress
      return (
        <>
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              {progress.phase === 'starting' && 'Preparing migration...'}
              {progress.phase === 'migrating' && `Migrating: ${progress.current} / ${progress.total}`}
              {progress.phase === 'cleaning' && 'Cleaning up old data...'}
              {progress.phase === 'complete' && 'Finalizing...'}
            </p>
            {progress.message && (
              <p className="text-xs text-gray-500 mt-1">{progress.message}</p>
            )}
          </div>
          <ProgressBar value={getProgressPercentage()} className="mb-4" />
        </>
      );
    }

    if (result) {
      // Migration complete
      const hasErrors = errors.length > 0;
      
      return (
        <>
          {result.success && !hasErrors ? (
            <Alert variant="success" className="mb-4">
              <h4 className="font-semibold">Migration Complete!</h4>
              <p>Successfully migrated {result.migratedCount} items.</p>
            </Alert>
          ) : (
            <Alert variant="warning" className="mb-4">
              <h4 className="font-semibold">Migration Completed with Errors</h4>
              <p>Migrated {result.migratedCount} items successfully.</p>
            </Alert>
          )}
          
          {hasErrors && (
            <div className="mt-4 max-h-40 overflow-y-auto">
              <p className="text-sm font-semibold text-red-600 mb-2">Errors:</p>
              <ul className="text-xs text-red-500 space-y-1">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      );
    }

    return null;
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Storage System Migration"
      size="medium"
    >
      <div className="p-6">
        {renderContent()}
      </div>

      <div className="flex justify-end gap-3 px-6 pb-6">
        {!isRunning && !result && (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" onClick={startMigration}>
              Start Migration
            </Button>
          </>
        )}
        
        {isRunning && (
          <Button variant="secondary" disabled>
            Cancel
          </Button>
        )}
        
        {result && (
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </Modal>
  );
};