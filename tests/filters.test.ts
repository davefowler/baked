import { expect, test, describe } from '@jest/globals';
import { TemplateFilters } from '../src/filters.js';

describe('Template Filters', () => {
  let mockBaker: any;
  let filters: any;

  beforeEach(() => {
    mockBaker = {
      getAsset: jest.fn()
    };
    filters = new TemplateFilters(mockBaker);
  });

  describe('date filter', () => {
    // Save original timezone
    const originalTZ = process.env.TZ;

    beforeEach(() => {
      // Set timezone to UTC for consistent testing
      process.env.TZ = 'UTC';
    });

    afterEach(() => {
      // Restore original timezone
      process.env.TZ = originalTZ;
    });

    test('formats date with custom format string', () => {
      const dateFilter = TemplateFilters.filterRegistry.get('date');
      const testDate = new Date('2024-03-14T00:00:00.000Z');
      
      expect(dateFilter(testDate, 'yyyy-MM-dd')).toBe('2024-03-14');
      expect(dateFilter(testDate, "yy-'W'ww")).toBe('24-W11');
    });

    test('uses default format when no format string provided', () => {
      const dateFilter = TemplateFilters.filterRegistry.get('date');
      const testDate = new Date('2024-03-14T00:00:00.000Z');
      expect(dateFilter(testDate)).toBe('03/14/2024');
    });

    test('handles dates with specific times', () => {
      const dateFilter = TemplateFilters.filterRegistry.get('date');
      const testDate = new Date('2024-03-14T15:30:00.000Z');
      
      expect(dateFilter(testDate, 'yyyy-MM-dd HH:mm')).toBe('2024-03-14 15:30');
    });

    test('handles invalid dates gracefully', () => {
        const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
        const dateFilter = TemplateFilters.filterRegistry.get('date');
        expect(dateFilter('invalid-date')).toBe('');
        consoleSpy.mockRestore();
      });
  });

  describe('asset filter', () => {
    test('retrieves asset with explicit type', () => {
      const assetFilter = TemplateFilters.filterRegistry.get('asset');
      mockBaker.getAsset.mockReturnValue('asset content');
      
      const result = assetFilter('file.txt', 'text');
      expect(mockBaker.getAsset).toHaveBeenCalledWith('file.txt', 'text');
      expect(result).toBe('asset content');
    });

    test('infers type from file extension', () => {
      const assetFilter = TemplateFilters.filterRegistry.get('asset');
      mockBaker.getAsset.mockReturnValue('template content');
      
      assetFilter('template.html');
      expect(mockBaker.getAsset).toHaveBeenCalledWith('template.html', 'templates');
    });
  });

  describe('image filter', () => {
    test('generates img tag with all attributes', () => {
      const imageFilter = TemplateFilters.filterRegistry.get('image');
      mockBaker.getAsset.mockReturnValue('image-data');
      
      const result = imageFilter('test.jpg', 'Alt text', 'Image title', '100px', '200px');
      expect(result.toString()).toContain('src="test.jpg"');
      expect(result.toString()).toContain('alt="Alt text"');
      expect(result.toString()).toContain('title="Image title"');
      expect(result.toString()).toContain('maxWidth="100px"');
      expect(result.toString()).toContain('maxHeight="200px"');
    });

    test('handles missing image asset', () => {
      const imageFilter = TemplateFilters.filterRegistry.get('image');
      mockBaker.getAsset.mockReturnValue(null);
      
      expect(imageFilter('missing.jpg')).toBe('');
    });

    test('escapes HTML in attributes', () => {
      const imageFilter = TemplateFilters.filterRegistry.get('image');
      mockBaker.getAsset.mockReturnValue('image-data');
      
      const result = imageFilter('test.jpg', '<script>alert("xss")</script>', '<h1>title</h1>');
      expect(result.toString()).not.toContain('<script>');
      expect(result.toString()).toContain('&lt;script&gt;');
    });
  });

  describe('css filter', () => {
    test('wraps CSS content in style tags', () => {
      const cssFilter = TemplateFilters.filterRegistry.get('css');
      mockBaker.getAsset.mockReturnValue('body { color: red; }');
      
      const result = cssFilter('styles.css');
      expect(result.toString()).toMatch(/<style>body { color: red; }<\/style>/);
    });

    test('escapes closing style tags in content', () => {
      const cssFilter = TemplateFilters.filterRegistry.get('css');
      mockBaker.getAsset.mockReturnValue('body { color: red; } </style><script>alert("xss")</script>');
      
      const result = cssFilter('styles.css').toString();
      expect(result).toContain('<\\/style>');
      expect(result.slice(0, -8)).not.toContain('</style>');
    });

    test('handles missing CSS asset', () => {
      const cssFilter = TemplateFilters.filterRegistry.get('css');
      mockBaker.getAsset.mockReturnValue(null);
      
      expect(cssFilter('missing.css')).toBe('');
    });
  });
}); 