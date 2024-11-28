import { expect, test, beforeEach, afterEach, mock } from "bun:test";
import { mkdtemp, rm, readFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import mockFs from 'mock-fs';
import createSite from './new';

describe('createSite', () => {
    let tempDir: string;

    beforeEach(async () => {
        // Create a temporary directory for testing
        tempDir = await mkdtemp(join(tmpdir(), 'absurdsite-test-'));
        
        // Mock the file system
        mockFs({
            './starter': {
                'site.yaml': 'title: <your site title>\nurl: <your site url>',
                'pages': {
                    'manifest.json': JSON.stringify({
                        name: "BakedSite",
                        short_name: "Baked",
                        description: "Baked is a static site generator for the modern web."
                    }),
                    'blog': {
                        'meta.yaml': 'template: blog\nmimetype: text/markdown'
                    }
                }
            },
            [tempDir]: {}
        });

        // Mock the prompt function
        global.prompt = mock((question: string) => {
            switch(question) {
                case 'Site name:': return 'Test Site';
                case 'Site URL:': return 'test.com';
                case 'Site description:': return 'A test site';
                case 'Default author name:': return 'Test Author';
                default: return '';
            }
        });
    });

    afterEach(async () => {
        mockFs.restore();
        await rm(tempDir, { recursive: true, force: true });
    });

    test('should create a new site with correct configuration', async () => {
        await createSite(tempDir);

        // Verify site.yaml
        const siteYaml = await readFile(`${tempDir}/site.yaml`, 'utf-8');
        expect(siteYaml).toContain('name: Test Site');
        expect(siteYaml).toContain('url: test.com');
        expect(siteYaml).toContain('description: A test site');
        expect(siteYaml).toContain('author: Test Author');

        // Verify blog/meta.yaml
        const blogMeta = await readFile(`${tempDir}/pages/blog/meta.yaml`, 'utf-8');
        expect(blogMeta).toContain('author: Test Author');

        // Verify manifest.json
        const manifest = JSON.parse(await readFile(`${tempDir}/pages/manifest.json`, 'utf-8'));
        expect(manifest.name).toBe('Test Site');
        expect(manifest.short_name).toBe('Test');
        expect(manifest.description).toBe('A test site');
    });

    test('should use default values when prompts are empty', async () => {
        // Override prompt mock to return empty values
        global.prompt = mock(() => '');

        await createSite(tempDir);

        // Verify default values in site.yaml
        const siteYaml = await readFile(`${tempDir}/site.yaml`, 'utf-8');
        expect(siteYaml).toContain('name: Baked Site');
        expect(siteYaml).toContain('url: yoursite.com');
        expect(siteYaml).toContain('description: A baked site');
        expect(siteYaml).toContain('author: A baker');
    });
});
