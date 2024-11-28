const PassThrough = (rawAsset) => {
    return () => rawAsset;
};

const Css = (rawAsset) => {
    return (page, baker, site, ...props) => {
        return `<style>${rawAsset}</style>`;
    };
};


const Template = (rawAsset) => {
    // This whole site is read only so an eval
    const fn = eval(`(function(page, baker, site, ...props) { return \`${rawAsset}\`; })`);
    return fn;
};

export const Components = {
    'images': PassThrough,
    'css': Css,
    'templates': Template
};
