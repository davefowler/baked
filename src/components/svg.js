const BaseComponent = require('./base');

class SvgComponent extends BaseComponent {
    render(absurd, page, site, className = '') {
        const classAttr = className ? ` class="${className}"` : '';
        return `<div${classAttr}>${this.rawAsset}</div>`;
    }
}

module.exports = (rawAsset) => new SvgComponent(rawAsset);
