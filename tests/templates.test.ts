import { expect, test, describe } from '@jest/globals';
import { Components } from '../src/components.js';

describe('Template System', () => {
  describe('Basic Template Features', () => {
    test('renders variables correctly', () => {
      const template = Components.templates(`<h1>{{ page.title }}</h1>`);
      const result = template({ title: 'Test Title' }, {}, {});
      expect(result).toBe('<h1>Test Title</h1>');
    });

    test('handles missing variables gracefully', () => {
      const template = Components.templates(`<h1>{{ page.nonexistent }}</h1>`);
      const result = template({}, {}, {});
      expect(result).toBe('<h1></h1>');
    });

    test('supports filters', () => {
      const template = Components.templates(`{{ page.content }}`);
      const result = template({ content: '<p>Test</p>' }, {}, {});
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

  test('safe filter working in template', () => {
    const page = {htmlTest: `Render this as <div>safe</div>`};
    // Double check that by default the template will escape strings
    const noSafeTemplate = Components.templates(`{{ page.htmlTest}}`);
    const noSafeResult = noSafeTemplate(page, {}, {});
    expect(noSafeResult).toContain('\<')
    expect(noSafeResult).toBe('')

    // Now try it with |safe and we should keep the divs
    const safeAppliedTemplate = Components.templates(`{{ page.htmlTest|safe }}`)
    const safeResult = safeAppliedTemplate(page, {}, {});
    expect(safeResult).toContain('<div>')
    expect(safeResult).toBe('')
  });

  test('date filter works',  () => {
    const testDate = new Date('2024-03-14');
    const page = { date: testDate };

    const formatT = Components.templates(`{{ page.date|date "yyyy-MM-dd" }}`);
    const formatResult = formatT(page, {}, {});
    expect(formatResult).toBe('2024-03-14');

    const formatT2 = Components.templates(`{{ page.date|date "yy-'W'ww" }}`);
    const formatResult2 = formatT2(page, {}, {});
    expect(formatResult2).toBe('24-W11');
  })

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

  describe('Template Variables and Loops', () => {
    test('set variables and for loops work together', () => {
      const template = Components.templates(`
        {% set items = ['apple', 'banana', 'orange'] %}
        <ul>
        {% for item in items %}
          <li>{{ item }}</li>
        {% endfor %}
        </ul>
      `);

      const result = template({}, {}, {});
      expect(result).toContain('<li>apple</li>');
      expect(result).toContain('<li>banana</li>');
      expect(result).toContain('<li>orange</li>');
    });

    test('set variables from baker methods work', () => {
      const template = Components.templates(`
        {% set fruits = baker.getAsset('fruits', 'json') %}
        <ul>
        {% for fruit in fruits %}
          <li>{{ fruit }}</li>
        {% endfor %}
        </ul>
      `);

      const baker = {
        getAsset: (path: string, type: string) => {
          if (path === 'fruits' && type === 'json') {
            return ['apple', 'banana', 'orange'];
          }
          return null;
        }
      };

      const result = template({}, baker, {});
      expect(result).toContain('<li>apple</li>');
      expect(result).toContain('<li>banana</li>');
      expect(result).toContain('<li>orange</li>');
    });
  });
});
