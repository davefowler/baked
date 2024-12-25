// Template Filters
// TODO - typescript?
import nunjucks from 'nunjucks';


const Safe = (str) => {
  return new nunjucks.runtime.SafeString(str);
}

export class TemplateFilters {
  constructor(baker) {
    this.baker = baker;
    // TODO - get things from registered filters
    // Need to do bind?
  }

  // Function to add all filters to a given nunjucks environment
  applyFilters(env) {
    const excludeFuncs = ['constructor', 'applyFilters'];
    const filters = Object.getOwnPropertyNames(this.prototype).filter(n => !excludeFuncs.includes(n));

    filters.forEach((fName) => {
      env.addFilter(fName, filters[fName])
    })
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

  image(path, maxWidth, maxHeight) {
    const imgAsset = this.baker.getAsset(path, 'image');
    if (!imgAsset) return '';

    let style = '';
    if (maxWidth) style += `maxWidth="${maxWidth}" `
    if (maxHeight) style += `maxHeight="${maxHeight} `
    return Safe(`<img ${style} src=${path}></img>`);
  }
}


