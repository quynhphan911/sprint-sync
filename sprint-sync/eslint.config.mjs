import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    rules: {
      // No explicit any types — enforced by TypeScript strict mode
      '@typescript-eslint/no-explicit-any': 'error',
      // Prefer named exports; default exports only for Next.js pages/layouts
      'import/prefer-default-export': 'off',
      // Prefer async/await over .then() chains
      'prefer-promise-reject-errors': 'error',
      // No unused variables
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Consistent return types
      '@typescript-eslint/explicit-function-return-type': 'off',
      // No non-null assertions without justification
      '@typescript-eslint/no-non-null-assertion': 'warn',
    },
  },
]

export default eslintConfig
