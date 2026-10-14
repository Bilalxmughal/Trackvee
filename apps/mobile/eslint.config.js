const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  ...expoConfig,
  {
    rules: {
      // AnimatedRegion.current during render is the documented react-native-maps pattern
      'react-hooks/refs': 'off',
      'react-hooks/set-state-in-effect': 'warn',
      '@typescript-eslint/array-type': 'off',
      'react/display-name': 'off',
    },
  },
  {
    ignores: ['dist/', '.expo/', 'node_modules/'],
  },
]);
