import sqlite from 'better-sqlite3';
type Database = ReturnType<typeof sqlite>;
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import matter from 'gray-matter';
import { escape } from 'html-escaper';

// Mixer - a function that takes a file and loads it properly into the database depending on its type
type Mixer = (filepath: string, content: string, metadata: any, distPath?: string) => Promise<{
    content: string;
    data: any;
}>;

// Default Mixer just returns content and metadata unchanged
// TODO - right now we're allowing all file types to be loaded, but maybe we shouldn't.
const defaultMixer: Mixer = async (filepath, content, metadata, distPath) => {
    console.log('default mixer', filepath, content, metadata, distPath);
    return { content, data: metadata };
};

// Process markdown files
const markdownMixer: Mixer = async (filepath, content, metadata, distPath) => {
    const frontmatter = matter(content);
    const combinedMetadata = { ...metadata, ...frontmatter.data };
    return {
        content: frontmatter.content,
        data: combinedMetadata,
        title: combinedMetadata.title || path.basename(filepath, path.extname(filepath))
    };
};

// Process image files
const imageMixer: Mixer = async (filepath, content, metadata, distPath) => {
    const defaultDistPath = path.join(process.cwd(), 'dist');
    const targetDistPath = distPath || defaultDistPath;
    // Create images directory if it doesn't exist
    const imagesDir = path.join(targetDistPath, 'images');
    await fs.mkdir(imagesDir, { recursive: true });
    
    // Copy image to images directory
    const filename = path.basename(filepath);
    const newPath = path.join('images', filename);
    await fs.copyFile(filepath, path.join(imagesDir, filename));
    
    // Return img tag as content
    return {
        content: `<img src="/${newPath}" alt="${metadata.alt || filename}" />`,
        data: metadata
    };
};

// Map directories to Mixers
const mixers: Record<string, Mixer> = {
    'images': imageMixer,
    'components': defaultMixer,
    'templates': defaultMixer,
    'css': defaultMixer,
    'pages': markdownMixer
};


// For the Pages loading.  Asset mixers right now are handled by their directory
const getMixerByFilename = (filename: string): Mixer => {
    if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
        return markdownMixer;
    }
    return defaultMixer;
}

export const loadPage = (db: Database, pagePath: string, content: string, data: any) => {
    const slug = pagePath.replace(path.extname(pagePath), '').replace(/\.[^/.]+$/, '');
    const title = data.title || path.basename(pagePath, path.extname(pagePath));
    const publishedDate = data.date ? 
        new Date(data.date).toISOString() : 
        null;


    // Sanitize all string values in the data object
    const sanitizedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
            key,
            typeof value === 'string' ? escape(value) : value
        ])
    );

    const template = sanitizedData?.template ? sanitizedData.template : 'base.html';

    // Ensure path includes the .md extension for consistency
    const fullPath = pagePath.endsWith('.md') ? pagePath : `${pagePath}.md`;
    
    const params = {
        path: fullPath,
        slug,
        title,
        content,
        template,
        data: JSON.stringify(sanitizedData),
        published_date: publishedDate
    };

    console.log('existing pages are', db.prepare('SELECT * FROM pages').all());
    try {
        const stmt = db.prepare(`
            REPLACE INTO pages (path, slug, title, content, template, data, published_date) 
            VALUES (@path, @slug, @title, @content, @template, @data, @published_date)
        `);
        
        stmt.run(params);
    } catch (error) {
        console.error('Error loading page:', error);
        console.error('Failed data:', params);
        throw error;
    }
}


export async function loadPagesFromDir(dir: string, db: Database, parentMetadata: any = {}, includeDrafts: boolean = false, rootDir?: string) {
    // Store the root directory on first call
    rootDir = rootDir || dir;
    console.log('loading pages from dir', dir, rootDir, 'parent metadata', parentMetadata);

    const entries = await fs.readdir(dir, { withFileTypes: true });
    const metaPath = path.join(dir, 'meta.yaml');
    let metadata = { ...parentMetadata };
    
    try {
        const metaContent = await fs.readFile(metaPath, 'utf8');
        metadata = { ...metadata, ...yaml.parse(metaContent) };
    } catch (error) {
        // meta.yaml doesn't exist, continue with parent metadata
    }

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            // Pass the root directory through recursive calls
            await loadPagesFromDir(fullPath, db, metadata, includeDrafts, rootDir);
            continue;
        } else if (entry.name === 'meta.yaml') {
            // meta.yaml must be handled first (above) so skip here
            continue;
        }
        
        // Read the file   
        const rawFileContent = await fs.readFile(fullPath, 'utf8');

        // Process the file based on its type
        const mixer = getMixerByFilename(entry.name);
        const {content, data} = await mixer(fullPath, rawFileContent, metadata);
        const pagePath = path.relative(rootDir, fullPath).replace(path.extname(fullPath), '');
        // Load the page into the database
        if (!includeDrafts && data.isDraft) return; // drafts are not included unless --drafts is specified
        loadPage(db, pagePath, content, data);
    }
}

export async function loadAssetsFromDir(dir: string, db: Database, distPath: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
            await loadAssetsFromDir(fullPath, db, distPath);
        } else {
            try {
                const content = await fs.readFile(fullPath, 'utf8');
                const type = path.basename(path.dirname(fullPath));
                
                db.prepare(`
                    INSERT INTO assets (path, content, type) 
                    VALUES (?, ?, ?)
                `).run(
                    entry.name,
                    content,
                    type
                );
                
            } catch (error) {
                console.error(`Error loading asset ${fullPath}:`, error);
            }
        }
    }
}

export async function loadSiteMetadata(dir: string, db: Database) {
    const sitePath = path.join(dir, 'site.yaml');
    const siteContent = await fs.readFile(sitePath, 'utf8');
    const siteMetadata = yaml.parse(siteContent);
    db.prepare(`
        INSERT INTO assets (path, content, type) VALUES (?, ?, ?)
    `).run('/json/site.yaml', JSON.stringify(siteMetadata), 'json');

}
