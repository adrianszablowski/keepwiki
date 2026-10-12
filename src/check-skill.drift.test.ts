import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evalSmallRows, findingCodes, pageFields, pendingUpdatesWarning, severities, stalePageDays } from './check.js';

const check = readFileSync(new URL('../skills/check/SKILL.md', import.meta.url), 'utf8');
const learn = readFileSync(new URL('../skills/learn/SKILL.md', import.meta.url), 'utf8');
const explain = readFileSync(new URL('../skills/explain/SKILL.md', import.meta.url), 'utf8');

describe('skills/check/SKILL.md against the check code', () => {
	it('lists every severity and every finding code', () => {
		for (const severity of severities) expect(check).toContain(`\`${severity}\``);
		for (const code of findingCodes) expect(check).toContain(`\`${code}\``);
	});

	it('quotes the thresholds', () => {
		expect(check).toContain(`${pendingUpdatesWarning} `);
		expect(check).toContain(`${stalePageDays} days`);
		expect(check).toContain(`${evalSmallRows} rows`);
	});

	it('runs the check command', () => {
		expect(check).toContain('npx -y keepwiki check --vault');
	});
});

describe('page frontmatter across skills', () => {
	it('learn names every page field the check code reads', () => {
		for (const field of pageFields) expect(learn).toMatch(new RegExp(`^\\s*${field}:`, 'm'));
	});
});

describe('skills/explain/SKILL.md', () => {
	it('never edits, runs the gate and points at add for gaps', () => {
		expect(explain).toContain('/keepwiki:add');
		expect(explain).toContain('[source: <vault>/knowledge/<page>.md]');
		expect(explain).toContain('npx -y keepwiki verify-citations');
	});
});
