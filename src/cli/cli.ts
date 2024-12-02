#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import buildSite from './build.js';
import createSite from './new.js';
import serveSite from './serve.js';

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

// Get package.json version
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, '..', '..');

const packageJson = JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf8')
);

program
    .name('bake')
    .description('CLI for creating and managing Baked websites, a fully baked site generator')
    .version(packageJson.version);

program
    .command('new')
    .alias('starter')
    .argument('<site destination>', 'Destination directory for the new site')
    .description('Create a new baked site')
    .action(async (destination) => {
        console.log(`Getting the ingredients for ${destination}...`);
        const starterDir = join(packageRoot, 'dist', 'starter');
        console.log('starterDir', starterDir, 'packageRoot', packageRoot);
        await createSite(destination, starterDir);
    });

program
    .command('build')
    .alias('site')
    .option('--drafts', 'Build draft pages')
    .description('Bake the site - so it\'s ready to be served!')
    .action(async (options) => {
        console.log('Let\'s get cooking...');
        const sqlDir = join(packageRoot, 'dist/sql');
        await buildSite(process.cwd(), sqlDir, options.drafts);
    });

program
    .command('serve')
    .description('Start development server')
    .action(async () => {
        console.log('Starting development server...');
        await serveSite();
    });

program.command('help').action(() => {
    program.help();
});

program.command('versions').action(() => {
    console.log(`Baked CLI version: ${process.env.npm_package_version}`);
});

program.parse();
