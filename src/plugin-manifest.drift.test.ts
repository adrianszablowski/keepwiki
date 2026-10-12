import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Manifest {
	readonly name: string;
	readonly version: string;
	readonly description: string;
	readonly license: string;
}

function readJson(path: string): Manifest {
	return JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8')) as Manifest;
}

describe('the plugin manifest against package.json', () => {
	const pkg = readJson('../package.json');
	const plugin = readJson('../.claude-plugin/plugin.json');

	it('carries the same version, which npm publish enforces on package.json', () => {
		expect(plugin.version).toBe(pkg.version);
	});

	it('carries the same name, description and license', () => {
		expect(plugin.name).toBe(pkg.name);
		expect(plugin.description).toBe(pkg.description);
		expect(plugin.license).toBe(pkg.license);
	});
});
