/*
 - absurd # a helper object with some useful functions
   - init(db) # initialize the absurd object with the given database (client or server side sqlite db)
   - getAsset(type, name) # fetch an asset from the database as a component
   - getRawAsset(slug) # fetch the raw asset from the database without wrapping it in it's component
   - getPage(slug) # fetch a page from the database
   - getLatestPages(limit=10, offset=0) # fetch the latest pages from the database
   - getPrevPage(currentPage) # fetch the previous page from the database
   - getNextPage(currentPage) # fetch the next page from the database
   - renderPage(page, site, absurd) # render a page with the given site and absurd objects
   - search(query, limit=10) # search the database for pages that match the query
   - query(sql, params) # run a sql query on the database and return the results
*/

import { initBackend } from 'absurd-sql/dist/indexeddb-main-thread';

export class Absurd {
    constructor() {
        this.db = null;
        this.isClient = null;
        this.site = {};
    }

    async init(db, isClient = true) {
        this.isClient = isClient;
        this.db = db;

        if (isClient) {
            // Initialize IndexedDB backend only in browser environment
            initBackend();
        }

        this.site = this.getAsset('site.yaml', 'application/yaml');

    }

    getRawAsset(name, type) {
        const path = type ? `/${type}/${name}` : name;
        const result = this.db.prepare('SELECT content, type FROM assets WHERE path = ?').get(path);
        return result;
    }

    getComponentProcessor(type) {
      const componentCode = this.getRawAsset(`${type}.js`, 'components');
      if (!componentCode) return null;

      return this.isClient 
          ? eval(componentCode)
          : require(componentCode);
  }


    getAsset(name, type = null) {
        const asset = this.getRawAsset(name, type);
        if (!asset) return null;

        // Get the component processor for this asset type
        const processor = this.getComponentProcessor(asset.type);
        if (processor) {
            return processor(asset.content);
        }

        return asset.content;
    }

    getPage(slug) {
        const page = this.db.prepare(`
            SELECT p.*, m.content as metadata 
            FROM pages p 
            LEFT JOIN metadata m ON m.page_slug = p.slug 
            WHERE p.slug = ?
        `).get(slug);

        if (page) {
            page.metadata = JSON.parse(page.metadata || '{}');
        }
        return page;
    }

    getLatestPages(limit = 10, offset = 0) {
        return this.db.prepare(`
            SELECT * FROM pages 
            WHERE published_date IS NOT NULL 
            ORDER BY published_date DESC 
            LIMIT ? OFFSET ?
        `).all(limit, offset);
    }

    getPrevPage(currentPage) {
        return this.db.prepare(`
            SELECT * FROM pages 
            WHERE published_date < ? 
            AND published_date IS NOT NULL 
            ORDER BY published_date DESC 
            LIMIT 1
        `).get(currentPage.published_date);
    }

    getNextPage(currentPage) {
        return this.db.prepare(`
            SELECT * FROM pages 
            WHERE published_date > ? 
            AND published_date IS NOT NULL 
            ORDER BY published_date ASC 
            LIMIT 1
        `).get(currentPage.published_date);
    }

    search(query, limit = 10) {
        return this.db.prepare(`
            SELECT * FROM pages 
            WHERE title LIKE ? 
            OR content LIKE ? 
            ORDER BY published_date DESC 
            LIMIT ?
        `).all(`%${query}%`, `%${query}%`, limit);
    }

    query(sql, params) {
        return this.db.prepare(sql).all(params);
    }
}