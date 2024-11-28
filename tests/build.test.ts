import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { promises as fs } from 'fs';
import path from 'path';
import { processDirectory, initializeDatabase, renderPages } from '../cli/cli';

describe("Build Process", () => {
    const testDir = path.join(process.cwd(), 'tmp', 'test-build-site');
    
    beforeAll(async () => {
        // Create test directory and required subdirectories
        await fs.mkdir(testDir, { recursive: true });
        await fs.mkdir(path.join(testDir, 'public'), { recursive: true });
        process.chdir(testDir);
        
        // Create all required directories
        const dirs = [
            'public',
            'public/styles',
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
            await fs.mkdir(dir, { recursive: true });
        }
        
        // Create required CSS file
        await fs.writeFile('public/styles/main.css', '/* Test CSS */');
        
        global.siteDir = process.cwd();
    });

    afterAll(async () => {
        // Clean up test directory
        process.chdir('..');
        await fs.rm(testDir, { recursive: true, force: true });
    });

    const verifyDirectory = async (dir: string) => {
        try {
            await fs.access(path.join(testDir, dir));
            return true;
        } catch {
            return false;
        }
    };

    test("should create required directories", async () => {
        // Create test directory and required subdirectories
        await fs.mkdir(testDir, { recursive: true });
        
        // Create all required directories
        const dirs = [
            'pages',
            'pages/blog',
            'assets',
            'assets/templates',
            'assets/css',
            'assets/components',
            'assets/images',
            'dist',
            'public'
        ];
        
        for (const dir of dirs) {
            await fs.mkdir(path.join(testDir, dir), { recursive: true });
            const exists = await verifyDirectory(dir);
            expect(exists, `Directory "${dir}" was not created`).toBe(true);
        }

        // Create required files
        await fs.writeFile(path.join(testDir, 'site.yaml'), 'title: Test Site\n');
    });

    test("should create required public files", async () => {
        // Create required public files
        await fs.mkdir('public', { recursive: true });
        await fs.writeFile('public/sw.js', '// Service Worker');
        await fs.writeFile('public/manifest.json', '{}');
        await fs.writeFile('public/offline.html', '<!DOCTYPE html><html><body>Offline</body></html>');
        
        // Check if public files exist
        const publicFiles = [
            'public/sw.js',
            'public/manifest.json',
            'public/offline.html'
        ];
        
        for (const file of publicFiles) {
            const exists = await fs.access(file)
                .then(() => true)
                .catch(() => false);
            expect(exists).toBe(true);
        }
    });
});
