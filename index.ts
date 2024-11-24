import { Database } from 'bun:sqlite';
import { promises as fs } from 'fs';
import { parse as parseYAML } from 'yaml';
import matter from 'gray-matter';
import path from 'path';
import Handlebars from 'handlebars';
import { marked } from 'marked';

interface PageRecord {
    id?: number;
    slug: string;
    title: string;
    content: string;
    template: string;
    lang: string;
    tags: string;
    path: string;
    metadata: Record<string, any>;
}

interface MetaData {
    [key: string]: any;
}

async function loadMetaYAML(dirPath: string): Promise<MetaData> {
    const metaPath = path.join(dirPath, 'meta.yaml');
    try {
        const content = await fs.readFile(metaPath, 'utf-8');
        return parseYAML(content);
    } catch (error) {
        return {};
    }
}

async function processDirectory(dirPath: string, parentMeta: MetaData = {}): Promise<void> {
    const dirMeta = await loadMetaYAML(dirPath);
    const mergedMeta = { ...parentMeta, ...dirMeta };
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory()) {
            await processDirectory(fullPath, mergedMeta);
        } else if (entry.name.endsWith('.md')) {
            await processMarkdownFile(fullPath, mergedMeta);
        }
    }
}

async function processMarkdownFile(filePath: string, inheritedMeta: MetaData): Promise<void> {
    const content = await fs.readFile(filePath, 'utf-8');
    const { data: frontMatter, content: markdownContent } = matter(content);
    
    const finalMeta = { ...inheritedMeta, ...frontMatter };
    const relativePath = path.relative('content', filePath);
    const slug = path.basename(relativePath, '.md');
    
    const pageRecord: PageRecord = {
        slug,
        title: finalMeta.title || slug,
        content: markdownContent,
        template: finalMeta.template || 'default',
        lang: finalMeta.lang || 'en',
        tags: Array.isArray(finalMeta.tags) ? finalMeta.tags.join(',') : finalMeta.tags || '',
        path: relativePath,
        metadata: finalMeta
    };
    
    await insertPage(pageRecord);
}

async function insertPage(page: PageRecord): Promise<void> {
    const db = await initializeDatabase('dist/site.db');
    db.run(`
        INSERT OR REPLACE INTO pages (slug, title, content, template, lang, tags, path, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
        page.slug,
        page.title,
        page.content,
        page.template,
        page.lang,
        page.tags,
        page.path,
        JSON.stringify(page.metadata)
    ]);
}

async function initializeDatabase(dbPath: string): Promise<Database> {
    const db = new Database(dbPath);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS pages (
            id INTEGER PRIMARY KEY,
            slug TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            template TEXT NOT NULL,
            lang TEXT,
            tags TEXT,
            path TEXT NOT NULL,
            metadata TEXT
        );
        
        CREATE TABLE IF NOT EXISTS templates (
            name TEXT PRIMARY KEY,
            content TEXT NOT NULL
        );
    `);

    // Load default template if it doesn't exist
    const defaultTemplate = await fs.readFile('templates/default.html', 'utf-8');
    db.run('INSERT OR REPLACE INTO templates (name, content) VALUES (?, ?)', 
        ['default', defaultTemplate]);

    console.log('Database schema created successfully');
    return db;
}

async function renderPages(db: Database): Promise<void> {
    const pages = db.prepare('SELECT * FROM pages').all();
    
    for (const page of pages) {
        // Get the template
        const template = db.prepare('SELECT content FROM templates WHERE name = ?')
            .get(page.template);
            
        if (!template) {
            console.error(`Template ${page.template} not found for ${page.slug}`);
            continue;
        }
        
        // Parse markdown to HTML
        const htmlContent = marked(page.content);
        
        // Compile template
        const compiledTemplate = Handlebars.compile(template.content);
        
        // Render page
        const html = compiledTemplate({
            ...page,
            content: htmlContent,
            metadata: JSON.parse(page.metadata)
        });
        
        // Write to file
        const outputPath = path.join('dist', `${page.slug}.html`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, html);
    }
}

async function main() {
    // Create necessary directories
    await fs.mkdir('content', { recursive: true });
    await fs.mkdir('scripts', { recursive: true });
    await fs.mkdir('dist', { recursive: true });
    await fs.mkdir('templates', { recursive: true });

    // Initialize the database
    const db = await initializeDatabase('dist/site.db');
    
    // Process content directory
    await processDirectory('content');
    
    // Generate HTML files
    await renderPages(db);
    
    console.log('Content processed and static files generated');
}

main().catch(console.error);
