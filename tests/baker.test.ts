import { expect, test, beforeEach, afterEach, describe } from '@jest/globals';
import Database, { Database as DatabaseType } from 'better-sqlite3';

import { Baker } from '../src/baked/baker';
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
      expect(asset.content).toBe('body { color: red; }');
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
      expect(processed).toBe('<style>body { color: red; }</style>'); // Remove style tags expectation since Components is mocked

      // test that it works the type folder
      const p2 = baker.getAsset('css/test.css', 'css');
      expect(p2).toBe('<style>body { color: red; }</style>'); // Remove style tags expectation since Components is mocked

      // test that it works with a leading slash
      const p3 = baker.getAsset('/css/test.css', 'css');
      expect(p3).toBe('<style>body { color: red; }</style>'); // Remove style tags expectation since Components is mocked
    });
  });

  describe('Page Management', () => {
    beforeEach(() => {
      db.prepare(
        `
                INSERT INTO pages (slug, title, content, template, data, published_date)
                VALUES (?, ?, ?, ?, ?, ?)
            `
      ).run(
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
      const page = baker.getPage('test');
      expect(page).toBeDefined();
      expect(page.title).toBe('Test Page');
      expect(page.data.author).toBe('test');
    });

    test('renderPage renders pages with template', async () => {
      const testPage = {
        title: 'Test from a new Page',
        content: 'Test content from a new page',
        data: {
          author: 'test',
          template: 'test-template',
        },
      };

      const alltemplatesare = db.prepare('SELECT * FROM assets WHERE type = ?').all('templates');
      console.log('available templates', alltemplatesare);
      const rendered = await baker.renderPage(testPage);
      expect(rendered).toContain('<h1>Test from a new Page</h1>');
      expect(rendered).toContain('Test content from a new page');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      const pages = [
        ['page1', 'Page 1', 'Content 1', 'default', '{}', '2024-01-01'],
        ['page2', 'Page 2', 'Content 2', 'default', '{}', '2024-01-02'],
        ['page3', 'Page 3', 'Content 3', 'default', '{}', '2024-01-03'],
      ];

      const stmt = db.prepare(
        'INSERT INTO pages (slug, title, content, template, data, published_date) VALUES (?, ?, ?, ?, ?, ?)'
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
      const page = baker.getPage('page2');
      const prev = baker.getPrevPage(page);
      const next = baker.getNextPage(page);

      expect(prev?.slug).toBe('page1');
      expect(next?.slug).toBe('page3');
    });
  });
});
