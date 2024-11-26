const BaseComponent = require('./base');

class PageComponent extends BaseComponent {
    render(absurd, page, site) {
        // Parse the page content as markdown
        const content = marked(this.rawAsset);
        
        // Get the template specified in page metadata or fall back to default
        const templateName = page.metadata?.template || 'default';
        const template = absurd.getTemplate(templateName);
        
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }
        
        // Render the page content within the template
        return template.render(absurd, {
            ...page,
            content,
            site
        });
    }
}

module.exports = (rawAsset) => new PageComponent(rawAsset);
