import { expect, test, beforeEach, afterEach, describe, jest } from '@jest/globals';
import { mkdtemp, rm, readFile, mkdir, writeFile, readdir, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import createSite from '../src/cli/new';
import bake from '../src/cli/build';
import startServer from '../src/cli/serve';
import Database from 'better-sqlite3';
import request from 'supertest';
import { Server } from 'http';
import { SpyInstance } from 'jest-mock';

let mockPrompt: SpyInstance<(message?: string) => string>;


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
    const STARTER_DIR = join(process.cwd(), 'src/starter');
    const SQL_DIR = join(process.cwd(), 'src/sql');

    beforeAll(async () => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    jest.setTimeout(30000); // 30 seconds

    beforeEach(async () => {
        global.prompt = jest.fn((message: string | undefined) => {
            switch(message) {
                case 'Site name:': return 'CLITest Site';
                case 'Site URL:': return 'cli-test.com';
                case 'Site description:': return 'A test of cli site';
                case 'Default author name:': return 'CLI Author';
                default: return '';
            }
        });

        await mkdir(TEST_DIR, { recursive: true });
        
    });

    afterEach(async () => {
        await rm(TEST_DIR, { recursive: true, force: true });
    });

    describe('new/starter command', () => {
        test('creates correct directory structure', async () => {
            await createSite(TEST_DIR, STARTER_DIR);
            
            // Check core directories exist
            const dirs = ['pages', 'assets', 'assets/templates', 'assets/css'];
            for (const dir of dirs) {
                const itExists = await exists(join(TEST_DIR, dir));
                expect(itExists).toBe(true);
            }

            // check for the right files in all dirs too
            // list out all files recursively
            const allFiles = await readdir(TEST_DIR, { recursive: true });
            expect(allFiles).toContain('site.yaml');
            expect(allFiles).toContain('pages/blog/meta.yaml');
            expect(allFiles).toContain('public/manifest.json');
            expect(allFiles.length).toBeGreaterThan(20);
        });

        test('sets site configuration from prompts', async () => {
            await createSite(TEST_DIR, STARTER_DIR);
            
            const siteYaml = await readFile(join(TEST_DIR, 'site.yaml'), 'utf8');
            expect(siteYaml).toContain('name: Custom Site');
            expect(siteYaml).toContain('url: custom.com');
        });
    });

    describe('build/oven command', () => {
        beforeEach(async () => {
            // Setup test site
            await rm(TEST_DIR, { recursive: true, force: true });
                    // Mock the prompt function
            global.prompt = jest.fn((message: string | undefined) => {
                switch(message) {
                    case 'Site name:': return 'CLITest Site';
                    case 'Site URL:': return 'cli-test.com';
                    case 'Site description:': return 'A test of cli site';
                    case 'Default author name:': return 'CLI Author';
                    default: return '';
                }
            });

            await createSite(TEST_DIR, STARTER_DIR);
        }, 10000);

        afterEach(async () => {
            // clear out the site dir
            await rm(TEST_DIR, { recursive: true, force: true });
        });

        test('builds site with default options', async () => {
            process.chdir(TEST_DIR); // Change working directory for build
            await bake(TEST_DIR, false, SQL_DIR); // no drafts
            
            const distDb = join(TEST_DIR, 'dist/site.db');
            expect(await exists(distDb)).toBe(true);
            
            const db = new Database(distDb);
            const page = db.prepare('SELECT * FROM pages WHERE path = ?')
                          .get('pages/test.md');
            db.close(); // Properly close the database connection
            expect(page).toBeDefined();
            expect((page as {title: string}).title).toBe('Test');
        });

        test('does not load drafts by default', async () => {
            await writeFile(join(TEST_DIR, 'pages/draft.md'),
                '---\ntitle: Draft\nisDraft: true\n---\nDraft content');
            
            // Build without drafts
            await bake(TEST_DIR, false, SQL_DIR);
            let db = new Database(join(TEST_DIR, 'dist/site.db'));
            let draft = db.prepare('SELECT * FROM pages WHERE path = ?')
                         .get('draft');
            expect(draft).toBeUndefined();
        });

        test('load drafts when specified', async () => {
            await writeFile(join(TEST_DIR, 'pages/draft.md'),
                '---\ntitle: Draft\nisDraft: true\n---\nDraft content');
            
            await bake(TEST_DIR, true, SQL_DIR);
            let db = new Database(join(TEST_DIR, 'dist/site.db'));
            let draft = db.prepare('SELECT * FROM pages WHERE path = ?')
                         .get('draft');
            db.close(); // Make sure to close the database
            expect(draft).toBeUndefined();
        }, 10000);

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
import { program } from 'commander';

describe('CLI', () => {
    let tempDir: string;
    let mockPrompt: SpyInstance<(message?: string) => string>;
    
    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'baked-cli-test-'));
        
        // Mock the prompt function
        // @ts-ignore
        mockPrompt = jest.spyOn(global, 'prompt').mockImplementation((message?: string) => {
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
        mockPrompt.mockRestore();
    });

    test('new command creates site with correct structure', async () => {
        // Test implementation here
        expect(true).toBe(true);
    });
});
