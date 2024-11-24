import { Database } from 'bun:sqlite';
import { Post, Page } from '../models/orm';

export class TemplateEngine {
    private templates: Map<string, Function> = new Map();
    private db: Database;

    constructor(db: Database) {
        this.db = db;
        Post.setDatabase(db);
        Page.setDatabase(db);
        
        // Expose models to templates
        this.Post = Post;
        this.Page = Page;
    }

    // Make Post and Page accessible as properties
    private Post: typeof Post;
    private Page: typeof Page;

    private parseExtends(templateStr: string): { parent: string | null, blocks: Map<string, string> } {
        const extendsMatch = templateStr.match(/\{\% extends ['"](.+?)['"] \%\}/);
        const parent = extendsMatch ? extendsMatch[1] : null;
        
        const blocks = new Map<string, string>();
        const blockRegex = /\{\% block (\w+) \%\}([\s\S]*?)\{\% endblock \%\}/g;
        
        let match;
        while ((match = blockRegex.exec(templateStr)) !== null) {
            blocks.set(match[1], match[2].trim());
        }

        return { parent, blocks };
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
        // Escape backticks and handle template expressions
        const escapedStr = templateStr
            .replace(/`/g, '\\`')
            .replace(/\$\{/g, '\\${');
            
        const templateFn = (data: any, engine: TemplateEngine) => {
            try {
                // Create a function that will process the template string
                const fn = new Function('data', 'engine', `
                    try {
                        with (data) {
                            return \`${escapedStr}\`;
                        }
                    } catch (e) {
                        console.error('Template error:', e);
                        return 'Error rendering template';
                    }
                `);
                return fn(data, engine);
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
