// Template Filters
// TODO - typescript?
import nunjucks from 'nunjucks';


const Safe = (str) => {
  return new nunjucks.runtime.SafeString(str);
}

// !TODO - ensure this escapes well
// TODO - write test for filters
const Escape = (str) => {
  return str.replace(/\</gi, '\\<');
}

const addStyle = (name, value) => {
  if (!value) return '';
  const escapedValue = Escape(value);
  return `$name="${escapedValue}" `
}

export class TemplateFilters {
  constructor(baker) {
    this.baker = baker;
    this.applyFilters = this.applyFilters.bind(this);
    // this.applyFilters = this.bind(this.applyFilters);
    // TODO - get things from registered filters
    // Need to do bind?
  }


  // Function to add all filters to a given nunjucks environment
  applyFilters(env) {
    const excludeFuncs = ['constructor', 'applyFilters'];
    const filters = Object.getOwnPropertyNames(this).filter(n => !excludeFuncs.includes(n));

    filters.forEach((fName) => {
      env.addFilter(fName, filters[fName])
    })
  }

  // TODO - is this really doing the right thing?
  safe(str) { return str; }

  // TODO - have this actually take and work with a format
  date(str, format) { 
    if (!str) return '';
    const date = new Date(str);
    return date.toLocaleDateString();
  } 

  // Defaults here
  css(path) {
    const styleAsset = this.baker.getAsset(path, 'css');
    if (!styleAsset) return '';
    const escapedStyle = styleAsset.replace(/<\/style>/gi, '<\\/style>');
    return Safe(`<style>${escapedStyle}</style>`);
  }

  asset(path, type) {
    type = type || inferType(path);
    return this.baker.getAsset(path, type);
  }

  image(path, title,  maxWidth, maxHeight) {
    const imgAsset = this.baker.getAsset(path, 'image');
    if (!imgAsset) return '';
    
    const escapedStyle = addStyle('maxHeight', maxHeight) + addStyle('maxWidth', maxWidth);
    const escapedTitle = Escape(title);
    return Safe(`<img ${escapedStyle} alt=${escapedTitle} src=${path}></img>`);
  }
}


