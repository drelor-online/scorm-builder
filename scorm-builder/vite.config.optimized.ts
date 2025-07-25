import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'
import path from 'path'
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
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
    target: 'es2018', // Modern browsers for smaller output
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'vendor-react'
            }
            if (id.includes('jszip')) {
              return 'vendor-jszip' // Separate heavy JSZip library
            }
            if (id.includes('dompurify')) {
              return 'vendor-security'
            }
            if (id.includes('tauri')) {
              return 'vendor-tauri' // Separate Tauri APIs
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
          
          // Application chunks - more granular splitting
          if (id.includes('src/components/DesignSystem')) {
            return 'design-system'
          }
          if (id.includes('src/services/spaceEfficient')) {
            return 'scorm-generators' // Separate SCORM generation code
          }
          if (id.includes('src/services')) {
            return 'services'
          }
          if (id.includes('src/hooks')) {
            return 'hooks'
          }
          if (id.includes('src/components/MediaLibrary')) {
            return 'media-library' // Separate media library chunk
          }
          if (id.includes('src/components/CourseBuilder')) {
            return 'course-builder' // Separate course builder chunk
          }
        },
        // Optimize chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : ''
          if (facadeModuleId && facadeModuleId.includes('.')) {
            return `assets/${facadeModuleId.split('.')[0]}-[hash].js`
          }
          return 'assets/[name]-[hash].js'
        },
        // Add entry chunk optimization
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      },
      // Tree shaking optimization
      treeshake: {
        moduleSideEffects: false,
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
        // More aggressive tree shaking
        unknownGlobalSideEffects: false,
        correctVarValueBeforeDeclaration: false
      },
      // Performance hints
      external: process.env.NODE_ENV === 'test' ? ['vitest', '@testing-library/react'] : []
    },
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug'],
        passes: 3, // Increased for better optimization
        global_defs: {
          "@PRODUCTION": JSON.stringify(true)
        },
        ecma: 2018,
        module: true,
        toplevel: true,
        arrows: true,
        dead_code: true,
        reduce_vars: true,
        reduce_funcs: true,
        inline: true,
        unused: true
      },
      mangle: {
        safari10: true,
        toplevel: true,
        properties: {
          regex: /^_/ // Mangle properties starting with underscore
        }
      },
      format: {
        comments: false,
        ecma: 2018
      }
    },
    // Optimize CSS
    cssMinify: true,
    cssCodeSplit: true,
    // Generate source maps for debugging
    sourcemap: 'hidden',
    // Performance budgets
    chunkSizeWarningLimit: 500, // Warn for chunks over 500kb
    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    // Report compressed size
    reportCompressedSize: true,
    // Use esbuild for faster minification in development
    minify: process.env.NODE_ENV === 'production' ? 'terser' : 'esbuild'
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
    ],
    // Force optimization of certain packages
    force: true,
    esbuildOptions: {
      target: 'es2018',
      define: {
        global: 'globalThis'
      }
    }
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
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  // Enable experimental features for better performance
  experimental: {
    renderBuiltUrl(filename: string) {
      // Use relative paths for better caching
      return `./${filename}`
    }
  },
  // Performance optimizations
  esbuild: {
    legalComments: 'none',
    treeShaking: true,
    minifyIdentifiers: true,
    minifySyntax: true,
    minifyWhitespace: true
  }
})