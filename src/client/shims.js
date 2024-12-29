// Browser shims for Node.js built-ins
const path = {
  dirname: (path) => {
    return path.split('/').slice(0, -1).join('/');
  },
  normalize: (path) => {
    return path.replace(/\/+/g, '/');
  }
};

const fs = {
  readFileSync: () => {
    throw new Error('fs.readFileSync is not supported in the browser');
  }
};

export { path, fs };
export default { path, fs }; 