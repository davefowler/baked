
import { Filter } from '../types'

// TODO - how should I create an extendable filter library? 
// this seems excessive.  there are probably better practices here 
// - maybe a hook after adding the defaults with env.filter


const cssFilterFactory = (env, baker, nunjucks) => {
    return {
        name: 'css',
        filter: (path) => {
    const styleAsset = baker.getAsset(path, 'css');
    if (!styleAsset) return '';
    const escapedStyle = styleAsset.replace(/<\/style>/gi, '<\\/style>');
    return new nunjucks.runtime.SafeString(`<style>${escapedStyle}</style>`);
   }  
  }   
}

const safeFilterFactory = (baker, nunjucks) => {

}

const safe: Filter = (str: string): string => str;


const date: Filter = (str: string, format: string): string => {
    if (!str) return '';
    const date = new Date(str);
    return date.toLocaleDateString();
  };

    // Add the css filter for easy loading of css assets
    env.addFilter('css', (path) => {
      const styleAsset = baker.getAsset(path, 'css');
      if (!styleAsset) return '';
      const escapedStyle = styleAsset.replace(/<\/style>/gi, '<\\/style>');
      return new nunjucks.runtime.SafeString(`<style>${escapedStyle}</style>`);
    });

    env.addFilter('asset', (path, type) => {
      type = type || inferType(path);
      return baker.getAsset(path, type);
    });
