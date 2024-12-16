import nunjucks from 'nunjucks';

const validatePath = (path) => {
  // Only prevent path traversal, allow absolute paths
  if (path.includes('..')) {
    throw new Error(`Invalid path: ${path}`);
  }
  // Remove leading slash if present
  return path.replace(/^\//, '');
};

// We're a little flexible here with the asset names for convenience
//  - templates don't need the .html extension
//  - we allow /css/style.css as well as css/style.css
//  - and you can just use css/style.css instead of style.css - more intuitive sometimes
export const cleanAssetName = (name, type) => {
  // add .html to the name if it has no other extension
  if (type === 'templates' && !name.includes('.')) name += '.html';

  // if it starts with /, remove it.
  name = validatePath(name);

  // if it starts with it's type name remove it.
  if (name.startsWith(`${type}/`)) {
    name = name.split('/').slice(1).join('/');
  }

  return name;
};

const inferType = (path) => {
  if (path.endsWith('.html')) return 'templates';
  if (path.endsWith('.css')) return 'css';
  return null;
};

const PassThrough = (rawAsset) => {
  return rawAsset;
};

// TODO - should the component wrap the style class?
const CssComponent = PassThrough;

const JsonComponent = (rawAsset) => {
  return JSON.parse(rawAsset);
};

// Configure nunjucks
const env = new nunjucks.Environment(null, {
  autoescape: true,
  throwOnUndefined: false,
  noGlobals: true,
});

// Add custom filters
env.addFilter('safe', (str) => str);
env.addFilter('date', (str, format) => {
  if (!str) return '';
  const date = new Date(str);
  return date.toLocaleDateString();
});

// Create custom loader for templates
class BakerLoader {
  constructor(baker) {
    this.baker = baker;
  }

  // Nunjucks loader overwrite to extend or include templates from the baked database instead of a file system
  getSource(name) {
    name = cleanAssetName(name);

    const { content: template } = this.baker.getRawAsset(name, 'templates');
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

const Template = (rawAsset) => {
  let env;

  return (page, baker, site) => {
    // Create new environment for each render with the current baker
    env = new nunjucks.Environment(new BakerLoader(baker), {
      autoescape: true,
      throwOnUndefined: false,
      noGlobals: true,
    });

    // Compile template with new environment
    const template = nunjucks.compile(rawAsset, env);

    // For security reasons we re-specify the interface to these objects
    const context = {
      page: {
        title: page.title || '',
        content: page.content || '',
        data: page.data || {},
        path: validatePath(page.path || ''),
      },
      baker: {
        getAsset: (path, type) => baker?.getAsset?.(validatePath(path), type) ?? null,
        getPage: (slug) => baker?.getPage?.(validatePath(slug)) ?? null,
        getLatestPages: (...args) => baker?.getLatestPages?.(...args) ?? [],
        getPrevPage: (...args) => baker?.getPrevPage?.(...args) ?? null,
        getNextPage: (...args) => baker?.getNextPage?.(...args) ?? null,
        search: (...args) => baker?.search?.(...args) ?? [],
        query: (sql, params) => {
          throw new Error('Direct SQL queries not allowed in templates');
        },
      },
      site: site || {},
    };

    try {
      return template.render(context).trim();
    } catch (error) {
      console.error('Template render error:', error);
      return '';
    }
  };
};

export const Components = {
  images: PassThrough,
  css: CssComponent,
  templates: Template,
  json: JsonComponent,
};
