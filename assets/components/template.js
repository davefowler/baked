class TemplateComponent {
    constructor(templateString) {
        this.templateString = templateString;
        const extendsMatch = templateString.match(/^\{%\s*extends\s+["']([^"']+)["']\s*%\}/);
        this.extends = extendsMatch ? extendsMatch[1] : null;
        this.template = templateString.replace(/^\{%\s*extends\s+["'][^"']+["']\s*%\}/, '').trim();
    }

    render(absurd, page, site, ...props) {
        // Create a context object with all available data
        const context = {
            absurd,
            page,
            site,
            ...Object.fromEntries(props)
        };

        // Basic template rendering function
        const renderTemplate = (template, ctx) => {
            return template.replace(/\${([^}]+)}/g, (_, expr) => {
                try {
                    return eval(`with(ctx) { ${expr} }`);
                } catch (err) {
                    console.error(`Template rendering error:`, err);
                    return '';
                }
            });
        };

        // Render the current template
        const renderedTemplate = renderTemplate(this.template, context);

        // If this extends another template, wrap it
        if (this.extends) {
            const parentTemplate = absurd.getTemplate(this.extends);
            return parentTemplate.render(absurd, page, site, {
                ...Object.fromEntries(props),
                children: renderedTemplate
            });
        }

        return renderedTemplate;
    }
}

// Export the component factory
module.exports = (templateString) => new TemplateComponent(templateString);
