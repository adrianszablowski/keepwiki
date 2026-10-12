import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const skillsDir = fileURLToPath(new URL('../skills/', import.meta.url));
const codexKeys = ['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'];

describe('every shipped SKILL.md', () => {
	const skills = readdirSync(skillsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);

	for (const skill of skills) {
		it(`${skill} uses only the frontmatter keys Codex accepts and is named after its folder`, () => {
			const text = readFileSync(join(skillsDir, skill, 'SKILL.md'), 'utf8');
			const frontmatter = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
			const keys = frontmatter.split('\n').map((line) => line.split(':')[0]);

			for (const key of keys) expect(codexKeys).toContain(key);

			expect(frontmatter).toContain(`name: ${skill}\n`);
		});
	}
});
