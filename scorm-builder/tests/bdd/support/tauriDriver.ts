import { spawn, ChildProcess } from 'child_process';
import { chromium, Browser } from '@playwright/test';

interface TauriWebDriverResult {
  process: ChildProcess;
  webdriverUrl: string;
  browser?: Browser;
}

export async function launchTauriWithWebDriver(): Promise<TauriWebDriverResult> {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Tauri with WebDriver support...');
    
    const tauriProcess = spawn('npm', ['run', 'tauri:dev'], {
      env: {
        ...process.env,
        TAURI_WEBDRIVER: 'true',
        RUST_LOG: 'debug' // Enable debug logging to see WebDriver URL
      },
      shell: true,
      cwd: process.cwd()
    });

    let webdriverUrl: string | null = null;
    let output = '';

    tauriProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log('Tauri stdout:', chunk);
      
      // Look for WebDriver URL in output
      // Tauri v2 outputs: "WebDriver listening on ws://127.0.0.1:XXXX"
      const wsMatch = chunk.match(/WebDriver listening on (ws:\/\/[^\s]+)/);
      if (wsMatch) {
        webdriverUrl = wsMatch[1];
        console.log('✅ Found WebDriver URL:', webdriverUrl);
        resolve({ process: tauriProcess, webdriverUrl });
      }
      
      // Alternative pattern for HTTP endpoint
      const httpMatch = chunk.match(/WebDriver server listening on (http:\/\/[^\s]+)/);
      if (httpMatch) {
        webdriverUrl = httpMatch[1];
        console.log('✅ Found WebDriver HTTP URL:', webdriverUrl);
        resolve({ process: tauriProcess, webdriverUrl });
      }
    });

    tauriProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      console.error('Tauri stderr:', chunk);
      
      // Also check stderr for WebDriver URL
      const match = chunk.match(/WebDriver.*?((?:ws|http):\/\/[^\s]+)/);
      if (match && !webdriverUrl) {
        webdriverUrl = match[1];
        console.log('✅ Found WebDriver URL in stderr:', webdriverUrl);
        resolve({ process: tauriProcess, webdriverUrl });
      }
    });

    tauriProcess.on('error', (error) => {
      console.error('Failed to start Tauri process:', error);
      reject(error);
    });

    // Timeout after 60 seconds
    setTimeout(() => {
      if (!webdriverUrl) {
        console.error('Timeout: Failed to find WebDriver URL in output');
        console.error('Full output:', output);
        tauriProcess.kill();
        reject(new Error('Failed to start Tauri with WebDriver - no URL found'));
      }
    }, 60000);
  });
}

export async function connectToTauriWebDriver(webdriverUrl: string): Promise<Browser> {
  console.log('🔗 Connecting to Tauri WebDriver at:', webdriverUrl);
  
  try {
    // For WebSocket endpoint (CDP)
    if (webdriverUrl.startsWith('ws://')) {
      return await chromium.connectOverCDP(webdriverUrl);
    }
    
    // For HTTP endpoint (WebDriver)
    const browser = await chromium.connect({
      wsEndpoint: webdriverUrl
    });
    
    return browser;
  } catch (error) {
    console.error('Failed to connect to Tauri WebDriver:', error);
    throw error;
  }
}

export async function stopTauri(tauriProcess: ChildProcess) {
  return new Promise<void>((resolve) => {
    if (!tauriProcess) {
      resolve();
      return;
    }
    
    console.log('🛑 Stopping Tauri process...');
    
    tauriProcess.on('exit', () => {
      console.log('✅ Tauri process stopped');
      resolve();
    });
    
    // Try graceful shutdown first
    tauriProcess.kill('SIGTERM');
    
    // Force kill after 5 seconds
    setTimeout(() => {
      if (!tauriProcess.killed) {
        tauriProcess.kill('SIGKILL');
      }
    }, 5000);
  });
}