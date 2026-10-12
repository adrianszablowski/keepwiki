import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { addToInbox, completeNote, listInbox } from './inbox.js';
import { adoptVault, createVault } from './vault.js';

interface Sandbox {
	readonly configDir: string;
	readonly home: string;
}

function sandbox(): Sandbox {
	const root = mkdtempSync(join(tmpdir(), 'keepwiki-inbox-'));

	return { configDir: join(root, 'config'), home: join(root, 'home') };
}

function withVault(name = 'seo'): Sandbox & { readonly vaultPath: string } {
	const box = sandbox();
	const { path } = createVault({ name, description: `${name} notes`, language: 'en' }, box);

	return { ...box, vaultPath: path };
}

const now = new Date();
const today = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
	.map((part) => String(part).padStart(2, '0'))
	.join('-');

describe('adding a source to an inbox', () => {
	it('writes a dated, slugged note with the frontmatter fields into the vault inbox', () => {
		const box = withVault();
		const result = addToInbox(
			{ vault: 'seo', source: 'text', title: 'Canonical tags: what Google says', content: 'Body text.\n' },
			box,
		);
		const note = readFileSync(result.path, 'utf8');

		expect(result).toEqual({
			path: join(box.vaultPath, 'inbox', `${today}-canonical-tags-what-google-says.md`),
			vault: 'seo',
			outcome: 'created',
		});
		expect(note).toBe(
			[
				'---',
				'source: text',
				'title: Canonical tags: what Google says',
				'status: unprocessed',
				`added: ${today}`,
				'---',
				'',
				'Body text.',
				'',
			].join('\n'),
		);
	});

	it('writes the url field when the source has one', () => {
		const box = withVault();
		const result = addToInbox(
			{ vault: 'seo', source: 'article', title: 'A', url: 'https://example.com/a', content: 'x' },
			box,
		);

		expect(readFileSync(result.path, 'utf8')).toContain('url: https://example.com/a\n');
	});

	it('creates the shared inbox on first use when no vault is named', () => {
		const box = sandbox();
		const result = addToInbox({ source: 'text', title: 'Loose thought', content: 'x' }, box);

		expect(result.vault).toBeNull();
		expect(result.path).toBe(join(box.home, 'inbox', `${today}-loose-thought.md`));
		expect(existsSync(result.path)).toBe(true);
	});

	it('slugs a Polish title to ascii letters, digits and hyphens', () => {
		const box = withVault();
		const result = addToInbox(
			{ vault: 'seo', source: 'text', title: 'Zażółć gęślą jaźń: 3 kroki!', content: 'x' },
			box,
		);

		expect(result.path).toBe(join(box.vaultPath, 'inbox', `${today}-zazolc-gesla-jazn-3-kroki.md`));
	});

	it('suffixes the filename when a note with the same slug exists today', () => {
		const box = withVault();
		const spec = { vault: 'seo', source: 'text', title: 'Same', content: 'x' } as const;

		addToInbox(spec, box);

		expect(addToInbox(spec, box).path).toBe(join(box.vaultPath, 'inbox', `${today}-same-2.md`));
		expect(addToInbox(spec, box).path).toBe(join(box.vaultPath, 'inbox', `${today}-same-3.md`));
	});

	it('refuses a vault that is not in the registry', () => {
		const box = withVault();

		expect(() => addToInbox({ vault: 'nope', source: 'text', title: 'T', content: 'x' }, box)).toThrow(/registry list/);
	});

	it('appends to the existing note when the same url is added again', () => {
		const box = withVault();
		const first = addToInbox(
			{
				vault: 'seo',
				source: 'article',
				title: 'A',
				url: 'https://www.example.com/a/?utm_source=x#top',
				content: 'summary',
			},
			box,
		);
		const second = addToInbox(
			{ vault: 'seo', source: 'text', title: 'A transcript', url: 'http://example.com/a', content: 'full text' },
			box,
		);
		const note = readFileSync(first.path, 'utf8');

		expect(second).toEqual({ path: first.path, vault: 'seo', outcome: 'appended' });
		expect(note).toContain('summary');
		expect(note).toContain(`## text added ${today}`);
		expect(note).toContain('full text');
		expect(readdirSync(join(box.vaultPath, 'inbox'))).toHaveLength(1);
	});

	it('brings a processed note back from raw to the inbox of its own vault when its url is added again', () => {
		const box = withVault();
		const first = addToInbox(
			{ vault: 'seo', source: 'article', title: 'A', url: 'https://example.com/a', content: 'summary' },
			box,
		);

		completeNote(first.path, box);

		const second = addToInbox({ source: 'text', title: 'A again', url: 'https://example.com/a', content: 'more' }, box);
		const note = readFileSync(second.path, 'utf8');

		expect(second.vault).toBe('seo');
		expect(second.path).toBe(first.path);
		expect(note).toContain('status: unprocessed');
		expect(note).not.toContain('processed:');
		expect(readdirSync(join(box.vaultPath, 'raw'))).toEqual([]);
	});
});

describe('listing unprocessed sources', () => {
	it('returns nothing before anything was added', () => {
		expect(listInbox(withVault())).toEqual([]);
	});

	it('lists shared and vault notes with their fields and skips processed ones', () => {
		const box = withVault();
		const shared = addToInbox({ source: 'text', title: 'Shared', content: 'x' }, box);
		const owned = addToInbox(
			{ vault: 'seo', source: 'article', title: 'Owned', url: 'https://e.com', content: 'x' },
			box,
		);
		const done = addToInbox({ vault: 'seo', source: 'text', title: 'Done', content: 'x' }, box);

		completeNote(done.path, box);

		expect(listInbox(box)).toEqual([
			{ path: shared.path, vault: null, source: 'text', title: 'Shared', added: today },
			{ path: owned.path, vault: 'seo', source: 'article', title: 'Owned', url: 'https://e.com', added: today },
		]);
	});

	it('lists the notes an adopted vault still has under unprocessed notes', () => {
		const box = sandbox();
		const existing = join(box.home, '..', 'notes');

		mkdirSync(existing, { recursive: true });
		writeFileSync(join(existing, 'old.md'), '# old\n');
		adoptVault({ name: 'notes', description: 'd', language: 'en', path: existing }, box);

		expect(listInbox(box)).toEqual([
			{ path: join(existing, 'old.md'), vault: 'notes', source: 'adopted', title: 'old.md', added: '' },
		]);
	});
});

describe('completing a source after learn', () => {
	it('moves a vault inbox note to raw and marks it processed', () => {
		const box = withVault();
		const { path } = addToInbox({ vault: 'seo', source: 'text', title: 'T', content: 'body' }, box);
		const result = completeNote(path, box);
		const raw = readFileSync(result.path, 'utf8');

		expect(result.path).toBe(join(box.vaultPath, 'raw', `${today}-t.md`));
		expect(result.vault).toBe('seo');
		expect(existsSync(path)).toBe(false);
		expect(raw).toContain('status: processed');
		expect(raw).toContain(`processed: ${today}`);
		expect(raw).toContain('body');
		expect(['committed', 'uncommitted', 'unavailable']).toContain(result.git);
	});

	it('moves a shared inbox note into the raw folder of the vault named', () => {
		const box = withVault();
		const { path } = addToInbox({ source: 'text', title: 'T', content: 'body' }, box);
		const result = completeNote(path, { ...box, vault: 'seo' });

		expect(result.path).toBe(join(box.vaultPath, 'raw', `${today}-t.md`));
		expect(existsSync(path)).toBe(false);
	});

	it('refuses a shared inbox note without a vault', () => {
		const box = withVault();
		const { path } = addToInbox({ source: 'text', title: 'T', content: 'body' }, box);

		expect(() => completeNote(path, box)).toThrow(/--vault/);
	});

	it('removes an adopted note from unprocessed notes and leaves the file alone', () => {
		const box = sandbox();
		const existing = join(box.home, '..', 'notes');

		mkdirSync(existing, { recursive: true });
		writeFileSync(join(existing, 'old.md'), '# old\n');
		writeFileSync(join(existing, 'other.md'), '# other\n');
		adoptVault({ name: 'notes', description: 'd', language: 'en', path: existing }, box);

		const result = completeNote(join(existing, 'old.md'), box);
		const index = readFileSync(join(existing, 'index.md'), 'utf8');

		expect(result.path).toBe(join(existing, 'old.md'));
		expect(readFileSync(join(existing, 'old.md'), 'utf8')).toBe('# old\n');
		expect(index).not.toContain('- old.md');
		expect(index).toContain('- other.md');
		expect(listInbox(box).map((note) => note.title)).toEqual(['other.md']);
	});

	it('refuses a file that is not an unprocessed source', () => {
		const box = withVault();
		const page = join(box.vaultPath, 'knowledge', 'page.md');

		writeFileSync(page, '# page\n');

		expect(() => completeNote(page, box)).toThrow(/not an unprocessed source/);
	});
});
