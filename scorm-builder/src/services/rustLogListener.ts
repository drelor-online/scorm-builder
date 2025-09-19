/**
 * Service to listen to Rust backend logs and route them to the frontend logger
 * This makes Rust logs visible in the browser console and localStorage
 */

import { listen } from '@tauri-apps/api/event'
import { debugLogger } from '../utils/ultraSimpleLogger'

let unlistenFn: (() => void) | null = null

export interface RustLogEvent {
  level: string
  message: string
  timestamp: string
}

/**
 * Start listening to Rust log events and route them to ultraSimpleLogger
 */
export async function startRustLogListener(): Promise<void> {
  if (unlistenFn) {
    console.log('[RustLogListener] Already listening to Rust logs')
    return // Already listening
  }

  try {
    unlistenFn = await listen<RustLogEvent>('rust-log', (event) => {
      const { level, message } = event.payload

      // Route to ultraSimpleLogger based on level
      switch(level.toUpperCase()) {
        case 'ERROR':
          debugLogger.error('RUST', message)
          break
        case 'WARN':
        case 'WARNING':
          debugLogger.warn('RUST', message)
          break
        case 'DEBUG':
          debugLogger.debug('RUST', message)
          break
        case 'INFO':
        default:
          debugLogger.info('RUST', message)
          break
      }
    })

    console.log('[RustLogListener] Started listening to Rust logs')
    debugLogger.info('RustLogListener', 'Started listening to Rust backend logs')
  } catch (error) {
    console.error('[RustLogListener] Failed to start listening to Rust logs:', error)
    debugLogger.error('RustLogListener', 'Failed to start listening to Rust logs', error)
  }
}

/**
 * Stop listening to Rust log events
 */
export function stopRustLogListener(): void {
  if (unlistenFn) {
    unlistenFn()
    unlistenFn = null
    console.log('[RustLogListener] Stopped listening to Rust logs')
    debugLogger.info('RustLogListener', 'Stopped listening to Rust backend logs')
  }
}

/**
 * Check if currently listening to Rust logs
 */
export function isListening(): boolean {
  return unlistenFn !== null
}