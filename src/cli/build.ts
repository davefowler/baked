/* Building/baking the site has two parts:

1. prep - Mixing/loading the ingredients into the database
2. dish - Pre-rendering each page
*/


import { rm } from "fs/promises";
import { mkdir } from "fs/promises";
import { rename } from "fs/promises";
import path from "path";
import { Database } from "sqlite3";
import { loadAssetsFromDir, loadPagesFromDir, loadSiteMetadata } from "../../baked/loading";
import { Baker } from "../../baked/baker";
import type { Page } from "../types";
import { writeFile } from "fs/promises";

/* prep for the baking process by creating the needed database and directories */
const prep = async (dist: string): Promise<Database> => {
    // Validate input
    if (!dist) {
        throw new Error('Distribution directory path is required');
    }

    // Create a tmp directory for the build
    try {
        await rm(dist, { recursive: true, force: true });
    } catch (error: unknown) {
        // Ignore error if directory doesn't exist
        if (error instanceof Error && ('code' in error) && error.code !== 'ENOENT') {
            throw new Error(`Failed to clean dist directory: ${error.message}`);
        }
    }

    try {
        await mkdir(dist, { recursive: true });
    } catch (error: unknown) {
        if (error instanceof Error) {
            throw new Error(`Failed to create dist directory: ${error.message}`);
        }
        throw new Error('Failed to create dist directory: Unknown error');
    }

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


/* in the dishing phase, we pre-render each page, saving it to the dist directory */
const dish = async (db: Database, dist: string) => {
    if (!db || !dist) {
        throw new Error('Database and dist path are required for pre-rendering');
    }

    const baker = new Baker(db, false);
    let failures = 0;
    
    try {
        const pageSlugs = await baker.query(`SELECT slug FROM pages`) as string[];
        if (!pageSlugs?.length) {
            console.warn('No pages found to render');
            return;
        }

        console.log(`Pre-rendering ${pageSlugs.length} pages...`);
        
        // N+1 query here - but it's fast in SQLite and better for larger sites vs loading all pages into memory
        for (const slug of pageSlugs) {
            try {
                const page = baker.getPage(slug);
                if (!page) {
                    console.error(`Failed to load page: ${slug}`);
                    failures++;
                    continue;
                }
                
                const rendered = await baker.renderPage(page);
                // Write the rendered content to a file
                await writeFile(`${dist}/${slug}.html`, rendered, {
                    encoding: 'utf8',
                    mode: 0o666, // File permissions
                    flag: 'w'    // 'w' for write (overwrites if file exists)
                });
                
            } catch (error) {
                console.error(`Failed to render page ${slug}:`, error);
                failures++;
            }
        }

        if (failures > 0) {
            console.error(`Failed to render ${failures} pages`);
            throw new Error(`Build completed with ${failures} failed pages`);
        }

        console.log('Pre-rendering completed successfully');
    } catch (error) {
        console.error('Pre-rendering failed:', error);
        throw error;
    }
}


/* bake the site!  Load the assets and pages into a database and pre-render each page */
export default async function bake(includeDrafts: boolean = false) {
    const thisDir = process.cwd();
    const tmpDist = path.join(thisDir, '/tmp/dist');

    const db = await prep(tmpDist);

    // mix in the assets
    const assetsDir = path.join(thisDir, 'assets');
    await loadAssetsFromDir(assetsDir, db, tmpDist);

    // mix in the pages
    const pagesDir = path.join(thisDir, 'pages');
    await loadPagesFromDir(pagesDir, db, tmpDist, includeDrafts);

    // add in just a splash of site metadata
    await loadSiteMetadata(thisDir, db);

    // oven....

    // dish out the pages (pre-render them)
    await dish(db, tmpDist);

    // swap the tmp dist to the final dist
    // Todo - in the future a diff could be useful here to know which files need to be uploaded to the CDN
    const distDir = path.join(thisDir, 'dist');
    await rename(tmpDist, distDir);
    
}

