export class TemplateEngine {
    private templates: Map<string, Function> = new Map();

    registerTemplate(name: string, templateFn: Function) {
        this.templates.set(name, templateFn);
    }

    render(templateName: string, data: any): string {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }
        return template(data, this);
    }
}
