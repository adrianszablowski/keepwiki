import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { InboxOptions } from './inbox.js';
import { expandHome, readRegistryFile } from './vault.js';

export const minimumExcerptLength = 20;

export const citationPattern = /["„“]([^"”“]+)["”“]\s*\[source:\s*([^/\]\s]+)\/knowledge\/([^\]]+?\.md)\]/g;

export interface Citation {
	readonly excerpt: string;
	readonly vault: string;
	readonly page: string;
}

export type CitationFailureReason = 'unknown vault' | 'missing page' | 'excerpt not found' | 'excerpt too short';

export interface CitationFailure extends Citation {
	readonly reason: CitationFailureReason;
}

export interface VerificationReport {
	readonly verified: readonly Citation[];
	readonly failed: readonly CitationFailure[];
	readonly isGrounded: boolean;
}

export function findCitations(answer: string): readonly Citation[] {
	return [...answer.matchAll(citationPattern)].map(([, excerpt = '', vault = '', page = '']) => ({
		excerpt: excerpt.trim(),
		vault,
		page,
	}));
}

export function verifyCitations(answer: string, options: InboxOptions): VerificationReport {
	const registry = readRegistryFile(options.configDir, options.home);
	const outcomes = findCitations(answer).map((citation) => {
		const vault = registry.vaults.find((entry) => entry.name === citation.vault);
		const pagePath = vault === undefined ? undefined : join(expandHome(vault.path), 'knowledge', citation.page);

		return { citation, reason: failureReason(citation, pagePath) };
	});
	const verified = outcomes.filter((outcome) => outcome.reason === undefined).map((outcome) => outcome.citation);
	const failed = outcomes.flatMap((outcome) =>
		outcome.reason === undefined ? [] : [{ ...outcome.citation, reason: outcome.reason }],
	);

	return { verified, failed, isGrounded: verified.length > 0 && failed.length === 0 };
}

function failureReason(citation: Citation, pagePath: string | undefined): CitationFailureReason | undefined {
	if (citation.excerpt.length < minimumExcerptLength) {
		return 'excerpt too short';
	}

	if (pagePath === undefined) {
		return 'unknown vault';
	}

	if (!existsSync(pagePath)) {
		return 'missing page';
	}

	return comparable(readFileSync(pagePath, 'utf8')).includes(comparable(citation.excerpt))
		? undefined
		: 'excerpt not found';
}

function comparable(text: string): string {
	return text
		.replace(/[*_`]|\[\[|\]\]/g, '')
		.replace(/\s+/g, ' ')
		.toLowerCase();
}
