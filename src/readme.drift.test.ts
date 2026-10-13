import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
const { name } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { name: string };
const skillNames = readdirSync(fileURLToPath(new URL('../skills/', import.meta.url)), { withFileTypes: true })
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

describe('README.md against what the plugin ships', () => {
	it('names every skill the plugin has', () => {
		expect(skillNames.length).toBeGreaterThan(0);

		for (const skill of skillNames) expect(readme).toContain(`/keepwiki:${skill}`);
	});

	it('installs the plugin by its package name from a marketplace', () => {
		expect(readme).toContain(`/plugin install ${name} --marketplace`);
	});

	it('links limits.md, which exists', () => {
		expect(readme).toContain('](limits.md)');
		expect(existsSync(new URL('../limits.md', import.meta.url))).toBe(true);
	});
});
