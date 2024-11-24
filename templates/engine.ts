import { Database } from 'bun:sqlite';

export class TemplateEngine {
    private templates: Map<string, Function> = new Map();
    private db: Database;

    constructor(db: Database) {
        this.db = db;
    }

    getAsset(path: string): string {
        const result = this.db.prepare('SELECT content FROM assets WHERE path = ?').get(path);
        return result ? result.content : '';
    }

    getPage(slug: string): any {
        const result = this.db.prepare('SELECT * FROM pages WHERE slug = ?').get(slug);
        if (result) {
            result.metadata = JSON.parse(result.metadata);
        }
        return result;
    }

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
