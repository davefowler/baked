import { expect, test, beforeEach, afterEach, describe } from "bun:test";
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { Database } from 'sqlite3';
import { Components } from '../src/components';
import { Baker } from '../baked/baker';

describe('Security Tests', () => {
    let tempDir: string;
    let db: Database;

    beforeEach(async () => {
        tempDir = await mkdtemp(join(tmpdir(), 'baked-security-test-'));
        db = new Database(':memory:');
        
        await db.exec(`
            CREATE TABLE IF NOT EXISTS pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                template TEXT NOT NULL,
                metadata TEXT,
                published_date TEXT
            );
            
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);
    });

    afterEach(async () => {
        await rm(tempDir, { recursive: true, force: true });
        await db.close();
    });

    describe('Template Security', () => {
        test('sanitizes HTML in template variables', () => {
            const template = Components.templates(`<div>${page.content}</div>`);
            const result = template(
                { content: '<script>alert("xss")</script>' },
                {},
                {}
            );
            
            expect(result).not.toContain('<script>');
            expect(result).toContain('&lt;script&gt;');
        });

        test('prevents access to global objects', () => {
            const template = Components.templates(`${window.location}`);
            expect(() => template({}, {}, {})).toThrow();
        });

        test('restricts template scope access', () => {
            const template = Components.templates(`${process.env}`);
            expect(() => template({}, {}, {})).toThrow();
        });

        test('handles undefined variables safely', () => {
            const template = Components.templates(`${page.nonexistent.property}`);
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

        test('validates input data before storage', async () => {
            const baker = new Baker(db, false);
            const invalidPage = {
                slug: '../../../etc/passwd', // Path traversal attempt
                title: 'Invalid',
                content: 'Test'
            };
            
            expect(() => baker.savePage(invalidPage)).toThrow();
        });

        test('sanitizes metadata before storage', async () => {
            const baker = new Baker(db, false);
            const pageWithScriptInMeta = {
                slug: 'test',
                title: 'Test',
                content: 'Content',
                metadata: {
                    script: '<script>alert("xss")</script>'
                }
            };
            
            await baker.savePage(pageWithScriptInMeta);
            const saved = await baker.getPage('test');
            expect(JSON.parse(saved.metadata).script).not.toContain('<script>');
        });

        test('prevents path traversal in asset loading', async () => {
            const baker = new Baker(db, false);
            const maliciousPath = '../../../etc/passwd';
            
            expect(() => baker.getAsset(maliciousPath)).toThrow();
        });
    });
});
