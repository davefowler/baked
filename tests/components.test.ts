import { expect, test, describe } from "bun:test";
import { Database } from "bun:sqlite";
import * as cheerio from 'cheerio';

// Mock absurd object
const mockAbsurd = {
    getTemplate: (name: string) => ({
        render: (_: any, data: any) => `<div class="template">${data.content}</div>`
    })
};

describe("Components", () => {
    test("CSS Component", () => {
        const cssComponent = require('../assets/components/css')('.test { color: red; }');
        const result = cssComponent.render(mockAbsurd, {}, {});
        expect(result).toBe('<style>.test { color: red; }</style>');
    });

    test("Image Component", () => {
        const imageComponent = require('../assets/components/image')('base64data');
        const result = imageComponent.render(mockAbsurd, {}, {}, 'Test image', 'test-class');
        const $ = cheerio.load(result);
        const img = $('img');
        
        expect(img.attr('src')).toBe('data:image/png;base64,base64data');
        expect(img.attr('alt')).toBe('Test image');
        expect(img.attr('class')).toBe('test-class');
    });

    test("SVG Component", () => {
        const svgContent = '<svg><circle cx="50" cy="50" r="40"/></svg>';
        const svgComponent = require('../assets/components/svg')(svgContent);
        const result = svgComponent.render(mockAbsurd, {}, {}, 'svg-class');
        const $ = cheerio.load(result);
        
        expect($('div.svg-class').html()).toBe(svgContent);
    });

    test("JavaScript Component", () => {
        const jsComponent = require('../assets/components/javascript')('console.log("test")');
        const result = jsComponent.render(mockAbsurd, {}, {}, true, true);
        expect(result).toBe('<script async defer>console.log("test")</script>');
    });

    test("Page Component", () => {
        const pageContent = '# Test Page\nThis is a test.';
        const pageComponent = require('../assets/components/page')(pageContent);
        const result = pageComponent.render(
            mockAbsurd,
            { metadata: { template: 'default' } },
            {}
        );
        
        const $ = cheerio.load(result);
        expect($('.template').html()).toContain('<h1>Test Page</h1>');
        expect($('.template').html()).toContain('<p>This is a test.</p>');
    });
});
