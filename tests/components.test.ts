import { expect, test, describe, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import * as cheerio from 'cheerio';

describe("Template Components", () => {
    let db: Database;
    let absurd: any;

    beforeEach(() => {
        // Setup fresh database for each test
        db = new Database(":memory:");
        db.exec(`
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);

        // Create absurd helper object
        absurd = {
            getAsset(name: string, type: string = null) {
                const path = type ? `${type}/${name}` : name;
                const asset = db.prepare('SELECT content, type FROM assets WHERE path = ?').get(path);
                if (!asset) return null;

                // Get the component handler for this type
                const componentPath = `../assets/components/${asset.type}.js`;
                const component = require(componentPath);
                return component(asset.content);
            },

            renderPage(page: any, site: any) {
                const template = this.getAsset(page.template, 'templates');
                if (!template) {
                    throw new Error(`Template ${page.template} not found`);
                }
                return template.render(this, page, site);
            }
        };

        // Register base template
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'base.html',
            '<!DOCTYPE html><html><head><title>${page.title}</title></head><body>${content}</body></html>',
            'templates'
        );
    });

    test("should handle basic template rendering", () => {
        // Add a simple template
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'simple.html',
            '<div>${page.title}</div>',
            'templates'
        );

        const template = absurd.getAsset('simple.html', 'templates');
        const result = template.render(absurd, {
            title: "Hello World"
        }, {});

        expect(result).toBe("<div>Hello World</div>");
    });

    test("should handle template inheritance", () => {
        // Add a child template that extends base
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'child.html',
            '{% extends "base" %}<h1>${page.title}</h1>',
            'templates'
        );

        const template = absurd.getAsset('child.html', 'templates');
        const result = template.render(absurd, {
            title: "Test Page"
        }, {});

        const $ = cheerio.load(result);
        expect($('title').text()).toBe("Test Page");
        expect($('h1').text()).toBe("Test Page");
    });

    test("should handle site-wide data", () => {
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'site-data.html',
            '<div>${site.title} - ${page.title}</div>',
            'templates'
        );

        const template = absurd.getAsset('site-data.html', 'templates');
        const result = template.render(absurd, {
            title: "Page Title"
        }, {
            title: "Site Title"
        });

        expect(result).toBe("<div>Site Title - Page Title</div>");
    });

    test("should handle nested metadata", () => {
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'metadata.html',
            '<div>${page.metadata?.author} - ${page.metadata?.date}</div>',
            'templates'
        );

        const template = absurd.getAsset('metadata.html', 'templates');
        const result = template.render(absurd, {
            metadata: {
                author: "John Doe",
                date: "2024-01-01"
            }
        }, {});

        expect(result).toContain("John Doe - 2024-01-01");
    });

    test("should handle missing templates gracefully", () => {
        expect(() => {
            absurd.getAsset('nonexistent.html', 'templates');
        }).toBeNull();
    });

    test("should handle other component types", () => {
        // Test CSS component
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'style.css',
            '.test { color: red; }',
            'css'
        );

        const cssComponent = absurd.getAsset('style.css', 'css');
        const cssResult = cssComponent.render(absurd, {}, {});
        expect(cssResult).toBe('<style>.test { color: red; }</style>');

        // Test JavaScript component
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'script.js',
            'console.log("test");',
            'javascript'
        );

        const jsComponent = absurd.getAsset('script.js', 'javascript');
        const jsResult = jsComponent.render(absurd, {}, {}, false, true);
        expect(jsResult).toBe('<script defer>console.log("test");</script>');
    });

    test("should handle image components", () => {
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'test.jpg',
            'base64encodedcontent',
            'image'
        );

        const imageComponent = absurd.getAsset('test.jpg', 'image');
        const result = imageComponent.render(absurd, {}, {}, 'Alt text', 'test-class');
        
        const $ = cheerio.load(result);
        const img = $('img');
        expect(img.attr('src')).toContain('base64encodedcontent');
        expect(img.attr('alt')).toBe('Alt text');
        expect(img.attr('class')).toBe('test-class');
    });

    test("should handle SVG components", () => {
        const svgContent = '<svg><circle cx="50" cy="50" r="40"/></svg>';
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'icon.svg',
            svgContent,
            'svg'
        );

        const svgComponent = absurd.getAsset('icon.svg', 'svg');
        const result = svgComponent.render(absurd, {}, {}, 'icon-class');
        
        const $ = cheerio.load(result);
        expect($('div.icon-class svg').length).toBe(1);
    });
});
