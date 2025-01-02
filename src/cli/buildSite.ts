/* Building/baking the site has two parts:

1. prep - Mixing/loading the ingredients into the database
2. dish - Pre-rendering each page
*/

import { rename, cp, mkdir, rm } from 'fs/promises';
import path, { join } from 'path';
import Database, { Database as DatabaseType } from 'better-sqlite3';
import { loadAssetsFromDir, loadPagesFromDir, loadSiteMetadata } from './loading.js';
import { Baker } from '../baker.js';
import { writeFile, readFile } from 'fs/promises';

/* prep for the baking process by creating the needed database and directories */
const prep = async (dist: string, sqlDir: string): Promise<DatabaseType> => {
  console.log('...Preparing ingredients');

  // Validate input
  if (!dist) {
    throw new Error('Distribution directory path is required');
  }

  // Clean up and create directory
  try {
    await rm(dist, { recursive: true, force: true });
    await mkdir(dist, { recursive: true });
    await mkdir(join(dist, 'baked'), { recursive: true });
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
  const schemaSQL = await readFile(path.join(sqlDir, '/schema.sql'), 'utf8');

  // TODO - add full text search when schema is stable
  // const ftsSQL = await readFile(path.join(sqlDir, '/fulltextsearch.sql'), 'utf8');
  // console.log('FTS SQL loaded');

  // Create a new sqlite database
  const db = new Database(`${dist}/baked/site.db`);
  db.exec(schemaSQL);
  // db.exec(ftsSQL);

  return db;
};

/* in the dishing phase, we pre-render each page, saving it to the dist directory */
const dish = async (db: DatabaseType, dist: string) => {
  if (!db || !dist) {
    throw new Error('Database and dist path are required for pre-rendering');
  }

  const baker = new Baker(db, false);
  let failures = 0;

  try {
    const paths = baker
      .query(`SELECT path FROM pages`)
      .map((p: { path: string }) => p.path) as string[];
    if (!paths?.length) {
      console.warn('No pages found to render');
      return;
    }
    // N+1 query here - but it's fast in SQLite and better for larger sites vs loading all pages into memory
    for (const path of paths) {
      try {
        const page = baker.getPage(path);
        if (!page) {
          console.error(`Cannot find page: ${path}`);
          failures++;
          continue;
        }
        const rendered = await baker.renderPage(page);
        // Ensure directory exists before writing file
        const fileDir = `${dist}/${path}`.split('/').slice(0, -1).join('/');
        await mkdir(fileDir, { recursive: true });

        // Write the rendered content to a file
        await writeFile(`${dist}/${path}.html`, rendered, {
          encoding: 'utf8',
          mode: 0o666, // File permissions
          flag: 'w', // 'w' for write (overwrites if file exists)
        });
      } catch (error) {
        console.error(`Failed to pre-render page ${path}:`, error);
        failures++;
      }
    }

    if (failures > 0) {
      console.error(`Failed to render ${failures} pages`);
      throw new Error(`Build completed with ${failures} failed pages`);
    }
  } catch (error) {
    console.error('Pre-rendering failed:', error);
    throw error;
  }

};

/* bake the site!  Load the assets and pages into a database and pre-render each page */
export default async function bake(
  siteDir: string,
  packageRoot: string,
  includeDrafts: boolean = false
) {
  const tmpDist = path.join(siteDir, 'tmp', 'dist');
  const finalDist = path.join(siteDir, 'dist');

  // Clean up and create tmp directory
  try {
    await rm(tmpDist, { recursive: true, force: true });
    await mkdir(tmpDist, { recursive: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to prepare tmp directory: ${message}`);
  }

  // prep the database
  const sqlDir = join(packageRoot, 'dist', 'sql');
  const db = await prep(tmpDist, sqlDir);

  // copy the public files into the tmp dist
  const publicDir = path.join(siteDir, 'public');
  await cp(publicDir, tmpDist, { recursive: true });

  // mix in the assets
  const assetsDir = path.join(siteDir, 'assets');
  await loadAssetsFromDir(assetsDir, db, tmpDist);

  // mix in the pages
  const pagesDir = path.join(siteDir, 'pages');
  await loadPagesFromDir(pagesDir, db, {}, includeDrafts);

  // add in just a splash of site metadata
  await loadSiteMetadata(siteDir, db);

  console.log('...Ingredients mixed, now baking');

  // dish out the pages (pre-render them)
  await dish(db, tmpDist);

  console.log('... and a cherry on top');
  
  // Copy baked files
  const bakedDir = join(packageRoot, 'dist', 'baked');
  await cp(bakedDir, join(tmpDist, 'baked'), { recursive: true });
  
  // Create directories for client-side dependencies in baked
  await mkdir(path.join(tmpDist, 'baked/sql.js'), { recursive: true });
  await mkdir(path.join(tmpDist, 'baked/absurd-sql'), { recursive: true });

  // Copy sql.js files
  await cp(
    path.join(packageRoot, 'node_modules/@jlongster/sql.js/dist/sql-wasm.wasm'),
    path.join(tmpDist, 'baked/sql.js/sql-wasm.wasm')
  );
  // await cp(
  //   path.join(packageRoot, 'node_modules/@jlongster/sql.js/dist/sql-wasm.js'),
  //   path.join(tmpDist, 'baked/sql.js/sql-wasm.js')
  // ); // created a sql-wasm-es.js file instead which is the ES module version

  // Copy absurd-sql files
  await cp(
    path.join(packageRoot, 'node_modules/absurd-sql/dist/index.js'),
    path.join(tmpDist, 'baked/absurd-sql/index.js')
  );
  await cp(
    path.join(packageRoot, 'node_modules/absurd-sql/dist/indexeddb-backend.js'),
    path.join(tmpDist, 'baked/absurd-sql/indexeddb-backend.js')
  );


  // swap the tmp dist to the final dist
  try {
    await rm(finalDist, { recursive: true, force: true });
    await rename(tmpDist, finalDist);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to rename tmp directory: ${message}`);
  }

  console.log('Site baked, ready to serve!');
}
