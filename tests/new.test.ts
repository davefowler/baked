import { expect, test, beforeEach, afterEach, jest, describe } from '@jest/globals';
import { mkdtemp, rm, readFile, mkdir, writeFile, stat } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import createSite from '../src/cli/new';

describe('createSite', () => {
    let tempDir: string;
    let starterDir: string;

    beforeEach(async () => {
        // Create temporary directories
        tempDir = await mkdtemp(join(tmpdir(), 'absurdsite-test-dest-'));
        starterDir = await mkdtemp(join(tmpdir(), 'absurdsite-test-starter-'));
        
        // Create starter directory structure
        await mkdir(join(starterDir, 'pages', 'blog'), { recursive: true });
        
        // Create test files
        await writeFile(join(starterDir, 'site.yaml'), 
            'title: <your site title>\nurl: <your site url>');
        
        await writeFile(join(starterDir, 'pages', 'manifest.json'), 
            JSON.stringify({
                name: "BakedSite",
                short_name: "Baked",
                description: "Baked is a static site generator for the modern web."
            }, null, 2));
            
        await writeFile(join(starterDir, 'pages', 'blog', 'meta.yaml'),
            'template: blog\nmimetype: text/markdown');
        // Mock the prompt function
        global.prompt = jest.fn((message: string | undefined) => {
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
        await rm(starterDir, { recursive: true, force: true });
    });

    test('should create a new site with correct configuration', async () => {
        // Temporarily override the starter directory path
        process.env.STARTER_DIR = starterDir;
        
        await createSite(tempDir);
        
        // Reset the environment
        delete process.env.STARTER_DIR;

        // Verify site.yaml
        const siteYaml = await readFile(join(tempDir, 'site.yaml'), 'utf-8');
        expect(siteYaml).toContain('name: Test Site');
        expect(siteYaml).toContain('url: test.com');
        expect(siteYaml).toContain('description: A test site');
        expect(siteYaml).toContain('author: Test Author');

        // Verify blog/meta.yaml
        const blogMeta = await readFile(join(tempDir, 'pages', 'blog', 'meta.yaml'), 'utf-8');
        expect(blogMeta).toContain('author: Test Author');

        // Verify manifest.json
        const manifest = JSON.parse(await readFile(join(tempDir, 'pages', 'manifest.json'), 'utf-8'));
        expect(manifest.name).toBe('Test Site');
        expect(manifest.short_name).toBe('Test');
        expect(manifest.description).toBe('A test site');
    });

    test('should use default values when prompts are empty', async () => {
        // Override prompt mock to return empty values
        global.prompt = jest.fn(() => '');

        await createSite(tempDir);

        // Verify default values in site.yaml
        const siteYaml = await readFile(`${tempDir}/site.yaml`, 'utf-8');
        expect(siteYaml).toContain('name: Baked Site');
        expect(siteYaml).toContain('url: yoursite.com');
        expect(siteYaml).toContain('description: A baked site');
        expect(siteYaml).toContain('author: A baker');
    });
});
