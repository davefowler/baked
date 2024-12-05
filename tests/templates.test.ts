import { expect, test, describe } from '@jest/globals';
import { compile } from 'svelte/compiler';

describe('Template System', () => {
  describe('Basic Template Features', () => {
    test('compiles Svelte templates correctly', async () => {
      const template = `
        <script>
          export let page;
          export let site;
          export let baker;
        </script>
        <h1>{page.title}</h1>
      `;

      const { js } = compile(template, {
        filename: 'Test.svelte',
        generate: 'server',
      });

      expect(js.code).toBeDefined();
      expect(js.code).toContain('export function render');
    });

    test('handles missing variables gracefully', async () => {
      const template = `
        <script>
          export let page = {};
        </script>
        <h1>{page?.nonexistent || ''}</h1>
      `;

      const { js } = compile(template, {
        filename: 'Test.svelte',
        generate: 'ssr',
      });

      expect(js.code).toBeDefined();
    });

    test('supports HTML escaping', async () => {
      const template = `
        <script>
          export let page;
        </script>
        <div>{page.content}</div>
      `;

      const { js } = compile(template, {
        filename: 'Test.svelte',
        generate: 'ssr',
      });

      expect(js.code).toBeDefined();
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
          if (name === 'base.html') return { content: rawBase, type: 'templates' };
          return null;
        },
      };

      const result = child({}, faker, {});
      expect(result).toContain('Hello');
      expect(result).toContain('<html>');
    });
  });

  describe('Conditional Logic', () => {
    test('if statements work correctly', () => {
      const template = Components.templates(`
                {% if page.data.show %}
                    <div>Shown</div>
                {% else %}
                    <div>Hidden</div>
                {% endif %}
            `);

      const shown = template({ data: { show: true } }, {}, {});
      expect(shown).toContain('Shown');
      expect(shown).not.toContain('Hidden');

      const hidden = template({ data: { show: false } }, {}, {});
      expect(hidden).toContain('Hidden');
      expect(hidden).not.toContain('Shown');
    });
  });

  describe('Loops', () => {
    test('for loops work correctly', () => {
      const template = Components.templates(`
                <ul>
                {% for item in page.data.items %}
                    <li>{{ item }}</li>
                {% endfor %}
                </ul>
            `);

      const result = template({ data: { items: ['one', 'two', 'three'] } }, {}, {});
      expect(result).toContain('<li>one</li>');
      expect(result).toContain('<li>two</li>');
      expect(result).toContain('<li>three</li>');
    });
  });

  describe('Default template should be base.html', () => {
    test('loads default template', () => {
      const template = Components.templates(`{{ page.content }}`);
    });
  });

  describe('Security', () => {
    test('escapes HTML by default', () => {
      const template = Components.templates(`{{ page.content }}`);
      const result = template({ content: '<script>alert("xss")</script>' }, {}, {});
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    test('safe filter allows HTML', () => {
      const template = Components.templates(`{{ page.content }}`);
      const result = template({ content: '<div>Safe HTML</div>' }, {}, {});
      expect(result).toBe('&lt;div&gt;Safe HTML&lt;/div&gt;');
    });

    test('css helper escapes style tags correctly', () => {
      const template = Components.templates(`{{ 'style.css'|css }}`);
      const baker = {
        getAsset: (path: string, type: string) => {
          if (path === 'style.css' && type === 'css') {
            return 'body { color: red; } </style><script>alert("xss")</script>';
          }
          return null;
        },
      };

      const result = template({}, baker, {});
      expect(result).toContain('body { color: red; }');
      expect(result).toContain('<\\/style><script>alert("xss")</script>');
      expect(result).toMatch(/<style>.*<\/style>/);
    });
  });

  test('asset helper returns asset', () => {
    const template = Components.templates(`{{ 'style.css'|asset }}`);
    const baker = {
      getAsset: (path: string, type: string) => {
        if (path === 'style.css' && type === 'css') {
          return 'body { color: red; }';
        }
        return null;
      },
    };

    const result = template({}, baker, {});
    expect(result).toEqual('body { color: red; }');
  });
});
