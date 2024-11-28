import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { rm } from "fs/promises";
import { Database } from "sqlite3";
import buildSite from "../src/cli/build";
import { existsSync } from "fs";

describe("build process", () => {
    const TEST_DIST = "test-dist";
    
    beforeEach(async () => {
        // Clean up any existing test directories
        await rm(TEST_DIST, { recursive: true, force: true });
        await rm(`${TEST_DIST}-tmp`, { recursive: true, force: true });
    });

    afterEach(async () => {
        // Clean up after tests
        await rm(TEST_DIST, { recursive: true, force: true });
        await rm(`${TEST_DIST}-tmp`, { recursive: true, force: true });
    });

    test("initializes build directory correctly", async () => {
        await buildSite(TEST_DIST);
        
        // Check that temp directory was created
        expect(existsSync(`${TEST_DIST}-tmp`)).toBe(true);
        // Check that database was created
        expect(existsSync(`${TEST_DIST}-tmp/site.db`)).toBe(true);
    });

    test("loads assets into database", async () => {
        await buildSite(TEST_DIST);
        
        const db = new Database(`${TEST_DIST}-tmp/site.db`);
        
        // Verify assets table exists and contains expected entries
        const assets = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM assets", (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });
        
        expect(assets).toBeDefined();
        // Add more specific asset checks based on your starter content
    });

    test("loads pages into database", async () => {
        await buildSite(TEST_DIST);
        
        const db = new Database(`${TEST_DIST}-tmp/site.db`);
        
        // Verify pages table exists and contains expected entries
        const pages = await new Promise((resolve, reject) => {
            db.all("SELECT * FROM pages", (err, rows) => {
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
        
        await expect(buildSite(TEST_DIST)).rejects.toThrow();
    });
});
