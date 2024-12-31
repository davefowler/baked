#!/usr/bin/env node
import { program } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import bake from './buildSite.js';
import createSite from './new.js';
import startServer from './serve.js';

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

const packageJson = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf8'));

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
    // TODO - run a check that the site doesn't already exist and this will be overwriting it...
    console.log(`Getting the ingredients for ${destination}...`);
    const starterDir = join(packageRoot, 'dist', 'starter');
    await createSite(destination, starterDir);
  });

// Extract the core functions
async function buildSite(drafts: boolean) {
  const siteDir = process.cwd();
  console.log("Let's get cooking...");
  console.log('package root is', packageRoot);
  await bake(siteDir, packageRoot, drafts);
}

async function serveSite(port: number, indexonly: boolean) {
  console.log('Starting development server...');
  await startServer(port, indexonly);
}

// Use the functions in the commands
program
  .command('build')
  .alias('site')
  .description("Bake the site - so it's ready to be served!")
  .option('--drafts', 'Include draft pages in the build')
  .action(async (options) => {
    await buildSite(options.drafts);
  });

program
  .command('serve')
  .description('Start development server')
  .option('--indexonly', 'Serve only the index.html page to test offline mode')
  .option('--port <port>', 'Port to serve the site on', '4242')
  .action(async (options) => {
    await serveSite(options.port, options.indexonly);
  });

program
  .command('andserve')
  .description('build and serve the site - combo command')
  .option('--drafts', 'Include draft pages in the build')
  .option('--port <port>', 'Port to serve the site on', '4242')
  .option('--indexonly', 'Serve only the index.html page to test offline mode')
  .action(async (options) => {
    await buildSite(options.drafts);
    await serveSite(options.port, options.indexonly);
  });

program.command('help').action(() => {
  program.help();
});

program.command('versions').action(() => {
  console.log(`Baked CLI version: ${process.env.npm_package_version}`);
});

program.parse();
