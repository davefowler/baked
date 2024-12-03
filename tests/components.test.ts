import { expect, test, describe } from "@jest/globals";
import { Components, cleanAssetName } from '../src/components.js';

describe('Component System', () => {
    describe('Template Component', () => {
        test('processes template variables correctly', () => {
            // Create mock baker with all required methods
            const mockBaker = {
                getAsset: () => '',
                getPage: () => null,
                getLatestPages: () => [],
                getPrevPage: () => null,
                getNextPage: () => null,
                search: () => [],
                query: () => []
            };

            const template = Components.templates(`
                <h1>{{ page.title }}</h1>
                <div>{{ page.content }}</div>
            `);
            
            const result = template(
                { title: 'Test Title', content: 'Test Content' },
                mockBaker,
                {}
            );
            
            expect(result).toContain('Test Title');
            expect(result).toContain('Test Content');
        });

        test('handles missing variables gracefully', () => {
            const template = Components.templates(`
                <h1>{{ page.title }}</h1>
                <div>{{ page.nonexistent }}</div>
            `);
            
            const result = template(
                { title: 'Test' },
                {},
                {}
            );
            
            expect(result).toContain('Test');
            expect(result).toContain('<div></div>');
        });

        test('sanitizes dangerous input', () => {
            const template = Components.templates(`
                <div>{{ page.content }}</div>
            `);
            
            const result = template(
                { content: '<script>alert("xss")</script>' },
                {},
                {}
            );
            
            expect(result).not.toContain('<script>');
        });
    });

    describe('CSS Component', () => {
        test('wraps CSS in style tags', () => {
            const css = Components.css(`
                body { color: red; }
            `);
                        
            expect(css).toContain('<style>');
            expect(css).toContain('body { color: red; }');
            expect(css).toContain('</style>');
        });
    });

    describe('PassThrough Component', () => {
        test('returns content unchanged', () => {
            const content = 'test content';
            const passthrough = Components.images(content);            
            expect(passthrough).toBe(content);
        });
    });
});

describe('cleanAssetName', () => {
    test('adds .html extension to template names without extension', () => {
        const result = cleanAssetName('about', 'templates');
        expect(result).toBe('about.html');
    });

    test('does not add .html if already has extension', () => {
        const result = cleanAssetName('about.njk', 'templates');
        expect(result).toBe('about.njk');
    });

    test('removes leading slash', () => {
        const result = cleanAssetName('/about.html', 'templates');
        expect(result).toBe('about.html');
    });

    test('removes type prefix from path', () => {
        const result = cleanAssetName('templates/about.html', 'templates');
        expect(result).toBe('about.html');
    });

    test('handles nested paths correctly', () => {
        const result = cleanAssetName('templates/blog/post.html', 'templates');
        expect(result).toBe('blog/post.html');
    });

    test('does not modify non-template assets', () => {
        const result = cleanAssetName('images/photo', 'images');
        expect(result).toBe('photo');
    });
});
