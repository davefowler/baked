import { existsSync } from 'fs';
import { cp, writeFile, readFile } from 'fs/promises';
import { createInterface } from 'readline';
import { stdin as input, stdout as output } from 'process';

// Renamed from prompt to promptUser to avoid naming conflict
async function promptUser(question: string): Promise<string> {
  // Use the global prompt if it exists (for testing), otherwise use readline
  if (typeof global.prompt === 'function') {
    return global.prompt(question) ?? '';
  }

  const rl = createInterface({ input, output });
  return new Promise<string>((resolve) => {
    rl.question(question + ' ', (answer: string) => {
      rl.close();
      resolve(answer);
    });
  });
}

export default async function createSite(destination: string, starterDir: string) {
  await cp(starterDir, destination, { recursive: true });

  console.log("Before we get cookin' let's get some info about the site...");

  try {
    // Use logical OR to handle empty strings as well as null/undefined
    const siteName = (await promptUser('Site name:')) || 'Baked Site';
    const siteUrl = (await promptUser('Site URL:')) || 'yoursite.com';
    const siteDescription = (await promptUser('Site description:')) || 'A baked site';
    const siteAuthor = (await promptUser('Default author name:')) || 'A baker';

    // Write those values to the site.yaml file
    const siteYamlContent = `name: ${siteName}
url: ${siteUrl}
description: ${siteDescription}
author: ${siteAuthor}`;
    await writeFile(`${destination}/site.yaml`, siteYamlContent, 'utf-8');

    // write author to the pages/blog/meta.yaml file
    const blogMetaContent = `author: ${siteAuthor}\ncategory: blog`;
    await writeFile(`${destination}/pages/blog/meta.yaml`, blogMetaContent, 'utf-8');

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
      description: siteDescription,
    };

    await writeFile(manifestPath, JSON.stringify(updatedManifest, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error during site creation:', error);
    throw error;
  }
}
