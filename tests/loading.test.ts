import { expect, test, beforeEach, afterEach, describe } from '@jest/globals';
import { mkdtemp, rm, writeFile, mkdir, readFile } from 'fs/promises';
import path from 'path';
import { tmpdir } from 'os';
import { join } from 'path';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { loadPagesFromDir, loadAssetsFromDir, loadSiteMetadata } from '../src/baked/loading';
import { RawAsset, Page } from '../src/types';

describe('Loading System', () => {
  let tempDir: string;
  let db: DatabaseType;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await mkdtemp(join(tmpdir(), 'baked-test-'));
    const schema = await readFile(path.join(process.cwd(), 'src/sql/schema.sql'), 'utf-8');

    // Create test database
    db = new Database(':memory:');

    // Initialize database schema
    await db.exec(schema);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    db.close();
  });

  describe('loadPagesFromDir', () => {
    test('processes markdown files correctly', async () => {
      const pageContent = `---
title: Test A Page
author: Test Author
date: 2024-01-01
---
# Test Content`;

      await mkdir(join(tempDir, 'pages'), { recursive: true });
      await writeFile(join(tempDir, 'pages', 'test.md'), pageContent);

      await loadPagesFromDir(join(tempDir, 'pages'), db, {}, false);

      const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('test') as Page;
      const data = JSON.parse(page.data);
      expect(page).toBeDefined();
      expect(page.title).toBe('Test A Page');
      expect(page.path).toBe('test');
      expect(page.slug).toBe('test');
      expect(page.published_date).toBe('2024-01-01T00:00:00.000Z');
      expect(page.template).toBe('base.html');
      expect(page.content).toContain('# Test Content');
      expect(data.author).toBe('Test Author');
    });

    test('handles meta.yaml inheritance', async () => {
      const metaContent = `template: overwriteme
author: Test Author`;
      const pageContent = `---
title: Test This Post
template: blog
date: 2024-01-01
---
Wild content here`;

      await mkdir(join(tempDir, 'pages', 'blog'), { recursive: true });
      await writeFile(join(tempDir, 'pages', 'blog', 'meta.yaml'), metaContent);
      await writeFile(join(tempDir, 'pages', 'blog', 'post.md'), pageContent);

      await loadPagesFromDir(join(tempDir, 'pages'), db, {}, false);

      const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('blog/post') as Page;
      const allpages = db.prepare('SELECT * FROM pages').all() as Page[];
      expect(page).toBeDefined();
      const data = JSON.parse(page.data);
      expect(data.template).toBe('blog');
      expect(data.author).toBe('Test Author');
      expect(page.title).toBe('Test This Post');
      expect(page.content).toContain('Wild content here');
      expect(allpages.length).toBe(1);
    });

    test('respects draft status', async () => {
      const draftContent = `---
title: Draft Post
isDraft: true
---
Draft content`;

      await mkdir(join(tempDir, 'pages'), { recursive: true });
      await writeFile(join(tempDir, 'pages', 'draft.md'), draftContent);

      await loadPagesFromDir(join(tempDir, 'pages'), db, {}, false);

      const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('draft');
      expect(page).toBeUndefined();
    });
  });

  describe('loadAssetsFromDir', () => {
    test('loads different asset types correctly', async () => {
      const cssContent = 'body { color: red; }';
      const templateContent = '<div>${content}</div>';

      await mkdir(join(tempDir, 'assets', 'css'), { recursive: true });
      await mkdir(join(tempDir, 'assets', 'templates'), { recursive: true });

      await writeFile(join(tempDir, 'assets', 'css', 'style.css'), cssContent);
      await writeFile(join(tempDir, 'assets', 'templates', 'base.html'), templateContent);

      await loadAssetsFromDir(join(tempDir, 'assets'), db, tempDir);

      const cssAsset = db
        .prepare('SELECT * FROM assets WHERE path = ? AND type = ?')
        .get('style.css', 'css') as RawAsset;
      const templateAsset = db
        .prepare('SELECT * FROM assets WHERE path = ? AND type = ?')
        .get('base.html', 'templates') as RawAsset;

      expect(cssAsset).toBeDefined();
      expect(cssAsset.content).toBe(cssContent);
      expect(templateAsset).toBeDefined();
      expect(templateAsset.content).toBe(templateContent);
    });
  });

  describe('loadSiteMetadata', () => {
    test('loads site.yaml correctly', async () => {
      const siteContent = `title: Test Site
description: A test site
author: Test Author`;

      await writeFile(join(tempDir, 'site.yaml'), siteContent);

      await loadSiteMetadata(tempDir, db);

      const siteRaw = db
        .prepare('SELECT content FROM assets WHERE path = ? AND type = ?')
        .get('site.yaml', 'json') as RawAsset;
      const site = JSON.parse(siteRaw.content);

      expect(site.title).toBe('Test Site');
      expect(site.description).toBe('A test site');
      expect(site.author).toBe('Test Author');
    });
  });
});
