import { envConfig } from '../config/environment'

type LogCategory = keyof typeof envConfig.debug

export function debugLog(category: LogCategory, ...args: any[]) {
  if (envConfig.debug[category]) {
    console.log(...args)
  }
}

export function debugWarn(category: LogCategory, ...args: any[]) {
  if (envConfig.debug[category]) {
    console.warn(...args)
  }
}

export function debugError(category: LogCategory, ...args: any[]) {
  if (envConfig.debug[category]) {
    console.error(...args)
  }
}