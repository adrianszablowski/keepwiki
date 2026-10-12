import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { addVault, emptyRegistry, parseRegistry, renderRegistry, type Registry } from './registry.js';

export interface VaultSpec {
	readonly name: string;
	readonly description: string;
	readonly language: string;
	readonly boundary?: string;
	readonly path?: string;
}

export interface VaultOptions {
	readonly configDir: string;
	readonly home: string;
}

export type GitOutcome = 'initialised' | 'initialised-without-commit' | 'unavailable';

export interface VaultResult {
	readonly name: string;
	readonly path: string;
	readonly git: GitOutcome;
	readonly unprocessed: readonly string[];
}

export const schemaVersion = 1;

export const vaultFolders = ['inbox', 'raw', 'knowledge'] as const;

export const vaultFiles = ['CLAUDE.md', 'index.md', 'eval.md'] as const;

export function createVault(spec: VaultSpec, options: VaultOptions): VaultResult {
	const path = spec.path ?? join(options.home, 'vaults', spec.name);
	const registry = registered(spec, path, options);

	if (existsSync(path) && readdirSync(path).length > 0) {
		throw new Error(
			`${path} already has files. Use \`keepwiki vault adopt\` to make it a vault without touching them.`,
		);
	}

	mkdirSync(join(options.home, 'inbox'), { recursive: true });
	scaffold(spec, path, []);
	writeRegistryFile(options.configDir, registry);

	return { name: spec.name, path, git: initialiseGit(path), unprocessed: [] };
}

export function adoptVault(spec: VaultSpec & { readonly path: string }, options: VaultOptions): VaultResult {
	const registry = registered(spec, spec.path, options);

	if (!existsSync(spec.path)) {
		throw new Error(`${spec.path} does not exist. Use \`keepwiki vault create\` for a new folder.`);
	}

	if (isVault(spec.path)) {
		throw new Error(`${spec.path} already is a keepwiki vault.`);
	}

	const taken = vaultFiles.filter((file) => existsSync(join(spec.path, file)));

	if (taken.length > 0) {
		throw new Error(`${spec.path} already has ${taken.join(', ')}; rename them before adopting the folder.`);
	}

	const unprocessed = markdownFilesUnder(spec.path);

	mkdirSync(join(options.home, 'inbox'), { recursive: true });
	scaffold(spec, spec.path, unprocessed);
	writeRegistryFile(options.configDir, registry);

	return { name: spec.name, path: spec.path, git: initialiseGit(spec.path), unprocessed };
}

export function readRegistryFile(configDir: string): Registry {
	const file = join(configDir, 'registry.md');

	return existsSync(file) ? parseRegistry(readFileSync(file, 'utf8')) : emptyRegistry(contractHome(defaultHome()));
}

export function writeRegistryFile(configDir: string, registry: Registry): void {
	mkdirSync(configDir, { recursive: true });
	writeFileSync(join(configDir, 'registry.md'), renderRegistry(registry));
}

export function defaultHome(): string {
	return join(homedir(), 'keepwiki');
}

export function expandHome(path: string): string {
	return path.startsWith('~/') ? join(homedir(), path.slice(2)) : path;
}

export function contractHome(path: string): string {
	const inside = relative(homedir(), path);

	return inside.startsWith('..') || resolve(path) !== path ? path : `~/${inside}`;
}

function registered(spec: VaultSpec, path: string, options: VaultOptions): Registry {
	const current = readRegistryFile(options.configDir);
	const registry = current.vaults.length === 0 ? emptyRegistry(contractHome(options.home)) : current;

	return addVault(registry, {
		name: spec.name,
		path: contractHome(path),
		description: spec.description,
		language: spec.language,
	});
}

function isVault(path: string): boolean {
	const claudeMd = join(path, 'CLAUDE.md');

	return existsSync(claudeMd) && readFileSync(claudeMd, 'utf8').includes('keepwiki_schema:');
}

function markdownFilesUnder(root: string): string[] {
	return readdirSync(root, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
		.map((entry) => relative(root, join(entry.parentPath, entry.name)))
		.filter((file) => !file.split('/').some((segment) => segment.startsWith('.')))
		.sort();
}

function scaffold(spec: VaultSpec, path: string, unprocessed: readonly string[]): void {
	for (const folder of vaultFolders) {
		mkdirSync(join(path, folder), { recursive: true });
	}

	writeFileSync(join(path, 'CLAUDE.md'), vaultClaudeMd(spec));
	writeFileSync(join(path, 'index.md'), indexMd(spec.name, unprocessed));
	writeFileSync(join(path, 'eval.md'), evalMd(spec.name));
}

function vaultClaudeMd(spec: VaultSpec): string {
	const boundaryField = spec.boundary === undefined ? [] : [`boundary: ${spec.boundary}`];
	const boundarySection = spec.boundary === undefined ? [] : ['## Boundary', '', spec.boundary, ''];

	return [
		'---',
		`keepwiki_schema: ${schemaVersion}`,
		`name: ${spec.name}`,
		`description: ${spec.description}`,
		`language: ${spec.language}`,
		...boundaryField,
		'---',
		'',
		`# ${spec.name}`,
		'',
		spec.description,
		'',
		...boundarySection,
		'## Page types',
		'',
		'Added by `learn` when a kind of page appears for the third time.',
		'',
	].join('\n');
}

function indexMd(name: string, unprocessed: readonly string[]): string {
	const unprocessedSection =
		unprocessed.length === 0 ? [] : ['## Unprocessed notes', '', ...unprocessed.map((file) => `- ${file}`), ''];

	return [
		'---',
		`vault: ${name}`,
		'---',
		'',
		'# Index',
		'',
		'One line per page: `- [[page]] — what it holds`.',
		'',
		'## Pages',
		'',
		'## Pending updates',
		'',
		...unprocessedSection,
	].join('\n');
}

function evalMd(name: string): string {
	return [
		'---',
		`vault: ${name}`,
		'---',
		'',
		'# Eval',
		'',
		'One row per question. `expected` is a page name, or `none` for a question the vault must answer with "not in keepwiki".',
		'',
		'| question | expected |',
		'| --- | --- |',
		'',
	].join('\n');
}

function initialiseGit(path: string): GitOutcome {
	try {
		execFileSync('git', ['--version'], { stdio: 'ignore' });
	} catch {
		return 'unavailable';
	}

	execFileSync('git', ['init', '-q'], { cwd: path, stdio: 'ignore' });

	try {
		execFileSync('git', ['add', '-A'], { cwd: path, stdio: 'ignore' });
		execFileSync('git', ['commit', '-q', '-m', 'chore: create the vault'], { cwd: path, stdio: 'ignore' });

		return 'initialised';
	} catch {
		return 'initialised-without-commit';
	}
}
