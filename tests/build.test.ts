import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { rm, mkdir, readFile, copyFile } from "fs/promises";
import sqlite, { Database } from "better-sqlite3";
import bake from "../src/cli/build";
import { existsSync } from "fs";
import path from 'path';



describe("build process", () => {
    const TEST_DIST = "test-dist";
    let db: Database;
    let schema: string;
    beforeEach(async () => {
        // Load schema
        if (!schema) {
            schema = await readFile(path.join(process.cwd(), 'src/sql/schema.sql'), 'utf-8');
        }
        
        // Clean up any existing test directories
        await rm(TEST_DIST, { recursive: true, force: true });
        await rm(`${TEST_DIST}-tmp`, { recursive: true, force: true });
        
        // Create test fixture directories and structure
        await mkdir(TEST_DIST, { recursive: true });
        await mkdir(`${TEST_DIST}/assets`, { recursive: true });
        await mkdir(`${TEST_DIST}/pages`, { recursive: true });
        
        // Create some test content
        await mkdir(`${TEST_DIST}/assets/images`, { recursive: true });
        await mkdir(`${TEST_DIST}/assets/css`, { recursive: true });
        await mkdir(`${TEST_DIST}/assets/templates`, { recursive: true });

        // copy starter site into test dist
        await copyFile(path.join(process.cwd(), 'src/starter/site.yaml'), `${TEST_DIST}/site.yaml`);

    });

    afterEach(async () => {
        // Clean up after tests
        await rm(TEST_DIST, { recursive: true, force: true });
        await rm(`${TEST_DIST}-tmp`, { recursive: true, force: true });
    });

    test("initializes build directory correctly", async () => {
        // Add check to ensure TEST_DIST exists before baking
        expect(existsSync(TEST_DIST)).toBe(true);
        
        await bake(TEST_DIST);
        
        // Add delay to ensure async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        expect(existsSync(`${TEST_DIST}-tmp`)).toBe(true);
        expect(existsSync(`${TEST_DIST}-tmp/site.db`)).toBe(true);
    });

    test("loads assets into database", async () => {
        await bake(TEST_DIST);
        
        // Add delay to ensure async operations complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const db = new sqlite(`${TEST_DIST}-tmp/site.db`);
        const assets = db.prepare("SELECT * FROM assets").all();
        db.close(); // Add cleanup
        expect(assets).toBeDefined();
        expect(Array.isArray(assets)).toBe(true);
    });

    test("loads pages into database", async () => {
        await bake(TEST_DIST);
        
        const db = new sqlite(`${TEST_DIST}-tmp/site.db`);
        const pages = db.prepare("SELECT * FROM pages").all();
        expect(pages).toBeDefined();
        expect(Array.isArray(pages)).toBe(true);
    });

    test("handles build errors gracefully", async () => {
        // Modify to create a real error condition
        await mkdir(`${TEST_DIST}-tmp`, { recursive: true }); // Create dir that should cause conflict
        await expect(bake(TEST_DIST)).rejects.toThrow();
    });
});
