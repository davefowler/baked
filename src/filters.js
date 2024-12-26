// Template Filters
// TODO - typescript?
import nunjucks from 'nunjucks';

// Short-hand for creating a nunjucks SafeString
const Safe = (str) => {
  return new nunjucks.runtime.SafeString(str);
}

// Using Nunjucks' built-in escape function
const Escape = (str) => {
  if (!str) return '';
  return nunjucks.runtime.escape(str);
}

const addStyle = (name, value) => {
  if (!value) return '';
  const escapedValue = Escape(value);
  return `$name="${escapedValue}" `
}

export class TemplateFilters {
  static filterRegistry = new Map();

  // Static method to register filters
  static registerFilter(name, filterFn) {
    this.filterRegistry.set(name, filterFn);
  }

  // Static method to register multiple filters at once
  static registerFilters(filtersObject) {
    Object.entries(filtersObject).forEach(([name, fn]) => {
      this.registerFilter(name, fn);
    });
  }

  constructor(baker) {
    this.baker = baker;
    this.applyFilters = this.applyFilters.bind(this);
    // this.applyFilters = this.bind(this.applyFilters);
    // TODO - get things from registered filters
    // Need to do bind?
    // Register default filters on instantiation
    this.defaultFilters = {
      asset: (path, type) => {
        type = type || inferType(path);
        return this.baker.getAsset(path, type);
      },
      image: (path, title, maxWidth, maxHeight) => {
        const imgAsset = this.baker.getAsset(path, 'image');
        if (!imgAsset) return '';
        
        const escapedStyle = addStyle('maxHeight', maxHeight) + addStyle('maxWidth', maxWidth);
        const escapedTitle = Escape(title);
        return Safe(`<img ${escapedStyle} alt=${escapedTitle} src=${path}></img>`);
      },
      css: (path) => {
        const styleAsset = this.baker.getAsset(path, 'css');
        if (!styleAsset) return '';
        const escapedStyle = styleAsset.replace(/<\/style>/gi, '<\\/style>');
        return Safe(`<style>${escapedStyle}</style>`);
      },
    };
    TemplateFilters.registerFilters(this.defaultFilters);
  }


  // Function to add all filters to a given nunjucks environment
  applyFilters(env) {
    Object.entries(TemplateFilters.filterRegistry).forEach(([name, fn]) => {
      console.log('Filter - ', name, fn)
      env.addFilter(name, fn)
    })
  }
}


