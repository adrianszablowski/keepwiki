import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findCitations, minimumExcerptLength, verifyCitations } from './citations.js';
import { createVault } from './vault.js';

function vaultWithPage(): { readonly configDir: string; readonly home: string } {
	const root = mkdtempSync(join(tmpdir(), 'keepwiki-citations-'));
	const options = { configDir: join(root, 'config'), home: join(root, 'home') };
	const { path } = createVault({ name: 'seo', description: 'SEO', language: 'en' }, options);

	writeFileSync(
		join(path, 'knowledge', 'canonical.md'),
		[
			'---',
			'title: Canonical',
			'---',
			'',
			'A **canonical tag** tells Google which URL is the',
			'main one. See [[duplicate-content]].',
			'',
		].join('\n'),
	);

	return options;
}

describe('finding citations in an answer', () => {
	it('reads straight, low-high and curly quotes followed by a source', () => {
		const answer = [
			'One "tells Google which URL is the main one" [source: seo/knowledge/canonical.md].',
			'Two „tells Google which URL is the main one” [source: seo/knowledge/canonical.md].',
			'Three “tells Google which URL is the main one” [source:seo/knowledge/sub/page.md].',
		].join('\n');

		expect(findCitations(answer)).toEqual([
			{ excerpt: 'tells Google which URL is the main one', vault: 'seo', page: 'canonical.md' },
			{ excerpt: 'tells Google which URL is the main one', vault: 'seo', page: 'canonical.md' },
			{ excerpt: 'tells Google which URL is the main one', vault: 'seo', page: 'sub/page.md' },
		]);
	});

	it('ignores quotes that are not followed by a source', () => {
		expect(findCitations('He said "hello there, friend" and left.')).toEqual([]);
	});
});

describe('verifying citations against the pages', () => {
	it('accepts an excerpt that matches the page once markdown, whitespace and case are ignored', () => {
		const report = verifyCitations(
			'"a canonical tag tells google which url is the main one" [source: seo/knowledge/canonical.md]',
			vaultWithPage(),
		);

		expect(report.failed).toEqual([]);
		expect(report.verified).toHaveLength(1);
		expect(report.isGrounded).toBe(true);
	});

	it('rejects an excerpt the page does not contain', () => {
		const report = verifyCitations(
			'"canonical tags are optional for small sites" [source: seo/knowledge/canonical.md]',
			vaultWithPage(),
		);

		expect(report.failed.map((failure) => failure.reason)).toEqual(['excerpt not found']);
		expect(report.isGrounded).toBe(false);
	});

	it('rejects a page that does not exist and a vault that is not registered', () => {
		const report = verifyCitations(
			[
				'"tells Google which URL is the main one" [source: seo/knowledge/missing.md]',
				'"tells Google which URL is the main one" [source: nope/knowledge/canonical.md]',
			].join('\n'),
			vaultWithPage(),
		);

		expect(report.failed.map((failure) => failure.reason)).toEqual(['missing page', 'unknown vault']);
	});

	it('rejects an excerpt shorter than the minimum', () => {
		const short = 'canonical tag';
		const report = verifyCitations(`"${short}" [source: seo/knowledge/canonical.md]`, vaultWithPage());

		expect(short.length).toBeLessThan(minimumExcerptLength);
		expect(report.failed.map((failure) => failure.reason)).toEqual(['excerpt too short']);
	});

	it('is not grounded when the answer has no citations at all', () => {
		const report = verifyCitations('Canonical tags matter.', vaultWithPage());

		expect(report).toEqual({ verified: [], failed: [], isGrounded: false });
	});
});
