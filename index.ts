import { Database } from 'bun:sqlite';
import { promises as fs } from 'fs';
import { parse as parseYAML } from 'yaml';
import matter from 'gray-matter';
import path from 'path';
import { marked } from 'marked';
import { TemplateEngine } from './templates/engine';

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

    // Load layouts
    const baseLayout = await fs.readFile('templates/layouts/base.html', 'utf-8');
    db.run('INSERT OR REPLACE INTO templates (name, content) VALUES (?, ?)', 
        ['base', baseLayout]);

    // Load partials
    const headerPartial = await fs.readFile('templates/partials/header.html', 'utf-8');
    const footerPartial = await fs.readFile('templates/partials/footer.html', 'utf-8');
    db.run('INSERT OR REPLACE INTO templates (name, content) VALUES (?, ?)',
        ['header', headerPartial]);
    db.run('INSERT OR REPLACE INTO templates (name, content) VALUES (?, ?)',
        ['footer', footerPartial]);

    // Load page templates
    const defaultTemplate = await fs.readFile('templates/default.html', 'utf-8');
    const blogTemplate = await fs.readFile('templates/blog.html', 'utf-8');
    db.run('INSERT OR REPLACE INTO templates (name, content) VALUES (?, ?)', 
        ['default', defaultTemplate]);
    db.run('INSERT OR REPLACE INTO templates (name, content) VALUES (?, ?)',
        ['blog', blogTemplate]);

    console.log('Database schema created successfully');
    return db;
}

async function renderPages(db: Database): Promise<void> {
    const engine = new TemplateEngine();

    // Register all templates and partials
    const templates = db.prepare('SELECT name, content FROM templates').all();
    for (const template of templates) {
        if (template.name === 'header' || template.name === 'footer') {
            engine.registerPartial(template.name, template.content);
        } else {
            engine.registerTemplate(template.name, template.content);
        }
    }

    const pages = db.prepare('SELECT * FROM pages').all();
    
    for (const page of pages) {
        // Parse markdown to HTML
        const htmlContent = marked(page.content);
        
        // Render page using our template engine
        const html = engine.render(page.template || 'default', {
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
