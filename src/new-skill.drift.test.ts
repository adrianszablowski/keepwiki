import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { registryHeader, vaultNamePattern } from './registry.js';
import { schemaVersion, vaultFiles, vaultFolders } from './vault.js';

const skill = readFileSync(new URL('../skills/new/SKILL.md', import.meta.url), 'utf8');

describe('skills/new/SKILL.md against the code it describes', () => {
	it('quotes the registry table header the parser expects', () => {
		expect(skill).toContain(registryHeader);
	});

	it('quotes the vault name character class', () => {
		const characterClass = vaultNamePattern.source.match(/\[([a-z0-9-]+)\]\*/)?.[1];

		expect(characterClass).toBeDefined();
		expect(skill).toContain(`[${characterClass}]`);
	});

	it('quotes the schema version the vault CLAUDE.md carries', () => {
		expect(skill).toContain(`keepwiki_schema: ${schemaVersion}`);
	});

	it('names every folder and file the CLI creates', () => {
		for (const folder of vaultFolders) expect(skill).toContain(`${folder}/`);
		for (const file of vaultFiles) expect(skill).toContain(file);
	});
});
