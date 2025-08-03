// Test script to verify project creation with folder structure
const { invoke } = require('@tauri-apps/api/core');

async function testProjectCreation() {
  try {
    console.log('Testing project creation...');
    
    // Create a test project
    const projectName = `Test Project ${Date.now()}`;
    const result = await invoke('create_project', { name: projectName });
    
    console.log('Project created successfully:', result);
    console.log('Project ID:', result.id);
    console.log('Project Path:', result.path);
    console.log('Project Name:', result.name);
    
    // Try to load the project
    console.log('\nTesting project load...');
    const loadedProject = await invoke('load_project', { filePath: result.path });
    console.log('Project loaded successfully:', loadedProject.project.name);
    
    // Test media storage
    console.log('\nTesting media storage...');
    const testMediaId = 'test-media-' + Date.now();
    const testData = new TextEncoder().encode('Test media content');
    
    await invoke('store_media', {
      id: testMediaId,
      projectId: result.id,
      data: Array.from(testData),
      metadata: {
        page_id: 'test-page',
        type: 'image',
        original_name: 'test.png',
        mime_type: 'image/png',
        source: 'upload',
        embed_url: null,
        title: 'Test Image'
      }
    });
    
    console.log('Media stored successfully');
    
    // Verify media retrieval
    const retrievedMedia = await invoke('get_media', {
      projectId: result.id,
      mediaId: testMediaId
    });
    
    console.log('Media retrieved successfully:', retrievedMedia.metadata.original_name);
    
    console.log('\n✅ All tests passed! Project creation with folder structure is working correctly.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Note: This script needs to be run in a Tauri environment
console.log('This test script needs to be run within the Tauri app context.');
console.log('To test manually:');
console.log('1. Open the app');
console.log('2. Open developer console (F12)');
console.log('3. Run the test commands shown in the script');