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
    console.log('baker - constructor', db, isClient);
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
      const result = this.db
        .prepare('SELECT content, type FROM assets WHERE path = ? and type = ?')
        .get(path, type) as RawAsset | undefined;

      if (!result) {
        const allassetsPaths = this.db.prepare('SELECT path, type FROM assets').all();
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

  getPage(slug: string): Page | null {
    if (typeof slug !== 'string' || slug.includes('..') || /[<>"']/.test(slug)) {
      return null;
    }

    const rawPage = this.db
      .prepare('SELECT * FROM pages WHERE slug = ?')
      .get(slug) as RawPage | undefined;

    console.log('getPage', slug, rawPage);
    if (rawPage) {
      try {
        return convertRawPageToPage(rawPage);
      } catch (error) {
        console.error(`Invalid metadata JSON for page ${slug}`);
        return {
          ...rawPage,
          data: {}
        };
      }
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
      const results = this.db
        .prepare(
          `SELECT * FROM pages
           WHERE json_extract(data, '$.category') = ?
           ORDER BY published_date DESC 
           LIMIT ? OFFSET ?`
        )
        .all(category, limit, offset) as Page[];
      console.log(`Found ${results.length} pages with category "${category}"`);
      return results;
    }

    const results = this.db
      .prepare(
        `SELECT * FROM pages
         ORDER BY published_date DESC 
         LIMIT ? OFFSET ?`
      )
      .all(limit, offset) as Page[];
    console.log(`Found ${results.length} pages`);
    return results;
  }

  getPrevPage(currentPage: Page): Page | null {
    return this.db
      .prepare(
        `SELECT * FROM pages 
         WHERE published_date < ? 
         AND published_date IS NOT NULL 
         ORDER BY published_date DESC 
         LIMIT 1`
      )
      .get(currentPage.published_date) as Page | null;
  }

  getNextPage(currentPage: Page): Page | null {
    return this.db
      .prepare(
        `SELECT * FROM pages 
         WHERE published_date > ? 
         AND published_date IS NOT NULL 
         ORDER BY published_date ASC 
         LIMIT 1`
      )
      .get(currentPage.published_date) as Page | null;
  }

  search(query: string, limit = 10, offset = 0): Page[] {
    const results = this.db
      .prepare(
        `SELECT * FROM pages 
         WHERE title LIKE ? 
         OR content LIKE ? 
         ORDER BY published_date DESC 
         LIMIT ? OFFSET ?`
      )
      .all(`%${query}%`, `%${query}%`, limit, offset) as RawPage[];
    return results.map(convertRawPageToPage);
  }

  query(sql: string, params: any[] = []): any[] {
    return this.db.prepare(sql).all(...params);
  }
} 