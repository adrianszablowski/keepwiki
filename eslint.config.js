import stylistic from '@stylistic/eslint-plugin';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import { defineConfig } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
	{
		ignores: ['dist/**', 'coverage/**', 'docs/**', '.claude/**'],
	},
	tseslint.configs.recommended,
	eslintPluginPrettierRecommended,
	{
		plugins: { '@stylistic': stylistic },
		rules: {
			'prettier/prettier': ['error', { singleQuote: true, printWidth: 120, useTabs: true }],
			'@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
			'@stylistic/padding-line-between-statements': [
				'error',
				{ blankLine: 'always', prev: '*', next: ['block-like', 'return', 'throw', 'export', 'function', 'class'] },
				{ blankLine: 'always', prev: ['block-like', 'function', 'class', 'import'], next: '*' },
				{ blankLine: 'any', prev: 'import', next: 'import' },
				{ blankLine: 'always', prev: ['const', 'let'], next: '*' },
				{ blankLine: 'any', prev: ['const', 'let'], next: ['const', 'let'] },
			],
		},
	},
]);
