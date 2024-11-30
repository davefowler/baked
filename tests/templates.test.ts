import { expect, test, describe } from "@jest/globals";
import { Components } from '../src/components';
import Database from "better-sqlite3";



describe('Template System', () => {
    describe('Basic Template Features', () => {
        test('renders variables correctly', () => {
            const template = Components.templates(`<h1>{{ page.title }}</h1>`);
            const result = template(
                { title: 'Test Title' },
                {},
                {}
            );
            expect(result).toBe('<h1>Test Title</h1>');
        });

        test('handles missing variables gracefully', () => {
            const template = Components.templates(`<h1>{{ page.nonexistent }}</h1>`);
            const result = template(
                {},
                {},
                {}
            );
            expect(result).toBe('<h1></h1>');
        });

        test('supports filters', () => {
            const template = Components.templates(`{{ page.content }}`);
            const result = template(
                { content: '<p>Test</p>' },
                {},
                {}
            );
            expect(result).toBe('&lt;p&gt;Test&lt;/p&gt;');
        });
    });

    describe('Template Inheritance', () => {
        test('extends base template correctly', () => {
            const rawBase = `
                <html>{% block content %}{% endblock %}</html>
            `;
            const child = Components.templates(`
                {% extends "base.html" %}
                {% block content %}Hello{% endblock %}
            `);
            
            // fake baker with getRawAsset
            const faker = {
                getRawAsset: (name: string) => {
                    if (name === 'base.html') return rawBase;
                    return null;
                }
            };
            
            const result = child({}, faker, {});
            expect(result).toContain('Hello');
            expect(result).toContain('<html>');
        });
    });

    describe('Conditional Logic', () => {
        test('if statements work correctly', () => {
            const template = Components.templates(`
                {% if page.metadata.show %}
                    <div>Shown</div>
                {% else %}
                    <div>Hidden</div>
                {% endif %}
            `);
            
            const shown = template({metadata: {show: true }}, {}, {});
            expect(shown).toContain('Shown');
            expect(shown).not.toContain('Hidden');
            
            const hidden = template({metadata: {show: false }}, {}, {});
            expect(hidden).toContain('Hidden');
            expect(hidden).not.toContain('Shown');
        });
    });

    describe('Loops', () => {
        test('for loops work correctly', () => {
            const template = Components.templates(`
                <ul>
                {% for item in page.metadata.items %}
                    <li>{{ item }}</li>
                {% endfor %}
                </ul>
            `);
            
            const result = template(
                { metadata: { items: ['one', 'two', 'three'] } },
                {},
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
                {},
                {}
            );
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        test('safe filter allows HTML', () => {
            const template = Components.templates(`{{ page.content }}`);
            const result = template(
                { content: '<div>Safe HTML</div>' },
                {},
                {}
            );
            expect(result).toBe('&lt;div&gt;Safe HTML&lt;/div&gt;');
        });
    });
});
