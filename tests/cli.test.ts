import { expect, test, beforeEach, afterEach, describe, jest } from "@jest/globals";
import { rm, readFile, mkdir, writeFile, stat } from 'fs/promises';
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
    const TEST_DIR = join(process.cwd(), 'tmp/cli-test');

    beforeAll(async () => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    beforeEach(async () => {
        await mkdir(TEST_DIR, { recursive: true });
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
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    describe('new/starter command', () => {
        test('creates correct directory structure', async () => {
            await createSite(TEST_DIR);
            
            // Check core directories exist
            const dirs = ['pages', 'assets', 'assets/templates', 'assets/css'];
            for (const dir of dirs) {
                const itExists = await exists(join(TEST_DIR, dir));
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

            await createSite(TEST_DIR);
            
            const siteYaml = await readFile(join(TEST_DIR, 'site.yaml'), 'utf8');
            expect(siteYaml).toContain('name: Test Site');
            expect(siteYaml).toContain('url: test.com');
        });
    });

    describe('build/oven command', () => {
        beforeEach(async () => {
            // Setup test site
            // Setup test site structure
            await createSite(TEST_DIR);
            
            // Create pages directory
            await ensureDir(join(TEST_DIR, 'pages'));
            
            // Create test content
            await writeFile(
                join(TEST_DIR, 'pages', 'test.md'), 
                '---\ntitle: Test\n---\nTest content'
            );
        });

        test('builds site with default options', async () => {
            process.chdir(TEST_DIR); // Change working directory for build
            await bake(TEST_DIR, false); // no drafts
            
            const distDb = join(TEST_DIR, 'dist/site.db');
            expect(await exists(distDb)).toBe(true);
            
            const db = new Database(distDb);
            const page = db.prepare('SELECT * FROM pages WHERE path = ?')
                          .get('pages/test.md');
            db.close(); // Properly close the database connection
            expect(page).toBeDefined();
            expect((page as {title: string}).title).toBe('Test');
        });

        test('handles draft pages correctly', async () => {
            await writeFile(join(TEST_DIR, 'pages/draft.md'),
                '---\ntitle: Draft\nisDraft: true\n---\nDraft content');
            
            // Build without drafts
            await bake(TEST_DIR, false);
            let db = new Database(join(TEST_DIR, 'dist/site.db'));
            console.log('all pages', db.prepare('SELECT * FROM pages').all());
            let draft = db.prepare('SELECT * FROM pages WHERE path = ?')
                         .get('draft');
            expect(draft).toBeUndefined();
            // Build with drafts
            await bake(TEST_DIR, true);
            db = new Database(join(TEST_DIR, 'dist/site.db'));   
            draft = db.prepare('SELECT * FROM pages WHERE path = ?')
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
            await ensureDir(join(TEST_DIR, 'dist'));
            await writeFile(join(TEST_DIR, 'dist', 'index.html'), '<html><body>Test</body></html>');
            
            process.chdir(TEST_DIR);
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
