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

function capture(): CapturedOutput & { readonly io: Parameters<typeof run>[1] } {
	const out: string[] = [];
	const err: string[] = [];

	return { out, err, io: { write: (text) => out.push(text), error: (text) => err.push(text) } };
}

describe('the keepwiki command line', () => {
	it('prints the package version for --version', () => {
		const captured = capture();
		const exitCode = run(['--version'], captured.io);

		expect(exitCode).toBe(0);
		expect(captured.out.join('')).toBe(`${version}\n`);
	});

	it('prints usage and fails on a command it does not know', () => {
		const captured = capture();
		const exitCode = run(['frobnicate'], captured.io);

		expect(exitCode).toBe(1);
		expect(captured.err.join('')).toContain('frobnicate');
		expect(captured.err.join('')).toContain('Usage');
	});

	it('prints usage and succeeds when called with no arguments', () => {
		const captured = capture();
		const exitCode = run([], captured.io);

		expect(exitCode).toBe(0);
		expect(captured.out.join('')).toContain('Usage');
	});
});

describe('the vault and registry commands', () => {
	function sandbox(): { readonly env: Readonly<Record<string, string>>; readonly home: string } {
		const root = mkdtempSync(join(tmpdir(), 'keepwiki-cli-'));

		return { env: { HOME: root }, home: join(root, 'home') };
	}

	it('says there are no vaults before the first one is created', () => {
		const { env } = sandbox();
		const captured = capture();

		expect(run(['registry', 'list'], captured.io, env)).toBe(0);
		expect(captured.out.join('')).toContain('No vaults yet');
	});

	it('creates a vault and prints a JSON summary the skill can read', () => {
		const { env, home } = sandbox();
		const captured = capture();
		const exitCode = run(
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

	it('lists the registry file after a vault exists', () => {
		const { env, home } = sandbox();
		const captured = capture();

		run(
			['vault', 'create', '--name', 'seo', '--description', 'SEO notes', '--language', 'en', '--home', home],
			captured.io,
			env,
		);
		run(['registry', 'list'], captured.io, env);

		expect(captured.out.join('')).toContain('| seo | ');
	});

	it('adopts an existing folder and lists its notes as unprocessed', () => {
		const { env, home } = sandbox();
		const existing = join(home, 'old-notes');
		const captured = capture();

		mkdirSync(existing, { recursive: true });
		writeFileSync(join(existing, 'a.md'), '# a\n');

		const exitCode = run(
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

	it('fails with the missing flag named when a required flag is absent', () => {
		const { env } = sandbox();
		const captured = capture();

		expect(run(['vault', 'create', '--name', 'x'], captured.io, env)).toBe(1);
		expect(captured.err.join('')).toContain('--description');
	});

	it('fails with the reason when the vault name is taken', () => {
		const { env, home } = sandbox();
		const captured = capture();
		const args = ['vault', 'create', '--name', 'dup', '--description', 'd', '--language', 'en', '--home', home];

		run(args, captured.io, env);

		expect(run(args, captured.io, env)).toBe(1);
		expect(captured.err.join('')).toContain('dup');
	});
});

describe('paths given to the CLI', () => {
	it('stores a relative --path and --home as absolute paths', () => {
		const root = realpathSync(mkdtempSync(join(tmpdir(), 'keepwiki-cli-rel-')));
		const env = { HOME: root };
		const captured = capture();
		const previousCwd = process.cwd();

		process.chdir(root);

		try {
			run(
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
