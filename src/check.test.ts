import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkVault, findWikilinks, pendingUpdatesWarning } from './check.js';
import { addToInbox } from './inbox.js';
import { createVault } from './vault.js';

interface Box {
	readonly configDir: string;
	readonly home: string;
	readonly vaultPath: string;
}

function vault(): Box {
	const root = mkdtempSync(join(tmpdir(), 'keepwiki-check-'));
	const options = { configDir: join(root, 'config'), home: join(root, 'home') };
	const { path } = createVault({ name: 'seo', description: 'SEO', language: 'en' }, options);

	createVault({ name: 'other', description: 'Other', language: 'en' }, options);
	writeFileSync(join(options.home, 'vaults', 'other', 'knowledge', 'exists.md'), page('Exists', ['raw/a.md'], ''));

	return { ...options, vaultPath: path };
}

function page(title: string, sources: readonly string[], body: string, updated = '2026-10-12'): string {
	const sourceLines = sources.length === 0 ? [] : ['sources:', ...sources.map((source) => `  - ${source}`)];

	return ['---', `title: ${title}`, ...sourceLines, `updated: ${updated}`, '---', '', body, ''].join('\n');
}

function write(box: Box, file: string, text: string): void {
	writeFileSync(join(box.vaultPath, file), text);
}

function codes(box: Box): string[] {
	return checkVault('seo', box).findings.map((finding) => finding.code);
}

describe('finding wikilinks', () => {
	it('reads same-vault and cross-vault links and ignores alias and heading suffixes', () => {
		expect(findWikilinks('See [[canonical]], [[other:exists|the thing]] and [[canonical#tips]].')).toEqual([
			{ page: 'canonical' },
			{ vault: 'other', page: 'exists' },
			{ page: 'canonical' },
		]);
	});
});

describe('checking a healthy vault', () => {
	it('reports only the small eval as a note', () => {
		const box = vault();

		write(box, 'raw/a.md', '# source\n');
		write(box, 'knowledge/a.md', page('A', ['raw/a.md'], 'Links to [[b]] and [[other:exists]].'));
		write(box, 'knowledge/b.md', page('B', ['raw/a.md'], 'Back to [[a]].'));
		write(box, 'index.md', '# Index\n\n## Pages\n\n- [[a]] — a\n- [[b]] — b\n\n## Pending updates\n');

		const report = checkVault('seo', box);

		expect(report.pages).toBe(2);
		expect(report.findings).toEqual([
			{ severity: 'note', code: 'eval-small', file: 'eval.md', message: expect.stringContaining('0 rows') as string },
		]);
	});
});

describe('structural findings', () => {
	it('flags a missing or outdated schema version', () => {
		const box = vault();

		write(box, 'CLAUDE.md', '---\nname: seo\n---\n');

		expect(codes(box)).toContain('schema-missing');

		write(box, 'CLAUDE.md', '---\nkeepwiki_schema: 0\nname: seo\n---\n');

		expect(codes(box)).toContain('schema-outdated');
	});

	it('flags a page without frontmatter, without sources, and with a source file that is gone', () => {
		const box = vault();

		write(box, 'knowledge/bare.md', '# bare\n');
		write(box, 'knowledge/loose.md', page('Loose', [], 'text'));
		write(box, 'knowledge/gone.md', page('Gone', ['raw/nope.md'], 'text'));

		const findings = checkVault('seo', box).findings;

		expect(findings).toContainEqual(
			expect.objectContaining({ code: 'frontmatter-missing', file: 'knowledge/bare.md' }),
		);
		expect(findings).toContainEqual(expect.objectContaining({ code: 'unsourced-page', file: 'knowledge/loose.md' }));
		expect(findings).toContainEqual(expect.objectContaining({ code: 'source-missing', file: 'knowledge/gone.md' }));
	});

	it('flags a page whose frontmatter lacks one of the page fields', () => {
		const box = vault();

		write(box, 'knowledge/half.md', '---\ntitle: Half\n---\n\ntext\n');

		const findings = checkVault('seo', box).findings;

		expect(findings).toContainEqual(
			expect.objectContaining({ code: 'page-fields-missing', severity: 'warning', file: 'knowledge/half.md' }),
		);
		expect(findings.find((finding) => finding.code === 'page-fields-missing')?.message).toContain('updated');
	});

	it('flags broken links in the vault and across vaults', () => {
		const box = vault();

		write(box, 'knowledge/a.md', page('A', [], '[[missing]] [[nope:exists]] [[other:missing]] [[other:exists]]'));

		const findings = checkVault('seo', box).findings;

		expect(findings.filter((finding) => finding.code === 'broken-link')).toHaveLength(1);
		expect(findings.filter((finding) => finding.code === 'broken-cross-link')).toHaveLength(2);
	});

	it('flags orphans, unindexed pages and stale index entries', () => {
		const box = vault();

		write(box, 'knowledge/a.md', page('A', [], 'no links out'));
		write(box, 'knowledge/b.md', page('B', [], 'links to [[a]]'));
		write(box, 'index.md', '# Index\n\n## Pages\n\n- [[a]] — a\n- [[ghost]] — gone\n\n## Pending updates\n');

		const findings = checkVault('seo', box).findings;

		expect(findings).toContainEqual(expect.objectContaining({ code: 'orphan-page', file: 'knowledge/b.md' }));
		expect(findings).not.toContainEqual(expect.objectContaining({ code: 'orphan-page', file: 'knowledge/a.md' }));
		expect(findings).toContainEqual(expect.objectContaining({ code: 'unindexed-page', file: 'knowledge/b.md' }));
		expect(findings).toContainEqual(
			expect.objectContaining({ code: 'index-stale-entry', message: expect.stringContaining('ghost') as string }),
		);
	});

	it('grades pending updates by count and counts the waiting inbox', () => {
		const box = vault();
		const few = Array.from({ length: pendingUpdatesWarning - 1 }, (_, index) => `- [[p${index}]]: fix (raw/a.md)`);
		const many = Array.from({ length: pendingUpdatesWarning }, (_, index) => `- [[p${index}]]: fix (raw/a.md)`);

		write(box, 'index.md', `# Index\n\n## Pages\n\n## Pending updates\n\n${few.join('\n')}\n`);

		expect(checkVault('seo', box).findings).toContainEqual(
			expect.objectContaining({ code: 'pending-updates', severity: 'note' }),
		);

		write(box, 'index.md', `# Index\n\n## Pages\n\n## Pending updates\n\n${many.join('\n')}\n`);
		addToInbox({ vault: 'seo', source: 'text', title: 'waiting', content: 'x' }, box);

		const findings = checkVault('seo', box).findings;

		expect(findings).toContainEqual(expect.objectContaining({ code: 'pending-updates', severity: 'warning' }));
		expect(findings).toContainEqual(
			expect.objectContaining({ code: 'inbox-waiting', message: expect.stringContaining('1 ') as string }),
		);
	});

	it('notes a page whose updated date is old', () => {
		const box = vault();

		write(box, 'knowledge/old.md', page('Old', [], 'x', '2020-01-01'));

		expect(codes(box)).toContain('stale-page');
	});

	it('orders findings errors first, then warnings, then notes', () => {
		const box = vault();

		write(box, 'knowledge/a.md', page('A', [], '[[missing]]'));

		const severities = checkVault('seo', box).findings.map((finding) => finding.severity);
		const rank = { error: 0, warning: 1, note: 2 };

		expect(severities).toEqual([...severities].sort((a, b) => rank[a] - rank[b]));
	});

	it('refuses a vault that is not registered', () => {
		expect(() => checkVault('nope', vault())).toThrow(/registry list/);
	});
});
