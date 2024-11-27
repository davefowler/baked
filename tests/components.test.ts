import { expect, test, describe, beforeEach } from "bun:test";
import { TemplateEngine } from "../templates/engine";
import { Database } from "bun:sqlite";
import * as cheerio from 'cheerio';

describe("TemplateEngine", () => {
    let engine: TemplateEngine;
    let db: Database;

    beforeEach(() => {
        db = new Database(":memory:");
        
        // Create required tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);

        // Insert minimum required assets for tests
        const testAssets = [
            {
                path: 'base.html',
                content: '<!DOCTYPE html><html><head><title>${data.title}</title></head><body>${data.blocks?.get("content") ?? ""}</body></html>',
                type: 'templates'
            },
            {
                path: 'test-component.js',
                content: 'module.exports = (content) => ({ render: () => `<div>${content}</div>` });',
                type: 'components'
            }
        ];

        const insertStmt = db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)');
        for (const asset of testAssets) {
            insertStmt.run(asset.path, asset.content, asset.type);
        }

        engine = new TemplateEngine(db);
    });

    test("should properly handle template inheritance", () => {
        // Register child template directly since it's specific to this test
        engine.registerTemplate("child", `{% extends "base" %}{% block content %}<h1>Hello World</h1>{% endblock %}`);

        const result = engine.render("child", { title: "Test Page" });
        const $ = cheerio.load(result);

        expect($('title').text()).toBe("Test Page");
        expect($('h1').text()).toBe("Hello World");
    });

    test("should handle nested blocks", () => {
        engine.registerTemplate("nested", `{% extends "base" %}{% block content %}<article>Test Content</article>{% endblock %}`);

        const result = engine.render("nested", { title: "Nested Test" });
        const $ = cheerio.load(result);
        
        expect($('article').text()).toBe("Test Content");
    });

    test("should properly escape template literals", () => {
        engine.registerTemplate("test", `<div>\${data.value}</div>`);

        const result = engine.render("test", { value: "Hello `world`" });
        const $ = cheerio.load(result);
        
        expect($('div').text()).toBe("Hello `world`");
    });
});
