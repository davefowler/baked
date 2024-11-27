import { Database } from 'bun:sqlite';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import matter from 'gray-matter';

// File processor type definition
type FileProcessor = (filepath: string, content: string, metadata: any, distPath: string) => Promise<{
    content: string;
    metadata: any;
}>;

// Default processor just returns content and metadata unchanged
const defaultProcessor: FileProcessor = async (filepath, content, metadata, distPath) => {
    return { content, metadata };
};

// Process markdown files
const markdownProcessor: FileProcessor = async (filepath, content, metadata, distPath) => {
    const frontmatter = matter(content);
    return {
        content: frontmatter.content,
        metadata: { ...metadata, ...frontmatter.data }
    };
};

// Process image files
const imageProcessor: FileProcessor = async (filepath, content, metadata, distPath) => {
    // Create images directory if it doesn't exist
    const imagesDir = path.join(distPath, 'images');
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

// Map directories to processors
const processors: Record<string, FileProcessor> = {
    'images': imageProcessor,
    'components': defaultProcessor,
    'templates': defaultProcessor,
    'css': defaultProcessor,
    'pages': markdownProcessor
};

export async function loadPagesFromDir(dir: string, db: Database, parentMetadata: any = {}, distPath: string) {
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
            await loadPagesFromDir(fullPath, db, metadata, distPath);
        } else if (entry.name !== 'meta.yaml') {
            // Get the directory name to determine the processor
            const dirName = path.basename(path.dirname(fullPath));
            const processor = processors[dirName] || defaultProcessor;
            
            try {
                const content = await fs.readFile(fullPath, 'utf8');
                const { content: processedContent, metadata: finalMetadata } = 
                    await processor(fullPath, content, metadata, distPath);
                
                const slug = path.relative('pages', fullPath).replace(ext, '');
                
                db.prepare(`
                    INSERT INTO pages (slug, content, template, metadata, published_date) 
                    VALUES (?, ?, ?, ?, ?)
                `).run(
                    slug,
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
