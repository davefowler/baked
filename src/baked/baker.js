/*
 - baker # a helper object with some useful functions for baking/rendering a site
   - init(db) # initialize the baker object with the given database (client or server side sqlite db)
   - getAsset(type, name) # fetch an asset from the database as a component
   - getRawAsset(slug) # fetch the raw asset from the database without wrapping it in it's component
   - getPage(slug) # fetch a page from the database
   - getLatestPages(limit=10, offset=0) # fetch the latest pages from the database
   - getPrevPage(currentPage) # fetch the previous page from the database
   - getNextPage(currentPage) # fetch the next page from the database
   - renderPage(page) # render a page with the given site and baker objects
   - search(query, limit=10) # search the database for pages that match the query
   - query(sql, params) # run a sql query on the database and return the results
*/

import { compile } from 'svelte/compiler';
import { readFileSync } from 'fs';
import { join } from 'path';

export class Baker {
  constructor(db, isClient) {
    this.db = db;
    this.isClient = isClient;
    this.site = this.getAsset('site.yaml', 'json');
  }

  getRawAsset(name, type) {
    try {
      if (!name) {
        throw new Error('Asset name is required');
      }
      const result = this.db
        .prepare('SELECT content, type FROM assets WHERE path = ? and type = ?')
        .get(name, type);
      
      if (!result) {
        const allassetsPaths = this.db.prepare('SELECT path, type FROM assets').all();
        console.warn(`Asset not found: ${name}, ${type}`, allassetsPaths);
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
      
      // Default to .svelte extension if none specified
      const templateName = page.data.template.includes('.')
        ? page.data.template
        : `${page.data.template}.svelte`;
      
      const template = this.getAsset(templateName, 'templates');
      if (!template) {
        throw new Error(`Template not found: ${templateName}`);
      }

      // Compile and render the Svelte component
      const { js } = compile(template, {
        filename: templateName,
        generate: 'server'
      });

      // Create a temporary module to execute the compiled code
      const mod = { exports: {} };
      const fn = new Function('module', 'exports', js.code);
      fn(mod, mod.exports);

      // Render the component with props
      const { render } = mod.exports;
      const rendered = render({
        page,
        baker: this,
        site: this.site
      });

      return rendered.html;
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

  getLatestPages(limit = 10, offset = 0) {
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

  query(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }
}
