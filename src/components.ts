import nunjucks from 'nunjucks';
import { TemplateFilters } from './filters';
import type { TypeOfAsset } from './types';
import type { Baker } from './baked/baker';

// Type for the context passed to templates
interface TemplateContext {
  page: {
    title: string;
    content: string;
    data: Record<string, any>;
    path: string;
    prevPage: (...args: any[]) => any | null;
    nextPage: (...args: any[]) => any | null;
  };
  baker: {
    getAsset: (path: string, type: TypeOfAsset) => any;
    getPage: (slug: string) => any;
    getLatestPages: (limit?: number, offset?: number, category?: string) => any[];
    search: (...args: any[]) => any[];
    query: (sql: string, params: any[]) => never;
  };
  site: Record<string, any>;
}

const validatePath = (path: string): string => {
  if (path.includes('..')) {
    throw new Error(`Invalid path: ${path}`);
  }
  return path.replace(/^\//, '');
};

export const cleanAssetName = (name: string, type?: TypeOfAsset): string => {
  if (type === 'templates' && !name.includes('.')) name += '.html';

  name = validatePath(name);

  if (type && name.startsWith(`${type}/`)) {
    name = name.split('/').slice(1).join('/');
  }

  return name;
};

const PassThrough = (rawAsset: string) => rawAsset;

const CssComponent = PassThrough;

const JsonComponent = (rawAsset: string) => {
  return JSON.parse(rawAsset);
};

class BakerLoader implements nunjucks.ILoader {
  private baker: Baker;

  constructor(baker: Baker) {
    this.baker = baker;
  }

  getSource(name: string): nunjucks.LoaderSource {
    name = cleanAssetName(name);

    const { content: template } = this.baker.getRawAsset(name, 'templates') || {};
    if (!template) {
      throw new Error(`Template ${name} not found`);
    }
    return {
      src: template,
      path: name,
      noCache: true,
    };
  }
}

const Template = (rawAsset: string) => {
  let env: nunjucks.Environment;

  return (page: any, baker: Baker, site: any): string => {
    // Create new environment for each render with the current baker
    env = new nunjucks.Environment(new BakerLoader(baker), {
      autoescape: true,
      throwOnUndefined: false,
    });

    // Add default and custom filters
    const filters = new TemplateFilters(baker);
    filters.applyFilters(env);

    // Compile template with new environment
    const template = nunjucks.compile(rawAsset, env);

    // render the content first so we can use it in the context
    const renderedContent = page.content ? env.renderString(page.content, { page, baker, site }) : '';

    // For security reasons we re-specify the interface to these objects
    const context: TemplateContext = {
      page: {
        title: page.title || '',
        content: renderedContent,
        data: page.data || {},
        path: validatePath(page.path || ''),
        prevPage: () => baker?.getPrevPage?.(page) ?? null,
        nextPage: () => baker?.getNextPage?.(page) ?? null,
      },
      baker: {
        getAsset: (path, type) => baker?.getAsset?.(validatePath(path), type) ?? null,
        getPage: (slug) => baker?.getPage?.(validatePath(slug)) ?? null,
        getLatestPages: (limit, offset, category) => baker?.getLatestPages?.(limit, offset, category) ?? [],
        search: (query: string, limit = 10, offset = 0) => baker?.search?.(query, limit, offset) ?? [],
        query: (sql: string, params: any[]) => {
          throw new Error('Direct SQL queries not allowed in templates');
        },
      },
      site: site || {},
    };

    try {
      console.log('rendering template', page.path);
      return template.render(context).trim();
    } catch (error) {
      console.error('Template render error:', error);
      return '';
    }
  };
};

type ComponentFunction = typeof PassThrough | typeof JsonComponent | typeof Template;

// Create a type-safe Components object
export const Components: Record<TypeOfAsset, ComponentFunction> = {
  images: PassThrough,
  css: CssComponent,
  templates: Template,
  json: JsonComponent,
}; 