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


  getRawAsset(name: string, type: TypeOfAsset): RawAsset | null {
    name = cleanAssetName(name, type);
    try {
      if (!name) {
        throw new Error('Asset name is required');
      }
      const path = name;
      const result = this.db.prepare('SELECT content, type FROM assets WHERE path = ? and type = ?').get(path, type);
      return result as RawAsset | null;
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

    const rawPage = this.db.prepare("SELECT * FROM pages WHERE path = ?").get(path) as RawPage | undefined;
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
    
    if (typeof category === 'string') {
      const stmt = this.db.prepare(
        `SELECT * FROM pages
         WHERE json_extract(data, '$.category') = ?
         ORDER BY published_date DESC 
         LIMIT ? OFFSET ?`
      );
      const results = stmt.all(category, limit, offset) as RawPage[];
      return results.map(convertRawPageToPage);
    }
  
    const stmt = this.db.prepare(
      `SELECT * FROM pages
       ORDER BY published_date DESC 
       LIMIT ? OFFSET ?`
    );
    const results = stmt.all(limit, offset) as RawPage[];
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
    return stmt.get(currentPage.published_date) as Page | null;
  }

  getNextPage(currentPage: Page): Page | null {
    const stmt = this.db.prepare(
      `SELECT * FROM pages 
       WHERE published_date > ? 
       AND published_date IS NOT NULL 
       ORDER BY published_date ASC 
       LIMIT 1`
    );
    return stmt.get(currentPage.published_date) as Page | null;
  }

  search(query: string, limit = 10, offset = 0): Page[] {
    const stmt = this.db.prepare(
      `SELECT * FROM pages 
       WHERE title LIKE ? 
       OR content LIKE ? 
       ORDER BY published_date DESC 
       LIMIT ? OFFSET ?`
    );
    const results = stmt.all(`%${query}%`, `%${query}%`, limit, offset) as RawPage[];
    return results.map(convertRawPageToPage);
  }

  query(sql: string, params: any[] = []): any[] {
    const stmt = this.db.prepare(sql);
    return stmt.all(params);
  }
} 