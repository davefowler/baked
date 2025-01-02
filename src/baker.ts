import type { Database } from 'better-sqlite3';
import { Components, cleanAssetName } from './components';
import type { Page, RawAsset, TypeOfAsset, RawPage } from './types';

export interface Site {
  title: string;
  [key: string]: any;
}

const convertRawPageToPage = (rawPage: RawPage): Page => {
  return {
    ...rawPage,
    data: JSON.parse(rawPage.data || '{}')
  };
};

export class Baker {
  private db: Database;
  private isClient: boolean;
  public site: Site;

  constructor(db: Database, isClient: boolean) {
    this.db = db;
    this.isClient = isClient;
    this.site = this.getAsset('site.yaml', 'json');
  }

  // SQL.js in absurd sql works slightly differently than better-sqlite3
  // these functions abstract the differences
  private executeQuery<T>(stmt: any, params: any[]): T | undefined {
    if (stmt.getAsObject) {
      // SQL.js style
      const result = stmt.getAsObject(params);
      stmt.free();
      return result as T;
    }
    // better-sqlite3 style
    return stmt.get(...params) as T;
  }

  private executeQueryAll<T>(stmt: any, params: any[]): T[] {
    if (stmt.getAsObject) {
      // SQL.js style
      const result = [];
      stmt.bind(params);
      while (stmt.step()) {
        result.push(stmt.getAsObject());
      }
      stmt.free();
      return result as T[];
    }
    // better-sqlite3 style
    return stmt.all(...params) as T[];
  }

  getRawAsset(name: string, type: TypeOfAsset): RawAsset | null {
    name = cleanAssetName(name, type);
    try {
      if (!name) {
        throw new Error('Asset name is required');
      }
      const path = name;
      const stmt = this.db.prepare('SELECT content, type FROM assets WHERE path = ? and type = ?');
      const result = this.executeQuery<RawAsset>(stmt, [path, type]);

      if (!result) {
        const stmt = this.db.prepare('SELECT path, type FROM assets');
        const allassetsPaths = this.executeQueryAll<{path: string, type: string}>(stmt, []);
        console.warn(`Asset not found: ${path}, ${type}`, allassetsPaths);
        return null;
      }
      return result;
    } catch (error) {
      console.error(`Failed to get asset ${name}, ${type}:`, error);
      throw error;
    }
  }

  getAsset(name: string, type: TypeOfAsset): any {
    const asset = this.getRawAsset(name, type);
    if (!asset) return null;

    const processor = Components[asset.type];
    if (processor) {
      return processor(asset.content);
    }
    console.warn(`No component found for asset type: ${asset.type}`);
    return asset.content;
  }

  getPage(path: string): Page | null {
    if (typeof path !== 'string' || path.includes('..') || /[<>"']/.test(path)) {
      return null;
    }
    const stmt = this.db.prepare("SELECT * FROM pages WHERE path = ?");
    const rawPage = this.executeQuery<RawPage>(stmt, [path]);

    if (rawPage) {
      return convertRawPageToPage(rawPage);
    }
    return null;
  }

  renderPage(page: Page): string {
    try {
      if (!page) {
        throw new Error('Cannot render null page');
      }
      if (!page.data?.template) {
        throw new Error(`No template specified for page: ${page.path}`);
      }
      const templateName = page.data.template.includes('.')
        ? page.data.template
        : `${page.data.template}.html`;
      const template = this.getAsset(templateName, 'templates');
      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }
      return template(page, this, this.site);
    } catch (error) {
      console.error(`Failed to render page:`, page.path, page, error);
      return `
        <html>
          <head><title>Error</title></head>
          <body>
            <h1>Error Rendering Page</h1>
            <p>Please try again later.</p>
            ${this.isClient ? '' : `<pre>${(error as Error).message}</pre>`}
          </body>
        </html>
      `;
    }
  }

  getLatestPages(limit = 10, offset = 0, category?: string): Page[] {
    console.log('getLatestPages params:', { limit, offset, category });
    
    if (typeof category === 'string') {
      console.log('Filtering by category:', category);
      const stmt = this.db.prepare(
        `SELECT * FROM pages
         WHERE json_extract(data, '$.category') = ?
         ORDER BY published_date DESC 
         LIMIT ? OFFSET ?`
      );
      const results = this.executeQueryAll<RawPage>(stmt, [category, limit, offset]);
      console.log(`Found ${results.length} pages with category "${category}"`);
      return results.map(convertRawPageToPage);
    }
  
    const stmt = this.db.prepare(
      `SELECT * FROM pages
       ORDER BY published_date DESC 
       LIMIT ? OFFSET ?`
    );
    const results = this.executeQueryAll<RawPage>(stmt, [limit, offset]);
    console.log('baker - getLatestPages results', results);
    console.log(`Found ${results.length} pages`);
    return results.map(convertRawPageToPage);
  }

  getPrevPage(currentPage: Page): Page | null {
    const stmt = this.db.prepare(
      `SELECT * FROM pages 
       WHERE published_date < ? 
       AND published_date IS NOT NULL 
       ORDER BY published_date DESC 
       LIMIT 1`
    );
    return this.executeQuery<Page>(stmt, [currentPage.published_date]) || null;
  }

  getNextPage(currentPage: Page): Page | null {
    const stmt = this.db.prepare(
      `SELECT * FROM pages 
       WHERE published_date > ? 
       AND published_date IS NOT NULL 
       ORDER BY published_date ASC 
       LIMIT 1`
    );
    return this.executeQuery<Page>(stmt, [currentPage.published_date]) || null;
  }

  search(query: string, limit = 10, offset = 0): Page[] {
    const stmt = this.db.prepare(
      `SELECT * FROM pages 
       WHERE title LIKE ? 
       OR content LIKE ? 
       ORDER BY published_date DESC 
       LIMIT ? OFFSET ?`
    );
    const results = this.executeQueryAll<RawPage>(stmt, [`%${query}%`, `%${query}%`, limit, offset]);
    return results.map(convertRawPageToPage);
  }

  query(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    return this.executeQueryAll<any>(stmt, params);
  }
} 