import { expect, test, describe } from "@jest/globals";
import { Components } from '../src/components.js';

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
            expect(result).toContain('{{ page.nonexistent }}');
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
            
            const result = passthrough();
            
            expect(result).toBe(content);
        });
    });
});
