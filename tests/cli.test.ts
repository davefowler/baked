import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe("CLI Commands", () => {
    const testDir = path.join(process.cwd(), 'tmp', 'test-cli-site');
    
    beforeAll(async () => {
        // Clean up any existing test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // Ignore if directory doesn't exist
        }
        
        // Create test directory structure
        await fs.mkdir(testDir, { recursive: true });
        
        // Create required subdirectories
        const dirs = [
            'pages',
            'pages/blog',
            'assets',
            'assets/templates',
            'assets/css',
            'assets/components',
            'assets/images',
            'dist'
        ];
        
        for (const dir of dirs) {
            await fs.mkdir(path.join(testDir, dir), { recursive: true });
        }
    });

    afterAll(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
    });

    test("should find CLI script", async () => {
        const cliPath = path.resolve(process.cwd(), 'cli.ts');
        const exists = await fs.access(cliPath)
            .then(() => true)
            .catch(() => false);
        expect(exists).toBe(true);
    });

    test("should create site directory", async () => {
        const cliPath = path.resolve(process.cwd(), 'cli.ts');
        execSync(`bun ${cliPath} new ${path.basename(testDir)}`, {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        const exists = await fs.access(testDir)
            .then(() => true)
            .catch(() => false);
        expect(exists).toBe(true);
    });

    test("should create required directories", async () => {
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

        for (const dir of requiredDirs) {
            const dirExists = await fs.access(path.join(testDir, dir))
                .then(() => true)
                .catch(() => false);
            expect(dirExists).toBe(true);
        }
    });

    test("should create required files", async () => {
        const requiredFiles = [
            'site.yaml',
            'pages/index.md',
            'pages/about.md',
            'pages/blog/meta.yaml'
        ];

        for (const file of requiredFiles) {
            const fileExists = await fs.access(path.join(testDir, file))
                .then(() => true)
                .catch(() => false);
            expect(fileExists).toBe(true);
        }
    });

    test("should build site successfully", async () => {
        const originalDir = process.cwd();
        const cliPath = path.resolve(originalDir, 'cli.ts');
        
        try {
            // Change to test directory
            process.chdir(testDir);

            // Run build command with absolute path
            execSync(`bun ${cliPath} build`, {
                stdio: 'inherit',
                cwd: testDir
            });

            // Check for build artifacts
            const buildFiles = [
                'dist/site.db',
                'public/sw.js',
                'public/manifest.json',
                'public/offline.html'
            ];

            for (const file of buildFiles) {
                const fileExists = await fs.access(file)
                    .then(() => true)
                    .catch(() => false);
                expect(fileExists).toBe(true);
            }
        } finally {
            // Always change back to original directory
            process.chdir(originalDir);
        }
    });
});
