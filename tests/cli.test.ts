import { expect, test, describe, beforeAll, afterAll, beforeEach, afterEach } from "bun:test";
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

describe("CLI Commands", () => {
    const TEST_ROOT = path.join(os.tmpdir(), 'absurdsite-tests');
    let testDir: string;
    let originalDir: string;
    let projectRoot: string;

    // Store project root for accessing example templates
    projectRoot = process.cwd();
    
    beforeEach(async () => {
        // Save original directory
        originalDir = process.cwd();
        
        // Create unique test directory for each test
        testDir = path.join(TEST_ROOT, `test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
        await fs.mkdir(testDir, { recursive: true });
        
        // Change to test directory
        process.chdir(testDir);
        
        // Create test directory
        await fs.mkdir(testDir, { recursive: true });
        
        // Link the package in the test directory
        try {
            // First link the package from the project root
            execSync('cd .. && bun link', { stdio: 'pipe' });
            // Then link it in the test directory
            execSync('bun link absurd', { stdio: 'pipe' });
        } catch (error) {
            console.error('Failed to link package:', error);
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
            const result = execSync(`absurd new testsite`, {
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
            const exists = await verifyDirectory(dir);
            expect(exists, `Directory "${dir}" was not created`).toBe(true);
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
            expect(fileExists, `File "${file}" was not created`).toBe(true);
        }
    });

    test("should build site successfully", async () => {
        try {
            console.log('Starting build test from:', process.cwd());
            
            // Change to test directory for build
            process.chdir(testDir);
            console.log('Changed to test directory:', process.cwd());
            
            // Run build command
            const buildOutput = execSync('absurd build', {
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
