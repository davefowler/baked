

import { rm, mkdir } from "fs/promises";
import { Database } from "sqlite3";

const initialize = async (dist: string) => {

    const tmpDist = `${dist}-tmp`;
    // Remove existing tmpDist directory if it exists and create a new one
    try {
        await rm(tmpDist, { recursive: true, force: true });
    } catch (error) {
        // Ignore error if directory doesn't exist
    }
    await mkdir(tmpDist, { recursive: true });

    const db = new Database(`${tmpDist}/site.db`);
}

const loadAssets = () => {

}

const loadPages = () => {

}






export default function buildSite() {

// Create a new sqlite database
const db = new Database('site.db');

// Load all the assets into the database


// load all the pages into the database

// 
}

