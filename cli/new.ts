import { cp } from 'fs/promises';
import { writeFile } from 'fs/promises';
import { readFile } from 'fs/promises';

export default async function createSite(destination: string) {
    // copy the starter site to the destination directory recursively
    await cp('./starter', destination, { recursive: true });


    // prompt for the values
    console.log('Before we get cookin\' let\'s get some info about the site...');
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

    // update specific fields in the pages/manifest.json file
    const manifestPath = `${destination}/pages/manifest.json`;
    const existingManifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
    
    const updatedManifest = {
        ...existingManifest,
        name: siteName,
        short_name: siteName.split(' ')[0], // Uses first word of site name
        description: siteDescription
    };
    
    await writeFile(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf-8');

}

