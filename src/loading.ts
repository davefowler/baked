import { readFileSync } from 'fs';
import { join } from 'path';
import { parse as parseYaml } from 'yaml';
import { Database } from 'better-sqlite3';

export const defaultMixer = async (filepath: string, content: string, metadata: any) => {
    return {
        content,
        metadata: {...metadata} // Create a new object to avoid inheriting properties
    };
};

export const markdownMixer = async (filepath: string, content: string, metadata: any) => {
    // Parse front matter
    const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (match) {
        const [_, frontMatter, mainContent] = match;
        const fm = parseYaml(frontMatter) || {};
        
        // Create new metadata object combining front matter and passed metadata
        const newMetadata = {
            ...metadata, // Base metadata
            ...fm // Front matter overrides
        };
        
        return {
            content: mainContent.trim(),
            metadata: newMetadata
        };
    }
    
    return {
        content,
        metadata: {...metadata} // Create new object to avoid inheritance
    };
};

export const loadPagesFromDir = async (db: Database, pagesDir: string, meta: any = {}) => {
    try {
        // Read meta.yaml if it exists
        try {
            const metaPath = join(pagesDir, 'meta.yaml');
            const metaContent = readFileSync(metaPath, 'utf8');
            const metaData = parseYaml(metaContent);
            meta = {...meta, ...metaData};
            console.log('meta.yaml read', meta);
        } catch (err) {
            // Ignore missing meta.yaml
        }

        // Process each page
        const stmt = db.prepare(`
            INSERT INTO pages (path, slug, title, content, metadata, template, published_date)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const processPage = async (filepath: string, content: string, metadata: any = {}) => {
            try {
                const filename = filepath.split('/').pop() || '';
                const slug = filename.replace(/\.[^/.]+$/, '');
                const title = metadata.title || slug;
                const template = metadata.template || 'default';
                const date = metadata.date || null;

                console.log('Loading page:', slug, filepath, slug, title, content, template, metadata, date);

                stmt.run(
                    filepath,
                    slug,
                    title,
                    content,
                    JSON.stringify(metadata),
                    template,
                    date
                );
            } catch (error) {
                console.error(`Error processing ${filepath}:`, error);
            }
        };

        // Your existing page loading logic here
        // This is just a placeholder - you'll need to implement the actual file reading
        // and processing logic based on your requirements

    } catch (error) {
        console.error('Error loading pages:', error);
    }
};
