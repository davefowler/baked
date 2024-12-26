/*
 - baker # a helper object with some useful functions for baking/rendering a site
   - init(db) # initialize the baker object with the given database (client or server side sqlite db)
   - getAsset(type, name) # fetch an asset from the database as a component
   - getRawAsset(slug) # fetch the raw asset from the database without wrapping it in it's component
   - getPage(slug) # fetch a page from the database
   - getLatestPages(limit=10, offset=0, category) # fetch the latest pages from the database
   - getPrevPage(currentPage) # fetch the previous page from the database
   - getNextPage(currentPage) # fetch the next page from the database
   - renderPage(page) # render a page with the given site and baker objects
   - search(query, limit=10) # search the database for pages that match the query
   - query(sql, params) # run a sql query on the database and return the results
*/

import { Components, cleanAssetName } from '../components.js';

export class Baker {
  constructor(db, isClient) {
    this.db = db;
    this.isClient = isClient;
    this.site = this.getAsset('site.yaml', 'json');
  }

  getRawAsset(name, type) {
    name = cleanAssetName(name, type);
    try {
      if (!name) {
        throw new Error('Asset name is required');
      }
      const path = name;
      const result = this.db
        .prepare('SELECT content, type FROM assets WHERE path = ? and type = ?')
        .get(path, type);
      if (!result) {
        const allassetsPaths = this.db.prepare('SELECT path, type FROM assets').all();
        console.warn(`Asset not found: ${path}, ${type}`, allassetsPaths);
      }
      return result;
    } catch (error) {
      console.error(`Failed to get asset ${name}, ${type}:`, error);
      throw error;
    }
  }

  getAsset(name, type) {
    const asset = this.getRawAsset(name, type);
    if (!asset) return null;

    // Get the component processor for this asset type
    const processor = Components[asset.type];
    if (processor) {
      return processor(asset.content);
    }
    console.warn(`No component found for asset type: ${asset.type}`);
    return asset.content;
  }

  getPage(slug) {
    // Validate slug to prevent SQL injection and path traversal
    if (typeof slug !== 'string' || slug.includes('..') || /[<>"']/.test(slug)) {
      return null;
    }

    const page = this.db
      .prepare(
        `
            SELECT * FROM pages WHERE slug = ?
        `
      )
      .get(slug);

    // Parse the data field as JSON
    if (page) {
      try {
        page.data = JSON.parse(page.data || '{}');
      } catch (error) {
        console.error(`Invalid metadata JSON for page ${slug}`);
        page.data = {};
      }
    }
    return page;
  }

  renderPage(page) {
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
      console.log('baker render page', template, page, this, this.site);

      console.log('rendered page', template(page, this, this.site));
      return template(page, this, this.site);
    } catch (error) {
      console.error(`Failed to render page:`, error);
      // Return a basic error page in production
      return `
                <html>
                    <head><title>Error</title></head>
                    <body>
                        <h1>Error Rendering Page</h1>
                        <p>Please try again later.</p>
                        ${this.isClient ? '' : `<pre>${error.message}</pre>`}
                    </body>
                </html>
            `;
    }
  }

  getLatestPages(limit = 10, offset = 0, category) {
    if (category === undefined) {
      return this.db
        .prepare(
          `
              SELECT * FROM pages
              ORDER BY published_date DESC 
              LIMIT ? OFFSET ?
          `
        )
        .all(limit, offset);
    }

    // Fixed query to properly parse JSON data field and check category
    return this.db
    .prepare(
      `
          SELECT * FROM pages
          WHERE json_extract(data, '$.category') = ?
          ORDER BY published_date DESC 
          LIMIT ? OFFSET ?
      `
    )
    .all(category, limit, offset);
  }

  getPrevPage(currentPage) {
    return this.db
      .prepare(
        `
            SELECT * FROM pages 
            WHERE published_date < ? 
            AND published_date IS NOT NULL 
            ORDER BY published_date DESC 
            LIMIT 1
        `
      )
      .get(currentPage.published_date);
  }

  getNextPage(currentPage) {
    return this.db
      .prepare(
        `
            SELECT * FROM pages 
            WHERE published_date > ? 
            AND published_date IS NOT NULL 
            ORDER BY published_date ASC 
            LIMIT 1
        `
      )
      .get(currentPage.published_date);
  }

  search(query, limit = 10) {
    return this.db
      .prepare(
        `
            SELECT * FROM pages 
            WHERE title LIKE ? 
            OR content LIKE ? 
            ORDER BY published_date DESC 
            LIMIT ?
        `
      )
      .all(`%${query}%`, `%${query}%`, limit);
  }

  // TODO - make query a filter?
  query(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }
}
