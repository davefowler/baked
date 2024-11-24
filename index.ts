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
    // Read CSS file
    const mainCss = await fs.readFile('public/styles/main.css', 'utf-8');
    
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
            metadata TEXT,
            UNIQUE(slug)
        );
        
        CREATE TABLE IF NOT EXISTS templates (
            name TEXT PRIMARY KEY,
            content TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS assets (
            path TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            mime_type TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS site_content (
            key TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
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

    // Store CSS in assets
    db.run('INSERT OR REPLACE INTO assets (path, content, mime_type) VALUES (?, ?, ?)',
        ['/styles/main.css', mainCss, 'text/css']);

    // Generate and store RSS feed
    const rss = generateRSSFeed(db);
    db.run('INSERT OR REPLACE INTO site_content (key, content) VALUES (?, ?)',
        ['rss.xml', rss]);

    // Generate and store sitemap
    const sitemap = generateSitemap(db);
    db.run('INSERT OR REPLACE INTO site_content (key, content) VALUES (?, ?)',
        ['sitemap.xml', sitemap]);

    // Store robots.txt
    const robotsTxt = `User-agent: *\nAllow: /\nSitemap: /sitemap.xml`;
    db.run('INSERT OR REPLACE INTO site_content (key, content) VALUES (?, ?)',
        ['robots.txt', robotsTxt]);

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
    await fs.mkdir('public', { recursive: true });

    // Copy public files to dist
    const publicFiles = ['sw.js', 'db.js', 'manifest.json', 'offline.html'];
    for (const file of publicFiles) {
        await fs.copyFile(`public/${file}`, `dist/${file}`);
    }

    // Initialize the database
    const db = await initializeDatabase('dist/site.db');
    
    // Process content directory
    await processDirectory('content');
    
    // Generate HTML files
    await renderPages(db);
    
    console.log('Content processed and static files generated');
}

main().catch(console.error);
function generateRSSFeed(db: Database): string {
    const posts = db.prepare(`
        SELECT p.*, json_extract(p.metadata, '$.date') as post_date 
        FROM pages p
        WHERE template = 'blog' 
        ORDER BY post_date DESC 
        LIMIT 10
    `).all();

    return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
    <title>AbsurdSite Blog</title>
    <link>https://absurdsite.com</link>
    <description>Latest blog posts</description>
    ${posts.map(post => `
        <item>
            <title>${post.title}</title>
            <link>https://absurdsite.com/${post.slug}</link>
            <pubDate>${new Date(JSON.parse(post.metadata).date).toUTCString()}</pubDate>
            <guid>https://absurdsite.com/${post.slug}</guid>
        </item>
    `).join('')}
</channel>
</rss>`;
}

function generateSitemap(db: Database): string {
    const pages = db.prepare('SELECT slug, path FROM pages').all();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${pages.map(page => `
        <url>
            <loc>https://absurdsite.com/${page.slug}</loc>
        </url>
    `).join('')}
</urlset>`;
}
