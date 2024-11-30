import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { rm, mkdir } from "fs/promises";
import Database from "better-sqlite3";
import bake from "../src/cli/build";
import { existsSync } from "fs";
import type { Asset, Page } from '../src/types';

describe("build process", () => {
    const TEST_DIST = "test-dist";
    
    beforeEach(async () => {
        // Clean up any existing test directories
        await rm(TEST_DIST, { recursive: true, force: true });
        await rm(`${TEST_DIST}-tmp`, { recursive: true, force: true });
        
        // Create test fixture directories
        await mkdir('assets', { recursive: true });
        await mkdir('pages', { recursive: true });
    });

    afterEach(async () => {
        // Clean up after tests
        await rm(TEST_DIST, { recursive: true, force: true });
        await rm(`${TEST_DIST}-tmp`, { recursive: true, force: true });
        await rm('assets', { recursive: true, force: true });
        await rm('pages', { recursive: true, force: true });
    });

    test("initializes build directory correctly", async () => {
        await bake(TEST_DIST);
        
        // Check that temp directory was created
        expect(existsSync(`${TEST_DIST}-tmp`)).toBe(true);
        // Check that database was created
        expect(existsSync(`${TEST_DIST}-tmp/site.db`)).toBe(true);
    });

    test("loads assets into database", async () => {
        await bake(TEST_DIST);
        
        const db = new Database(`${TEST_DIST}-tmp/site.db`);
        
        const assets = await new Promise<Asset[]>((resolve, reject) => {
            db.all("SELECT * FROM assets", (err: Error | null, rows: Asset[]) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
        expect(assets).toBeDefined();
        // Add more specific asset checks based on your starter content
    });

    test("loads pages into database", async () => {
        await bake(TEST_DIST);
        
        const db = new Database(`${TEST_DIST}-tmp/site.db`);
        
        // Verify pages table exists and contains expected entries
        const pages = await new Promise<Page[]>((resolve, reject) => {
            db.get("SELECT * FROM pages", (err: Error | null, rows: Page[]) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
        
        expect(pages).toBeDefined();
        // Add more specific page checks based on your starter content
    });

    test("handles build errors gracefully", async () => {
        // Create a file in the way of the build directory to cause an error
        await mkdir(TEST_DIST);
        
        await expect(bake(TEST_DIST)).rejects.toThrow();
    });
});
