import { expect, test, describe, beforeEach, afterEach } from '@jest/globals';
import { Components } from '../src/components.js';
import { Baker } from '../src/baker';
import { promises as fs } from 'fs';
import path from 'path';
import Database, { Database as DatabaseType } from 'better-sqlite3';

describe('Baker Template Integration', () => {
  let db: DatabaseType;
  let baker: Baker;
  let schema: string;
  beforeEach(async () => {
    if (!schema) {
      schema = await fs.readFile(path.join(__dirname, '../src/sql/schema.sql'), 'utf-8');
    }

    db = new Database(':memory:');
    // Initialize test database schema
    db.exec(schema);
    db.exec(`
            -- Add some test data
            INSERT INTO pages (path, slug, title, content, template, data, published_date)
            VALUES 
                ('test1', 'test1', 'Test Page 1', 'Content 1', 'default', '{}', '2024-01-01'),
                ('test2', 'test2', 'Test Page 2', 'Content 2', 'default', '{}', '2024-01-02');

            INSERT INTO assets (path, content, type)
            VALUES 
                ('site.yaml', '{"title": "Test Site"}', 'json'),
                ('test.css', 'body { color: red; }', 'css');
        `);

    baker = new Baker(db, true);
  });

  afterEach(() => {
    if (db) db.close();
  });

  describe('Template Baker Integration', () => {
    test('template can access baker.getAsset', () => {
      const template = Components.templates(`
                {{ baker.getAsset('test.css', 'css') }}
            `);

      const result = template({}, baker, {});
      expect(result).toContain('body { color: red; }');
    });

    test('template can access baker.getPage', () => {
      const template = Components.templates(`
                {{ baker.getPage('test1').title }}
            `);

      const result = template({}, baker, {});
      expect(result).toContain('Test Page 1');
    });

    test('template can access baker.getLatestPages', () => {
      const template = Components.templates(`
                {% for page in baker.getLatestPages(10) %}
                    <li>{{ page.title }}</li>
                {% endfor %}
            `);

      const result = template({}, baker, {});
      expect(result).toContain('Test Page 1');
      expect(result).toContain('Test Page 2');
    });

    test('template can access site metadata', () => {
      const template = Components.templates(`
                <h1>{{ site.title }}</h1>
            `);

      const result = template({}, baker, { title: 'Test Site' });
      expect(result).toContain('Test Site');
    });

    test('template can handle missing baker methods gracefully', () => {
      // Temporarily suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      const template = Components.templates(`
                {{ baker.nonexistentMethod() }}
            `);

      const result = template({}, baker, {});
      expect(result).toBe('');

      // Restore console.error
      console.error = originalError;
    });

    test('template can handle null page data', () => {
      const template = Components.templates(`
                {{ baker.getPage('nonexistent').title }}
            `);

      const result = template({}, baker, {});
      expect(result).toBe('');
    });
  });

  describe('getLatestPages with categories', () => {
    beforeEach(() => {
      // Add test pages with different categories
      db.exec(`
        INSERT INTO pages (slug, title, content, template, data, published_date)
        VALUES 
          ('blog1', 'Blog Post 1', 'Content 1', 'default', '{"category":"blog"}', '2024-01-01'),
          ('blog2', 'Blog Post 2', 'Content 2', 'default', '{"category":"blog"}', '2024-01-02'),
          ('news1', 'News Item 1', 'Content 3', 'default', '{"category":"news"}', '2024-01-03');
      `);
    });

    test('template handles string category parameter correctly', () => {
      const template = Components.templates(`
        {% set posts = baker.getLatestPages(10, 0, "blog") %}
        {% for post in posts %}
          <li>{{ post.title }}</li>
        {% endfor %}
      `);

      const result = template({}, baker, {});
      expect(result).toContain('Blog Post 1');
      expect(result).toContain('Blog Post 2');
      expect(result).not.toContain('News Item 1');
    });

    test('template handles category parameter from variable', () => {
      const template = Components.templates(`
        {% set category = "blog" %}
        {% set posts = baker.getLatestPages(10, 0, category) %}
        {% for post in posts %}
          <li>{{ post.title }}</li>
        {% endfor %}
      `);

      const result = template({}, baker, {});
      expect(result).toContain('Blog Post 1');
      expect(result).toContain('Blog Post 2');
      expect(result).not.toContain('News Item 1');
    });

    test('template handles category parameter from page data', () => {
      const template = Components.templates(`
        {% set posts = baker.getLatestPages(10, 0, page.data.category) %}
        {% for post in posts %}
          <li>{{ post.title }}</li>
        {% endfor %}
      `);

      const result = template({ data: { category: 'blog' } }, baker, {});
      expect(result).toContain('Blog Post 1');
      expect(result).toContain('Blog Post 2');
      expect(result).not.toContain('News Item 1');
    });

    test('debug category parameter type', () => {
      let capturedCategory;
      const originalGetLatestPages = baker.getLatestPages.bind(baker);
      baker.getLatestPages = (limit, offset, category) => {
        capturedCategory = category;
        console.log('Category type:', typeof category, 'Value:', category);
        return originalGetLatestPages(limit, offset, category);
      };

      const template = Components.templates(`
        {% set posts = baker.getLatestPages(10, 0, "blog") %}
        {{ posts | length }}
      `);

      template({}, baker, {});
      expect(typeof capturedCategory).toBe('string');
      expect(capturedCategory).toBe('blog');
    });

    test('handles undefined category parameter', () => {
      const template = Components.templates(`
        {% set posts = baker.getLatestPages(10, 0) %}
        {% for post in posts %}
          <li>{{ post.title }}</li>
        {% endfor %}
      `);

      const result = template({}, baker, {});
      expect(result).toContain('Blog Post 1');
      expect(result).toContain('Blog Post 2');
      expect(result).toContain('News Item 1');
    });

    test('handles category parameter with special characters', () => {
      // First add a page with special characters in category
      db.exec(`
        INSERT INTO pages (slug, title, content, template, data, published_date)
        VALUES ('special', 'Special Post', 'Content', 'default', '{"category":"blog-special"}', '2024-01-04');
      `);

      const template = Components.templates(`
        {% set posts = baker.getLatestPages(10, 0, "blog-special") %}
        {% for post in posts %}
          <li>{{ post.title }}</li>
        {% endfor %}
      `);

      const result = template({}, baker, {});
      expect(result).toContain('Special Post');
      expect(result).not.toContain('Blog Post 1');
    });
  });
});
