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

const Template = (rawAsset) => {
    // Safe template processing without eval
    return (page, baker, site, ...props) => {
        // Create a sanitized context with only allowed variables
        const context = {
            page: {
                title: sanitizeHtml(page.title || ''),
                content: sanitizeHtml(page.content || ''),
                metadata: typeof page.metadata === 'object' ? 
                    Object.fromEntries(
                        Object.entries(page.metadata)
                            .map(([k, v]) => [k, typeof v === 'string' ? sanitizeHtml(v) : v])
                    ) : {},
                path: validatePath(page.path || '')
            },
            baker: {
                getAsset: (path) => baker.getAsset(validatePath(path)),
                getPage: (slug) => baker.getPage(validatePath(slug)),
                getLatestPages: baker.getLatestPages.bind(baker)
            },
            site: {
                title: sanitizeHtml(site.title || ''),
                description: sanitizeHtml(site.description || ''),
                url: sanitizeHtml(site.url || '')
            }
        };
        
        // Replace ${...} expressions with context values
        return rawAsset.replace(/\$\{([^}]+)\}/g, (match, expr) => {
            try {
                // Only allow simple property access and method calls
                const value = expr.split('.')
                    .reduce((obj, prop) => {
                        if (typeof obj === 'function') {
                            return obj();
                        }
                        // Prevent access to prototype chain
                        if (!obj || !Object.prototype.hasOwnProperty.call(obj, prop)) {
                            return '';
                        }
                        return obj[prop];
                    }, context);
                return value ?? '';
            } catch (error) {
                console.warn(`Template error: ${error.message}`);
                return '';
            }
        });
    };
};

export const Components = {
    'images': PassThrough,
    'css': Css,
    'templates': Template
};
