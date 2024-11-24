export class TemplateEngine {
    private templates: Map<string, Function> = new Map();

    registerTemplate(name: string, templateStr: string) {
        const templateFn = (data: any, engine: TemplateEngine) => {
            // Create a function that will process the template string
            return new Function('data', 'engine', `return \`${templateStr}\`;`)(data, engine);
        };
        this.templates.set(name, templateFn);
    }

    registerPartial(name: string, templateStr: string) {
        // Partials are just templates, so we can use the same storage
        this.registerTemplate(name, templateStr);
    }

    render(templateName: string, data: any): string {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }
        return template(data, this);
    }
}
