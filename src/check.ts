import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { frontmatterList, parseFrontmatter } from './frontmatter.js';
import { listInbox, type InboxOptions } from './inbox.js';
import type { Registry } from './registry.js';
import { sectionItems } from './sections.js';
import { evalHeader, expandHome, indexSections, readRegistryFile, schemaVersion } from './vault.js';

export const wikilinkPattern = /\[\[(?:([a-z0-9][a-z0-9-]*):)?([^\]|#]+)(?:[|#][^\]]*)?\]\]/g;

export const pageFields = ['title', 'sources', 'updated'] as const;

export const severities = ['error', 'warning', 'note'] as const;

export const findingCodes = [
	'schema-missing',
	'schema-outdated',
	'frontmatter-missing',
	'page-fields-missing',
	'broken-link',
	'broken-cross-link',
	'source-missing',
	'unsourced-page',
	'orphan-page',
	'unindexed-page',
	'index-stale-entry',
	'pending-updates',
	'inbox-waiting',
	'eval-small',
	'stale-page',
] as const;

export const pendingUpdatesWarning = 5;

export const stalePageDays = 90;

export const evalSmallRows = 10;

export type Severity = (typeof severities)[number];

export type FindingCode = (typeof findingCodes)[number];

export interface WikiLink {
	readonly vault?: string;
	readonly page: string;
}

export interface Finding {
	readonly severity: Severity;
	readonly code: FindingCode;
	readonly file?: string;
	readonly message: string;
}

export interface CheckReport {
	readonly vault: string;
	readonly pages: number;
	readonly findings: readonly Finding[];
}

export function findWikilinks(text: string): readonly WikiLink[] {
	return [...text.matchAll(wikilinkPattern)].map(([, vault, page = '']) => ({
		...(vault === undefined ? {} : { vault }),
		page: page.trim(),
	}));
}

export function checkVault(name: string, options: InboxOptions): CheckReport {
	const registry = readRegistryFile(options.configDir, options.home);
	const vault = registry.vaults.find((entry) => entry.name === name);

	if (!vault) {
		throw new Error(`No vault named "${name}". Run \`keepwiki registry list\` to see the names.`);
	}

	const root = expandHome(vault.path);
	const pages = readPages(root);
	const findings = [
		...checkSchema(root),
		...pages.flatMap((page) => checkPage(page, pages, registry, root)),
		...checkOrphans(pages),
		...checkIndex(root, pages),
		...checkPending(root),
		...checkInbox(name, options),
		...checkEval(root),
	];
	const rank = new Map(severities.map((severity, index) => [severity, index]));

	return {
		vault: name,
		pages: pages.length,
		findings: [...findings].sort((a, b) => (rank.get(a.severity) ?? 0) - (rank.get(b.severity) ?? 0)),
	};
}

interface Page {
	readonly name: string;
	readonly file: string;
	readonly text: string;
	readonly hasFrontmatter: boolean;
	readonly links: readonly WikiLink[];
}

function readPages(root: string): readonly Page[] {
	const knowledge = join(root, 'knowledge');

	if (!existsSync(knowledge)) {
		return [];
	}

	return readdirSync(knowledge, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
		.map((entry) => join(entry.parentPath, entry.name))
		.sort()
		.map((path) => {
			const text = readFileSync(path, 'utf8');

			return {
				name: relative(knowledge, path).slice(0, -'.md'.length),
				file: relative(root, path),
				text,
				hasFrontmatter: text.startsWith('---\n'),
				links: findWikilinks(text),
			};
		});
}

function checkSchema(root: string): Finding[] {
	const claudeMd = join(root, 'CLAUDE.md');
	const version = existsSync(claudeMd)
		? parseFrontmatter(readFileSync(claudeMd, 'utf8')).get('keepwiki_schema')
		: undefined;

	if (version === undefined) {
		return [
			finding(
				'error',
				'schema-missing',
				'CLAUDE.md',
				`No keepwiki_schema in the frontmatter; expected ${schemaVersion}.`,
			),
		];
	}

	if (Number(version) < schemaVersion) {
		return [finding('warning', 'schema-outdated', 'CLAUDE.md', `Schema ${version} is older than ${schemaVersion}.`)];
	}

	return [];
}

function checkPage(page: Page, pages: readonly Page[], registry: Registry, root: string): Finding[] {
	if (!page.hasFrontmatter) {
		return [finding('error', 'frontmatter-missing', page.file, 'The page has no frontmatter block.')];
	}

	const fields = parseFrontmatter(page.text);
	const sources = frontmatterList(page.text, 'sources');
	const updated = fields.get('updated');
	const missingFields = pageFields.filter((field) => !fields.has(field));
	const fieldFindings =
		missingFields.length === 0
			? []
			: [finding('warning', 'page-fields-missing', page.file, `Frontmatter lacks ${missingFields.join(', ')}.`)];
	const sourceFindings =
		sources.length === 0
			? [finding('warning', 'unsourced-page', page.file, 'No sources: listed; nothing backs its claims.')]
			: sources
					.filter((source) => !existsSync(join(root, source)))
					.map((source) =>
						finding('error', 'source-missing', page.file, `sources: names ${source}, which does not exist.`),
					);
	const linkFindings = page.links.flatMap((link) => checkLink(link, page, pages, registry));
	const staleFindings = isStale(updated)
		? [finding('note', 'stale-page', page.file, `updated: ${updated} is older than ${stalePageDays} days.`)]
		: [];

	return [...fieldFindings, ...sourceFindings, ...linkFindings, ...staleFindings];
}

function checkLink(link: WikiLink, page: Page, pages: readonly Page[], registry: Registry): Finding[] {
	if (link.vault === undefined) {
		return pages.some((candidate) => candidate.name === link.page)
			? []
			: [finding('error', 'broken-link', page.file, `[[${link.page}]] has no page knowledge/${link.page}.md.`)];
	}

	const target = registry.vaults.find((entry) => entry.name === link.vault);
	const isResolved = target !== undefined && existsSync(join(expandHome(target.path), 'knowledge', `${link.page}.md`));

	return isResolved
		? []
		: [
				finding(
					'error',
					'broken-cross-link',
					page.file,
					target === undefined
						? `[[${link.vault}:${link.page}]] names a vault that is not in the registry.`
						: `[[${link.vault}:${link.page}]] has no page in vault ${link.vault}.`,
				),
			];
}

function checkOrphans(pages: readonly Page[]): Finding[] {
	if (pages.length < 2) {
		return [];
	}

	const linked = new Set(
		pages.flatMap((page) => page.links.filter((link) => link.vault === undefined).map((link) => link.page)),
	);

	return pages
		.filter((page) => !linked.has(page.name))
		.map((page) => finding('warning', 'orphan-page', page.file, 'No other page links to it.'));
}

function checkIndex(root: string, pages: readonly Page[]): Finding[] {
	const indexPath = join(root, 'index.md');
	const text = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
	const indexed = sectionItems(text, indexSections.pages).flatMap((item) =>
		findWikilinks(item).map((link) => link.page),
	);
	const names = new Set(pages.map((page) => page.name));
	const unindexed = pages
		.filter((page) => !indexed.includes(page.name))
		.map((page) =>
			finding('warning', 'unindexed-page', page.file, `Not listed under ${indexSections.pages} in index.md.`),
		);
	const stale = indexed
		.filter((name) => !names.has(name))
		.map((name) =>
			finding(
				'warning',
				'index-stale-entry',
				'index.md',
				`[[${name}]] is listed but knowledge/${name}.md does not exist.`,
			),
		);

	return [...unindexed, ...stale];
}

function checkPending(root: string): Finding[] {
	const indexPath = join(root, 'index.md');
	const count = existsSync(indexPath) ? sectionItems(readFileSync(indexPath, 'utf8'), indexSections.pending).length : 0;

	if (count === 0) {
		return [];
	}

	const severity = count >= pendingUpdatesWarning ? 'warning' : 'note';

	return [finding(severity, 'pending-updates', 'index.md', `${count} pending updates wait for the next learn.`)];
}

function checkInbox(name: string, options: InboxOptions): Finding[] {
	const waiting = listInbox(options).filter((note) => note.vault === name).length;

	return waiting === 0
		? []
		: [finding('note', 'inbox-waiting', 'inbox', `${waiting} unprocessed sources wait for learn.`)];
}

function checkEval(root: string): Finding[] {
	const evalPath = join(root, 'eval.md');
	const rows = existsSync(evalPath)
		? readFileSync(evalPath, 'utf8')
				.split('\n')
				.filter((line) => line.startsWith('|') && line !== evalHeader && !/^\|\s*-{3,}/.test(line)).length
		: 0;

	return rows >= evalSmallRows
		? []
		: [finding('note', 'eval-small', 'eval.md', `${rows} rows; ${evalSmallRows} or more make eval meaningful.`)];
}

function isStale(updated: string | undefined): boolean {
	if (updated === undefined) {
		return false;
	}

	const age = (Date.now() - new Date(updated).getTime()) / (24 * 60 * 60 * 1000);

	return Number.isFinite(age) && age > stalePageDays;
}

function finding(severity: Severity, code: FindingCode, file: string, message: string): Finding {
	return { severity, code, file, message };
}
