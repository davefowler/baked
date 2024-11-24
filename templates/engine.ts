export class TemplateEngine {
    private templates: Map<string, string> = new Map();
    private partials: Map<string, string> = new Map();

    registerTemplate(name: string, content: string) {
        this.templates.set(name, content);
    }

    registerPartial(name: string, content: string) {
        this.partials.set(name, content);
    }

    private replacePartials(template: string): string {
        return template.replace(/\{\{>\s*([^}]+)\}\}/g, (match, partialName) => {
            const partial = this.partials.get(partialName.trim());
            if (!partial) {
                throw new Error(`Partial ${partialName} not found`);
            }
            return this.replacePartials(partial); // Handle nested partials
        });
    }

    private replaceVariables(template: string, data: any): string {
        // Handle triple braces for unescaped HTML
        template = template.replace(/\{\{\{([^}]+)\}\}\}/g, (match, path) => {
            return this.getValueFromPath(data, path.trim()) || '';
        });

        // Handle double braces for escaped content
        template = template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const value = this.getValueFromPath(data, path.trim());
            return this.escapeHtml(value?.toString() || '');
        });

        // Handle if conditions
        template = template.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (match, condition, content) => {
            const value = this.getValueFromPath(data, condition.trim());
            return value ? this.replaceVariables(content, data) : '';
        });

        return template;
    }

    private getValueFromPath(obj: any, path: string): any {
        return path.split('.').reduce((acc, part) => {
            if (acc === null || acc === undefined) return undefined;
            return acc[part.trim()];
        }, obj);
    }

    private escapeHtml(str: string): string {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    render(templateName: string, data: any): string {
        const template = this.templates.get(templateName);
        if (!template) {
            throw new Error(`Template ${templateName} not found`);
        }

        let result = this.replacePartials(template);
        result = this.replaceVariables(result, data);
        return result;
    }
}
