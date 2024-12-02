import { existsSync } from 'fs';
import { cp, writeFile, readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { createInterface } from 'readline';
import { stdin as input, stdout as output } from 'process';
import { fileURLToPath } from 'url';

// Replace the __dirname/__filename code with:
const __filename = new URL('', import.meta.url).pathname;
const __dirname = dirname(__filename);

// Add this helper function at the top of the file
function createPrompts() {
    const rl = createInterface({ input, output });
    
    const prompt = (question: string) => new Promise<string>((resolve) => {
        rl.question(question + ' ', (answer) => {
            resolve(answer);
        });
    });

    return {
        prompt,
        close: () => rl.close()
    };
}

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');  // Go up two levels from dist/cli/new.js to reach package root

export default async function createSite(destination: string, starterDir?: string) {
    // Look for starter files in dist/starter relative to package root
    starterDir = starterDir || join(packageRoot, 'dist', 'starter');
    
    await cp(starterDir, destination, { recursive: true });

    console.log('starter coppied to:', destination, await readdir(destination));
    console.log('public dir contents', await readdir(`${destination}/public`));
    // prompt for the values
    console.log('Before we get cookin\' let\'s get some info about the site...');
    // Create the prompts interface
    const { prompt, close } = createPrompts();
    
    try {
        // Use prompt as before
        const siteName = await prompt('Site name:') || 'Baked Site';
        const siteUrl = await prompt('Site URL:') || 'yoursite.com';
        const siteDescription = await prompt('Site description:') || 'A baked site';
        const siteAuthor = await prompt('Default author name:') || 'A baker';

        // Write those values to the site.yaml file
        const siteYamlContent = `name: ${siteName}
url: ${siteUrl}
description: ${siteDescription}
author: ${siteAuthor}`;
        await writeFile(`${destination}/site.yaml`, siteYamlContent, 'utf-8');

        // write author to the pages/blog/meta.yaml file
        const blogMetaContent = `author: ${siteAuthor}`;
        await writeFile(`${destination}/pages/blog/meta.yaml`, blogMetaContent, 'utf-8');

        console.log('things in ', destination, await readdir(destination));
        // update specific fields in the manifest.json file
        const manifestPath = `${destination}/public/manifest.json`;
        // ensure manifest exists
        if (!existsSync(manifestPath)) {
            throw new Error('manifest.json not found in /public folder');
        }
        const existingManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
        
        const updatedManifest = {
            ...existingManifest,
            name: siteName,
            short_name: siteName.split(' ')[0], // Uses first word of site name
            description: siteDescription
        };
        
        await writeFile(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf-8');

    } finally {
        // Make sure we always close the readline interface
        close();
    }
}

