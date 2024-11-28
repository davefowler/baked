const PassThrough = (rawAsset) => {
    return () => rawAsset;
};

const Css = (rawAsset) => {
    return (page, baker, site, ...props) => {
        return `<style>${rawAsset}</style>`;
    };
};


const Template = (rawAsset) => {
    // Safe template processing without eval
    return (page, baker, site, ...props) => {
        // Create a sanitized context with only allowed variables
        const context = {
            page: {
                title: page.title,
                content: page.content,
                metadata: page.metadata,
                path: page.path
            },
            baker: {
                getAsset: baker.getAsset.bind(baker),
                getPage: baker.getPage.bind(baker),
                getLatestPages: baker.getLatestPages.bind(baker)
            },
            site: {
                title: site.title,
                description: site.description,
                url: site.url
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
                        return obj?.[prop];
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
