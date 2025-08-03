import { useState, useCallback } from 'react';

export type DialogType = 'settings' | 'help' | 'delete' | 'unsaved' | 'performance' | 'testChecklist' | null;

export function useDialogManager() {
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string; path?: string } | null>(null);

  const showDialog = useCallback((dialog: DialogType, data?: any) => {
    if (dialog === 'delete' && data) {
      setProjectToDelete(data);
    }
    setActiveDialog(dialog);
  }, []);

  const hideDialog = useCallback(() => {
    setActiveDialog(null);
    // Reset specific dialog data if necessary
    if (projectToDelete) {
      setProjectToDelete(null);
    }
  }, [projectToDelete]);

  return {
    activeDialog,
    projectToDelete,
    showDialog,
    hideDialog,
    setProjectToDelete,
  };
}
