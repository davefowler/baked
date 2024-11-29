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

const PassThrough = (rawAsset) => {
    return () => rawAsset;
};

const Css = (rawAsset) => {
    return (page, baker, site, ...props) => {
        return `<style>${sanitizeHtml(rawAsset)}</style>`;
    };
};

import nunjucks from 'nunjucks';

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

const Template = (rawAsset) => {
    // Compile the template
    const template = nunjucks.compile(rawAsset, env);
    
    // Return render function
    return (page, baker, site) => {
        const context = {
            page: {
                title: page.title || '',
                content: page.content || '',
                metadata: page.metadata || {},
                path: validatePath(page.path || '')
            },
            baker: {
                getAsset: (path) => baker.getAsset(validatePath(path)),
                getPage: (slug) => baker.getPage(validatePath(slug)),
                getLatestPages: baker.getLatestPages.bind(baker)
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
    'templates': Template
};
