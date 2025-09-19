import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
  // Set base path for portable builds
  base: './',
  // Disable caching to ensure fresh builds
  cacheDir: '.vite-temp',
  server: {
    port: 1420,
    strictPort: false
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]__[hash:base64:5]'
    },
    preprocessorOptions: {
      css: {
        charset: false
      }
    }
  },
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true
    }),
    // Compress assets
    compression({
      algorithm: 'gzip',
      threshold: 10240, // Only compress files larger than 10kb
      deleteOriginalAssets: false
    }),
    compression({
      algorithm: 'brotliCompress',
      threshold: 10240,
      deleteOriginalAssets: false
    })
  ],
  build: {
    target: 'es2022', // Support for top-level await
    rollupOptions: {
      output: {
        // Ensure all assets use relative paths with consistent naming
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react'
            }
            if (id.includes('dompurify') || id.includes('jszip')) {
              return 'vendor-utils'
            }
            if (id.includes('@testing-library') || id.includes('vitest')) {
              return 'vendor-test'
            }
            if (id.includes('web-vitals')) {
              return 'vendor-monitoring'
            }
            // All other vendor modules
            return 'vendor'
          }
          
          // Application chunks - Keep core modules together to avoid circular deps
          if (id.includes('src/components/DesignSystem')) {
            return 'design-system'
          }
          if (id.includes('src/services') || id.includes('src/hooks') || id.includes('src/contexts')) {
            // Keep services, hooks, and contexts in same chunk to prevent circular dependencies
            return 'app-core'
          }
        }
      },
      // Tree shaking optimization
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false
      }
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true, // Remove console.log statements in production
        drop_debugger: true,
        // Exclude console.log from pure_funcs to prevent aggressive optimization
        // that might remove state updates adjacent to console statements
        pure_funcs: ['console.info', 'console.debug', 'console.trace'],
        passes: 2
      },
      mangle: {
        safari10: true
      },
      format: {
        comments: false,
        ecma: 2018
      }
    },
    // Optimize CSS
    cssMinify: true,
    cssCodeSplit: false, // Disable to ensure CSS variables are always available
    // Generate source maps for debugging
    sourcemap: 'hidden',
    // Increase chunk size warnings threshold
    chunkSizeWarningLimit: 1000,
    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    // Report compressed size
    reportCompressedSize: true
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react/jsx-runtime'
    ],
    exclude: [
      '@testing-library/react',
      'vitest'
    ]
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/types': path.resolve(__dirname, './src/types'),
      '@/components': path.resolve(__dirname, './src/components'),
      '@/services': path.resolve(__dirname, './src/services'),
      '@/hooks': path.resolve(__dirname, './src/hooks'),
      '@/utils': path.resolve(__dirname, './src/utils'),
      '@/styles': path.resolve(__dirname, './src/styles'),
      '@/constants': path.resolve(__dirname, './src/constants')
    }
  },
  clearScreen: false
})