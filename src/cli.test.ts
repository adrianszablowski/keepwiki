import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from './cli.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

interface CapturedOutput {
	readonly out: string[];
	readonly err: string[];
}

function capture(stdin = ''): CapturedOutput & { readonly io: Parameters<typeof run>[1] } {
	const out: string[] = [];
	const err: string[] = [];

	return { out, err, io: { write: (text) => out.push(text), error: (text) => err.push(text), read: () => stdin } };
}

describe('the keepwiki command line', () => {
	it('prints the package version for --version', async () => {
		const captured = capture();
		const exitCode = await run(['--version'], captured.io);

		expect(exitCode).toBe(0);
		expect(captured.out.join('')).toBe(`${version}\n`);
	});

	it('prints usage and fails on a command it does not know', async () => {
		const captured = capture();
		const exitCode = await run(['frobnicate'], captured.io);

		expect(exitCode).toBe(1);
		expect(captured.err.join('')).toContain('frobnicate');
		expect(captured.err.join('')).toContain('Usage');
	});

	it('prints usage and succeeds when called with no arguments', async () => {
		const captured = capture();
		const exitCode = await run([], captured.io);

		expect(exitCode).toBe(0);
		expect(captured.out.join('')).toContain('Usage');
	});
});

describe('the vault and registry commands', () => {
	function sandbox(): { readonly env: Readonly<Record<string, string>>; readonly home: string } {
		const root = mkdtempSync(join(tmpdir(), 'keepwiki-cli-'));

		return { env: { HOME: root }, home: join(root, 'home') };
	}

	it('says there are no vaults before the first one is created', async () => {
		const { env } = sandbox();
		const captured = capture();

		expect(await run(['registry', 'list'], captured.io, env)).toBe(0);
		expect(captured.out.join('')).toContain('No vaults yet');
	});

	it('creates a vault and prints a JSON summary the skill can read', async () => {
		const { env, home } = sandbox();
		const captured = capture();
		const exitCode = await run(
			['vault', 'create', '--name', 'megadev', '--description', 'Kurs MegaDev', '--language', 'pl', '--home', home],
			captured.io,
			env,
		);
		const summary = JSON.parse(captured.out.join('')) as { name: string; path: string; git: string };

		expect(exitCode).toBe(0);
		expect(summary.name).toBe('megadev');
		expect(summary.path).toBe(join(home, 'vaults', 'megadev'));
		expect(existsSync(join(summary.path, 'knowledge'))).toBe(true);
	});

	it('lists the registry file after a vault exists', async () => {
		const { env, home } = sandbox();
		const captured = capture();

		await run(
			['vault', 'create', '--name', 'seo', '--description', 'SEO notes', '--language', 'en', '--home', home],
			captured.io,
			env,
		);
		await run(['registry', 'list'], captured.io, env);

		expect(captured.out.join('')).toContain('| seo | ');
	});

	it('adopts an existing folder and lists its notes as unprocessed', async () => {
		const { env, home } = sandbox();
		const existing = join(home, 'old-notes');
		const captured = capture();

		mkdirSync(existing, { recursive: true });
		writeFileSync(join(existing, 'a.md'), '# a\n');

		const exitCode = await run(
			[
				'vault',
				'adopt',
				'--name',
				'old',
				'--path',
				existing,
				'--description',
				'Old notes',
				'--language',
				'en',
				'--home',
				home,
			],
			captured.io,
			env,
		);
		const summary = JSON.parse(captured.out.join('')) as { unprocessed: string[] };

		expect(exitCode).toBe(0);
		expect(summary.unprocessed).toEqual(['a.md']);
	});

	it('fails with the missing flag named when a required flag is absent', async () => {
		const { env } = sandbox();
		const captured = capture();

		expect(await run(['vault', 'create', '--name', 'x'], captured.io, env)).toBe(1);
		expect(captured.err.join('')).toContain('--description');
	});

	it('fails with the reason when the vault name is taken', async () => {
		const { env, home } = sandbox();
		const captured = capture();
		const args = ['vault', 'create', '--name', 'dup', '--description', 'd', '--language', 'en', '--home', home];

		await run(args, captured.io, env);

		expect(await run(args, captured.io, env)).toBe(1);
		expect(captured.err.join('')).toContain('dup');
	});
});

describe('paths given to the CLI', () => {
	it('stores a relative --path and --home as absolute paths', async () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), 'keepwiki-cli-rel-')));
		const env = { HOME: root };
		const captured = capture();
		const previousCwd = process.cwd();

		process.chdir(root);

		try {
			await run(
				[
					'vault',
					'create',
					'--name',
					'rel',
					'--description',
					'd',
					'--language',
					'en',
					'--home',
					'home',
					'--path',
					'rel-vault',
				],
				captured.io,
				env,
			);
		} finally {
			process.chdir(previousCwd);
		}

		const summary = JSON.parse(captured.out.join('')) as { path: string };

		expect(summary.path).toBe(join(root, 'rel-vault'));
		expect(readFileSync(join(root, '.keepwiki', 'registry.md'), 'utf8')).toContain(`home: ${join(root, 'home')}`);
	});
});

describe('the inbox commands', () => {
	async function vaultSandbox(): Promise<{ readonly env: Readonly<Record<string, string>>; readonly home: string }> {
		const root = mkdtempSync(join(tmpdir(), 'keepwiki-cli-inbox-'));
		const env = { HOME: root };
		const home = join(root, 'home');

		await run(
			['vault', 'create', '--name', 'seo', '--description', 'SEO notes', '--language', 'en', '--home', home],
			capture().io,
			env,
		);

		return { env, home };
	}

	it('adds pasted text from stdin to a vault inbox and prints the note path', async () => {
		const { env, home } = await vaultSandbox();
		const captured = capture('Pasted body\n');
		const exitCode = await run(
			['inbox', 'add', '--vault', 'seo', '--source', 'text', '--title', 'Pasted'],
			captured.io,
			env,
		);
		const summary = JSON.parse(captured.out.join('')) as { path: string; vault: string; outcome: string };

		expect(exitCode).toBe(0);
		expect(summary.vault).toBe('seo');
		expect(summary.outcome).toBe('created');
		expect(summary.path.startsWith(join(home, 'vaults', 'seo', 'inbox'))).toBe(true);
		expect(readFileSync(summary.path, 'utf8')).toContain('Pasted body');
	});

	it('adds a file by path to the shared inbox when no vault is given', async () => {
		const { env, home } = await vaultSandbox();
		const file = join(home, 'notes.txt');
		const captured = capture();

		writeFileSync(file, 'From a file\n');

		const exitCode = await run(
			['inbox', 'add', '--source', 'file', '--title', 'Notes', '--file', file],
			captured.io,
			env,
		);
		const summary = JSON.parse(captured.out.join('')) as { path: string; vault: string | null };

		expect(exitCode).toBe(0);
		expect(summary.vault).toBeNull();
		expect(summary.path.startsWith(join(home, 'inbox'))).toBe(true);
		expect(readFileSync(summary.path, 'utf8')).toContain('From a file');
	});

	it('refuses a source kind it does not know', async () => {
		const { env } = await vaultSandbox();
		const captured = capture('x');

		expect(await run(['inbox', 'add', '--source', 'carrier-pigeon', '--title', 'T'], captured.io, env)).toBe(1);
		expect(captured.err.join('')).toContain('text, article, file, pdf');
	});

	it('requires a title unless the article is fetched', async () => {
		const { env } = await vaultSandbox();
		const captured = capture('x');

		expect(await run(['inbox', 'add', '--source', 'text'], captured.io, env)).toBe(1);
		expect(captured.err.join('')).toContain('--title');
	});

	it('lists unprocessed notes as JSON and completes one into raw', async () => {
		const { env, home } = await vaultSandbox();
		const added = capture('Body\n');

		await run(['inbox', 'add', '--vault', 'seo', '--source', 'text', '--title', 'Body'], added.io, env);

		const listed = capture();

		await run(['inbox', 'list'], listed.io, env);

		const notes = JSON.parse(listed.out.join('')) as { path: string; title: string }[];

		expect(notes.map((note) => note.title)).toEqual(['Body']);

		const done = capture();
		const exitCode = await run(['inbox', 'done', notes[0]?.path ?? ''], done.io, env);
		const summary = JSON.parse(done.out.join('')) as { path: string; git: string };

		expect(exitCode).toBe(0);
		expect(summary.path.startsWith(join(home, 'vaults', 'seo', 'raw'))).toBe(true);
		expect(existsSync(notes[0]?.path ?? '')).toBe(false);
	});

	it('prints an empty list when nothing is unprocessed', async () => {
		const { env } = await vaultSandbox();
		const captured = capture();

		expect(await run(['inbox', 'list'], captured.io, env)).toBe(0);
		expect(JSON.parse(captured.out.join(''))).toEqual([]);
	});

	it('reminds in one line how many sources wait and which skill learns them', async () => {
		const { env } = await vaultSandbox();

		await run(['inbox', 'add', '--vault', 'seo', '--source', 'text', '--title', 'One'], capture('a\n').io, env);
		await run(['inbox', 'add', '--source', 'text', '--title', 'Two'], capture('b\n').io, env);

		const captured = capture();

		expect(await run(['inbox', 'remind'], captured.io, env)).toBe(0);
		expect(captured.out.join('')).toBe('keepwiki: 2 unprocessed sources; `/keepwiki:learn` adds them to the pages\n');
	});

	it('says source, not sources, for a single waiting note', async () => {
		const { env } = await vaultSandbox();

		await run(['inbox', 'add', '--source', 'text', '--title', 'Only'], capture('a\n').io, env);

		const captured = capture();

		await run(['inbox', 'remind'], captured.io, env);

		expect(captured.out.join('')).toContain('1 unprocessed source;');
	});

	it('stays silent when nothing is unprocessed, so a session start hook adds no context', async () => {
		const { env } = await vaultSandbox();
		const captured = capture();

		expect(await run(['inbox', 'remind'], captured.io, env)).toBe(0);
		expect(captured.out.join('')).toBe('');
	});

	it('stays silent before any vault or inbox exists', async () => {
		const captured = capture();

		expect(
			await run(['inbox', 'remind'], captured.io, { HOME: mkdtempSync(join(tmpdir(), 'keepwiki-cli-empty-')) }),
		).toBe(0);
		expect(captured.out.join('')).toBe('');
	});
});

describe('the citation gate command', () => {
	async function vaultWithPage(): Promise<{ readonly env: Readonly<Record<string, string>>; readonly root: string }> {
		const root = mkdtempSync(join(tmpdir(), 'keepwiki-cli-gate-'));
		const env = { HOME: root };
		const home = join(root, 'home');

		await run(
			['vault', 'create', '--name', 'seo', '--description', 'SEO', '--language', 'en', '--home', home],
			capture().io,
			env,
		);
		writeFileSync(
			join(home, 'vaults', 'seo', 'knowledge', 'canonical.md'),
			'# Canonical\n\nA canonical tag names the main URL.\n',
		);

		return { env, root };
	}

	it('exits 0 and prints the verified citations when every citation holds', async () => {
		const { env } = await vaultWithPage();
		const captured = capture('"A canonical tag names the main URL." [source: seo/knowledge/canonical.md]\n');
		const exitCode = await run(['verify-citations'], captured.io, env);
		const report = JSON.parse(captured.out.join('')) as { verified: unknown[]; failed: unknown[] };

		expect(exitCode).toBe(0);
		expect(report.verified).toHaveLength(1);
		expect(report.failed).toEqual([]);
	});

	it('exits 1 and names the reason when a citation fails', async () => {
		const { env } = await vaultWithPage();
		const captured = capture('"Canonical tags are always optional." [source: seo/knowledge/canonical.md]\n');
		const exitCode = await run(['verify-citations'], captured.io, env);
		const report = JSON.parse(captured.out.join('')) as { failed: { reason: string }[] };

		expect(exitCode).toBe(1);
		expect(report.failed[0]?.reason).toBe('excerpt not found');
	});

	it('exits 1 when the answer cites nothing', async () => {
		const { env } = await vaultWithPage();
		const captured = capture('Canonical tags matter.\n');

		expect(await run(['verify-citations'], captured.io, env)).toBe(1);
	});

	it('reads the answer from --file', async () => {
		const { env, root } = await vaultWithPage();
		const file = join(root, 'answer.md');
		const captured = capture();

		writeFileSync(file, '"A canonical tag names the main URL." [source: seo/knowledge/canonical.md]\n');

		expect(await run(['verify-citations', '--file', file], captured.io, env)).toBe(0);
	});
});

describe('adding a YouTube video', () => {
	it('writes the pasted transcript as a youtube note when --file - is given', async () => {
		const root = mkdtempSync(join(tmpdir(), 'keepwiki-cli-yt-'));
		const env = { HOME: root };

		await run(
			['vault', 'create', '--name', 'seo', '--description', 'SEO', '--language', 'en', '--home', join(root, 'home')],
			capture().io,
			env,
		);

		const captured = capture('spoken words\n');
		const exitCode = await run(
			[
				'inbox',
				'add',
				'--vault',
				'seo',
				'--source',
				'youtube',
				'--url',
				'https://youtu.be/dQw4w9WgXcQ',
				'--title',
				'Talk',
				'--file',
				'-',
			],
			captured.io,
			env,
		);
		const summary = JSON.parse(captured.out.join('')) as { path: string };

		expect(exitCode).toBe(0);
		expect(readFileSync(summary.path, 'utf8')).toContain('source: youtube');
		expect(readFileSync(summary.path, 'utf8')).toContain('spoken words');
	});
});

describe('the check command', () => {
	it('prints the JSON report and exits 0 even with findings', async () => {
		const root = mkdtempSync(join(tmpdir(), 'keepwiki-cli-check-'));
		const env = { HOME: root };
		const home = join(root, 'home');

		await run(
			['vault', 'create', '--name', 'seo', '--description', 'SEO', '--language', 'en', '--home', home],
			capture().io,
			env,
		);
		writeFileSync(
			join(home, 'vaults', 'seo', 'knowledge', 'a.md'),
			'---\ntitle: A\nupdated: 2026-10-12\n---\n\n[[missing]]\n',
		);

		const captured = capture();
		const exitCode = await run(['check', '--vault', 'seo'], captured.io, env);
		const report = JSON.parse(captured.out.join('')) as { vault: string; findings: { code: string }[] };

		expect(exitCode).toBe(0);
		expect(report.vault).toBe('seo');
		expect(report.findings.map((finding) => finding.code)).toContain('broken-link');
	});

	it('requires --vault', async () => {
		const captured = capture();

		expect(await run(['check'], captured.io, { HOME: mkdtempSync(join(tmpdir(), 'keepwiki-cli-check-')) })).toBe(1);
		expect(captured.err.join('')).toContain('--vault');
	});
});
