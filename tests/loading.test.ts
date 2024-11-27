import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { promises as fs } from 'fs';
import path from 'path';
import { Database } from 'bun:sqlite';
import { loadPagesFromDir, loadAssetsFromDir } from '../loading';

describe("Loading Functions", () => {
    let testDir: string;
    let db: Database;

    beforeEach(async () => {
        // Create test directory
        testDir = path.join(process.cwd(), 'tmp', `test-${Date.now()}`);
        await fs.mkdir(testDir, { recursive: true });
        
        // Initialize test database
        db = new Database(':memory:');
        db.exec(`
            CREATE TABLE pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                template TEXT NOT NULL,
                metadata TEXT,
                published_date TEXT
            );
            
            CREATE TABLE assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    test("loadPagesFromDir handles markdown files with frontmatter", async () => {
        // Create test markdown file
        const mdContent = `---
title: Test Post
date: 2024-01-01
tags: [test]
---
# Test Content`;
        
        await fs.mkdir(path.join(testDir, 'pages'), { recursive: true });
        await fs.writeFile(path.join(testDir, 'pages', 'test.md'), mdContent);
        
        await loadPagesFromDir(path.join(testDir, 'pages'), db, {}, testDir);
        
        const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('test');
        expect(page).toBeDefined();
        expect(page.title).toBe('Test Post');
        expect(page.content).toContain('# Test Content');
        
        const metadata = JSON.parse(page.metadata);
        expect(metadata.tags).toEqual(['test']);
        expect(metadata.date).toBe('2024-01-01');
    });

    test("loadPagesFromDir inherits metadata from meta.yaml", async () => {
        // Create meta.yaml
        const metaContent = `
template: blog
author: Test Author
`;
        const mdContent = `---
title: Test Post
---
Content`;
        
        await fs.mkdir(path.join(testDir, 'pages', 'blog'), { recursive: true });
        await fs.writeFile(path.join(testDir, 'pages', 'blog', 'meta.yaml'), metaContent);
        await fs.writeFile(path.join(testDir, 'pages', 'blog', 'post.md'), mdContent);
        
        await loadPagesFromDir(path.join(testDir, 'pages'), db);
        
        const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('blog/post');
        expect(page).toBeDefined();
        expect(page.template).toBe('blog');
        
        const metadata = JSON.parse(page.metadata);
        expect(metadata.author).toBe('Test Author');
    });

    test("loadAssetsFromDir handles different asset types", async () => {
        // Create test assets
        const assets = {
            'templates/test.html': '<div>${content}</div>',
            'css/style.css': '.test { color: red; }',
            'components/test.js': 'console.log("test");'
        };
        
        for (const [filePath, content] of Object.entries(assets)) {
            const fullPath = path.join(testDir, 'assets', filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content);
        }
        
        await loadAssetsFromDir(path.join(testDir, 'assets'), db);
        
        // Check each asset type
        for (const [filePath, content] of Object.entries(assets)) {
            const type = filePath.split('/')[0];
            const name = path.basename(filePath);
            
            const asset = db.prepare('SELECT * FROM assets WHERE path = ?').get(name);
            expect(asset).toBeDefined();
            expect(asset.content).toBe(content);
            expect(asset.type).toBe(type);
        }
    });

    test("loadPagesFromDir handles image files", async () => {
        // Create test image file (just a small binary file for testing)
        const imageContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG header
        
        await fs.mkdir(path.join(testDir, 'pages', 'images'), { recursive: true });
        await fs.writeFile(path.join(testDir, 'pages', 'images', 'test.jpg'), imageContent);
        
        await loadPagesFromDir(path.join(testDir, 'pages'), db);
        
        // Check if image was processed and copied
        const imageExists = await fs.access(path.join(testDir, 'dist', 'images', 'test.jpg'))
            .then(() => true)
            .catch(() => false);
        expect(imageExists).toBe(true);
        
        // Check if page entry was created with img tag
        const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('images/test');
        expect(page).toBeDefined();
        expect(page.content).toContain('<img src="/images/test.jpg"');
    });
});
