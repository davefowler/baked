import * as esbuild from 'esbuild'
import { cp, mkdir, rm } from 'fs/promises'

console.log('Starting build...')

// Clean dist directory
await rm('dist', { recursive: true, force: true })
await mkdir('dist', { recursive: true })

// Common config
const commonConfig = {
  platform: 'node',
  target: 'node18',
  format: 'esm',
  loader: {
    '.sql': 'text',
  },
  bundle: true,
  external: [
    'better-sqlite3',
    'commander',
    'events',
    'path',
    'fs',
    'os',
    'stream',
    'gray-matter',
    'nunjucks',
    'body-parser',
    'express',
    'html-escaper',
    'marked',
    'supertest',
  ],
}

// CLI - 

// Build the main CLI code
await esbuild.build({
  ...commonConfig,
  entryPoints: ['src/cli/cli.ts'],
  outfile: 'dist/cli/cli.js',
})

// Copy starter templates and sql files
await cp('src/starter', 'dist/starter', { recursive: true })
await mkdir('dist/sql', { recursive: true })
await cp('src/sql', 'dist/sql', { recursive: true, force: true })

// Client-side build config
const clientConfig = {
  platform: 'browser',
  target: ['es2020'],
  format: 'esm',
  bundle: true,
  loader: {
    '.sql': 'text',
    '.wasm': 'file',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
    'global': 'window',
    '__dirname': '""',
  },
  alias: {
    // Map Node.js built-ins to our shims
    'path': './src/client/shims.js',
    'fs': './src/client/shims.js'
  },
  external: [],
}

// Copy baked files needed for client
await cp('src/baked', 'dist/baked', { recursive: true, force: true })

// Build client files
await esbuild.build({
  ...clientConfig,
  entryPoints: ['src/baker.ts', 'src/client/db.worker.ts'],
  outdir: 'dist/baked',
  splitting: true,
})

// Copy necessary sql.js files
await cp(
  'node_modules/@jlongster/sql.js/dist/sql-wasm.wasm',
  'dist/baked/sql-wasm.wasm'
)
