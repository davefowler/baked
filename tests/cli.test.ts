import { expect, test, describe, beforeAll, afterAll, beforeEach } from "bun:test";
import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

describe("CLI Commands", () => {
    const projectRoot = process.cwd();
    const testDir = path.join(projectRoot, 'tmp', 'test-cli-site');
    const examplesDir = path.join(projectRoot, '..', 'examples', 'defaultsite');
    let originalDir: string;

    beforeAll(async () => {
        console.log('Project root:', projectRoot);
        console.log('Test directory:', testDir);
        console.log('Examples directory:', examplesDir);
        
        originalDir = process.cwd();
        
        // Clean up any existing test directory
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            console.log('Clean up error (safe to ignore if dir not exists):', error.message);
        }
        
        // Create test directory structure
        await fs.mkdir(path.dirname(testDir), { recursive: true });
        
        // Create examples directory structure if it doesn't exist
        await fs.mkdir(path.dirname(examplesDir), { recursive: true });
        await fs.mkdir(examplesDir, { recursive: true });
        
        // Ensure examples directory exists
        try {
            await fs.access(examplesDir);
        } catch (error) {
            console.error('Examples directory not found:', error);
            throw new Error('Examples directory not found. Please ensure the project is properly set up.');
        }
        
        // Link the package globally
        try {
            execSync('bun link', { stdio: 'pipe' });
        } catch (error) {
            console.error('Failed to link package:', error);
            throw error;
        }
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
            // Execute the CLI command
            console.log('Executing CLI command from:', process.cwd());
            const result = execSync('absurd new test-cli-site', {
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
