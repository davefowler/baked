import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe("CLI Commands", () => {
    const projectRoot = process.cwd();
    const testDir = path.resolve(projectRoot, 'tmp', 'test-cli-site');
    const cliPath = path.resolve(projectRoot, 'cli.ts');
    let originalDir: string;

    beforeAll(async () => {
        console.log('Project root:', projectRoot);
        console.log('Test directory:', testDir);
        console.log('CLI path:', cliPath);
        
        originalDir = process.cwd();
        
        // Clean up any existing test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            console.log('Clean up error (safe to ignore if dir not exists):', error.message);
        }
        
        // Create test directory
        await fs.mkdir(testDir, { recursive: true });
    });

    beforeEach(() => {
        // Ensure we're in the project root before each test
        process.chdir(projectRoot);
    });

    afterAll(async () => {
        // Clean up and restore original directory
        try {
            process.chdir(originalDir);
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    });

    test("should create site directory", async () => {
        try {
            // Link the package globally first
            execSync('bun link', { stdio: 'pipe' });
            
            console.log('Executing CLI command from:', process.cwd());
            const result = execSync('absurd new test-cli-site', {
                stdio: 'pipe',
                env: { ...process.env, PATH: process.env.PATH }
            });
            console.log('CLI output:', result.toString());
            
            const exists = await fs.access(testDir)
                .then(() => true)
                .catch(() => false);
            
            if (!exists) {
                console.error('Directory not created:', testDir);
                console.error('Current directory:', process.cwd());
                const dirContents = await fs.readdir(process.cwd());
                console.log('Current directory contents:', dirContents);
            }
            
            expect(exists).toBe(true);
        } catch (error) {
            console.error('CLI execution error:', error);
            throw error;
        }
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
            expect(dirExists, `Directory "${dir}" was not created`).toBe(true);
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
