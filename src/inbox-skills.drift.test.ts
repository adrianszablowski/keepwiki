import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inboxFields, inboxStatuses, sourceKinds } from './inbox.js';
import { indexSections } from './vault.js';
import { transcriptMissingOutcome } from './youtube.js';

const add = readFileSync(new URL('../skills/add/SKILL.md', import.meta.url), 'utf8');
const learn = readFileSync(new URL('../skills/learn/SKILL.md', import.meta.url), 'utf8');

describe('skills/add/SKILL.md against the inbox code', () => {
	it('offers exactly the source kinds the CLI accepts', () => {
		expect(add).toContain(`--source <${sourceKinds.join('|')}>`);
	});

	it('shows every frontmatter field of an inbox note in its manual fallback', () => {
		for (const field of inboxFields) expect(add).toMatch(new RegExp(`^\\s*${field}: `, 'm'));
	});

	it('names the outcome the CLI prints when a video has no transcript', () => {
		expect(add).toContain(transcriptMissingOutcome);
	});

	it('calls the inbox add command', () => {
		expect(add).toContain('npx -y keepwiki inbox add');
	});
});

describe('skills/learn/SKILL.md against the inbox and index code', () => {
	it('names every index section it edits', () => {
		for (const heading of Object.values(indexSections)) expect(learn).toContain(heading);
	});

	it('names both inbox statuses', () => {
		for (const status of inboxStatuses) expect(learn).toContain(`status: ${status}`);
	});

	it('calls the inbox list and inbox done commands', () => {
		expect(learn).toContain('npx -y keepwiki inbox list');
		expect(learn).toContain('npx -y keepwiki inbox done');
	});

	it('describes the cross-vault link syntax', () => {
		expect(learn).toContain('[[vault:page]]');
	});
});
