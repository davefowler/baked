import { Database } from 'better-sqlite3';
import { promises as fs } from 'fs';

interface PageRecord {
    id?: number;
    slug: string;
    title: string;
    content: string;
    template: string;
    lang: string;
    tags: string;
    path: string;
}

async function initializeDatabase(dbPath: string): Promise<Database> {
    const db = new Database(dbPath);
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS pages (
            id INTEGER PRIMARY KEY,
            slug TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            template TEXT NOT NULL,
            lang TEXT,
            tags TEXT,
            path TEXT NOT NULL
        );
    `);

    console.log('Database schema created successfully');
    return db;
}

async function main() {
    // Create necessary directories
    await fs.mkdir('content', { recursive: true });
    await fs.mkdir('scripts', { recursive: true });
    await fs.mkdir('dist', { recursive: true });

    // Initialize the database
    const db = await initializeDatabase('dist/site.db');
    
    console.log('Project structure initialized');
}

main().catch(console.error);
