import { expect, test, beforeEach, afterEach, jest, describe } from '@jest/globals';
import { mkdtemp, rm, readFile, mkdir, writeFile, readdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import createSite from '../src/cli/new';

const SRC_STARTER_DIR = join(dirname(__dirname), 'src/starter');

describe('createSite', () => {
  let tempDir: string;
  let starterDir: string;

  // Add console suppression
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  // Restore console
  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    // Create temporary directories
    tempDir = await mkdtemp(join(tmpdir(), 'absurdsite-test-dest-'));
    starterDir = await mkdtemp(join(tmpdir(), 'absurdsite-test-starter-'));

    // Create starter directory structure
    await mkdir(join(starterDir, 'pages', 'blog'), { recursive: true });
    await mkdir(join(starterDir, 'public'), { recursive: true });

    // Create test files
    await writeFile(
      join(starterDir, 'site.yaml'),
      'title: <your site title>\nurl: <your site url>'
    );

    await writeFile(
      join(starterDir, 'public', 'manifest.json'),
      JSON.stringify(
        {
          name: 'BakedSite',
          short_name: 'Baked',
          description: 'Baked is a static site generator for the modern web.',
        },
        null,
        2
      )
    );

    await writeFile(
      join(starterDir, 'pages', 'blog', 'meta.yaml'),
      'template: blog\nmimetype: text/markdown'
    );

    // write a blog post
    await writeFile(
      join(starterDir, 'pages', 'blog', 'first-post.md'),
      '---\ntitle: My First Post\n---\n# My First Post\n\nThis is the content of my first post.'
    );

    // Mock the prompt function
    global.prompt = jest.fn((message: string | undefined) => {
      switch (message) {
        case 'Site name:':
          return 'Test Site';
        case 'Site URL:':
          return 'test.com';
        case 'Site description:':
          return 'A test site';
        case 'Default author name:':
          return 'Test Author';
        default:
          return '';
      }
    });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
    await rm(starterDir, { recursive: true, force: true });
  });

  test('should handle missing directories in starter gracefully', async () => {
    // Remove some directories to simulate incomplete starter
    await rm(join(starterDir, 'assets'), { recursive: true, force: true });
    await createSite(tempDir, starterDir);

    // Should still copy available directories
    const dirs = await readdir(tempDir);
    expect(dirs).toContain('pages');
    expect(dirs).toContain('public');
  });

  test('should create a new site with correct configuration', async () => {
    // Temporarily override the starter directory path

    await createSite(tempDir, starterDir);

    // Verify site.yaml
    const siteYaml = await readFile(join(tempDir, 'site.yaml'), 'utf-8');
    expect(siteYaml).toContain('name: Test Site');
    expect(siteYaml).toContain('url: test.com');
    expect(siteYaml).toContain('description: A test site');
    expect(siteYaml).toContain('author: Test Author');

    // Verify blog/meta.yaml
    const blogMeta = await readFile(join(tempDir, 'pages', 'blog', 'meta.yaml'), 'utf-8');
    expect(blogMeta).toContain('author: Test Author');

    // Verify manifest.json
    const manifest = JSON.parse(await readFile(join(tempDir, 'public', 'manifest.json'), 'utf-8'));
    expect(manifest.name).toBe('Test Site');
    expect(manifest.short_name).toBe('Test');
    expect(manifest.description).toBe('A test site');

    // verify blog post
    const blogPost = await readFile(join(tempDir, 'pages', 'blog', 'first-post.md'), 'utf-8');
    expect(blogPost).toContain('My First Post');
  });

  test('should use default values when prompts are empty', async () => {
    // Override prompt mock to return empty values
    global.prompt = jest.fn(() => '');

    await createSite(tempDir, starterDir);

    // Verify default values in site.yaml
    const siteYaml = await readFile(`${tempDir}/site.yaml`, 'utf-8');
    expect(siteYaml).toContain('name: Baked Site');
    expect(siteYaml).toContain('url: yoursite.com');
    expect(siteYaml).toContain('description: A baked site');
    expect(siteYaml).toContain('author: A baker');
  });
});

describe('createSite with starter directory', () => {
  let tempDir: string;

  beforeEach(async () => {
    // Create temporary directories
    tempDir = await mkdtemp(join(tmpdir(), 'absurdsite-test-dest-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  test('should copy starter directory structure correctly', async () => {
    await createSite(tempDir, SRC_STARTER_DIR);

    // Verify directory structure
    const dirs = await readdir(tempDir);
    expect(dirs).toContain('pages');
    expect(dirs).toContain('assets');
    expect(dirs).toContain('public');

    // Verify subdirectories
    expect(await readdir(join(tempDir, 'pages'))).toContain('blog');
    expect(await readdir(join(tempDir, 'assets'))).toContain('css');
    expect(await readdir(join(tempDir, 'assets'))).toContain('templates');
  });
});
