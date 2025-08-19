/**
 * File helper utilities for Playwright tests
 * Handles creation, manipulation, and cleanup of test files
 */

import fs from 'fs';
import path from 'path';
import { Page } from '@playwright/test';

export class TestFileManager {
  private testDir: string;
  private createdFiles: string[] = [];

  constructor(baseDir: string = __dirname) {
    this.testDir = path.join(baseDir, '..', 'test-files');
    this.ensureTestDirectory();
  }

  private ensureTestDirectory() {
    if (!fs.existsSync(this.testDir)) {
      fs.mkdirSync(this.testDir, { recursive: true });
    }
  }

  /**
   * Create a test file with specified content
   */
  createFile(filename: string, content: string | Buffer): string {
    const filePath = path.join(this.testDir, filename);
    fs.writeFileSync(filePath, content);
    this.createdFiles.push(filePath);
    return filePath;
  }

  /**
   * Create a realistic image file for testing
   */
  createImageFile(filename: string, sizeKB: number = 100): string {
    // Create a minimal valid JPEG header followed by dummy data
    const jpegHeader = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43
    ]);
    
    const targetSize = sizeKB * 1024;
    const remainingSize = Math.max(0, targetSize - jpegHeader.length - 2); // -2 for end marker
    const dummyData = Buffer.alloc(remainingSize, 0x80); // Fill with gray
    const jpegEnd = Buffer.from([0xFF, 0xD9]);
    
    const fileContent = Buffer.concat([jpegHeader, dummyData, jpegEnd]);
    return this.createFile(filename, fileContent);
  }

  /**
   * Create a test video file
   */
  createVideoFile(filename: string, durationSeconds: number = 30): string {
    // Create a minimal MP4 header structure
    const mp4Header = Buffer.from([
      // ftyp box
      0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70, // box size and type
      0x69, 0x73, 0x6F, 0x6D, // major brand: isom
      0x00, 0x00, 0x02, 0x00, // minor version
      0x69, 0x73, 0x6F, 0x6D, 0x69, 0x73, 0x6F, 0x32, // compatible brands
      0x61, 0x76, 0x63, 0x31, 0x6D, 0x70, 0x34, 0x31
    ]);
    
    // Add dummy data based on duration (rough estimate: 1KB per second)
    const dummySize = durationSeconds * 1024;
    const dummyData = Buffer.alloc(dummySize, 0x42);
    
    const fileContent = Buffer.concat([mp4Header, dummyData]);
    return this.createFile(filename, fileContent);
  }

  /**
   * Create a test audio file
   */
  createAudioFile(filename: string, durationSeconds: number = 60): string {
    // Create a minimal MP3 header
    const mp3Header = Buffer.from([
      0xFF, 0xFB, 0x90, 0x00, // MP3 sync word and header
      0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    
    // Add dummy data based on duration (rough estimate: 1KB per second for compressed audio)
    const dummySize = durationSeconds * 1024;
    const dummyData = Buffer.alloc(dummySize, 0xAA);
    
    const fileContent = Buffer.concat([mp3Header, dummyData]);
    return this.createFile(filename, fileContent);
  }

  /**
   * Create a ZIP file containing caption files
   */
  createCaptionZip(filename: string, captions: Array<{name: string, content: string}>): string {
    // Simple ZIP creation for testing - in real implementation, use a proper ZIP library
    const zipContent = this.createSimpleZip(captions);
    return this.createFile(filename, zipContent);
  }

  private createSimpleZip(files: Array<{name: string, content: string}>): Buffer {
    // This is a simplified ZIP implementation for testing
    // In a real scenario, you'd use a proper ZIP library like node-stream-zip
    const localFileHeaders: Buffer[] = [];
    const centralDirHeaders: Buffer[] = [];
    let offset = 0;

    files.forEach((file, index) => {
      const fileName = Buffer.from(file.name, 'utf8');
      const fileContent = Buffer.from(file.content, 'utf8');
      
      // Local file header
      const localHeader = Buffer.alloc(30 + fileName.length);
      localHeader.writeUInt32LE(0x04034b50, 0); // Local file header signature
      localHeader.writeUInt16LE(20, 4); // Version needed
      localHeader.writeUInt16LE(0, 6); // Flags
      localHeader.writeUInt16LE(0, 8); // Compression method (stored)
      localHeader.writeUInt16LE(0, 10); // Mod time
      localHeader.writeUInt16LE(0, 12); // Mod date
      localHeader.writeUInt32LE(0, 14); // CRC32 (simplified)
      localHeader.writeUInt32LE(fileContent.length, 18); // Compressed size
      localHeader.writeUInt32LE(fileContent.length, 22); // Uncompressed size
      localHeader.writeUInt16LE(fileName.length, 26); // Filename length
      localHeader.writeUInt16LE(0, 28); // Extra field length
      fileName.copy(localHeader, 30);
      
      localFileHeaders.push(Buffer.concat([localHeader, fileContent]));
      
      // Central directory header
      const centralHeader = Buffer.alloc(46 + fileName.length);
      centralHeader.writeUInt32LE(0x02014b50, 0); // Central dir signature
      centralHeader.writeUInt16LE(20, 4); // Version made by
      centralHeader.writeUInt16LE(20, 6); // Version needed
      centralHeader.writeUInt32LE(offset, 42); // Local header offset
      fileName.copy(centralHeader, 46);
      
      centralDirHeaders.push(centralHeader);
      offset += localHeader.length + fileContent.length;
    });

    // End of central directory record
    const endRecord = Buffer.alloc(22);
    endRecord.writeUInt32LE(0x06054b50, 0); // End signature
    endRecord.writeUInt16LE(files.length, 8); // Total entries
    endRecord.writeUInt16LE(files.length, 10); // Total entries on disk
    
    return Buffer.concat([...localFileHeaders, ...centralDirHeaders, endRecord]);
  }

  /**
   * Create a large file for performance testing
   */
  createLargeFile(filename: string, sizeMB: number): string {
    const sizeBytes = sizeMB * 1024 * 1024;
    const chunkSize = 1024 * 1024; // 1MB chunks
    const filePath = path.join(this.testDir, filename);
    
    const writeStream = fs.createWriteStream(filePath);
    
    for (let written = 0; written < sizeBytes; written += chunkSize) {
      const remainingBytes = Math.min(chunkSize, sizeBytes - written);
      const chunk = Buffer.alloc(remainingBytes, 0x55);
      writeStream.write(chunk);
    }
    
    writeStream.end();
    this.createdFiles.push(filePath);
    return filePath;
  }

  /**
   * Create a corrupted file for error testing
   */
  createCorruptedFile(filename: string, originalType: 'image' | 'video' | 'audio'): string {
    let content: Buffer;
    
    switch (originalType) {
      case 'image':
        // Corrupted JPEG - valid header but invalid data
        content = Buffer.concat([
          Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]), // Valid JPEG start
          Buffer.from('CORRUPTED_DATA_NOT_VALID_JPEG'),
          Buffer.from([0xFF, 0xD9]) // Valid JPEG end
        ]);
        break;
      case 'video':
        // Corrupted MP4 - invalid header
        content = Buffer.from('NOT_A_VALID_MP4_FILE_HEADER_CORRUPTED');
        break;
      case 'audio':
        // Corrupted MP3 - no valid sync word
        content = Buffer.from('INVALID_MP3_NO_SYNC_WORD_FOUND_HERE');
        break;
    }
    
    return this.createFile(filename, content);
  }

  /**
   * Upload a file using Playwright
   */
  async uploadFile(page: Page, selector: string, filePath: string): Promise<void> {
    const fileInput = await page.locator(selector);
    await fileInput.setInputFiles(filePath);
  }

  /**
   * Upload multiple files using Playwright
   */
  async uploadMultipleFiles(page: Page, selector: string, filePaths: string[]): Promise<void> {
    const fileInput = await page.locator(selector);
    await fileInput.setInputFiles(filePaths);
  }

  /**
   * Simulate file drag and drop
   */
  async dragAndDropFile(page: Page, filePath: string, targetSelector: string): Promise<void> {
    // Read file and create a data transfer
    const fileContent = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);
    
    await page.evaluate(
      ({ targetSelector, fileName, fileContent }) => {
        const target = document.querySelector(targetSelector);
        if (!target) throw new Error(`Target element not found: ${targetSelector}`);

        // Create a File object
        const file = new File([new Uint8Array(fileContent)], fileName, {
          type: 'application/octet-stream'
        });

        // Create and dispatch drag events
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);

        const dragEnterEvent = new DragEvent('dragenter', {
          bubbles: true,
          dataTransfer
        });

        const dragOverEvent = new DragEvent('dragover', {
          bubbles: true,
          dataTransfer
        });

        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          dataTransfer
        });

        target.dispatchEvent(dragEnterEvent);
        target.dispatchEvent(dragOverEvent);
        target.dispatchEvent(dropEvent);
      },
      { targetSelector, fileName, fileContent: Array.from(fileContent) }
    );
  }

  /**
   * Verify file was uploaded successfully
   */
  async verifyFileUpload(page: Page, filename: string): Promise<boolean> {
    // Look for common indicators of successful upload
    const indicators = [
      `text=${filename}`,
      `[title*="${filename}"]`,
      `[alt*="${filename}"]`,
      '.upload-success',
      '.file-uploaded'
    ];

    for (const indicator of indicators) {
      try {
        await page.waitForSelector(indicator, { timeout: 5000 });
        return true;
      } catch {
        // Continue to next indicator
      }
    }

    return false;
  }

  /**
   * Wait for file processing to complete
   */
  async waitForFileProcessing(page: Page, timeout: number = 30000): Promise<void> {
    // Wait for processing indicators to disappear
    const processingIndicators = [
      '.uploading',
      '.processing',
      '.loading',
      '[aria-label*="processing"]',
      '[aria-label*="uploading"]'
    ];

    for (const indicator of processingIndicators) {
      try {
        await page.waitForSelector(indicator, { state: 'detached', timeout });
      } catch {
        // Indicator might not be present, continue
      }
    }

    // Wait for success indicators
    const successIndicators = [
      '.upload-complete',
      '.processing-complete',
      '.success'
    ];

    for (const indicator of successIndicators) {
      try {
        await page.waitForSelector(indicator, { timeout: 5000 });
        break;
      } catch {
        // Continue to next indicator
      }
    }
  }

  /**
   * Get file size in a human-readable format
   */
  getFileSize(filePath: string): { bytes: number; human: string } {
    const stats = fs.statSync(filePath);
    const bytes = stats.size;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const human = `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
    
    return { bytes, human };
  }

  /**
   * Clean up all created test files
   */
  cleanup(): void {
    this.createdFiles.forEach(filePath => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        console.warn(`Failed to delete test file ${filePath}:`, error);
      }
    });
    
    this.createdFiles = [];
    
    // Remove test directory if empty
    try {
      if (fs.existsSync(this.testDir)) {
        const files = fs.readdirSync(this.testDir);
        if (files.length === 0) {
          fs.rmdirSync(this.testDir);
        }
      }
    } catch (error) {
      console.warn(`Failed to remove test directory ${this.testDir}:`, error);
    }
  }

  /**
   * Get the test directory path
   */
  getTestDirectory(): string {
    return this.testDir;
  }

  /**
   * List all created files
   */
  getCreatedFiles(): string[] {
    return [...this.createdFiles];
  }
}