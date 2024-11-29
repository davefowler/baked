import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { Components } from '../src/components';
import { Database } from "sqlite3";
import { Baker } from '../baked/baker';

describe('Baker Template Integration', () => {
    let db: Database;
    let baker: Baker;

    beforeEach(() => {
        db = new Database(':memory:');
        
        // Initialize test database schema
        db.exec(`
            CREATE TABLE assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
            
            CREATE TABLE pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                template TEXT NOT NULL DEFAULT 'default',
                metadata TEXT,
                published_date TEXT
            );

            -- Add some test data
            INSERT INTO pages (slug, title, content, template, metadata, published_date)
            VALUES 
                ('test1', 'Test Page 1', 'Content 1', 'default', '{}', '2024-01-01'),
                ('test2', 'Test Page 2', 'Content 2', 'default', '{}', '2024-01-02');

            INSERT INTO assets (path, content, type)
            VALUES 
                ('site.yaml', 'title: Test Site', 'application/yaml'),
                ('test.css', 'body { color: red; }', 'css');
        `);

        baker = new Baker(db, true);
    });

    afterEach(() => {
        db.close();
    });

    describe('Template Baker Integration', () => {
        test('template can access baker.getAsset', () => {
            const template = Components.templates(`
                {{ baker.getAsset('test.css') }}
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
            const template = Components.templates(`
                {{ baker.nonexistentMethod() }}
            `);
            
            const result = template({}, baker, {});
            expect(result).toBe('');
        });

        test('template can handle null page data', () => {
            const template = Components.templates(`
                {{ baker.getPage('nonexistent').title }}
            `);
            
            const result = template({}, baker, {});
            expect(result).toBe('');
        });
    });
});
