import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt([
  {
    ignores: ['static/tac/**']
  },
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      'vue/multi-word-component-names': 'off'
    }
  }
])
