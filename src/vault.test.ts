import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRegistry } from './registry.js';
import { adoptVault, contractHome, createVault, expandHome, readRegistryFile, schemaVersion } from './vault.js';

function sandbox(): { readonly configDir: string; readonly home: string } {
	const root = mkdtempSync(join(tmpdir(), 'keepwiki-test-'));

	return { configDir: join(root, 'config'), home: join(root, 'home') };
}

const megadev = { name: 'megadev', description: 'Kurs MegaDev', language: 'pl', boundary: 'tylko treści kursu' };

describe('creating a vault', () => {
	it('creates the registry, the home and the vault folders on first use', () => {
		const { configDir, home } = sandbox();
		const result = createVault(megadev, { configDir, home });

		expect(result.path).toBe(join(home, 'vaults', 'megadev'));
		expect(
			readdirSync(result.path)
				.filter((entry) => entry !== '.git')
				.sort(),
		).toEqual(['CLAUDE.md', 'eval.md', 'inbox', 'index.md', 'knowledge', 'raw']);
		expect(existsSync(join(home, 'inbox'))).toBe(true);
		expect(readRegistryFile(configDir).vaults.map((vault) => vault.name)).toEqual(['megadev']);
	});

	it('writes the vault fields and the schema version into the vault CLAUDE.md frontmatter', () => {
		const { configDir, home } = sandbox();
		const { path } = createVault(megadev, { configDir, home });
		const claudeMd = readFileSync(join(path, 'CLAUDE.md'), 'utf8');

		expect(claudeMd).toContain(`keepwiki_schema: ${schemaVersion}`);
		expect(claudeMd).toContain('name: megadev');
		expect(claudeMd).toContain('language: pl');
		expect(claudeMd).toContain('boundary: tylko treści kursu');
	});

	it('stores the path with ~ in the registry when the vault sits under the home directory of the user', () => {
		const userHome = process.env['HOME'] ?? '';

		expect(contractHome(join(userHome, 'keepwiki', 'vaults', 'megadev'))).toBe('~/keepwiki/vaults/megadev');
		expect(contractHome('/opt/vaults/seo')).toBe('/opt/vaults/seo');
		expect(expandHome('~/keepwiki/vaults/megadev')).toBe(join(userHome, 'keepwiki', 'vaults', 'megadev'));
		expect(expandHome('/opt/vaults/seo')).toBe('/opt/vaults/seo');
	});

	it('accepts an explicit path outside the home', () => {
		const { configDir, home } = sandbox();
		const elsewhere = join(home, '..', 'elsewhere', 'seo');
		const result = createVault({ ...megadev, name: 'seo', path: elsewhere }, { configDir, home });

		expect(result.path).toBe(elsewhere);
		expect(existsSync(join(elsewhere, 'knowledge'))).toBe(true);
	});

	it('refuses a second vault with the same name and leaves the disk untouched', () => {
		const { configDir, home } = sandbox();

		createVault(megadev, { configDir, home });

		expect(() => createVault({ ...megadev, path: join(home, 'other') }, { configDir, home })).toThrow(/megadev/);
		expect(existsSync(join(home, 'other'))).toBe(false);
	});

	it('reports whether git initialised the vault', () => {
		const { configDir, home } = sandbox();
		const result = createVault(megadev, { configDir, home });

		expect(['initialised', 'initialised-without-commit', 'unavailable']).toContain(result.git);

		if (result.git !== 'unavailable') expect(existsSync(join(result.path, '.git'))).toBe(true);
	});
});

describe('adopting an existing folder as a vault', () => {
	it('adds the keepwiki files, lists the existing notes as unprocessed, and changes none of them', () => {
		const { configDir, home } = sandbox();
		const existing = join(home, '..', 'notes');

		mkdirSync(join(existing, 'sub'), { recursive: true });
		writeFileSync(join(existing, 'one.md'), '# one\n');
		writeFileSync(join(existing, 'sub', 'two.md'), '# two\n');

		const result = adoptVault({ ...megadev, name: 'notes', path: existing }, { configDir, home });

		expect(readFileSync(join(existing, 'one.md'), 'utf8')).toBe('# one\n');
		expect(readFileSync(join(existing, 'sub', 'two.md'), 'utf8')).toBe('# two\n');
		expect(result.unprocessed).toEqual(['one.md', 'sub/two.md']);
		expect(readFileSync(join(existing, 'index.md'), 'utf8')).toContain('- one.md');
		expect(existsSync(join(existing, 'knowledge'))).toBe(true);
		expect(parseRegistry(readFileSync(join(configDir, 'registry.md'), 'utf8')).vaults[0]?.name).toBe('notes');
	});

	it('refuses a folder that already is a vault', () => {
		const { configDir, home } = sandbox();
		const { path } = createVault(megadev, { configDir, home });

		expect(() => adoptVault({ ...megadev, name: 'again', path }, { configDir, home })).toThrow(/already/);
	});
});

describe('guarding folders the user already has', () => {
	it('refuses to create a vault in a folder that already has files and points at adopt', () => {
		const { configDir, home } = sandbox();
		const occupied = join(home, '..', 'occupied');

		mkdirSync(occupied, { recursive: true });
		writeFileSync(join(occupied, 'notes.md'), '# mine\n');

		expect(() => createVault({ ...megadev, path: occupied }, { configDir, home })).toThrow(/adopt/);
		expect(readFileSync(join(occupied, 'notes.md'), 'utf8')).toBe('# mine\n');
		expect(existsSync(join(occupied, 'CLAUDE.md'))).toBe(false);
	});

	it('creates a vault in an existing empty folder', () => {
		const { configDir, home } = sandbox();
		const empty = join(home, '..', 'empty');

		mkdirSync(empty, { recursive: true });

		expect(createVault({ ...megadev, path: empty }, { configDir, home }).path).toBe(empty);
	});

	it('refuses to adopt a folder that does not exist', () => {
		const { configDir, home } = sandbox();

		expect(() => adoptVault({ ...megadev, path: join(home, 'nowhere') }, { configDir, home })).toThrow(
			/does not exist/,
		);
	});
});
