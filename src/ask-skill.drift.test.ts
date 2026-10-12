import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { minimumExcerptLength } from './citations.js';
import { evalHeader } from './vault.js';

const ask = readFileSync(new URL('../skills/ask/SKILL.md', import.meta.url), 'utf8');
const evalSkill = readFileSync(new URL('../skills/eval/SKILL.md', import.meta.url), 'utf8');

describe('skills/ask/SKILL.md against the citation gate', () => {
	it('quotes the citation format the gate parses', () => {
		expect(ask).toContain('[source: <vault>/knowledge/<page>.md]');
	});

	it('quotes the minimum excerpt length', () => {
		expect(ask).toContain(`${minimumExcerptLength} characters`);
	});

	it('runs the gate and the inbox check', () => {
		expect(ask).toContain('npx -y keepwiki verify-citations');
		expect(ask).toContain('npx -y keepwiki inbox list');
	});
});

describe('skills/eval/SKILL.md against the eval file format', () => {
	it('quotes the eval table header and the none marker', () => {
		expect(evalSkill).toContain(evalHeader);
		expect(evalSkill).toContain('`none`');
	});
});
