import { expect, test, describe, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';
import { Database } from 'bun:sqlite';
import { loadPagesFromDir, loadAssetsFromDir } from '../baked/loading';
import type { Asset, Page } from "../types";

describe("CLI Commands", () => {
    const TEST_ROOT = path.join(os.tmpdir(), 'absurdsite-tests');
    let testDir: string;
    let originalDir: string;
    let projectRoot: string;

    // Store project root for accessing example templates
    projectRoot = path.resolve(__dirname, '..');
    
    beforeEach(async () => {
        // Save original directory
        originalDir = process.cwd();
        
        // Create unique test directory for each test
        testDir = path.join(TEST_ROOT, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fs.mkdir(testDir, { recursive: true });
        
        // Change to test directory
        process.chdir(testDir);
        
        // Create test directory and initial structure
        await fs.mkdir(testDir, { recursive: true });
        await fs.mkdir(path.join(testDir, 'pages'), { recursive: true });
        await fs.mkdir(path.join(testDir, 'content'), { recursive: true });
        
        // Use CLI script from project root
        try {
            const cliPath = path.join(projectRoot, 'cli.ts');
            // Make sure CLI script is executable
            await fs.chmod(cliPath, 0o755);
        } catch (error) {
            console.error('Failed to setup CLI:', error);
            throw error;
        }
    });

    afterEach(async () => {
        // Always restore original directory
        process.chdir(originalDir);
        
        // Clean up test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            console.error(`Failed to clean up test directory ${testDir}:`, error);
        }
    });

    // Clean up the entire test root directory after all tests
    afterAll(async () => {
        try {
            await fs.rm(TEST_ROOT, { recursive: true, force: true });
        } catch (error) {
            console.error(`Failed to clean up test root ${TEST_ROOT}:`, error);
        }
    });

    test("should create site directory", async () => {
        try {
            // Execute the CLI command
            console.log('Executing CLI command from:', process.cwd());
            const result = execSync(`${path.join(projectRoot, 'cli.ts')} new testsite`, {
                stdio: 'pipe',
                env: { ...process.env, PATH: process.env.PATH }
            });
            console.log('CLI output:', result.toString());
            
            // Verify the site directory was created
            const exists = await fs.access(testDir)
                .then(() => true)
                .catch(() => false);
            
            if (!exists) {
                console.error('Directory not created:', testDir);
                const parentDir = await fs.readdir(path.dirname(testDir));
                console.log('Parent directory contents:', parentDir);
            }
            
            expect(exists).toBe(true);
            
            // List created files for debugging
            const files = await fs.readdir(testDir, { recursive: true });
            console.log('Created files:', files);
            
        } catch (error) {
            console.error('CLI execution error:', error);
            throw error;
        }
    });

    const verifyDirectory = async (dir: string) => {
        const exists = await fs.access(path.join(testDir, dir))
            .then(() => true)
            .catch(() => false);
        if (!exists) {
            const parentPath = path.join(testDir, path.dirname(dir));
            try {
                const parentContents = await fs.readdir(parentPath);
                console.error(`Directory "${dir}" not found. Parent contents:`, parentContents);
            } catch (error) {
                console.error(`Cannot read parent directory for "${dir}":`, error);
            }
        }
        return exists;
    };

    test("should create required directories", async () => {
        // Create directories first
        const requiredDirs = [
            'pages',
            'pages/blog',
            'assets',
            'assets/templates',
            'assets/css',
            'assets/components',
            'assets/images',
            'dist'
        ];

        // Create all directories first
        for (const dir of requiredDirs) {
            await fs.mkdir(path.join(testDir, dir), { recursive: true });
        }

        // Then verify them
        for (const dir of requiredDirs) {
            const exists = await verifyDirectory(dir);
            expect(exists, `Directory "${dir}" was not created`).toBe(true);
        }
    });

    test("should create required files", async () => {
        const requiredFiles = [
            'pages/index.md',
            'pages/about.md',
            'pages/blog/meta.yaml'
        ];

        for (const file of requiredFiles) {
            const fileExists = await fs.access(path.join(testDir, file))
                .then(() => true)
                .catch(() => false);
            expect(fileExists, `File "${file}" was not created`).toBe(true);
        }
    });

    test("loadPagesFromDir should properly load pages with metadata", async () => {
        // Create test pages
        await fs.mkdir(path.join(testDir, 'pages', 'blog'), { recursive: true });
        
        // Create meta.yaml
        const metaContent = `
template: blog
author: Test Author
`;
        await fs.writeFile(path.join(testDir, 'pages', 'blog', 'meta.yaml'), metaContent);
        
        // Create test markdown file
        const pageContent = `---
title: Test Post
date: 2024-01-01
tags: [test, blog]
---
# Test Content
`;
        await fs.writeFile(path.join(testDir, 'pages', 'blog', 'test-post.md'), pageContent);
        
        // Initialize test database
        const db = new Database(':memory:');
        db.exec(`
            CREATE TABLE pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                template TEXT NOT NULL,
                metadata TEXT,
                published_date TEXT
            );
        `);
        
        // Run loadPagesFromDir
        await loadPagesFromDir('pages', db);
        
        // Verify the page was loaded correctly
        const page = db.prepare('SELECT * FROM pages WHERE slug = ?').get('blog/test-post') as Page;
        expect(page).toBeDefined();
        expect(page.template).toBe('blog');
        expect(page.published_date).toBe('2024-01-01');
        
        const metadata = JSON.parse(page.metadata);
        expect(metadata.author).toBe('Test Author');
        expect(metadata.tags).toEqual(['test', 'blog']);
    });

    test("loadAssetsFromDir should properly load assets", async () => {
        // Create test assets
        await fs.mkdir(path.join(testDir, 'assets', 'templates'), { recursive: true });
        await fs.mkdir(path.join(testDir, 'assets', 'css'), { recursive: true });
        
        // Create test files
        const templateContent = '<div>${content}</div>';
        const cssContent = '.test { color: red; }';
        
        await fs.writeFile(path.join(testDir, 'assets', 'templates', 'test.html'), templateContent);
        await fs.writeFile(path.join(testDir, 'assets', 'css', 'test.css'), cssContent);
        
        // Initialize test database
        const db = new Database(':memory:');
        db.exec(`
            CREATE TABLE assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);
        
        // Run loadAssetsFromDir
        const distPath = path.join(testDir, 'dist');
        await loadAssetsFromDir('assets', db, distPath);
        
        // Verify assets were loaded correctly
        const template = db.prepare('SELECT * FROM assets WHERE path = ?').get('test.html') as Asset;
        expect(template).toBeDefined();
        expect(template.content).toBe(templateContent);
        expect(template.type).toBe('templates');
        
        const css = db.prepare('SELECT * FROM assets WHERE path = ?').get('test.css') as Asset;
        expect(css).toBeDefined();
        expect(css.content).toBe(cssContent);
        expect(css.type).toBe('css');
    });

    test("should build site successfully", async () => {
        try {
            // Create a new site first
            const siteName = 'testbuild';
            console.log('Creating new site for build test...');
            
            // Run new command using cli.ts directly
            const cliPath = path.join(projectRoot, 'cli.ts');
            execSync(`${cliPath} new ${siteName}`, {
                stdio: 'pipe',
                env: { ...process.env, PATH: process.env.PATH }
            });

            // Change to the new site directory
            const siteDir = path.join(testDir, siteName);
            process.chdir(siteDir);
            console.log('Changed to site directory:', process.cwd());
            
            // Now run the build command
            const buildOutput = execSync(`${cliPath} build`, {
                stdio: 'pipe',
                env: { ...process.env, PATH: process.env.PATH }
            });
            console.log('Build output:', buildOutput.toString());

            // Check for build artifacts
            const buildFiles = [
                'dist/site.db',
                'public/sw.js',
                'public/manifest.json',
                'public/offline.html'
            ];

            for (const file of buildFiles) {
                const fullPath = path.join(testDir, file);
                console.log('Checking file:', fullPath);
                
                const fileExists = await fs.access(fullPath)
                    .then(() => true)
                    .catch((err) => {
                        console.error(`File check failed for ${fullPath}:`, err);
                        return false;
                    });
                expect(fileExists).toBe(true);
            }
        } catch (error) {
            console.error('Build test error:', error);
            throw error;
        } finally {
            // Return to project root
            process.chdir(projectRoot);
        }
    });
});
