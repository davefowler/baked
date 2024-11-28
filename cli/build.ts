import { rm, mkdir } from "fs/promises";
import { Database } from "sqlite3";
import { promisify } from "util";

const initialize = async (dist: string): Promise<Database> => {
    const tmpDist = `${dist}-tmp`;
    // Remove existing tmpDist directory if it exists and create a new one
    try {
        await rm(tmpDist, { recursive: true, force: true });
    } catch (error) {
        // Ignore error if directory doesn't exist
    }
    await mkdir(tmpDist, { recursive: true });

    const db = new Database(`${tmpDist}/site.db`);
    const run = promisify(db.run.bind(db));

    // Initialize database schema
    await run(`
        CREATE TABLE IF NOT EXISTS assets (
            id INTEGER PRIMARY KEY,
            path TEXT NOT NULL,
            content BLOB,
            mime_type TEXT
        )
    `);

    await run(`
        CREATE TABLE IF NOT EXISTS pages (
            id INTEGER PRIMARY KEY,
            path TEXT NOT NULL,
            content TEXT,
            metadata TEXT
        )
    `);

    return db;
}

const loadAssets = async (db: Database) => {
    const run = promisify(db.run.bind(db));
    
    // TODO: Implement asset loading
    // This is where we'll scan the assets directory and load files into the database
    await run("INSERT INTO assets (path, mime_type) VALUES (?, ?)", 
        ["/test-asset.txt", "text/plain"]);
}

const loadPages = async (db: Database) => {
    const run = promisify(db.run.bind(db));
    
    // TODO: Implement page loading
    // This is where we'll scan the pages directory and load content into the database
    await run("INSERT INTO pages (path, content) VALUES (?, ?)",
        ["/index.html", "<html><body>Test Page</body></html>"]);
}

export default async function buildSite(dist: string) {
    try {
        const db = await initialize(dist);
        await loadAssets(db);
        await loadPages(db);
        
        // Close database connection
        await promisify(db.close.bind(db))();
    } catch (error) {
        throw new Error(`Build failed: ${error.message}`);
    }
}

