import { describe, test, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import { rm, mkdir, cp, readdir, writeFile } from "fs/promises";
import sqlite, { Database } from "better-sqlite3";
import bake from "../src/cli/build";
import { existsSync } from "fs";
import path from 'path';



describe("build process", () => {
    const TEST_DIR = path.join(process.cwd(), "tmp/test");
    let db: Database;
    let schema: string;
    beforeAll(async () => {
        // Initial cleanup
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    beforeEach(async () => {
        console.log('Creating test directories...');
        
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

    test("initializes build directory correctly", async () => {

        console.log('things in the test dir', await readdir(TEST_DIR));
        // Add check to ensure TEST_DIST exists before baking
        expect(existsSync(TEST_DIR)).toBe(true);
        expect(existsSync(path.join(TEST_DIR, 'assets'))).toBe(true);
        expect(existsSync(path.join(TEST_DIR, 'pages'))).toBe(true);
        expect(existsSync(path.join(TEST_DIR, 'manifest.json'))).toBe(true);
        expect(existsSync(path.join(TEST_DIR, 'assets/css'))).toBe(true);
        expect(existsSync(path.join(TEST_DIR, 'assets/templates'))).toBe(true);

        await bake(TEST_DIR);
        
        // Add delay to ensure async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        const distDir = path.join(TEST_DIR, 'dist');
        expect(existsSync(distDir)).toBe(true);
        expect(existsSync(path.join(distDir, 'site.db'))).toBe(true);
        
        // Check that public files were copied
        expect(existsSync(path.join(distDir, 'manifest.json'))).toBe(true);
    });

    test("loads assets into database", async () => {
        // Verify directories exist before proceeding
        const assetsPath = path.join(TEST_DIR, 'assets');
        console.log('Before bake - assets directory exists?', existsSync(assetsPath));
        console.log('Assets directory contents:', await readdir(assetsPath));
        
        await bake(TEST_DIR);
        
        console.log('After bake - assets directory exists?', existsSync(assetsPath));
        if (existsSync(assetsPath)) {
            console.log('Assets directory contents after bake:', await readdir(assetsPath));
        }
        
        const distDir = path.join(TEST_DIR, 'dist');
        const dbPath = path.join(distDir, 'site.db');
        console.log('Database path exists?', existsSync(dbPath));
        
        const db = new sqlite(dbPath);
        const assets = db.prepare("SELECT * FROM assets").all();
        db.close();
        expect(assets).toBeDefined();
        expect(Array.isArray(assets)).toBe(true);
    });

    test("loads pages into database", async () => {
        await bake(TEST_DIR);
        
        const db = new sqlite(path.join(TEST_DIR, 'dist', 'site.db'));
        const pages = db.prepare("SELECT * FROM pages").all();
        expect(pages).toBeDefined();
        expect(Array.isArray(pages)).toBe(true);

        expect(pages.length).toBe(3);
        
        const manifestPage = db.prepare("SELECT * FROM pages WHERE slug like '%manifest%'").get();
        expect(manifestPage).toBeUndefined();
    });

    afterAll(async () => {
        // Final cleanup
        await rm(TEST_DIR, { recursive: true, force: true });
    });
});
