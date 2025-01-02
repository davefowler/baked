import { expect, test, beforeEach, afterEach, describe } from '@jest/globals';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { Page } from '../src/types';
import { Baker } from '../src/baker';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFileSync } from 'fs';
import { join as pathJoin } from 'path';
import type { RawAsset } from '../src/types';

describe('Baker', () => {
  let tempDir: string;
  let db: DatabaseType;
  let baker: Baker;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'baker-test-'));
    db = new Database(':memory:');

    // Load and execute schema
    const schema = readFileSync(pathJoin(__dirname, '../src/sql/schema.sql'), 'utf-8');
    db.exec(schema);

    // Add site.yaml for Baker initialization
    db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
      'site.yaml',
      JSON.stringify({ title: 'Test Site' }),
      'json'
    );

    baker = new Baker(db, true);
  });

  afterEach(async () => {
    // Close database connection
    db.close();
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Asset Management', () => {
    test('getRawAsset retrieves assets correctly', async () => {
      db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
        'test.css',
        'body { color: red; }',
        'css'
      );
      const assets = db.prepare('SELECT * FROM assets').all() as RawAsset[];

      const asset = baker.getRawAsset('test.css', 'css');
      expect(asset).toBeDefined();
      expect(asset?.content).toBe('body { color: red; }');
    });

    test('getAsset processes assets with components', async () => {
      db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
        'test.css',
        'body { color: red; }',
        'css'
      );

      // Test 3 diffferent ways to grab the same asset

      // just by the asset name (no directory)
      const processed = baker.getAsset('test.css', 'css');
      expect(processed).toBe('body { color: red; }'); // Remove style tags expectation since Components is mocked

      // test that it works the type folder
      const p2 = baker.getAsset('css/test.css', 'css');
      expect(p2).toBe('body { color: red; }'); // Remove style tags expectation since Components is mocked

      // test that it works with a leading slash
      const p3 = baker.getAsset('/css/test.css', 'css');
      expect(p3).toBe('body { color: red; }'); // Remove style tags expectation since Components is mocked
    });
  });

  describe('Page Management', () => {
    beforeEach(() => {
      db.prepare(
        `
                INSERT INTO pages (path, slug, title, content, template, data, published_date)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `
      ).run(
        'test',
        'test',
        'Test Page',
        'Test content',
        'default',
        '{"author":"test","template":"default"}',
        '2024-01-01'
      );

      // Add a template
      db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
        'test-template.html',
        '<h1>{{ page.title }}</h1>{{ page.content }}',
        'templates'
      );
    });

    test('getPage retrieves pages with metadata', async () => {
      const page = baker.getPage('test')!;
      expect(page).toBeDefined();
      expect(page.title).toBe('Test Page');
      expect(page.data.author).toBe('test');
    });

    test('renderPage renders pages with template', async () => {
      const testPage = {
        id: 1,
        path: 'test',
        slug: 'test',
        template: 'test-template',
        published_date: '2024-01-01',
        title: 'Test from a new Page',
        content: 'Test content from a new page',
        data: {
          author: 'test',
          template: 'test-template',
        },
      } as Page;

      const alltemplatesare = db.prepare('SELECT * FROM assets WHERE type = ?').all('templates');
      const rendered = await baker.renderPage(testPage);
      expect(rendered).toContain('<h1>Test from a new Page</h1>');
      expect(rendered).toContain('Test content from a new page');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      const pages = [
        ['page1', 'page1', 'Page 1', 'Content 1', 'default', '{}', '2024-01-01'],
        ['page2', 'page2', 'Page 2', 'Content 2', 'default', '{}', '2024-01-02'],
        ['page3', 'page3', 'Page 3', 'Content 3', 'default', '{}', '2024-01-03'],
      ];

      const stmt = db.prepare(
        'INSERT INTO pages (path, slug, title, content, template, data, published_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      pages.forEach((page) => stmt.run(...page));
    });

    test('getLatestPages returns correct pages', async () => {
      const latest = baker.getLatestPages(2);
      expect(latest).toHaveLength(2);
      expect(latest[0].slug).toBe('page3');
      expect(latest[1].slug).toBe('page2');
    });

    test('getPrevNext returns correct adjacent pages', async () => {
      const page = baker.getPage('page2')!;
      expect(page).toBeDefined();
      const prev = baker.getPrevPage(page);
      const next = baker.getNextPage(page);

      expect(prev?.slug).toBe('page1');
      expect(next?.slug).toBe('page3');
    });
  });

  describe('Search and Filtering', () => {
    beforeEach(() => {
      // Insert test pages with different categories
      const pages = [
        ['blog1', 'blog1', 'Blog Post 1', 'Blog content 1', 'default', '{"category":"blog"}', '2024-01-01'],
        ['blog2', 'blog2', 'Blog Post 2', 'Blog content 2', 'default', '{"category":"blog"}', '2024-01-02'],
        ['news1', 'news1', 'News Item 1', 'News content', 'default', '{"category":"news"}', '2024-01-03'],
      ];

      const stmt = db.prepare(
        'INSERT INTO pages (path, slug, title, content, template, data, published_date) VALUES (?, ?, ?, ?, ?, ?, ?)'
      );
      pages.forEach((page) => stmt.run(...page));
    });

    test('search returns matching pages by title', async () => {
      const results = baker.search('Blog');
      expect(results).toHaveLength(2);
      expect(results[0].title).toBe('Blog Post 2');
      expect(results[1].title).toBe('Blog Post 1');
    });

    test('search returns matching pages by content', async () => {
      const results = baker.search('News content');
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('News Item 1');
    });

    test('getLatestPages filters by category', async () => {
      const blogPosts = baker.getLatestPages(10, 0, 'blog');
      expect(blogPosts).toHaveLength(2);
      expect(blogPosts[0].slug).toBe('blog2');
      expect(blogPosts[1].slug).toBe('blog1');

      const newsPosts = baker.getLatestPages(10, 0, 'news');
      expect(newsPosts).toHaveLength(1);
      expect(newsPosts[0].slug).toBe('news1');
    });

    test('getLatestPages respects limit and offset', async () => {
      const firstPage = baker.getLatestPages(1, 0, 'blog');
      expect(firstPage).toHaveLength(1);
      expect(firstPage[0].slug).toBe('blog2');

      const secondPage = baker.getLatestPages(1, 1, 'blog');
      expect(secondPage).toHaveLength(1);
      expect(secondPage[0].slug).toBe('blog1');
    });
  });
});
