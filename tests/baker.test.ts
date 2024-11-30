import { expect, test, beforeEach, afterEach, describe } from "@jest/globals";
import Database from "better-sqlite3";
import type { Database as DatabaseType } from "better-sqlite3";

import { Baker } from "../baked/baker";
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { readFileSync } from 'fs';
import { join as pathJoin } from 'path';
import type { RawAsset } from "../src/types";

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
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)')
          .run('/json/site.yaml', JSON.stringify({ title: 'Test Site' }), 'json');
        
        baker = new Baker(db, true);
    });

    afterEach(async () => {
        // Close database connection
        db.close();
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('Asset Management', () => {
        test('getRawAsset retrieves assets correctly', async () => {
            db.prepare(
                'INSERT INTO assets (path, content, type) VALUES (?, ?, ?)'
            ).run('/css/test.css', 'body { color: red; }', 'css');
            const assets = db.prepare('SELECT * FROM assets').all() as RawAsset[];
            
            console.log('again the assets', assets)
            const asset = baker.getRawAsset('test.css', 'css');
            expect(asset).toBeDefined();
            expect(asset.content).toBe('body { color: red; }');
        });

        test('getAsset processes assets with components', async () => {
            db.prepare(
                'INSERT INTO assets (path, content, type) VALUES (?, ?, ?)'
            ).run('/css/test.css', 'body { color: red; }', 'css');

            const processed = baker.getAsset('test.css', 'css');
            expect(processed).toBe('<style>body { color: red; }</style>'); // Remove style tags expectation since Components is mocked
        });
    });

    describe('Page Management', () => {
        beforeEach(() => {
            db.prepare(`
                INSERT INTO pages (slug, title, content, template, metadata, published_date)
                VALUES (?, ?, ?, ?, ?, ?)
            `).run(
                'test',
                'Test Page',
                'Test content',
                'default',
                '{"author":"test","template":"default"}',
                '2024-01-01'
            );
        });

        test('getPage retrieves pages with metadata', async () => {
            const page = baker.getPage('test');
            expect(page).toBeDefined();
            expect(page.title).toBe('Test Page');
            expect(page.metadata.author).toBe('test');
        });

        test('renderPage renders pages with template', async () => {
            db.prepare(
                'INSERT INTO assets (path, content, type) VALUES (?, ?, ?)'
            ).run(
                '/templates/default',
                '<h1>{{ page.title }}</h1>{{ page.content }}',
                'templates'
            );

            const page = baker.getPage('test');
            const rendered = await baker.renderPage(page);
            expect(rendered).toContain('<h1>Test Page</h1>');
            expect(rendered).toContain('Test content');
        });
    });

    describe('Navigation', () => {
        beforeEach(() => {
            const pages = [
                ['page1', 'Page 1', 'Content 1', 'default', '{}', '2024-01-01'],
                ['page2', 'Page 2', 'Content 2', 'default', '{}', '2024-01-02'],
                ['page3', 'Page 3', 'Content 3', 'default', '{}', '2024-01-03']
            ];
            
            const stmt = db.prepare(
                'INSERT INTO pages (slug, title, content, template, metadata, published_date) VALUES (?, ?, ?, ?, ?, ?)'
            );
            pages.forEach(page => stmt.run(...page));
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

    describe('Search', () => {
        beforeEach(async () => {
            const stmt = db.prepare(`
                INSERT INTO pages (slug, title, content, template, metadata, published_date)
                VALUES (?, ?, ?, ?, ?, ?)`);
            stmt.run('test1', 'Test One', 'Content about testing', 'default', '{}', '2024-01-01');
            stmt.run('test2', 'Test Two', 'More test content', 'default', '{}', '2024-01-02');
        });

        test('search returns relevant results', async () => {
            const results = baker.search('test');
            expect(results).toHaveLength(2);
            
            const contentResults = baker.search('about');
            expect(contentResults).toHaveLength(1);
            expect(contentResults[0].slug).toBe('test1');
        });
    });
});
