import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // The generated shadcn catalogue is an inactive starter scaffold; lint the
  // shipped game surface rather than components that are never imported.
  globalIgnores(['dist', 'src/components/ui/**']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
  },
  {
    // Rendering methods intentionally live on Game.prototype to keep the
    // simulation class readable. TypeScript validates the merged interface;
    // these two generic rules cannot model that established boundary.
    files: ['src/game/engine.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-declaration-merging': 'off',
    },
  },
])
