import { expect, test, describe } from '@jest/globals';
import { markdownMixer } from '../src/baked/loading';

describe('Markdown Processing', () => {
  test('basic markdown conversion', async () => {
    const content = `---
title: Test Post
---
# Heading 1
## Heading 2
This is a paragraph.`;

    const result = await markdownMixer('test.md', content, {}, '');
    expect(result.content).toContain('<h1>Heading 1</h1>');
    expect(result.content).toContain('<h2>Heading 2</h2>');
    expect(result.content).toContain('<p>This is a paragraph.</p>');
  });

  test('preserves nunjucks template variables', async () => {
    const content = `---
title: Test Post
---
# Welcome {{ page.name }}
This post was written by {{ page.author }}`;

    const result = await markdownMixer('test.md', content, {}, '');
    expect(result.content).toContain('{{ page.name }}');
    expect(result.content).toContain('{{ page.author }}');
  });

  test('converts markdown images to nunjucks macros', async () => {
    const content = `---
title: Test Post
---
Here's an image:
![Alt text](path/to/image.jpg "Image title")
`;

    const result = await markdownMixer('test.md', content, {}, '');
    expect(result.content).toContain('{% image "path/to/image.jpg", "Alt text", "Image title" %}');
    expect(result.content).not.toContain('<img');
  });

  test('handles images without title', async () => {
    const content = `![Alt text](path/to/image.jpg)`;

    const result = await markdownMixer('test.md', content, {}, '');
    expect(result.content).toContain('{% image "path/to/image.jpg", "Alt text", "" %}');
  });

  test('preserves inline HTML', async () => {
    const content = `# Title
<div class="custom">
  This is custom HTML with {{ page.variable }}
</div>`;

    const result = await markdownMixer('test.md', content, {}, '');
    expect(result.content).toContain('<div class="custom">');
    expect(result.content).toContain('{{ page.variable }}');
  });

  test('combines frontmatter with passed metadata', async () => {
    const content = `---
title: Post Title
author: John Doe
---
Content`;

    const metadata = {
      template: 'blog',
      category: 'tech'
    };

    const result = await markdownMixer('test.md', content, metadata, '');
    expect(result.data).toEqual({
      title: 'Post Title',
      author: 'John Doe',
      template: 'blog',
      category: 'tech'
    });
  });
}); 