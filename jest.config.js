export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleFileExtensions: ['js', 'mjs', 'cjs', 'jsx', 'ts', 'tsx', 'json', 'node', 'svelte'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^.+\\.svelte$': ['jest-transform-svelte', {
      preprocess: true,
      compilerOptions: { generate: 'ssr' }
    }]
  },
  transform: {
    '^.+\\.[tj]sx?$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        esModuleInterop: true
      }
    }]
  },
  transformIgnorePatterns: [
    '/node_modules/(?!(svelte|@testing-library|baked)/)'
  ]
};
