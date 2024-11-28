const BaseComponent = require('./base');

class JavaScriptComponent extends BaseComponent {
    render(absurd, page, site, async = false, defer = false) {
        const asyncAttr = async ? ' async' : '';
        const deferAttr = defer ? ' defer' : '';
        return `<script${asyncAttr}${deferAttr}>${this.rawAsset}</script>`;
    }
}

module.exports = (rawAsset) => new JavaScriptComponent(rawAsset);
