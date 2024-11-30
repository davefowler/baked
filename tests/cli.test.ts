import { expect, test, beforeEach, afterEach, describe, jest } from "@jest/globals";
import { mkdtemp, rm, readFile, mkdir, writeFile, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import createSite from '../src/cli/new';
import bake from '../src/cli/build';
import startServer from '../src/cli/serve';
import Database from 'better-sqlite3';
import request from 'supertest';
import { Server } from 'http';

// Helper functions
const exists = async (path: string): Promise<boolean> => {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
};

const ensureDir = async (dir: string) => {
    try {
        await mkdir(dir, { recursive: true });
    } catch (err: any) {
        if (err.code !== 'EEXIST') throw err;
    }
};

describe('CLI Commands', () => {
    let tempDir: string;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'baked-test-'));
        // Mock prompt responses globally
        global.prompt = jest.fn((message?: string) => {
            switch(message) {
                case 'Site name:': return 'Test Site';
                case 'Site URL:': return 'test.com';
                case 'Site description:': return 'A test site';
                case 'Default author name:': return 'Test Author';
                default: return '';
            }
        });
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
    });

    describe('new/starter command', () => {
        test('creates correct directory structure', async () => {
            await createSite(tempDir);
            
            // Check core directories exist
            const dirs = ['pages', 'assets', 'assets/templates', 'assets/css'];
            for (const dir of dirs) {
                const itExists = await exists(join(tempDir, dir));
                expect(itExists).toBe(true);
            }
        });

        test('sets site configuration from prompts', async () => {
            // Mock prompt responses
            global.prompt = jest.fn((message?: string) => {
                switch(message) {
                    case 'Site name:': return 'Test Site';
                    case 'Site URL:': return 'test.com';
                    case 'Site description:': return 'A test site';
                    case 'Default author name:': return 'Test Author';
                    default: return '';
                }
            });

            await createSite(tempDir);
            
            const siteYaml = await readFile(join(tempDir, 'site.yaml'), 'utf8');
            expect(siteYaml).toContain('name: Test Site');
            expect(siteYaml).toContain('url: test.com');
        });
    });

    describe('build/oven command', () => {
        beforeEach(async () => {
            // Setup test site
            // Setup test site structure
            await createSite(tempDir);
            
            // Create pages directory
            await ensureDir(join(tempDir, 'pages'));
            
            // Create test content
            await writeFile(
                join(tempDir, 'pages', 'test.md'), 
                '---\ntitle: Test\n---\nTest content'
            );
        });

        test('builds site with default options', async () => {
            process.chdir(tempDir); // Change working directory for build
            await bake(tempDir, false); // no drafts
            
            const distDb = join(tempDir, 'dist/site.db');
            expect(await exists(distDb)).toBe(true);
            
            const db = new Database(distDb);
            const page = db.prepare('SELECT * FROM pages WHERE slug = ?')
                          .get('test');
            db.close(); // Properly close the database connection
            expect(page!).toBeDefined();
            expect((page as {title: string}).title).toBe('Test');
        });

        test('handles draft pages correctly', async () => {
            await writeFile(join(tempDir, 'pages/draft.md'),
                '---\ntitle: Draft\nisDraft: true\n---\nDraft content');
            
            // Build without drafts
            await bake(tempDir, false);
            let db = new Database(join(tempDir, 'dist/site.db'));
            let draft = db.prepare('SELECT * FROM pages WHERE slug = ?')
                         .get('draft');
            expect(draft).toBeUndefined();
            // Build with drafts
            await bake(tempDir, true);
            db = new Database(join(tempDir, 'dist/site.db'));   
            draft = db.prepare('SELECT * FROM pages WHERE slug = ?')
                     .get('draft');
            expect(draft).toBeDefined();
        });
    });

    describe('serve command', () => {
        let server: Server;
        
        afterEach(() => {
            if (server?.listening) {
                server.close();
            }
        });

        test('serves static files correctly', async () => {
            // Create test dist directory with content
            await ensureDir(join(tempDir, 'dist'));
            await writeFile(join(tempDir, 'dist', 'index.html'), '<html><body>Test</body></html>');
            
            process.chdir(tempDir);
            server = await startServer();
            
            await request(`http://localhost:4242`)  // Use the actual server URL
                .get('/')
                .expect(200)
                .expect((res) => {
                    expect(res.text).toContain('Test');
                });
            
            await request(`http://localhost:4242`)
                .get('/notfound')
                .expect(404);
        });
    });
});