import { describe, expect, it } from 'vitest';
import { addVault, emptyRegistry, parseRegistry, renderRegistry, vaultNamePattern } from './registry.js';

const twoVaults = `---
home: ~/keepwiki
inbox: ~/keepwiki/inbox
---

# keepwiki registry

| name | path | description | language |
| --- | --- | --- | --- |
| megadev | ~/keepwiki/vaults/megadev | Kurs MegaDev: architektura i wzorce | pl |
| seo | ~/Desktop/Code/trackist/seo-vault | SEO for the Trackist landing page | en |
`;

describe('the registry file', () => {
	it('starts empty with the default home and inbox', () => {
		const registry = emptyRegistry('~/keepwiki');

		expect(registry.home).toBe('~/keepwiki');
		expect(registry.inbox).toBe('~/keepwiki/inbox');
		expect(registry.vaults).toEqual([]);
	});

	it('parses the frontmatter and one row per vault', () => {
		const registry = parseRegistry(twoVaults);

		expect(registry.home).toBe('~/keepwiki');
		expect(registry.vaults).toHaveLength(2);
		expect(registry.vaults[1]).toEqual({
			name: 'seo',
			path: '~/Desktop/Code/trackist/seo-vault',
			description: 'SEO for the Trackist landing page',
			language: 'en',
		});
	});

	it('renders back to the same text it parsed', () => {
		expect(renderRegistry(parseRegistry(twoVaults))).toBe(twoVaults);
	});

	it('renders an empty registry with the table header and no rows', () => {
		const text = renderRegistry(emptyRegistry('~/keepwiki'));

		expect(text).toContain('| name | path | description | language |');
		expect(text.trim().endsWith('| --- | --- | --- | --- |')).toBe(true);
	});

	it('adds a vault as a new row', () => {
		const registry = addVault(emptyRegistry('~/keepwiki'), {
			name: 'megadev',
			path: '~/keepwiki/vaults/megadev',
			description: 'Kurs MegaDev',
			language: 'pl',
		});

		expect(registry.vaults.map((vault) => vault.name)).toEqual(['megadev']);
	});

	it('refuses a second vault with the same name', () => {
		const registry = parseRegistry(twoVaults);

		expect(() =>
			addVault(registry, { name: 'seo', path: '~/elsewhere', description: 'again', language: 'en' }),
		).toThrow(/seo/);
	});

	it('refuses a vault name that would break @name and [[name:page]]', () => {
		expect(() =>
			addVault(emptyRegistry('~/keepwiki'), {
				name: 'My Vault',
				path: '~/x',
				description: 'spaces',
				language: 'en',
			}),
		).toThrow(/name/);
		expect(vaultNamePattern.test('mega-dev2')).toBe(true);
		expect(vaultNamePattern.test('seo:draft')).toBe(false);
	});

	it('refuses a description with a pipe, which would split the table row', () => {
		expect(() =>
			addVault(emptyRegistry('~/keepwiki'), { name: 'a', path: '~/a', description: 'x | y', language: 'en' }),
		).toThrow(/\|/);
	});
});
