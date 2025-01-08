import * as esbuild from 'esbuild'
import { cp, mkdir, rm } from 'fs/promises'
import path from 'path'

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
  external: [],
  splitting: true,
}

// Copy baked files needed for client
await cp('src/baked', 'dist/baked', { recursive: true })

// Copy SQLite WASM files
await mkdir(path.join('dist', 'baked', 'sqlite-wasm'), { recursive: true });
await cp(
  path.join(process.cwd(), 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.mjs'),
  path.join('dist', 'baked', 'sqlite-wasm', 'sqlite3.mjs')
);

await cp(
  path.join(process.cwd(), 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3-opfs-async-proxy.js'),
  path.join('dist', 'baked', 'sqlite-wasm', 'sqlite3-opfs-async-proxy.js')
);

await cp(
  path.join(process.cwd(), 'node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm'),
  path.join('dist', 'baked', 'sqlite-wasm', 'sqlite3.wasm')
);

// Build client files
await esbuild.build({
  ...clientConfig,
  entryPoints: ['src/client/bakedClient.ts'],
  outdir: 'dist/baked',
})


console.log('Build complete!')

