#!/usr/bin/env bun
import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import { Database } from 'bun:sqlite';
import type { Page } from './types.ts';
import matter from 'gray-matter';
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
            'dist',
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
                metadata TEXT,
                published_date TEXT
            );
                        
            CREATE TABLE IF NOT EXISTS assets (
                path TEXT PRIMARY KEY,
                content TEXT NOT NULL,
                type TEXT NOT NULL
            );
        `);
        
        // Process content directory
        const loadPagesFromDir = async (dir: string, parentMetadata: any = {}) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            const metaPath = path.join(dir, 'meta.yaml');
            const dirMetadata = await fs.readFile(metaPath, 'utf8');
            const metadata = dirMetadata ? {...parentMetadata, ...yaml.parse(dirMetadata)} : parentMetadata;

            for (const entry of entries) {
                if (entry.isDirectory()) {
                    // load metadata from meta.yaml file in the directory
                    await loadPagesFromDir(path.join(dir, entry.name), metadata);
                } else if (entry.name.endsWith('.md')) {
                    const content = await fs.readFile(path.join(dir, entry.name), 'utf8');
                    // parse the frontmatter from the markdown and extend the metadata
                    const frontmatter = matter(content);
                    const newMetadata = {...metadata, ...frontmatter.data};
                    // Process markdown files
                    db.prepare('INSERT INTO pages (slug, content, template, published_date) VALUES (?, ?, ?, ?)')
                        .run(entry.name.replace('.md', ''), content, newMetadata.template, newMetadata.date);
                    console.log(`loaded page: ${entry.name.replace('.md', '')}`, 'with metadata', newMetadata);
                }
            }
        };
        await loadPagesFromDir('pages');

        // Load all the assets into the database
        // TODO - do assets need metadata?  I think for now no.
        const loadAssetsFromDir = async (dir: string) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await loadAssetsFromDir(path.join(dir, entry.name));
                    return;
                }  
                // the type of asset gets defined by the directory name that the file is in
                const type = entry.name;
                const content = await fs.readFile(path.join(dir, entry.name), 'utf8');
                db.prepare('INSERT INTO assets (path, content, type) VALUES (?, ?, ?)')
                    .run(entry.name, content, type);
                console.log(`Loaded asset: ${entry.name} as ${type}`);
            }
        };
        await loadAssetsFromDir('assets');

        // TODO render pages
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
