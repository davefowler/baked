import { Database } from 'bun:sqlite';
import { promises as fs } from 'fs';
import { parse as parseYAML } from 'yaml';
import matter from 'gray-matter';
import path from 'path';
import { marked } from 'marked';
const TemplateComponent = require('./assets/components/template');

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

    // Load templates from examples/defaultsite/assets/templates
    const templatesDir = 'examples/defaultsite/assets/templates';
    const templates = await fs.readdir(templatesDir);
    
    for (const template of templates) {
        if (template.endsWith('.html')) {
            const name = path.basename(template, '.html');
            const content = await fs.readFile(path.join(templatesDir, template), 'utf-8');
            db.run('INSERT OR REPLACE INTO templates (name, content) VALUES (?, ?)',
                [name, content]);
        }
    }

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

async function renderPages(db: Database, TemplateComponent: any): Promise<void> {
    const pages = db.prepare('SELECT * FROM pages').all();
    
    for (const page of pages) {
        // Parse markdown to HTML
        const htmlContent = marked(page.content);
        
        // Get template content
        const templateResult = db.prepare('SELECT content FROM templates WHERE name = ?')
            .get(page.template || 'default');
            
        if (!templateResult) {
            console.error(`Template ${page.template} not found`);
            continue;
        }
        
        // Create template component
        const template = TemplateComponent(templateResult.content);
        
        // Render page using template component
        const html = template.render(
            {
                getTemplate: (name: string) => {
                    const result = db.prepare('SELECT content FROM templates WHERE name = ?').get(name);
                    return result ? TemplateComponent(result.content) : null;
                },
                getAsset: (path: string) => {
                    const result = db.prepare('SELECT content FROM assets WHERE path = ?').get(path);
                    return result ? result.content : '';
                }
            },
            {
                ...page,
                content: htmlContent,
                metadata: JSON.parse(page.metadata)
            },
            {}
        );
        
        // Write to file
        const outputPath = path.join('dist', `${page.slug}.html`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, html);
    }
}

export async function main() {
    // Create necessary directories
    const dirs = [
        'content',
        'content/blog',
        'scripts',
        'dist',
        'dist/styles',
        'templates',
        'public',
        'assets',
        'assets/components',
        'assets/templates'
    ];
    
    for (const dir of dirs) {
        await fs.mkdir(dir, { recursive: true });
    }

    // Create public directory if it doesn't exist
    await fs.mkdir(path.join(process.cwd(), 'public'), { recursive: true });
    
    // Copy required public files
    const publicFiles = {
        'sw.js': `const CACHE_NAME = 'absurdsite-v1';
const ASSETS = [
  '/',
  '/db.js',
  '/site.db',
  '/manifest.json',
  '/rss.xml',
  '/sitemap.xml',
  '/robots.txt'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});`,
        'manifest.json': JSON.stringify({
            name: "AbsurdSite",
            short_name: "AbsurdSite",
            start_url: '/',
            display: 'standalone',
            background_color: '#ffffff',
            theme_color: '#000000',
            icons: [
                {
                    src: '/icon-192.png',
                    sizes: '192x192',
                    type: 'image/png'
                },
                {
                    src: '/icon-512.png',
                    sizes: '512x512',
                    type: 'image/png'
                }
            ]
        }, null, 2),
        'offline.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Offline - AbsurdSite</title>
</head>
<body>
    <h1>You're Offline</h1>
    <p>Sorry, you're currently offline and we couldn't load this page. Please check your internet connection and try again.</p>
    <p>You can still access any previously visited pages.</p>
</body>
</html>`
    };

    for (const [filename, content] of Object.entries(publicFiles)) {
        await fs.writeFile(path.join(siteDir, 'public', filename), content);
    }

    // Copy db.js from the package
    await fs.copyFile(
        path.join(import.meta.dir, 'public', 'db.js'),
        path.join(siteDir, 'public', 'db.js')
    );

    // Initialize the database
    const db = await initializeDatabase('dist/site.db');
    
    // Process content directory
    await processDirectory('content');
    
    // Generate HTML files
    await renderPages(db, TemplateComponent);
    
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
