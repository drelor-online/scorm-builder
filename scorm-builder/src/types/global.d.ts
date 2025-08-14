// Global type declarations for Web APIs and test globals

declare global {
  // Web APIs that might not be available in all environments
  const TextEncoder: {
    prototype: TextEncoder;
    new(): TextEncoder;
  };

  const TextDecoder: {
    prototype: TextDecoder;
    new(label?: string, options?: { fatal?: boolean; ignoreBOM?: boolean }): TextDecoder;
  };

  const ReadableStream: {
    prototype: ReadableStream;
    new<R = any>(underlyingSource?: UnderlyingSource<R>, strategy?: QueuingStrategy<R>): ReadableStream<R>;
  };

  const btoa: (data: string) => string;
  const atob: (data: string) => string;

  // React DevTools
  const __REACT_DEVTOOLS_GLOBAL_HOOK__: any;

  // Node.js globals that might be used in some contexts
  const require: (id: string) => any;

  // Vitest globals
  const vi: import('vitest').VitestUtils;
  const describe: import('vitest').Describe;
  const test: import('vitest').Test;
  const it: import('vitest').Test;
  const expect: import('vitest').ExpectStatic;
  const beforeEach: import('vitest').Hooks['beforeEach'];
  const beforeAll: import('vitest').Hooks['beforeAll'];
  const afterEach: import('vitest').Hooks['afterEach'];
  const afterAll: import('vitest').Hooks['afterAll'];

  // Custom types that might be used in tests
  interface MediaReference {
    id: string;
    url: string;
    type: string;
    metadata?: any;
  }
}

export {};