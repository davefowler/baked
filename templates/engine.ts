import { Database } from 'bun:sqlite';

export class TemplateEngine {
    constructor(private db: Database) {}

    registerTemplate(name: string, content: string) {
        this.db.prepare('INSERT OR REPLACE INTO templates (name, content) VALUES (?, ?)')
            .run(name, content);
    }

    render(templateName: string, data: any) {
        const template = this.db.prepare('SELECT content FROM templates WHERE name = ?')
            .get(templateName);
            
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        // Handle template inheritance
        const extendsMatch = template.content.match(/^\{%\s*extends\s+["']([^"']+)["']\s*%\}/m);
        if (extendsMatch) {
            const parentName = extendsMatch[1];
            
            // Extract block content
            const blockMatch = template.content.match(/\{%\s*block\s+content\s*%\}([\s\S]*?)\{%\s*endblock\s*%\}/m);
            const blockContent = blockMatch ? blockMatch[1].trim() : '';
            
            // Get parent template and render with block content
            const parentTemplate = this.db.prepare('SELECT content FROM templates WHERE name = ?')
                .get(parentName);
                
            if (!parentTemplate) {
                throw new Error(`Parent template ${parentName} not found`);
            }
            
            return parentTemplate.content.replace(/\${data\.blocks\.get\("content"\)\s*\?\?\s*""}/g, blockContent);
        }

        // Basic template rendering
        return template.content.replace(/\${([^}]+)}/g, (_, expr) => {
            try {
                const fn = new Function('data', `return ${expr}`);
                return fn(data);
            } catch (err) {
                console.error(`Template rendering error:`, err);
                return '';
            }
        });
    }
}
