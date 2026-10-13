import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { run } from './cli.js';

interface HookCommand {
	readonly type: string;
	readonly command: string;
	readonly timeout: number;
}

interface HookGroup {
	readonly matcher: string;
	readonly hooks: readonly HookCommand[];
}

interface HooksFile {
	readonly hooks: Readonly<Record<string, readonly HookGroup[]>>;
}

const hooksFile = JSON.parse(readFileSync(new URL('../hooks/hooks.json', import.meta.url), 'utf8')) as HooksFile;
const sessionStart = hooksFile.hooks['SessionStart'] ?? [];
const commands = sessionStart.flatMap((group) => group.hooks);

describe('hooks/hooks.json against the CLI', () => {
	it('declares one SessionStart command hook that fires on startup, resume and clear', () => {
		expect(sessionStart.map((group) => group.matcher)).toEqual(['startup|resume|clear']);
		expect(commands.map((hook) => hook.type)).toEqual(['command']);
	});

	it('calls a CLI command that exists and succeeds', async () => {
		const match = /npx -y keepwiki ([a-z][a-z -]*[a-z])/.exec(commands[0]?.command ?? '');
		const argv = (match?.[1] ?? '').trim().split(' ');
		const err: string[] = [];
		const exitCode = await run(
			argv,
			{ write: () => {}, error: (text) => err.push(text), read: () => '' },
			{ HOME: '/nonexistent/keepwiki-hooks-test' },
		);

		expect(argv).toEqual(['inbox', 'remind']);
		expect(exitCode).toBe(0);
		expect(err).toEqual([]);
	});

	it('gives up well before the 600 second default so a cold npx cannot stall a session', () => {
		for (const hook of commands) expect(hook.timeout).toBeLessThanOrEqual(30);
	});

	it('cannot fail the session start: errors and a missing npx are swallowed', () => {
		for (const hook of commands) expect(hook.command).toMatch(/\|\| true$/);
	});
});
