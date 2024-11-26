const BaseComponent = require('./base');

class ImageComponent extends BaseComponent {
    render(absurd, page, site, alt = '', className = '') {
        const classAttr = className ? ` class="${className}"` : '';
        return `<img src="data:image/png;base64,${this.rawAsset}" alt="${alt}"${classAttr}>`;
    }
}

module.exports = (rawAsset) => new ImageComponent(rawAsset);
