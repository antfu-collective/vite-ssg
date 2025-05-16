import antfu from '@antfu/eslint-config'

export default await antfu(
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
