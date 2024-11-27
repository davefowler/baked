import { Database } from "bun:sqlite";

export class TemplateEngine {
    private db: Database;
    private templates: Map<string, string> = new Map();

    constructor(db: Database) {
        this.db = db;
    }

    registerTemplate(name: string, content: string) {
        this.templates.set(name, content);
    }

    render(templateName: string, data: any) {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        // Extract extends directive if present
        const extendsMatch = template.match(/^\{%\s*extends\s+["']([^"']+)["']\s*%\}/);
        const parentTemplate = extendsMatch ? extendsMatch[1] : null;
        const content = template.replace(/^\{%\s*extends\s+["'][^"']+["']\s*%\}/, '').trim();

        // Process blocks
        const blocks = new Map();
        const blockContent = content.replace(/\{%\s*block\s+(\w+)\s*%\}([\s\S]*?)\{%\s*endblock\s*%\}/g, 
            (_, blockName, blockContent) => {
                blocks.set(blockName, blockContent.trim());
                return '';
            }
        );

        // Render template
        const renderContent = (template: string, context: any) => {
            return template.replace(/\${([^}]+)}/g, (_, expr) => {
                try {
                    return eval(`with(context) { ${expr} }`);
                } catch (err) {
                    console.error('Template render error:', err);
                    return '';
                }
            });
        };

        // If this extends another template, render parent with blocks
        if (parentTemplate) {
            const parent = this.templates.get(parentTemplate);
            if (!parent) {
                throw new Error(`Parent template ${parentTemplate} not found`);
            }
            data.blocks = blocks;
            return this.render(parentTemplate, data);
        }

        return renderContent(content, data);
    }
}
