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

    query(sql: string, params: any[] = []): any[] {
        return this.db.prepare(sql).all(...params);
    }

    registerTemplate(name: string, templateStr: string) {
        const templateFn = (data: any, engine: TemplateEngine) => {
            // Create a function that will process the template string
            try {
                return new Function('data', 'engine', `
                    try {
                        return \`${templateStr}\`;
                    } catch (e) {
                        console.error('Template error:', e);
                        return 'Error rendering template';
                    }
                `)(data, engine);
            } catch (e) {
                console.error('Template compilation error:', e);
                return 'Error compiling template';
            }
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
