import nunjucks from 'nunjucks';



const PassThrough = (rawAsset) => {
    return () => rawAsset;
};

const Css = (rawAsset) => {
    return (page, baker, site, ...props) => {
        return `<style>${sanitizeHtml(rawAsset)}</style>`;
    };
};

const JSON = (rawAsset) => {
    return () => JSON.parse(rawAsset);
};


// Configure nunjucks
const env = new nunjucks.Environment(null, { 
    autoescape: true,
    throwOnUndefined: false
});

// Add custom filters
env.addFilter('safe', str => sanitizeHtml(str));
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
        const template = this.baker.getRawAsset(name, 'templates');
        if (!template) {
            throw new Error(`Template ${name} not found`);
        }
        return {
            src: template,
            path: name,
            noCache: true
        };
    }
}

const Template = (rawAsset) => {
    // Create environment with custom loader (will be set for each render)
    let env;

    const sanitizeHtml = (str) => {
        return str.replace(/[&<>"']/g, (match) => {
            const escape = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            };
            return escape[match];
        });
    };
    
    const validatePath = (path) => {
        // Prevent path traversal
        if (path.includes('..') || path.startsWith('/')) {
            throw new Error('Invalid path');
        }
        return path;
    };
    
    // Return render function
    return (page, baker, site) => {
        // Create new environment for each render with the current baker
        env = new nunjucks.Environment(new BakerLoader(baker), { 
            autoescape: true,
            throwOnUndefined: false
        });
        
        // Re-add filters to the new environment
        env.addFilter('safe', str => sanitizeHtml(str));
        env.addFilter('date', (str, format) => {
            if (!str) return '';
            const date = new Date(str);
            return date.toLocaleDateString();
        });

        // Compile template with new environment
        const template = nunjucks.compile(rawAsset, env);

        // For security reasons we re-specify the interface to these objects
        const context = {
            page: {
                title: page.title || '',
                content: page.content || '',
                metadata: page.metadata || {},
                path: validatePath(page.path || '')
            },
            baker: {
                getAsset: (path) => baker?.getAsset?.(validatePath(path)) ?? null,
                getPage: (slug) => baker?.getPage?.(validatePath(slug)) ?? null,
                getLatestPages: (...args) => baker?.getLatestPages?.(...args) ?? [],
                getPrevPage: (...args) => baker?.getPrevPage?.(...args) ?? null,
                getNextPage: (...args) => baker?.getNextPage?.(...args) ?? null,
                search: (...args) => baker?.search?.(...args) ?? [],
                query: (sql, params) => {
                    throw new Error('Direct SQL queries not allowed in templates');
                }
            },
            site: site || {}
        };
        
        try {
            return template.render(context);
        } catch (error) {
            console.error('Template render error:', error);
            return `<pre>Template Error: ${sanitizeHtml(error.message)}</pre>`;
        }
    };
};

export const Components = {
    'images': PassThrough,
    'css': Css,
    'templates': Template,
    'json': JSON
};
