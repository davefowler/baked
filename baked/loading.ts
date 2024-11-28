import { Database } from "sqlite3";
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import matter from 'gray-matter';

// Mixer - a function that takes a file and loads it properly into the database depending on its type
type Mixer = (filepath: string, content: string, metadata: any, distPath?: string) => Promise<{
    content: string;
    metadata: any;
}>;

// Default Mixer just returns content and metadata unchanged
const defaultMixer: Mixer = async (filepath, content, metadata, distPath) => {
    return { content, metadata };
};

// Process markdown files
const markdownMixer: Mixer = async (filepath, content, metadata, distPath) => {
    const frontmatter = matter(content);
    const combinedMetadata = { ...metadata, ...frontmatter.data };
    return {
        content: frontmatter.content,
        metadata: combinedMetadata,
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
        metadata
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

export async function loadPagesFromDir(dir: string, db: Database, parentMetadata: any = {}, includeDrafts: boolean = false) {
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
            await loadPagesFromDir(fullPath, db, metadata, includeDrafts);
        } else if (entry.name !== 'meta.yaml') {
            // Get the directory name to determine the Mixer
            const dirName = path.basename(path.dirname(fullPath));
            const mixer = mixers[dirName] || defaultMixer;
            
            try {
                const content = await fs.readFile(fullPath, 'utf8');
                const { content: processedContent, metadata: finalMetadata } = 
                    await mixer(fullPath, content, metadata);

                if (!includeDrafts && metadata.isDraft) continue; // don't even load draft pages if not specified by user with --drafts

                const slug = path.relative(dir, fullPath)
                    .replace(path.extname(fullPath), '');
                
                const title = finalMetadata.title || path.basename(fullPath, path.extname(fullPath));
                console.log(`Processing ${slug} with title ${title}`);
                db.prepare(`
                    INSERT INTO pages (slug, title, content, template, metadata, published_date) 
                    VALUES (?, ?, ?, ?, ?, ?)
                `).run(
                    slug,
                    title,
                    processedContent,
                    finalMetadata.template || 'default',
                    JSON.stringify(finalMetadata),
                    finalMetadata.date || null
                );
                
                console.log(`Loaded page: ${slug}`);
            } catch (error) {
                console.error(`Error processing ${fullPath}:`, error);
            }
        }
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
                
                console.log(`Loaded asset: ${entry.name} as ${type}`);
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
        INSERT INTO site (metadata) VALUES (?)
    `).run(JSON.stringify(siteMetadata));
}
