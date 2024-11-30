#!/usr/bin/env bun
import { program } from 'commander';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import Database from 'better-sqlite3';
import type { Page } from '../types';
import matter from 'gray-matter';

/* CLI options

bake new <site destination>
   - will then prompt for site.yaml values
   - coppies starter_ to the destination and fills in prompts
   
bake build
   will build the site to dist/
        - loads site.yaml, pages/*, assets/* into database
        - pre-renders each page to dist/
    --drafts will build in draft pages


bake serve <site port = 4242>
   will start the development server on the specified port (default 4242)

bake help
   shows this help

bake versions


Fun aliases: if you prefer cooking to coding, you'll love these 

bake starter # alias for bake new
bake site # alias for bake build
bake serve # Psych, it didn't need an alias its a double entendre!

*/


program
    .name('bake')
    .description('CLI for creating and managing Baked websites, a fully baked site generator')
    .version('0.0.2');

program
    .command('new')
    .alias('starter')
    .argument('<site destination>', 'Destination directory for the new site')
    .description('Create a new baked site')
    .action(async (destination) => {
        console.log(`Getting the ingredients for ${destination}...`);
        import('./new.ts').then(module => module.default(destination));
    });

program
    .command('build')
    .alias('site')
    .option('--drafts', 'Build draft pages')
    .description('Bake the site - so it\'s ready to be served!')
    .action(async (options) => {
        console.log('Let\'s get cooking...');
        import('./build.ts').then(module => module.default(options.drafts));
    });

program
    .command('serve')
    .description('Start development server')
    .action(() => {
        console.log('Starting development server...');
        import('./serve.ts').then(module => module.default());
    });

program.command('help').action(() => {
    program.help();
});

program.command('versions').action(() => {
    console.log(`Baked CLI version: ${process.env.npm_package_version}`);
});

program.parse();
