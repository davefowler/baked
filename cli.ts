#!/usr/bin/env bun
import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Database } from 'bun:sqlite';

async function createSiteStructure(siteName: string) {
    const siteDir = path.join(process.cwd(), siteName);
    const templateDir = path.join(import.meta.dir, 'examples', 'defaultsite');
    
    try {
        // Create site directory first
        await fs.mkdir(siteDir, { recursive: true });
        
        // Create subdirectories before copying template
        const dirs = [
            'pages',
            'pages/blog',
            'assets',
            'assets/templates',
            'assets/css',
            'assets/components',
            'assets/images',
            'dist'
        ];
        
        for (const dir of dirs) {
            await fs.mkdir(path.join(siteDir, dir), { recursive: true });
        }

        // Copy example site structure after directories are created
        await fs.cp(templateDir, siteDir, { recursive: true, force: true });
    } catch (error) {
        console.error('Error creating site structure:', error);
        throw error;
    }
    
    // Create site.yaml
    const siteConfig = {
        url: `${siteName}.com`,
        title: siteName,
        description: `${siteName} website`,
        author: 'Your Name',
        language: 'en'
    };
    
    await fs.writeFile(
        path.join(siteDir, 'site.yaml'),
        yaml.stringify(siteConfig)
    );
    
    // Create default pages
    const indexContent = `---
title: Welcome to ${siteName}
template: default
---
# Welcome to ${siteName}

This is your new website built with AbsurdSite.`;
    
    const aboutContent = `---
title: About
template: default
---
# About ${siteName}

Tell your visitors about your site.`;
    
    await fs.writeFile(path.join(siteDir, 'pages', 'index.md'), indexContent);
    await fs.writeFile(path.join(siteDir, 'pages', 'about.md'), aboutContent);
    
    // Create blog meta.yaml
    const blogMeta = {
        template: 'blog',
        listTemplate: 'blog-list'
    };
    
    await fs.writeFile(
        path.join(siteDir, 'pages', 'blog', 'meta.yaml'),
        yaml.stringify(blogMeta)
    );
    
    console.log(`Created new site: ${siteName}`);
    console.log(`\nNext steps:`);
    console.log(`  cd ${siteName}`);
    console.log(`  absurd serve   # Start development server`);
}

program
    .name('absurd')
    .description('CLI for creating and managing AbsurdSite static websites')
    .version('1.0.0');

program
    .command('new')
    .argument('<sitename>', 'Name of the new site')
    .description('Create a new static site')
    .action(createSiteStructure);

program
    .command('build')
    .description('Build the static site')
    .action(async () => {
        console.log('Building site...');
        
        // Create necessary directories
        const dirs = [
            'scripts',
            'dist',
            'templates',
            'public',
            'assets',
            'assets/components',
            'assets/templates'
        ];
        
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }

        // Initialize the database
        const db = new Database('dist/site.db');
        
        // Create required tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                template TEXT NOT NULL,
                metadata TEXT
            );
            
            CREATE TABLE IF NOT EXISTS templates (
                name TEXT PRIMARY KEY,
                content TEXT NOT NULL
            );
            
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);
        
        // Process content directory
        const loadPagesFromDir = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await loadPagesFromDir(path.join(dir, entry.name));
                } else if (entry.name.endsWith('.md')) {
                    const content = await fs.readFile(path.join(dir, entry.name), 'utf8');
                    // Process markdown files
                    db.prepare('INSERT INTO pages (slug, content, template) VALUES (?, ?, ?)')
                        .run(entry.name.replace('.md', ''), content, 'default');
                }
            }
        };
        await loadPagesFromDir('pages');
        
        // Generate HTML files
        await renderPages(db);

async function renderPages(db: Database) {
    const pages = db.prepare('SELECT * FROM pages').all();
    const distDir = path.join(process.cwd(), 'dist');
    
    for (const page of pages) {
        const template = db.prepare('SELECT content FROM templates WHERE name = ?')
            .get(page.template);
            
        if (!template) {
            console.warn(`Template ${page.template} not found for page ${page.slug}`);
            continue;
        }
        
        // Parse metadata if it exists
        const metadata = page.metadata ? JSON.parse(page.metadata) : {};
        
        // Render the page
        const html = template.content.replace(/\${([^}]+)}/g, (_, expr) => {
            try {
                const fn = new Function('page', `return ${expr}`);
                return fn({ ...page, metadata });
            } catch (err) {
                console.error(`Template rendering error for ${page.slug}:`, err);
                return '';
            }
        });
        
        // Write the rendered HTML
        const outputPath = path.join(distDir, `${page.slug}.html`);
        await fs.mkdir(path.dirname(outputPath), { recursive: true });
        await fs.writeFile(outputPath, html);
    }
}
        
        console.log('Content processed and static files generated');
    });

program
    .command('serve')
    .description('Start development server')
    .action(() => {
        console.log('Starting development server...');
        // Import and run the serve process
        import('./serve.ts').then(module => module.default());
    });

program.parse();
