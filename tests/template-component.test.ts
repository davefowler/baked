import { expect, test, describe, beforeEach } from "bun:test";
import { Database } from "bun:sqlite";
import * as cheerio from 'cheerio';
import path from 'path';
import { absurd } from 'absurd';

describe("Template Component", () => {
    let db: Database;
    let absurd: any;
    let templateComponent: any;

    beforeEach(() => {
        // Setup fresh database
        db = new Database(":memory:");
        db.exec(`
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);

        // Load the template component handler
        templateComponent = require('../assets/components/template.js');
    });

    test("should render basic template with variables", () => {
        const template = templateComponent(`
            <div>
                <h1>${page.title}</h1>
                <p>${page.content}</p>
            </div>
        `);

        const result = template.render(absurd, {
            title: "Test Title",
            content: "Test Content"
        }, {});

        const $ = cheerio.load(result);
        expect($('h1').text()).toBe("Test Title");
        expect($('p').text()).toBe("Test Content");
    });

    test("should handle template inheritance", () => {
        // Register base template in database
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'base.html',
            `<!DOCTYPE html>
            <html>
                <head><title>${page.title}</title></head>
                <body>${content}</body>
            </html>`,
            'templates'
        );

        // Create child template that extends base
        const template = templateComponent(`
            {% extends "base" %}
            <div class="content">
                <h1>${page.title}</h1>
                ${page.content}
            </div>
        `);

        const result = template.render(absurd, {
            title: "Child Page",
            content: "Child Content"
        }, {});

        const $ = cheerio.load(result);
        expect($('title').text()).toBe("Child Page");
        expect($('.content h1').text()).toBe("Child Page");
        expect($('.content').text().includes("Child Content")).toBe(true);
    });

    test("should handle site-wide variables", () => {
        const template = templateComponent(`
            <header>
                <h1>${site.title}</h1>
                <nav>${site.navigation}</nav>
            </header>
            <main>${page.content}</main>
        `);

        const result = template.render(absurd, {
            content: "Page Content"
        }, {
            title: "My Site",
            navigation: "<a href='/'>Home</a>"
        });

        const $ = cheerio.load(result);
        expect($('header h1').text()).toBe("My Site");
        expect($('nav').html()).toBe("<a href='/'>Home</a>");
    });

    test("should handle nested data structures", () => {
        const template = templateComponent(`
            <article>
                <header>
                    <h1>\${page.title}</h1>
                    \${page.metadata?.date ? \`<time>\${page.metadata.date}</time>\` : ''}
                    \${page.metadata?.author ? \`<author>\${page.metadata.author}</author>\` : ''}
                </header>
                <div class="content">\${page.content}</div>
                \${page.metadata?.tags?.map(tag => \`<span class="tag">\${tag}</span>\`).join('')}
            </article>
        `);

        const result = template.render(absurd, {
            title: "Test Post",
            content: "Post content",
            metadata: {
                date: "2024-01-01",
                author: "John Doe",
                tags: ["test", "example"]
            }
        }, {});

        const $ = cheerio.load(result);
        expect($('h1').text()).toBe("Test Post");
        expect($('time').text()).toBe("2024-01-01");
        expect($('author').text()).toBe("John Doe");
        expect($('.tag').length).toBe(2);
        expect($('.tag').first().text()).toBe("test");
    });

    test("should handle missing parent template gracefully", () => {
        const template = templateComponent(`{% extends "nonexistent" %}`);

        expect(() => {
            template.render(absurd, {}, {});
        }).toThrow("Parent template nonexistent not found");
    });

    test("should handle invalid template syntax gracefully", () => {
        const template = templateComponent(`\${invalid syntax}`);

        expect(() => {
            template.render(absurd, {}, {});
        }).toThrow();
    });

    test("should handle conditional rendering", () => {
        const template = templateComponent(`
            <div>
                \${page.showTitle ? \`<h1>\${page.title}</h1>\` : ''}
                <p>\${page.content}</p>
            </div>
        `);

        const withTitle = template.render(absurd, {
            showTitle: true,
            title: "Test Title",
            content: "Test Content"
        }, {});

        const withoutTitle = template.render(absurd, {
            showTitle: false,
            title: "Test Title",
            content: "Test Content"
        }, {});

        const $with = cheerio.load(withTitle);
        const $without = cheerio.load(withoutTitle);

        expect($with('h1').length).toBe(1);
        expect($without('h1').length).toBe(0);
        expect($with('p').text()).toBe("Test Content");
        expect($without('p').text()).toBe("Test Content");
    });

    test("should handle array iteration", () => {
        const template = templateComponent(`
            <ul>
                \${page.items?.map(item => \`
                    <li>\${item.text}</li>
                \`).join('')}
            </ul>
        `);

        const result = template.render(absurd, {
            items: [
                { text: "Item 1" },
                { text: "Item 2" },
                { text: "Item 3" }
            ]
        }, {});
        const $ = cheerio.load(result);
        expect($('li').length).toBe(3);
        expect($('li').first().text().trim()).toBe("Item 1");
    });

    test("should handle nested template calls", () => {
        // Register a partial template
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'header.html',
            '<header><h1>${page.title}</h1></header>',
            'templates'
        );

        const template = templateComponent(`
            \${absurd.getAsset('header.html', 'templates').render(absurd, page, site)}
            <main>\${page.content}</main>
        `);

        const result = template.render(absurd, {
            title: "Page Title",
            content: "Page Content"
        }, {});

        const $ = cheerio.load(result);
        expect($('header h1').text()).toBe("Page Title");
        expect($('main').text()).toBe("Page Content");
    });
});
