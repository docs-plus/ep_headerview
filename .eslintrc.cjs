require('eslint-config-etherpad/patch/modern-module-resolution');

module.exports = {
  root: true,
  extends: 'etherpad/plugin',
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true,
    jquery: true,
  },
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
};
