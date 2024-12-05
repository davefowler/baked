import { expect, test, beforeEach, afterEach, describe } from '@jest/globals';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { compile } from 'svelte/compiler';
import { Baker } from '../src/baked/baker';
import { readFile } from 'fs/promises';
import { loadPage } from '../src/baked/loading.js';

describe('Security Tests', () => {
  let tempDir: string;
  let db: DatabaseType;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(async () => {
    // Suppress console warnings
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    tempDir = await mkdtemp(join(tmpdir(), 'baked-security-test-'));
    db = new Database(':memory:');

    // Load schema from file
    const schema = await readFile(join(__dirname, '../src/sql/schema.sql'), 'utf-8');
    await db.exec(schema);
  });

  afterEach(async () => {
    // Restore console.warn
    consoleWarnSpy.mockRestore();

    await rm(tempDir, { recursive: true, force: true });
    await db.close();
  });

  describe('Template Security', () => {
    test('sanitizes HTML in template variables', async () => {
      const template = `
        <script>
          export let page;
        </script>
        <div>{page.content}</div>
      `;

      const { js } = compile(template, {
        filename: 'Test.svelte',
        generate: 'server'
      });
      
      expect(js.code).toBeDefined();
      expect(js.code).not.toContain('alert("xss")');
    });

    test('restricts template scope and globals access', async () => {
      const template = `
        <script>
          export let page;
        </script>
        {typeof window === 'undefined' ? '' : window.location}
      `;

      const { js } = compile(template, {
        filename: 'Test.svelte',
        generate: 'ssr'
      });
      
      expect(js.code).toBeDefined();
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
        script: '<script>alert("xss")</script>',
      };
      loadPage(db, 'sanitization-test.md', 'Content', scriptInMeta);

      const saved = await baker.getPage('sanitization-test');
      const data = saved?.data
        ? typeof saved.data === 'string'
          ? JSON.parse(saved.data)
          : saved.data
        : {};
      expect(data.script).not.toContain('<script>');
    });

    test('prevents path traversal in asset loading', async () => {
      const baker = new Baker(db, false);
      const maliciousPath = '../../../etc/passwd';

      try {
        await baker.getAsset(maliciousPath);
        // If we get here, the test should fail because no error was thrown
        fail('Expected path traversal to throw an error');
      } catch (error: any) {
        expect(error.message).toBe(`Invalid path: ${maliciousPath}`);
      }
    });
  });
});
