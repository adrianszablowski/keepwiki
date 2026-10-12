import { describe, expect, it } from 'vitest';
import { parseFrontmatter, renderFrontmatter, setFrontmatterField } from './frontmatter.js';

const note = '---\nsource: text\nstatus: unprocessed\nadded: 2026-10-12\n---\n\nBody\n';

describe('frontmatter', () => {
	it('parses key: value lines and keeps colons inside values', () => {
		const fields = parseFrontmatter('---\nurl: https://e.com/a\ntitle: A: B\n---\n');

		expect(fields.get('url')).toBe('https://e.com/a');
		expect(fields.get('title')).toBe('A: B');
	});

	it('renders only the fields that have a value', () => {
		expect(renderFrontmatter({ source: 'text', url: undefined, status: 'unprocessed' })).toBe(
			'---\nsource: text\nstatus: unprocessed\n---',
		);
	});

	it('replaces a field in place, keeping the order of the others', () => {
		expect(setFrontmatterField(note, 'status', 'processed')).toBe(
			'---\nsource: text\nstatus: processed\nadded: 2026-10-12\n---\n\nBody\n',
		);
	});

	it('appends a field that is absent and removes one set to undefined', () => {
		const withProcessed = setFrontmatterField(note, 'processed', '2026-10-13');

		expect(withProcessed).toContain('added: 2026-10-12\nprocessed: 2026-10-13\n---');
		expect(setFrontmatterField(withProcessed, 'processed', undefined)).toBe(note);
	});
});
