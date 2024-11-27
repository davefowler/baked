#!/usr/bin/env bun
import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Database } from 'bun:sqlite';
import type { Page } from './types.ts';
import matter from 'gray-matter';
import { TemplateEngine } from './templates/engine';
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
    
    try {
        await fs.writeFile(
            path.join(siteDir, 'site.yaml'),
            yaml.stringify(siteConfig)
        );
    } catch (error) {
        console.error('Error creating site.yaml:', error);
    }
    
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
    
    const pagesDir = path.join(siteDir, 'pages');
    await fs.mkdir(pagesDir, { recursive: true });
    await fs.writeFile(path.join(pagesDir, 'index.md'), indexContent);
    await fs.writeFile(path.join(pagesDir, 'about.md'), aboutContent);
    
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
            'dist',
            'dist/images',
            'dist/public'
        ];
        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true });
        }

        // Initialize the database
        const db = new Database('dist/site.db', { create: true });
        
        // Ensure the database file exists and is writable
        await fs.writeFile('dist/site.db', '');
        
        // Create required tables
        db.exec(`
            CREATE TABLE IF NOT EXISTS pages (
                slug TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                template TEXT NOT NULL,
                metadata TEXT,
                published_date TEXT
            );
                        
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);
        
        // Import and use loading functions
        const { loadPagesFromDir, loadAssetsFromDir } = await import('./loading');
        
        const siteDir = process.cwd();
        const distPath = path.join(siteDir, 'dist');
        await loadPagesFromDir(path.join(siteDir, 'pages'), db);
        await loadAssetsFromDir(path.join(siteDir, 'assets'), db, distPath);

        // Initialize template engine
        const engine = new TemplateEngine(db);
        
        // Load templates from database
        const templates = db.prepare('SELECT path, content FROM assets WHERE type = ?').all('templates');
        for (const template of templates) {
            engine.registerTemplate(template.path.replace('.html', ''), template.content);
        }

        // Get all pages
        const pages = db.prepare('SELECT * FROM pages').all();
        
        // Render each page
        for (const page of pages) {
            const rendered = engine.render(page.template, {
                ...page,
                metadata: JSON.parse(page.metadata || '{}'),
                site: yaml.parse(await fs.readFile('site.yaml', 'utf8'))
            });

            // Write rendered page to dist
            const outputPath = path.join(distPath, `${page.slug}.html`);
            await fs.mkdir(path.dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, rendered);
        }

        console.log(`Built ${pages.length} pages`);
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
