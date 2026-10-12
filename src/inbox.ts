import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { parseFrontmatter, renderFrontmatter, setFrontmatterField } from './frontmatter.js';
import { commitAll, type CommitOutcome } from './git.js';
import type { Registry, RegistryEntry } from './registry.js';
import { expandHome, indexSections, readRegistryFile } from './vault.js';

export const sourceKinds = ['text', 'article', 'file', 'pdf'] as const;

export const inboxStatuses = ['unprocessed', 'processed'] as const;

export const inboxFields = ['source', 'url', 'title', 'status', 'added'] as const;

export type SourceKind = (typeof sourceKinds)[number];

export interface InboxSpec {
	readonly source: SourceKind;
	readonly title: string;
	readonly content: string;
	readonly url?: string;
	readonly vault?: string;
}

export interface InboxOptions {
	readonly configDir: string;
	readonly home: string;
}

export interface AddResult {
	readonly path: string;
	readonly vault: string | null;
	readonly outcome: 'created' | 'appended';
}

export interface InboxNote {
	readonly path: string;
	readonly vault: string | null;
	readonly source: string;
	readonly title: string;
	readonly url?: string;
	readonly added: string;
}

export interface CompleteResult {
	readonly path: string;
	readonly vault: string;
	readonly git: CommitOutcome;
}

export function addToInbox(spec: InboxSpec, options: InboxOptions): AddResult {
	const registry = readRegistryFile(options.configDir, options.home);
	const vault = spec.vault === undefined ? null : vaultNamed(registry, spec.vault);
	const existing = spec.url === undefined ? undefined : noteWithUrl(registry, spec.url);

	if (existing) {
		return appendToNote(existing, spec);
	}

	const inbox = vault === null ? expandHome(registry.inbox) : join(vaultPath(vault), 'inbox');
	const path = uniquePath(inbox, `${today()}-${slug(spec.title)}`);

	mkdirSync(inbox, { recursive: true });
	writeFileSync(path, `${noteFrontmatter(spec)}\n\n${spec.content.trimEnd()}\n`);

	return { path, vault: vault?.name ?? null, outcome: 'created' };
}

export function listInbox(options: InboxOptions): readonly InboxNote[] {
	const registry = readRegistryFile(options.configDir, options.home);
	const shared = unprocessedNotes(expandHome(registry.inbox)).map((note) => toInboxNote(note, null));
	const owned = registry.vaults.flatMap((vault) => [
		...unprocessedNotes(join(vaultPath(vault), 'inbox')).map((note) => toInboxNote(note, vault.name)),
		...adoptedNotes(vault),
	]);

	return [...shared, ...owned];
}

export function completeNote(path: string, options: InboxOptions & { readonly vault?: string }): CompleteResult {
	const registry = readRegistryFile(options.configDir, options.home);
	const target = resolve(path);
	const owner = registry.vaults.find((vault) => isInside(target, vaultPath(vault)));

	if (owner && isInside(target, join(vaultPath(owner), 'inbox'))) {
		return moveToRaw(target, owner);
	}

	if (owner && adoptedNotes(owner).some((note) => note.path === target)) {
		return forgetAdoptedNote(target, owner);
	}

	if (isInside(target, expandHome(registry.inbox))) {
		if (options.vault === undefined) {
			throw new Error(`${target} is in the shared inbox. Say which vault learned it with --vault <name>.`);
		}

		return moveToRaw(target, vaultNamed(registry, options.vault));
	}

	throw new Error(`${target} is not an unprocessed source: it is in no inbox and no vault lists it as unprocessed.`);
}

interface StoredNote {
	readonly path: string;
	readonly fields: ReadonlyMap<string, string>;
}

function appendToNote(found: StoredNote & { readonly vault: RegistryEntry | null }, spec: InboxSpec): AddResult {
	const inbox = found.vault === null ? dirname(found.path) : join(vaultPath(found.vault), 'inbox');
	const path = isInside(found.path, inbox) ? found.path : uniquePath(inbox, basename(found.path, '.md'));
	const section = `\n## ${spec.source} added ${today()}\n\n${spec.content.trimEnd()}\n`;
	const text = readFileSync(found.path, 'utf8').trimEnd();
	const reopened = setFrontmatterField(setFrontmatterField(text, 'status', 'unprocessed'), 'processed', undefined);

	if (path !== found.path) {
		rmSync(found.path);
	}

	writeFileSync(path, `${reopened}\n${section}`);

	return { path, vault: found.vault?.name ?? null, outcome: 'appended' };
}

function moveToRaw(path: string, vault: RegistryEntry): CompleteResult {
	const raw = join(vaultPath(vault), 'raw');
	const destination = uniquePath(raw, basename(path, '.md'));
	const text = readFileSync(path, 'utf8');
	const processed = setFrontmatterField(setFrontmatterField(text, 'status', 'processed'), 'processed', today());

	mkdirSync(raw, { recursive: true });
	writeFileSync(destination, processed);
	rmSync(path);

	const title = parseFrontmatter(text).get('title') ?? basename(path, '.md');

	return { path: destination, vault: vault.name, git: commitAll(vaultPath(vault), `learn: ${title}`) };
}

function forgetAdoptedNote(path: string, vault: RegistryEntry): CompleteResult {
	const indexPath = join(vaultPath(vault), 'index.md');
	const item = `- ${relative(vaultPath(vault), path)}`;
	const lines = readFileSync(indexPath, 'utf8').split('\n');
	const kept = lines.filter((line) => line !== item);
	const start = kept.indexOf(indexSections.unprocessed);
	const end = kept.findIndex((line, index) => index > start && line.startsWith('## '));
	const section = kept.slice(start + 1, end === -1 ? undefined : end);
	const isEmpty = section.every((line) => line.trim() === '');
	const index = isEmpty ? [...kept.slice(0, start), ...kept.slice(end === -1 ? kept.length : end)] : kept;

	writeFileSync(indexPath, `${index.join('\n').trimEnd()}\n`);

	return { path, vault: vault.name, git: commitAll(vaultPath(vault), `learn: ${basename(path)}`) };
}

function noteWithUrl(
	registry: Registry,
	url: string,
): (StoredNote & { readonly vault: RegistryEntry | null }) | undefined {
	const wanted = normaliseUrl(url);
	const sharedMatch = notesIn(expandHome(registry.inbox)).find((note) => hasUrl(note, wanted));

	if (sharedMatch) {
		return { ...sharedMatch, vault: null };
	}

	for (const vault of registry.vaults) {
		const match = ['inbox', 'raw']
			.flatMap((folder) => notesIn(join(vaultPath(vault), folder)))
			.find((note) => hasUrl(note, wanted));

		if (match) {
			return { ...match, vault };
		}
	}

	return undefined;
}

function hasUrl(note: StoredNote, wanted: string): boolean {
	const url = note.fields.get('url');

	return url !== undefined && normaliseUrl(url) === wanted;
}

function unprocessedNotes(folder: string): readonly StoredNote[] {
	return notesIn(folder).filter((note) => note.fields.get('status') === 'unprocessed');
}

function notesIn(folder: string): readonly StoredNote[] {
	if (!existsSync(folder)) {
		return [];
	}

	return readdirSync(folder)
		.filter((file) => file.endsWith('.md'))
		.sort()
		.map((file) => join(folder, file))
		.map((path) => ({ path, fields: parseFrontmatter(readFileSync(path, 'utf8')) }));
}

function adoptedNotes(vault: RegistryEntry): readonly InboxNote[] {
	const indexPath = join(vaultPath(vault), 'index.md');

	if (!existsSync(indexPath)) {
		return [];
	}

	const lines = readFileSync(indexPath, 'utf8').split('\n');
	const start = lines.indexOf(indexSections.unprocessed);

	if (start === -1) {
		return [];
	}

	return lines
		.slice(start + 1)
		.filter((line, index, rest) => !rest.slice(0, index + 1).some((seen) => seen.startsWith('## ')))
		.filter((line) => line.startsWith('- '))
		.map((line) => line.slice(2))
		.map((file) => ({
			path: join(vaultPath(vault), file),
			vault: vault.name,
			source: 'adopted',
			title: file,
			added: '',
		}));
}

function toInboxNote(note: StoredNote, vault: string | null): InboxNote {
	const url = note.fields.get('url');

	return {
		path: note.path,
		vault,
		source: note.fields.get('source') ?? '',
		title: note.fields.get('title') ?? basename(note.path, '.md'),
		...(url === undefined ? {} : { url }),
		added: note.fields.get('added') ?? '',
	};
}

function noteFrontmatter(spec: InboxSpec): string {
	return renderFrontmatter({
		source: spec.source,
		url: spec.url,
		title: spec.title,
		status: 'unprocessed',
		added: today(),
	});
}

function vaultNamed(registry: Registry, name: string): RegistryEntry {
	const vault = registry.vaults.find((entry) => entry.name === name);

	if (!vault) {
		throw new Error(`No vault named "${name}". Run \`keepwiki registry list\` to see the names.`);
	}

	return vault;
}

function vaultPath(vault: RegistryEntry): string {
	return expandHome(vault.path);
}

function isInside(path: string, folder: string): boolean {
	const inside = relative(folder, path);

	return inside !== '' && !inside.startsWith('..') && !inside.startsWith('/');
}

function uniquePath(folder: string, stem: string): string {
	const candidates = [stem, ...Array.from({ length: 98 }, (_, index) => `${stem}-${index + 2}`)];
	const free = candidates.map((candidate) => join(folder, `${candidate}.md`)).find((path) => !existsSync(path));

	if (free === undefined) {
		throw new Error(`${folder} already holds 99 notes named ${stem}.`);
	}

	return free;
}

function slug(title: string): string {
	const ascii = title
		.normalize('NFKD')
		.replace(/\p{M}/gu, '')
		.replace(/ł/g, 'l')
		.replace(/Ł/g, 'L')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 60)
		.replace(/-$/, '');

	return ascii === '' ? 'note' : ascii;
}

function normaliseUrl(url: string): string {
	try {
		const parsed = new URL(url.trim());
		const params = [...parsed.searchParams.entries()]
			.filter(([key]) => !key.startsWith('utm_') && key !== 'fbclid')
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([key, value]) => `${key}=${value}`)
			.join('&');
		const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
		const path = parsed.pathname.replace(/\/+$/, '');

		return `${host}${path}${params === '' ? '' : `?${params}`}`;
	} catch {
		return url.trim();
	}
}

function today(): string {
	const now = new Date();

	return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part) => String(part).padStart(2, '0')).join('-');
}
