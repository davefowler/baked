import { expect, test, beforeEach, afterEach, describe } from '@jest/globals';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { Components } from '../src/components.js';
import { Baker } from '../src/baker';
import { readFile } from 'fs/promises';
import { loadPage } from '../src/cli/loading.js';

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
    test('sanitizes HTML in template variables', () => {
      const template = Components.templates(`<div>{{ page.content }}</div>`);
      const result = template({ content: '<script>alert("xss")</script>' }, {}, {});

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
        script: '<script>alert("xss")</script>',
      };
      const path = 'sanitization-test.md';
      loadPage(db, path, 'Content', scriptInMeta);

      const saved = await baker.getPage(path);
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
        await baker.getAsset(maliciousPath, 'templates');
        // If we get here, the test should fail because no error was thrown
        fail('Expected path traversal to throw an error');
      } catch (error: any) {
        expect(error.message).toBe(`Invalid path: ${maliciousPath}`);
      }
    });
  });
});
