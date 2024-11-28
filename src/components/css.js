const BaseComponent = require('./base');

class CssComponent extends BaseComponent {
    render(absurd, page, site) {
        return `<style>${this.rawAsset}</style>`;
    }
}

module.exports = (rawAsset) => new CssComponent(rawAsset);
