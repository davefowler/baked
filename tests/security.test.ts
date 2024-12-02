import { expect, test, beforeEach, afterEach, describe } from "@jest/globals";
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sqlite, { Database } from "better-sqlite3"
import { Components } from '../src/components.js';
import { Baker } from '../src/baked/baker';
import { readFile } from 'fs/promises';
import { loadPage } from "../src/baked/loading.js";

describe('Security Tests', () => {
    let tempDir: string;
    let db: Database;
    let consoleWarnSpy: jest.SpyInstance;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'baked-security-test-'));
        db = new sqlite(':memory:');
        
        // Store the original console.warn
        const originalWarn = console.warn;
        
        // Only suppress specific warnings
        consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation((message) => {
            if (!message.includes('Asset not found: /json/site.yaml')) {
                originalWarn.call(console, message);  // Use the original warn function
            }
        });
        
        // Load schema from file
        const schema = await readFile(join(__dirname, '../src/sql/schema.sql'), 'utf-8');
        await db.exec(schema);
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
        await db.close();
        // Restore console.warn
        consoleWarnSpy.mockRestore();
    });

    describe('Template Security', () => {
        test('sanitizes HTML in template variables', () => {
            const template = Components.templates(`<div>{{ page.content }}</div>`);
            const result = template(
                { content: '<script>alert("xss")</script>' },
                {},
                {}
            );
            
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });


        test('restricts template scope and globals access', () => {
            // Nunjucks should not allow access to process.env or window objects (noGlobals: true)
            const template = Components.templates(`{{ process.env }}{{ window.location }}`);
            const result = template({}, {}, {});
            expect(result).toBe('');
        });

        test('handles undefined variables safely', () => {
            const template = Components.templates(`{{page.nonexistent.property}}`);
            const result = template({}, {}, {});
            expect(result).toBe('');
        });
    });

    describe('Database Security', () => {
        test('prevents SQL injection in queries', async () => {
            const baker = new Baker(db, false);
            const maliciousSlug = "' OR '1'='1";
            
            // Attempt SQL injection
            const result = await baker.getPage(maliciousSlug);
            expect(result).toBeNull();
        });

        test('sanitizes metadata before storage', async () => {
            const baker = new Baker(db, false);
            const scriptInMeta = {
                script: '<script>alert("xss")</script>'
            };
            loadPage(db, 'sanitization-test.md', 'Content', scriptInMeta);

            const saved = await baker.getPage('sanitization-test');            
            const data = saved?.data ? 
                (typeof saved.data === 'string' ? JSON.parse(saved.data) : saved.data) 
                : {};
            expect(data.script).not.toContain('<script>');
        });

        test('prevents path traversal in asset loading', async () => {
            const baker = new Baker(db, false);
            const maliciousPath = '../../../etc/passwd';
            
            const result = await baker.getAsset(maliciousPath);
            expect(result).toBeNull();
        });
    });
});
