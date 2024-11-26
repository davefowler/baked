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
            CREATE TABLE IF NOT EXISTS templates (
                name TEXT PRIMARY KEY,
                content TEXT NOT NULL
            );
        `);
        engine = new TemplateEngine(db);
    });

    test("should properly handle template inheritance", () => {
        // Register base template
        engine.registerTemplate("base", `
            <!DOCTYPE html>
            <html>
                <head><title>\${data.title}</title></head>
                <body>
                    \${data.blocks?.get("content") ?? ""}
                </body>
            </html>
        `);

        // Register child template
        engine.registerTemplate("child", `
            {% extends "base" %}
            {% block content %}
            <h1>Hello World</h1>
            {% endblock %}
        `);

        const result = engine.render("child", { title: "Test Page" });
        const $ = cheerio.load(result);

        expect($('title').text()).toBe("Test Page");
        expect($('h1').text()).toBe("Hello World");
    });

    test("should handle nested blocks", () => {
        engine.registerTemplate("base", `
            <main>
                ${'${data.blocks?.get("content") ?? ""}'}
            </main>
        `);

        engine.registerTemplate("nested", `
            {% extends "base" %}
            {% block content %}
            <article>Test Content</article>
            {% endblock %}
        `);

        const result = engine.render("nested", {});
        const $ = cheerio.load(result);
        
        expect($('main article').text()).toBe("Test Content");
    });

    test("should properly escape template literals", () => {
        engine.registerTemplate("test", `
            {% block content %}
            <div>${'${data.value}'}</div>
            {% endblock %}
        `);

        const result = engine.render("test", { value: "Hello `world`" });
        const $ = cheerio.load(result);
        
        expect($('div').text()).toBe("Hello `world`");
    });
});
