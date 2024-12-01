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

import { Components } from '../components.js';

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
            const path = type ? `/${type}/${name}` : name;
            const result = this.db.prepare('SELECT content, type FROM assets WHERE path = ? and type = ?').get(path, type);
            if (!result) {
                const allassets = this.db.prepare('SELECT * FROM assets').all();
                console.warn(`Asset not found: ${path}`, allassets);

            }
            return result;
        } catch (error) {
            console.error(`Failed to get asset ${name}:`, error);
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

        const page = this.db.prepare(`
            SELECT * FROM pages WHERE slug = ?
        `).get(slug);

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

    savePage(page) {
        // Validate page data
        if (!page || typeof page !== 'object') {
            throw new Error('Invalid page data');
        }

        // Validate required fields
        if (!page.slug || typeof page.slug !== 'string' || 
            !page.title || typeof page.title !== 'string' ||
            !page.content || typeof page.content !== 'string') {
            throw new Error('Missing required page fields');
        }

        // Prevent path traversal
        if (page.slug.includes('..') || page.slug.startsWith('/')) {
            throw new Error('Invalid page slug');
        }

        // Sanitize metadata
        if (page.data) {
            if (typeof page.data === 'object') {
                // Recursively sanitize metadata object
                const sanitizeObj = (obj) => {
                    return Object.fromEntries(
                        Object.entries(obj).map(([k, v]) => {
                            if (typeof v === 'string') {
                                return [k, v.replace(/[<>"']/g, '')];
                            }
                            if (typeof v === 'object' && v !== null) {
                                return [k, sanitizeObj(v)];
                            }
                            return [k, v];
                        })
                    );
                };
                page.data = sanitizeObj(page.data);
            } else {
                throw new Error('Metadata must be an object');
            }
        }

        // Store the page
        this.db.prepare(`
            INSERT OR REPLACE INTO pages (slug, title, content, template, data, published_date)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(
            page.slug,
            page.title,
            page.content,
            page.template || 'default',
            JSON.stringify(page.data || {}),
            page.published_date || null
        );
    }

    renderPage(page) {
        try {
            if (!page) {
                throw new Error('Cannot render null page');
            }
            if (!page.data?.template) {
                throw new Error(`No template specified for page: {{ page.slug }}`);
            }
            
            const template = this.getAsset(page.data.template, 'templates');
            if (!template) {
                throw new Error(`Template not found: {{ page.data.template }}`);
            }
            
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

    getLatestPages(limit = 10, offset = 0) {
        return this.db.prepare(`
            SELECT * FROM pages
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

    query(sql, params = []) {
        return this.db.prepare(sql).all(...params);
    }
}
