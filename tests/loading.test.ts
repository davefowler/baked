import { expect, test, beforeEach, afterEach, describe } from "@jest/globals";
import { mkdtemp, rm, writeFile, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Database } from 'sqlite3';
import { loadPagesFromDir, loadAssetsFromDir, loadSiteMetadata } from '../baked/loading';

describe('Loading System', () => {
    let tempDir: string;
    let db: Database;

    beforeEach(async () => {
        // Create temporary test directory
        tempDir = await mkdtemp(join(tmpdir(), 'baked-test-'));
        
        // Create test database
        db = new Database(':memory:');
        
        // Initialize database schema
        await db.exec(`
            CREATE TABLE IF NOT EXISTS pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                template TEXT NOT NULL,
                metadata TEXT,
                published_date TEXT
            );
            
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS site (
                metadata TEXT
            );
        `);
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
        db.close();
    });

    describe('loadPagesFromDir', () => {
        test('processes markdown files correctly', async () => {
            const pageContent = `---
title: Test Page
date: 2024-01-01
---
# Test Content`;
            
            await mkdir(join(tempDir, 'pages'), { recursive: true });
            await writeFile(join(tempDir, 'pages', 'test.md'), pageContent);
            
            await loadPagesFromDir(join(tempDir, 'pages'), db);
            
            const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('test');
            expect(page).toBeDefined();
            expect(page.title).toBe('Test Page');
            expect(page.content).toContain('# Test Content');
        });

        test('handles meta.yaml inheritance', async () => {
            const metaContent = `template: blog
author: Test Author`;
            const pageContent = `---
title: Test Post
---
Content`;
            
            await mkdir(join(tempDir, 'pages', 'blog'), { recursive: true });
            await writeFile(join(tempDir, 'pages', 'blog', 'meta.yaml'), metaContent);
            await writeFile(join(tempDir, 'pages', 'blog', 'post.md'), pageContent);
            
            await loadPagesFromDir(join(tempDir, 'pages'), db);
            
            const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('blog/post');
            const metadata = JSON.parse(page.metadata);
            expect(metadata.template).toBe('blog');
            expect(metadata.author).toBe('Test Author');
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
            
            const cssAsset = db.prepare('SELECT * FROM assets WHERE path = ? AND type = ?')
                .get('style.css', 'css');
            const templateAsset = db.prepare('SELECT * FROM assets WHERE path = ? AND type = ?')
                .get('base.html', 'templates');
                
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
            
            const site = db.prepare('SELECT metadata FROM site').get();
            const metadata = JSON.parse(site.metadata);
            
            expect(metadata.title).toBe('Test Site');
            expect(metadata.description).toBe('A test site');
            expect(metadata.author).toBe('Test Author');
        });
    });
});
