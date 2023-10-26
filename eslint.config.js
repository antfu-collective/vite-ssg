// @ts-check
const antfu = require('@antfu/eslint-config').default

module.exports = antfu(
  {
    ignores: [
      // eslint ignore globs here
    ],
  },
  {
    rules: {
      'no-restricted-globals': 'off',
    },
  },
)
