/* Building/baking the site has two parts:

1. prep - Mixing/loading the ingredients into the database
2. dish - Pre-rendering each page
*/

import { rename, cp, mkdir, rm } from "fs/promises";
import path from "path";
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { loadAssetsFromDir, loadPagesFromDir, loadSiteMetadata } from "../baked/loading.js";
import { Baker } from "../baked/baker.js";
import { writeFile, readFile } from "fs/promises";

/* prep for the baking process by creating the needed database and directories */
const prep = async (dist: string, sqlDir: string): Promise<DatabaseType> => {
    console.log('Preparing build...');
    console.log('dist:', dist);
    console.log('sqlDir:', sqlDir);
    
    // Validate input
    if (!dist) {
        throw new Error('Distribution directory path is required');
    }

    // Clean up and create directory
    try {
        await rm(dist, { recursive: true, force: true });
        await mkdir(dist, { recursive: true });
    } catch (error: unknown) {
        if (error instanceof Error) {
            // Only throw if it's not a "directory doesn't exist" error during removal
            if (!('code' in error) || error.code !== 'ENOENT' || error.message.includes('create')) {
                throw new Error(`Failed to prepare directory: ${error.message}`);
            }
        } else {
            throw new Error('Failed to prepare directory: Unknown error');
        }
    }

    // Load and execute SQL files
    console.log('Loading SQL files from:', sqlDir);
    const schemaSQL = await readFile(path.join(sqlDir, '/schema.sql'), 'utf8');
    console.log('Schema SQL loaded');

    // TODO - add full text search when schema is stable
    // const ftsSQL = await readFile(path.join(sqlDir, '/fulltextsearch.sql'), 'utf8');
    // console.log('FTS SQL loaded');

    // Create a new sqlite database
    const db = new Database(`${dist}/site.db`);
    db.exec(schemaSQL);
    // db.exec(ftsSQL);

    return db;
    
}


/* in the dishing phase, we pre-render each page, saving it to the dist directory */
const dish = async (db: DatabaseType, dist: string) => {
    if (!db || !dist) {
        throw new Error('Database and dist path are required for pre-rendering');
    }

    const baker = new Baker(db, false);
    let failures = 0;
    
    try {
        const pageSlugs = await baker.query(`SELECT slug FROM pages`) as Array<{slug: string}>;
        if (!pageSlugs?.length) {
            console.warn('No pages found to render');
            return;
        }

        console.log(`Pre-rendering ${pageSlugs.length} pages...`);
        
        // N+1 query here - but it's fast in SQLite and better for larger sites vs loading all pages into memory
        for (const slug of pageSlugs) {
            try {
                const page = baker.getPage(slug.slug);
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
export default async function bake(rootDir: string,  sqlDir: string, includeDrafts: boolean = false,) {
    const tmpDist = path.join(rootDir, 'dist-tmp');
    const finalDist = path.join(rootDir, 'dist');

    // Clean up and create tmp directory
    try {
        await rm(tmpDist, { recursive: true, force: true });
        await mkdir(tmpDist, { recursive: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to prepare tmp directory: ${message}`);
    }

    // copy the public files into the tmp dist
    const publicDir = path.join(rootDir, 'public');
    await cp(publicDir, tmpDist, { recursive: true });

    // prep the database
    const db = await prep(tmpDist, sqlDir);

    // mix in the assets
    const assetsDir = path.join(rootDir, 'assets');
    await loadAssetsFromDir(assetsDir, db, tmpDist);

    // mix in the pages
    const pagesDir = path.join(rootDir, 'pages');
    await loadPagesFromDir(pagesDir, db, {}, includeDrafts);

    // add in just a splash of site metadata
    await loadSiteMetadata(rootDir, db);

    // dish out the pages (pre-render them)
    await dish(db, tmpDist);

    // swap the tmp dist to the final dist
    try {
        await rm(finalDist, { recursive: true, force: true });
        await rename(tmpDist, finalDist);
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        throw new Error(`Failed to rename tmp directory: ${message}`);
    }
}

