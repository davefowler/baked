import type { Database as DatabaseType } from 'better-sqlite3';
import { promises as fs } from 'fs';
import path from 'path';
import yaml from 'yaml';
import matter from 'gray-matter';
import { escape } from 'html-escaper';
import { marked } from 'marked';

// Mixer - a function that takes a file and loads it properly into the database depending on its type
type Mixer = (
  filePath: string,
  content: string,
  metadata: any,
  distPath?: string
) => {
  content: string;
  data: any;
};

  // Copy asset to it's directory
  const copyAsset = async (filePath: string, distPath?: string, assetDirName?: string) => {
    const defaultDistPath = path.join(process.cwd(), 'dist');
    const targetDistPath = distPath || defaultDistPath;

    // Create images directory if it doesn't exist
    const assetDir = path.join(targetDistPath, assetDirName || '');
    await fs.mkdir(assetDir, { recursive: true });
    const filename = path.basename(filePath);
    const newPath = path.join(assetDir, filename)
    await fs.copyFile(filePath, newPath);
  }


// Default Mixer just returns content and metadata unchanged
// TODO - right now we're allowing all file types to be loaded, but maybe we shouldn't.
const defaultMixer: Mixer = (filePath, content, metadata, distPath) => {
  return { content, data: metadata };
};

// Process markdown files 
export const markdownMixer: Mixer = (filePath, content, metadata, distPath) => {
  const frontmatter = matter(content);
  const combinedMetadata = { ...metadata, ...frontmatter.data };

  // Configure marked to use custom renderer for images and blocks
  const renderer = new marked.Renderer();
  renderer.image = ({href, title, text}) => {
    return `{{ "${href}" | image("${text}", "${title}") }}`;
  };

  // Add custom handling for HTML blocks that contain Nunjucks tags
  renderer.html = ({ text }: { text: string }): string => {
    if (text.includes('{%') || text.includes('{{')) {
      // Return the HTML as-is without wrapping in paragraphs
      return text;
    }
    return text;
  };

  // Configure marked
  marked.setOptions({
    renderer,
  });

  const parsedContent = marked.parse(frontmatter.content) as string;

  return {
    content: parsedContent,
    data: combinedMetadata,
  };
};

// Process image files
const imageMixer: Mixer = (filePath, content, metadata, distPath) => {


  const filename = path.basename(filePath);
  const newPath = path.join('images', filename);

  // No need to await this async function
  copyAsset(filePath, distPath, 'images')

  // Return img tag as content
  return {
    content: `<img src="/${newPath}" alt="${metadata.alt || filename}" />`,
    data: metadata,
  };
};

// Map directories to Mixers
const mixers: Record<string, Mixer> = {
  images: imageMixer,
  components: defaultMixer,
  templates: defaultMixer,
  css: defaultMixer,
  pages: markdownMixer,
};

// For the Pages loading.  Asset mixers right now are handled by their directory
const getMixerByFilename = (filename: string): Mixer => {
  if (filename.endsWith('.md') || filename.endsWith('.markdown')) {
    return markdownMixer;
  }
  return defaultMixer;
};

export const loadPage = (db: DatabaseType, pagePath: string, content: string, data: any) => {
  const slug = pagePath.replace(path.extname(pagePath), '').replace(/\.[^/.]+$/, '');
  const title = data.title || path.basename(pagePath, path.extname(pagePath));
  const publishedDate = data.date ? new Date(data.date).toISOString() : null;

  // Sanitize all string values in the data object
  const sanitizedData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === 'string' ? escape(value) : value,
    ])
  );

  const template = sanitizedData?.template ? sanitizedData.template : 'base.html';

  const params = {
    path: pagePath,
    slug,
    title,
    content,
    template,
    data: JSON.stringify(sanitizedData),
    published_date: publishedDate,
  };

  try {
    const stmt = db.prepare(`
            INSERT INTO pages (path, slug, title, content, template, data, published_date) 
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

    // Ensure data is stringified JSON
    const jsonData = typeof params.data === 'string' ? params.data : JSON.stringify(params.data);

    stmt.run(
      String(params.path),
      String(params.slug),
      String(params.title),
      String(params.content),
      String(params.template),
      jsonData,
      params.published_date || null
    );
  } catch (error) {
    console.error('Error loading page:', error);
    console.error('Failed data:', params);
    throw error;
  }
};

export async function loadPagesFromDir(
  dir: string,
  db: DatabaseType,
  parentMetadata: any = {},
  includeDrafts: boolean = false,
  rootDir?: string
) {
  // Store the root directory on first call
  rootDir = rootDir || dir;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const metaPath = path.join(dir, 'meta.yaml');
  let metadata = { ...parentMetadata };

  try {
    const metaContent = await fs.readFile(metaPath, 'utf8');
    metadata = { ...metadata, ...yaml.parse(metaContent) };
  } catch (error) {
    // meta.yaml doesn't exist, continue with parent metadata
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Pass the root directory through recursive calls
      await loadPagesFromDir(fullPath, db, metadata, includeDrafts, rootDir);
      continue;
    } else if (entry.name === 'meta.yaml') {
      // meta.yaml must be handled first (above) so skip here
      continue;
    }

    // Read the file
    const rawFileContent = await fs.readFile(fullPath, 'utf8');

    // Process the file based on its type
    const mixer = getMixerByFilename(entry.name);
    const { content, data } = await mixer(fullPath, rawFileContent, metadata);
    const pagePath = path.relative(rootDir, fullPath).replace(path.extname(fullPath), '');
    // Load the page into the database
    if (!includeDrafts && data.isDraft) return; // drafts are not included unless --drafts is specified
    loadPage(db, pagePath, content, data);
  }
}

export async function loadAssetsFromDir(dir: string, db: DatabaseType, distPath: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      await loadAssetsFromDir(fullPath, db, distPath);
    } else {
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        const type = path.basename(path.dirname(fullPath));

        db.prepare(
          `
                    INSERT INTO assets (path, content, type) 
                    VALUES (?, ?, ?)
                `
        ).run(entry.name, content, type);
      } catch (error) {
        console.error(`Error loading asset ${fullPath}:`, error);
      }
    }
  }
}

export async function loadSiteMetadata(dir: string, db: DatabaseType) {
  const sitePath = path.join(dir, 'site.yaml');
  const siteContent = await fs.readFile(sitePath, 'utf8');
  const siteMetadata = yaml.parse(siteContent);
  db.prepare(
    `
        INSERT INTO assets (path, content, type) VALUES (?, ?, ?)
    `
  ).run('site.yaml', JSON.stringify(siteMetadata), 'json');
}
