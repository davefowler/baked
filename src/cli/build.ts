import { rm } from "fs/promises";
import { mkdir } from "fs/promises";
import { rename } from "fs/promises";
import path from "path";
import { Database } from "sqlite3";
import { loadAssetsFromDir, loadPagesFromDir, loadSiteMetadata } from "../../baked/loading";
import { Baker } from "../../baked/baker";
import type { Page } from "../types";


const initialize = async (dist: string): Promise<Database> => {

    // Create a tmp directory for the build
    try {
        await rm(dist, { recursive: true, force: true });
    } catch (error) {
        // Ignore error if directory doesn't exist
    }
    await mkdir(dist, { recursive: true });

    // Create a new sqlite database
    const db = new Database(`${dist}/site.db`);
    // Create tables
    db.serialize(() => {

        // Assets table stores CSS, images, components etc
        db.run(`
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            )
        `);
        
        // Pages table stores all content pages
        db.run(`
            CREATE TABLE IF NOT EXISTS pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                template TEXT NOT NULL DEFAULT 'default',
                metadata TEXT,
                published_date TEXT
            )
        `);

        // Create Full Text Search (FTS) virtual table for search
        db.run(`
            CREATE VIRTUAL TABLE IF NOT EXISTS pages_fts USING fts5(
                title, 
                content,
                metadata,
                content='pages',
                content_rowid='slug'
            )
        `);

        // Create triggers to keep FTS table in sync
        db.run(`
            CREATE TRIGGER IF NOT EXISTS pages_ai AFTER INSERT ON pages BEGIN
                INSERT INTO pages_fts(rowid, title, content, metadata)
                VALUES (new.slug, new.title, new.content, new.metadata);
            END
        `);

        db.run(`
            CREATE TRIGGER IF NOT EXISTS pages_ad AFTER DELETE ON pages BEGIN
                INSERT INTO pages_fts(pages_fts, rowid, title, content, metadata)
                VALUES('delete', old.slug, old.title, old.content, old.metadata);
            END
        `);

        db.run(`
            CREATE TRIGGER IF NOT EXISTS pages_au AFTER UPDATE ON pages BEGIN
                INSERT INTO pages_fts(pages_fts, rowid, title, content, metadata)
                VALUES('delete', old.slug, old.title, old.content, old.metadata);
                INSERT INTO pages_fts(rowid, title, content, metadata)
                VALUES (new.slug, new.title, new.content, new.metadata);
            END
        `);

    });

    return db;
    
}


const preRender = async (db: Database, dist: string, ) => {
    const baker = new Baker(db, false);

    const pages = await baker.query(`SELECT * FROM pages`) as Page[];

    for (const page of pages) {
        page.metadata = JSON.parse(page.metadata || '{}');
        await baker.renderPage(page);
    }
}



export default async function buildSite(includeDrafts: boolean = false) {
 
    const thisDir = process.cwd();
    const tmpDist = path.join(thisDir, '/tmp/dist');


    const db = await initialize(tmpDist);

    const assetsDir = path.join(thisDir, 'assets');
    await loadAssetsFromDir(assetsDir, db, tmpDist);

    const pagesDir = path.join(thisDir, 'pages');
    await loadPagesFromDir(pagesDir, db, tmpDist, includeDrafts);

    await loadSiteMetadata(thisDir, db);

    await preRender(db, tmpDist);

    // move the tmp dist to the final dist
    const distDir = path.join(thisDir, 'dist');
    await rename(tmpDist, distDir);
    
}

