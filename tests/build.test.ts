import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { rm, mkdir } from "fs/promises";
import sqlite from 'better-sqlite3';
import bake from "../src/cli/build";
import { existsSync } from "fs";
import type { Asset, Page } from '../src/types';

describe("build process", () => {
    const TEST_DIST = "test-dist";
    
    beforeEach(async () => {
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
    });

    afterEach(async () => {
        // Clean up after tests
        await rm(TEST_DIST, { recursive: true, force: true });
        await rm(`${TEST_DIST}-tmp`, { recursive: true, force: true });
    });

    test("initializes build directory correctly", async () => {
        await bake(TEST_DIST);
        
        expect(existsSync(`${TEST_DIST}-tmp`)).toBe(true);
        expect(existsSync(`${TEST_DIST}-tmp/site.db`)).toBe(true);
    });

    test("loads assets into database", async () => {
        await bake(TEST_DIST);
        
        const db = new sqlite(`${TEST_DIST}-tmp/site.db`);
        const assets = db.prepare("SELECT * FROM assets").all();
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
        // Create a file in the way of the build directory to cause an error
        await mkdir(TEST_DIST, { recursive: true });
        await expect(bake(TEST_DIST)).rejects.toThrow();
    });
});
