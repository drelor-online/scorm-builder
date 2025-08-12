/**
 * Advanced JSON auto-fixer that handles unescaped quotes within string values
 */

/**
 * Proper JSON tokenizer that tracks string boundaries
 * This implementation uses a state machine to properly handle colons, quotes, and escapes
 */
export function smartAutoFixJSON(input: string): string {
  // Step 1: Clean up line endings, control characters, and smart quotes
  let preprocessed = input
    .replace(/\r\n/g, '\n')            // Normalize Windows line endings
    .replace(/\r/g, '\n')              // Remove standalone carriage returns
    .replace(/[\u2018\u2019]/g, "'")  // Smart single quotes
    .replace(/[\u201C\u201D]/g, '"')  // Smart double quotes
    .replace(/…/g, '...')
    .replace(/–/g, '-')
    .replace(/—/g, '--')
    // Remove invisible Unicode characters that can break JSON parsing
    .replace(/\u200B/g, '')            // Zero-width space
    .replace(/\u00A0/g, ' ')           // Non-breaking space to regular space
    .replace(/\u200C/g, '')            // Zero-width non-joiner
    .replace(/\u200D/g, '')            // Zero-width joiner
    .replace(/\uFEFF/g, '')            // Zero-width no-break space (BOM)
    .replace(/\u2060/g, '')            // Word joiner
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove other control characters (except \t, \n)
  
  // Step 1.5: Fix null values for string fields (common in narration fields)
  // Replace standalone null values with empty strings where they appear as string values
  preprocessed = preprocessed.replace(
    /"(narration|content|title|description|feedback)":\s*null/g,
    '"$1": ""'
  )
  
  // Step 2: Try to parse as-is
  try {
    JSON.parse(preprocessed)
    return preprocessed // Already valid
  } catch (e) {
    // Continue with fixing
  }
  
  // Step 3: Advanced fixing using proper tokenization
  // Use a character-by-character state machine to track JSON structure
  
  const result: string[] = []
  let state: 'ROOT' | 'IN_KEY' | 'AFTER_KEY' | 'AFTER_COLON' | 'IN_VALUE_STRING' | 'IN_VALUE_OTHER' = 'ROOT'
  let escaped = false
  let depth = 0
  let stringDelimiter = ''
  let valueBuffer = ''
  let keyBuffer = ''
  
  for (let i = 0; i < preprocessed.length; i++) {
    const char = preprocessed[i]
    const prevChar = i > 0 ? preprocessed[i - 1] : ''
    const nextChar = i < preprocessed.length - 1 ? preprocessed[i + 1] : ''
    
    // Handle escape sequences
    if (escaped) {
      result.push(char)
      escaped = false
      continue
    }
    
    if (char === '\\') {
      escaped = true
      result.push(char)
      continue
    }
    
    // State machine for JSON parsing
    switch (state) {
      case 'ROOT':
        if (char === '"') {
          // Starting a key (after { or ,) or a string value in an array
          let j = i - 1
          while (j >= 0 && /\s/.test(preprocessed[j])) j--
          
          if (j >= 0 && (preprocessed[j] === '{' || preprocessed[j] === ',')) {
            // Starting a key in an object
            state = 'IN_KEY'
            keyBuffer = ''
          } else if (j >= 0 && (preprocessed[j] === '[' || (preprocessed[j] === ',' && depth > 0))) {
            // Starting a string value in an array
            state = 'IN_VALUE_STRING'
            valueBuffer = ''
          }
        }
        result.push(char)
        
        // Track depth for nested structures
        if (char === '{' || char === '[') depth++
        if (char === '}' || char === ']') depth--
        break
        
      case 'IN_KEY':
        if (char === '"' && !escaped) {
          // Ending the key
          state = 'AFTER_KEY'
        }
        result.push(char)
        keyBuffer += char
        break
        
      case 'AFTER_KEY':
        if (char === ':') {
          // Found the colon after the key, next is the value
          result.push(char)
          
          // Look ahead to see what type of value follows
          let j = i + 1
          while (j < preprocessed.length && /\s/.test(preprocessed[j])) j++
          
          if (j < preprocessed.length) {
            if (preprocessed[j] === '"') {
              // String value coming - we'll enter IN_VALUE_STRING when we hit the quote
              state = 'AFTER_COLON'
            } else if (preprocessed[j] === '{' || preprocessed[j] === '[') {
              // Object or array value
              state = 'ROOT'
            } else {
              // Number, boolean, or null
              state = 'IN_VALUE_OTHER'
              valueBuffer = ''
            }
          }
        } else if (/\s/.test(char)) {
          // Whitespace between key and colon
          result.push(char)
        } else {
          // Unexpected character
          result.push(char)
          state = 'ROOT'
        }
        break
        
      case 'AFTER_COLON':
        if (char === '"') {
          // Starting a string value after a colon
          state = 'IN_VALUE_STRING'
          valueBuffer = ''
        } else if (!(/\s/.test(char))) {
          // Non-whitespace means we're in a different value type
          state = 'IN_VALUE_OTHER'
          valueBuffer = char
        }
        result.push(char)
        break
        
      case 'IN_VALUE_STRING':
        // We need to handle string values specially to escape unescaped quotes and newlines
        if (char === '"' && !escaped) {
          // Check if this is the closing quote of the string value
          // Look ahead to see if we have a valid JSON terminator
          let j = i + 1
          while (j < preprocessed.length && /\s/.test(preprocessed[j])) j++
          
          if (j >= preprocessed.length || 
              preprocessed[j] === ',' || 
              preprocessed[j] === '}' || 
              preprocessed[j] === ']') {
            // This is the closing quote
            result.push(char)
            state = 'ROOT'
          } else {
            // This is an unescaped quote within the string - escape it
            result.push('\\')
            result.push(char)
          }
        } else if (char === '\n') {
          // Escape newlines in string values
          result.push('\\')
          result.push('n')
        } else if (char === '\t') {
          // Escape tabs in string values  
          result.push('\\')
          result.push('t')
        } else {
          // Regular character in string value - colons are fine here!
          result.push(char)
        }
        valueBuffer += char
        break
        
      case 'IN_VALUE_OTHER':
        // Non-string value (number, boolean, null)
        if (char === ',' || char === '}' || char === ']') {
          state = 'ROOT'
          // Track depth
          if (char === '}' || char === ']') depth--
        }
        result.push(char)
        break
    }
  }
  
  return result.join('')
}

// Keep the old functions for backward compatibility but redirect to the new implementation
export function autoFixUnescapedQuotes(input: string): string {
  return smartAutoFixJSON(input)
}

export function autoFixJSON(input: string): string {
  return smartAutoFixJSON(input)
}