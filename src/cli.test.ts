import { createRequire } from 'node:module';
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
