// Test script to call the cleanup command
const { invoke } = require('@tauri-apps/api/tauri');

async function runCleanup() {
  try {
    console.log('Running cleanup for project 1758632512852...');
    const result = await invoke('clean_duplicate_media', {
      projectId: '1758632512852'
    });
    console.log('Cleanup result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Cleanup failed:', error);
  }
}

runCleanup();