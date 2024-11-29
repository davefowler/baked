import { expect, test, describe } from "bun:test";
import { Components } from '../src/components';
import { Database } from "sqlite3";


const mockBaker = {
    getAsset: (path: string) => {
        return () => `<h1>${path}</h1>`;
    },
    getPage: (path: string) => {
        return () => `<h1>${path}</h1>`;
    },
    getLatestPages: () => {
        return () => `<h1>Latest Pages</h1>`;
    },
    getPrevPage: () => {
        return () => `<h1>Prev Page</h1>`;
    },
    getNextPage: () => {
        return () => `<h1>Next Page</h1>`;
    },
    search: () => {
        return () => `<h1>Search</h1>`;
    },
    query: () => {
        return () => `<h1>Query</h1>`;
    }
};

describe('Template System', () => {
    describe('Basic Template Features', () => {
        test('renders variables correctly', () => {
            const template = Components.templates(`<h1>{{ page.title }}</h1>`);
            const result = template(
                { title: 'Test Title' },
                mockBaker,
                {}
            );
            expect(result).toBe('<h1>Test Title</h1>');
        });

        test('handles missing variables gracefully', () => {
            const template = Components.templates(`<h1>{{ page.nonexistent }}</h1>`);
            const result = template(
                {},
                mockBaker,
                {}
            );
            expect(result).toBe('<h1></h1>');
        });

        test('supports filters', () => {
            const template = Components.templates(`{{ page.content|safe }}`);
            const result = template(
                { content: '<p>Test</p>' },
                mockBaker,
                {}
            );
            expect(result).toBe('<p>Test</p>');
        });
    });

    describe('Template Inheritance', () => {
        test('extends base template correctly', () => {
            const base = Components.templates(`
                <html>{% block content %}{% endblock %}</html>
            `);
            const child = Components.templates(`
                {% extends "base.html" %}
                {% block content %}Hello{% endblock %}
            `);
            
            // Mock baker with getAsset
            const baker = {
                ...mockBaker, 
                getAsset: (name: string) => {
                    if (name === 'base.html') return base;
                    return null;
                }
            };
            
            const result = child({}, baker, {});
            expect(result).toContain('Hello');
            expect(result).toContain('<html>');
        });
    });

    describe('Conditional Logic', () => {
        test('if statements work correctly', () => {
            const template = Components.templates(`
                {% if page.show %}
                    <div>Shown</div>
                {% else %}
                    <div>Hidden</div>
                {% endif %}
            `);
            
            const shown = template({ show: true }, {}, {});
            expect(shown).toContain('Shown');
            expect(shown).not.toContain('Hidden');
            
            const hidden = template({ show: false }, {}, {});
            expect(hidden).toContain('Hidden');
            expect(hidden).not.toContain('Shown');
        });
    });

    describe('Loops', () => {
        test('for loops work correctly', () => {
            const template = Components.templates(`
                <ul>
                {% for item in page.items %}
                    <li>{{ item }}</li>
                {% endfor %}
                </ul>
            `);
            
            const result = template(
                { items: ['one', 'two', 'three'] },
                mockBaker,
                {}
            );
            expect(result).toContain('<li>one</li>');
            expect(result).toContain('<li>two</li>');
            expect(result).toContain('<li>three</li>');
        });
    });

    describe('Security', () => {
        test('escapes HTML by default', () => {
            const template = Components.templates(`{{ page.content }}`);
            const result = template(
                { content: '<script>alert("xss")</script>' },
                mockBaker,
                {}
            );
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        test('safe filter allows HTML', () => {
            const template = Components.templates(`{{ page.content|safe }}`);
            const result = template(
                { content: '<div>Safe HTML</div>' },
                mockBaker,
                {}
            );
            expect(result).toBe('<div>Safe HTML</div>');
        });
    });
});
