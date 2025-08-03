import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Helper to create test files
const createTestFile = (filename: string, content: Buffer | string) => {
  const testDir = path.join(__dirname, 'test-security-files');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const filePath = path.join(testDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
};

// Create various test files including malicious ones
test.beforeAll(async () => {
  // Create valid files
  const validPng = Buffer.from([
    0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
    0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,
    0x54, 0x08, 0xD7, 0x63, 0xF8, 0x0F, 0x00, 0x00,
    0x01, 0x01, 0x01, 0x00, 0x1B, 0x7C, 0x73, 0x4D,
    0x0A, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E,
    0x44, 0xAE, 0x42, 0x60, 0x82
  ]);
  createTestFile('valid-image.png', validPng);

  // Create file with malicious name patterns
  createTestFile('../../etc/passwd.png', validPng);
  createTestFile('..\\..\\windows\\system32\\config.png', validPng);
  createTestFile('image<script>alert("xss")</script>.png', validPng);
  createTestFile('image\x00null.png', validPng);
  createTestFile('image%2e%2e%2f%2e%2e%2fsensitive.png', validPng);

  // Create files with wrong extensions
  createTestFile('malicious.exe', Buffer.from('MZ')); // PE header
  createTestFile('fake-image.png.exe', Buffer.from('MZ'));
  createTestFile('script.js', 'alert("XSS")');
  
  // Create HTML file disguised as image
  const htmlContent = '<html><script>alert("XSS")</script></html>';
  createTestFile('malicious.html', htmlContent);
  createTestFile('fake-image.png', htmlContent); // HTML with image extension

  // Create file with sensitive metadata
  const sensitiveJson = JSON.stringify({
    apiKey: 'secret-api-key-12345',
    token: 'bearer-token-xyz',
    password: 'admin123',
    creditCard: '4111111111111111'
  });
  createTestFile('metadata-test.json', sensitiveJson);
});

test.describe('Media Security E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
  });

  test('1. Reject malicious URL patterns', async ({ page }) => {
    // Create a new project
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Security URL Test');
    await page.click('button:has-text("Create")');

    // Navigate to Media Enhancement
    await page.fill('input[placeholder*="course title"]', 'Security Test Course');
    await page.click('button:has-text("Next")');

    // Test various malicious URLs
    const maliciousUrls = [
      'javascript:alert("XSS")',
      'data:text/html,<script>alert("XSS")</script>',
      'file:///etc/passwd',
      'file://C:/Windows/System32/config/SAM',
      'http://localhost:8080/internal-api',
      'http://127.0.0.1/admin',
      'http://169.254.169.254/latest/meta-data/', // AWS metadata endpoint
      'ftp://evil.com/malware.exe',
      'vbscript:msgbox("XSS")'
    ];

    for (const url of maliciousUrls) {
      // Try to add malicious URL
      const urlInput = page.locator('input[placeholder*="URL"]').first();
      await urlInput.fill(url);
      
      const addButton = page.locator('button:has-text("Add")').first();
      await addButton.click();

      // Verify error message appears
      const errorMessage = page.locator('[role="alert"]').or(page.locator('.error-message'));
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      // Verify URL was not added
      const addedMedia = page.locator(`[data-url="${url}"]`);
      await expect(addedMedia).not.toBeVisible();

      // Clear error for next test
      const closeButton = page.locator('[aria-label="Close"]').or(page.locator('button:has-text("×")'));
      if (await closeButton.isVisible()) {
        await closeButton.click();
      }
    }

    // Test that valid URLs still work
    const validUrls = [
      'https://example.com/image.jpg',
      'https://cdn.example.com/video.mp4',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    ];

    for (const url of validUrls) {
      const urlInput = page.locator('input[placeholder*="URL"]').first();
      await urlInput.fill(url);
      
      const addButton = page.locator('button:has-text("Add")').first();
      await addButton.click();

      // For YouTube, verify iframe appears
      if (url.includes('youtube.com')) {
        await expect(page.locator('iframe[src*="youtube.com/embed"]')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('2. Path traversal protection in file uploads', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Path Traversal Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Path Security Test');
    await page.click('button:has-text("Next")');

    // Test files with path traversal attempts in names
    const maliciousFiles = [
      '../../etc/passwd.png',
      '..\\..\\windows\\system32\\config.png',
      'image%2e%2e%2f%2e%2e%2fsensitive.png'
    ];

    for (const filename of maliciousFiles) {
      const fileInput = page.locator('input[type="file"]').first();
      await fileInput.setInputFiles(path.join(__dirname, 'test-security-files', filename));

      // Wait for upload processing
      await page.waitForTimeout(1000);

      // Verify file was processed but name was sanitized
      // The file should be uploaded but with a safe name
      const uploadedFiles = page.locator('[data-testid="uploaded-file"]');
      const fileCount = await uploadedFiles.count();
      
      if (fileCount > 0) {
        // Check that the displayed filename doesn't contain path traversal sequences
        const displayedName = await uploadedFiles.last().textContent();
        expect(displayedName).not.toContain('..');
        expect(displayedName).not.toContain('/etc/');
        expect(displayedName).not.toContain('\\windows\\');
        expect(displayedName).not.toContain('%2e');
      }
    }
  });

  test('3. File type validation', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'File Type Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'File Type Security');
    await page.click('button:has-text("Next")');

    // Test uploading files with wrong/dangerous extensions
    const dangerousFiles = [
      'malicious.exe',
      'fake-image.png.exe',
      'script.js',
      'malicious.html'
    ];

    for (const filename of dangerousFiles) {
      const fileInput = page.locator('input[type="file"][accept*="image"]').first();
      
      // Attempt to upload dangerous file
      await fileInput.setInputFiles(path.join(__dirname, 'test-security-files', filename));

      // Wait for validation
      await page.waitForTimeout(500);

      // Verify error message or rejection
      const errorAlert = page.locator('[role="alert"]').or(page.locator('.error'));
      const isError = await errorAlert.isVisible();
      
      if (!isError) {
        // If no error shown, verify file was not added to the media list
        const mediaList = page.locator('[data-testid="media-list"]');
        const hasFile = await mediaList.locator(`text=${filename}`).isVisible();
        expect(hasFile).toBe(false);
      }
    }

    // Test HTML file with image extension
    const fakeImageInput = page.locator('input[type="file"][accept*="image"]').first();
    await fakeImageInput.setInputFiles(path.join(__dirname, 'test-security-files', 'fake-image.png'));
    
    // The system should detect this is not a real image
    await page.waitForTimeout(1000);
    
    // Look for any indication the file was rejected or marked as invalid
    const mediaItems = page.locator('[data-testid="media-item"]');
    const itemCount = await mediaItems.count();
    
    // If file was added, verify it's not treated as HTML
    if (itemCount > 0) {
      // Navigate to preview or SCORM generation to ensure no XSS
      await page.click('button:has-text("Next")'); // Content Review
      await page.waitForTimeout(500);
      
      // Check no script alerts appeared
      let alertFired = false;
      page.on('dialog', () => { alertFired = true; });
      await page.waitForTimeout(1000);
      expect(alertFired).toBe(false);
    }
  });

  test('4. XSS prevention in filenames', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'XSS Prevention Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'XSS Security Test');
    await page.click('button:has-text("Next")');

    // Upload file with XSS attempt in filename
    const xssFile = 'image<script>alert("xss")</script>.png';
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(path.join(__dirname, 'test-security-files', xssFile));

    await page.waitForTimeout(1000);

    // Check that filename is displayed safely (sanitized)
    const uploadedFile = page.locator('[data-testid="uploaded-file"]').last();
    if (await uploadedFile.isVisible()) {
      const displayedName = await uploadedFile.innerHTML();
      
      // Verify no script tags in the rendered HTML
      expect(displayedName).not.toContain('<script>');
      expect(displayedName).not.toContain('</script>');
      
      // The text content should be safe
      const textContent = await uploadedFile.textContent();
      expect(textContent).toBeTruthy();
    }

    // Set up dialog handler to catch any XSS attempts
    let xssTriggered = false;
    page.on('dialog', (dialog) => {
      xssTriggered = true;
      dialog.dismiss();
    });

    // Navigate through the app to ensure no XSS executes
    await page.click('button:has-text("Next")'); // Content Review
    await page.waitForTimeout(1000);
    
    expect(xssTriggered).toBe(false);
  });

  test('5. Sensitive data stripping from metadata', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'Metadata Security Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'Metadata Stripping Test');
    
    // Navigate to a page where we can test metadata
    await page.click('button:has-text("Next")'); // Media Enhancement

    // If there's a metadata or settings section, test it
    const settingsButton = page.locator('button:has-text("Settings")').or(page.locator('[aria-label="Settings"]'));
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      // Try to input sensitive data in any metadata fields
      const metadataInputs = page.locator('input[type="text"]').all();
      
      for (const input of await metadataInputs) {
        const placeholder = await input.getAttribute('placeholder');
        if (placeholder?.toLowerCase().includes('api') || placeholder?.toLowerCase().includes('key')) {
          await input.fill('secret-api-key-12345');
        }
      }
      
      // Save settings
      const saveButton = page.locator('button:has-text("Save")');
      if (await saveButton.isVisible()) {
        await saveButton.click();
      }
    }

    // Navigate to SCORM generation
    for (let i = 0; i < 4; i++) {
      const nextButton = page.locator('button:has-text("Next")');
      if (await nextButton.isVisible()) {
        await nextButton.click();
        await page.waitForTimeout(500);
      }
    }

    // Generate SCORM package and check for sensitive data
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:has-text("Generate SCORM Package")');
    
    const download = await downloadPromise;
    const downloadPath = await download.path();
    
    if (downloadPath) {
      // Read the generated files and verify no sensitive data
      const content = fs.readFileSync(downloadPath, 'utf-8');
      
      // Check that sensitive patterns are not in the output
      expect(content).not.toContain('secret-api-key');
      expect(content).not.toContain('bearer-token');
      expect(content).not.toContain('password');
      expect(content).not.toContain('4111111111111111'); // Credit card
      
      // Cleanup
      fs.unlinkSync(downloadPath);
    }
  });

  test('6. CORS and external resource validation', async ({ page }) => {
    await page.click('text=Create New Project');
    await page.fill('input[placeholder="Enter project name"]', 'CORS Security Test');
    await page.click('button:has-text("Create")');

    await page.fill('input[placeholder*="course title"]', 'CORS Test Course');
    await page.click('button:has-text("Next")');

    // Test loading external resources
    const externalUrls = [
      'https://httpbin.org/image/jpeg', // Public test API
      'https://via.placeholder.com/150', // Placeholder image service
      'https://picsum.photos/200/300' // Random image service
    ];

    for (const url of externalUrls) {
      const urlInput = page.locator('input[placeholder*="URL"]').first();
      await urlInput.fill(url);
      await page.click('button:has-text("Add")').first();
      
      // Wait for resource to load or fail
      await page.waitForTimeout(2000);
      
      // Check if resource loaded successfully (no CORS errors in console)
      const consoleErrors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error' && msg.text().includes('CORS')) {
          consoleErrors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(1000);
      
      // CORS errors should be handled gracefully
      if (consoleErrors.length > 0) {
        // Verify error message is shown to user
        const errorMsg = page.locator('[role="alert"]').or(page.locator('.error'));
        await expect(errorMsg).toBeVisible();
      }
    }
  });
});

// Cleanup
test.afterAll(async () => {
  const testDir = path.join(__dirname, 'test-security-files');
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
});