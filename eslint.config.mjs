// See: https://eslint.org/docs/latest/use/configure/configuration-files

import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import typescriptEslint from '@typescript-eslint/eslint-plugin'
import tsParser from '@typescript-eslint/parser'
import jest from 'eslint-plugin-jest'
import prettier from 'eslint-plugin-prettier'
import globals from 'globals'

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
})

export default [
    {
        ignores: ['**/coverage', '**/dist', '**/node_modules', '**/lib']
    },
    ...compat.extends(
        'eslint:recommended',
        'plugin:@typescript-eslint/eslint-recommended',
        'plugin:@typescript-eslint/recommended',
        'plugin:jest/recommended',
        'plugin:prettier/recommended'
    ),
    {
        plugins: {
            jest,
            prettier,
            '@typescript-eslint': typescriptEslint
        },

        languageOptions: {
            globals: {
                ...globals.node,
                ...globals.jest
            },

            parser: tsParser,
            ecmaVersion: 2023,
            sourceType: 'module',

            parserOptions: {
                projectService: {
                    // __fixtures__ is nested (e.g. __fixtures__/yandex-sdk/*.ts), so a
                    // single-level glob like the template's is not enough. `**` is rejected
                    // outright by @typescript-eslint (see tseslint.com/allowdefaultproject-glob-too-wide),
                    // so each nesting depth is listed explicitly instead.
                    allowDefaultProject: [
                        '__fixtures__/*.ts',
                        '__fixtures__/*/*.ts',
                        '__tests__/*.ts',
                        'eslint.config.mjs',
                        'jest.config.js',
                        'rollup.config.ts'
                    ],
                    // The default cap (8) is too low for this repo's fixtures and tests.
                    maximumDefaultProjectFileMatchCount_THIS_WILL_SLOW_DOWN_LINTING: 50
                },
                tsconfigRootDir: import.meta.dirname
            }
        },

        rules: {
            camelcase: 'off',
            'no-console': 'off',
            'no-shadow': 'off',
            'no-unused-vars': 'off',
            'prettier/prettier': 'error'
        }
    }
]
