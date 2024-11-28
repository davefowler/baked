class BaseComponent {
    constructor(rawAsset) {
        this.rawAsset = rawAsset;
    }

    render(absurd, page, site, ...props) {
        throw new Error('Component must implement render method');
    }
}

module.exports = BaseComponent;
