import { expect, test, describe } from "bun:test";
import { Components } from '../src/components';

describe('Component System', () => {
    describe('Template Component', () => {
        test('processes template variables correctly', () => {
            // Create mock baker
            const mockBaker = {
                getAsset: () => '',
                getPage: () => null,
                getLatestPages: () => []
            };

            const template = Components.templates(`
                <h1>${page.title}</h1>
                <div>${page.content}</div>
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
                <h1>${page.title}</h1>
                <div>${page.nonexistent}</div>
            `);
            
            const result = template(
                { title: 'Test' },
                mockBaker,
                {}
            );
            
            expect(result).toContain('Test');
            expect(result).toContain('${page.nonexistent}');
        });

        test('sanitizes dangerous input', () => {
            const template = Components.templates(`
                <div>${page.content}</div>
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
            
            const result = css({}, {}, {});
            
            expect(result).toContain('<style>');
            expect(result).toContain('body { color: red; }');
            expect(result).toContain('</style>');
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
