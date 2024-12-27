import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { rm, mkdir, cp, readdir, readFile } from 'fs/promises';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import bake from '../src/cli/build';
import { existsSync } from 'fs';
import path from 'path';
import type { Page } from '../src/types';


describe('build output', () => {

  const TEST_DIR = path.join(__dirname, '../tmp/test');
  const SQL_DIR = path.join(__dirname, '../src/sql');
  const distDir = path.join(TEST_DIR, 'dist');

  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    // Optionally also mock error if you want to suppress those too
    // jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeAll(async () => {
    // Initial cleanup
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Create base directories
    await mkdir(TEST_DIR, { recursive: true });

    // copy the starter site
    const starterDir = path.join(process.cwd(), 'src/starter');
    await cp(starterDir, TEST_DIR, { recursive: true });

    // bake that site!
    await bake(TEST_DIR, SQL_DIR);
    // Add delay to ensure async operations complete
    await new Promise((resolve) => setTimeout(resolve, 100));

  });

  afterEach(async () => {
    // Clean up after tests
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test('builds directories correctly', async () => {
    // Test that the dist dir was created
    expect(existsSync(distDir)).toBe(true);
    // And the database was put there
    expect(existsSync(path.join(distDir, 'site.db'))).toBe(true);
    // Check that public files were copied
    expect(existsSync(path.join(distDir, 'manifest.json'))).toBe(true);

    // Ensure some of the main files
    expect(existsSync(path.join(distDir, 'index.html'))).toBe(true);
    expect(existsSync(path.join(distDir, 'DOESNOTEXIST.html'))).toBe(false);
    expect(existsSync(path.join(distDir, 'blog.html'))).toBe(true);
    expect(existsSync(path.join(distDir, 'blog/customization.html'))).toBe(true);
    expect(existsSync(path.join(distDir, 'icons/site-icon-192.png'))).toBe(true);
    expect(existsSync(path.join(distDir, 'about.html'))).toBe(true);
  })

  test('markdown renders as html', async () => {

    const indexPath = path.join(distDir, 'index.html');
    expect(existsSync(indexPath)).toBe(true);

    const index = await readFile(indexPath, 'utf8');
    expect(index).toContain('Hello World!');
    expect(index).toContain('<h1>Hello World!</h1>\n');
  })

  // TODO - maybe test this in templates or baker?
  test('baker can getLatestPosts in templates', async () => {
    const indexPath = path.join(distDir, 'index.html');
    expect(existsSync(indexPath)).toBe(true);

    const index = await readFile(indexPath, 'utf8');
    expect(index).toContain('Hello World!');
    expect(index).toContain('<li><a href=\"/blog/customization\">Customizing Your Site</a></li>');
  })
})

describe('pre build process', () => {
  const TEST_DIR = path.join(__dirname, '../tmp/test');
  const SQL_DIR = path.join(__dirname, '../src/sql');
  let db: DatabaseType;
  let schema: string;

  beforeAll(async () => {
    // Initial cleanup
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  beforeEach(async () => {
    // Create base directories
    await mkdir(TEST_DIR, { recursive: true });

    // copy the starter site
    const starterDir = path.join(process.cwd(), 'src/starter');
    await cp(starterDir, TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    // Clean up after tests
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  test('initializes build directory correctly', async () => {
    // Add check to ensure TEST_DIST exists before baking
    expect(existsSync(TEST_DIR)).toBe(true);

    expect(existsSync(path.join(TEST_DIR, 'assets'))).toBe(true);
    expect(existsSync(path.join(TEST_DIR, 'pages'))).toBe(true);
    expect(existsSync(path.join(TEST_DIR, 'public/manifest.json'))).toBe(true);
    expect(existsSync(path.join(TEST_DIR, 'assets/css'))).toBe(true);
    expect(existsSync(path.join(TEST_DIR, 'assets/templates'))).toBe(true);
  });

  test('loads assets into database', async () => {
    // Verify directories exist before proceeding
    const assetsPath = path.join(TEST_DIR, 'assets');
    await bake(TEST_DIR, SQL_DIR);

    const distDir = path.join(TEST_DIR, 'dist');
    const dbPath = path.join(distDir, 'site.db');

    const db = new Database(dbPath);
    const assets = db.prepare('SELECT * FROM assets').all();
    db.close();
    expect(assets).toBeDefined();
    expect(Array.isArray(assets)).toBe(true);
  });

  test('loads pages into database', async () => {
    const num_pages = await readdir(path.join(TEST_DIR, 'pages'));
    await bake(TEST_DIR, SQL_DIR);

    const db = new Database(path.join(TEST_DIR, 'dist', 'site.db'));
    const pages = db.prepare('SELECT * FROM pages').all() as Page[];
    expect(pages).toBeDefined();
    expect(Array.isArray(pages)).toBe(true);
    expect(pages.length).toBe(4);
    expect(pages.map((page) => page.slug)).toEqual([
      'about',
      'blog/customization',
      'blog',
      'index',
    ]);

    const manifestPage = db.prepare("SELECT * FROM pages WHERE slug like '%manifest%'").get();
    expect(manifestPage).toBeUndefined();
  });

  afterAll(async () => {
    // Final cleanup
    await rm(TEST_DIR, { recursive: true, force: true });
  });
});
