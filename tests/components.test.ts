import { expect, test, describe, beforeEach } from "bun:test";
import { TemplateEngine } from "../templates/engine";
import { Database } from "bun:sqlite";
import * as cheerio from 'cheerio';

describe("TemplateEngine", () => {
    let engine: TemplateEngine;
    let db: Database;

    beforeEach(() => {
        db = new Database(":memory:");
        db.exec(`
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);
        engine = new TemplateEngine(db);

        // Register base component in the database
        db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)').run(
            'base.html',
            '<!DOCTYPE html><html><head><title>${page.title}</title></head><body>${page.blocks?.get("content") ?? ""}</body></html>',
            'templates'
        );
    });

    test("should properly handle template inheritance", () => {
        // Register child template
        engine.registerTemplate("child", `{% extends "base" %}{% block content %}<h1>Hello World</h1>{% endblock %}`);

        const result = engine.render("child", {
            page: { 
                title: "Test Page",
                blocks: new Map()
            },
            site: {},
            absurd: engine
        });
        const $ = cheerio.load(result);

        expect($('title').text()).toBe("Test Page");
        expect($('h1').text()).toBe("Hello World");
    });

    test("should handle nested blocks", () => {
        engine.registerTemplate("nested", `{% extends "base" %}{% block content %}<article>Test Content</article>{% endblock %}`);

        const result = engine.render("nested", {
            page: { 
                title: "Nested Test",
                blocks: new Map()
            },
            site: {},
            absurd: engine
        });
        const $ = cheerio.load(result);
        
        expect($('article').text()).toBe("Test Content");
    });

    test("should properly escape template literals", () => {
        engine.registerTemplate("test", `
            {% block content %}
            <div>\${page.value}</div>
            {% endblock %}
        `);

        const result = engine.render("test", {
            page: { 
                value: "Hello `world`",
                blocks: new Map()
            },
            site: {},
            absurd: engine
        });
        const $ = cheerio.load(result);
        
        expect($('div').text().trim()).toBe("Hello `world`");
    });
});
