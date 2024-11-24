import { Database } from 'bun:sqlite';

class Model {
    protected static db: Database;
    
    static setDatabase(database: Database) {
        this.db = database;
    }
}

export class Post extends Model {
    static all() {
        return this.db.prepare(`
            SELECT *, json_extract(metadata, '$.date') as post_date 
            FROM pages 
            WHERE template = 'blog'
            ORDER BY post_date DESC
        `).all();
    }

    static paginate(page: number, perPage: number = 10) {
        const offset = (page - 1) * perPage;
        return {
            items: this.db.prepare(`
                SELECT *
                FROM pages 
                WHERE template = 'blog'
                ORDER BY json_extract(metadata, '$.date') DESC
                LIMIT ? OFFSET ?
            `).all(perPage, offset),
            total: this.db.prepare(`
                SELECT COUNT(*) as count
                FROM pages
                WHERE template = 'blog'
            `).get().count
        };
    }
}

export class Page extends Model {
    static findBySlug(slug: string) {
        return this.db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
    }
}
