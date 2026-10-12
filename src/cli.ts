import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fetchArticle } from './article.js';
import { addToInbox, completeNote, listInbox, sourceKinds, type InboxOptions, type SourceKind } from './inbox.js';
import { renderRegistry } from './registry.js';
import { adoptVault, createVault, expandHome, readRegistryFile, type VaultOptions, type VaultSpec } from './vault.js';

export interface CommandLineIo {
	readonly write: (text: string) => void;
	readonly error: (text: string) => void;
	readonly read: () => string;
}

export type Environment = Readonly<Record<string, string | undefined>>;

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const usage = `Usage: keepwiki <command>

Commands:
  registry list                       print the registry file
  vault create --name <n> --description <d> --language <l> [--boundary <b>] [--path <p>] [--home <h>]
  vault adopt  --name <n> --description <d> --language <l> --path <p> [--boundary <b>] [--home <h>]
  inbox add    --source <${sourceKinds.join('|')}> [--vault <n>] [--title <t>] [--url <u>] [--file <p>]
                                      content comes from --file (- is stdin), from --url for an article, else stdin
  inbox list                          print every unprocessed source as JSON
  inbox done   <path> [--vault <n>]   move a learned source to raw/ (--vault for a shared inbox note)
  --version                           print the version

The registry lives in ~/.keepwiki/registry.md.
`;

const vaultFlags = {
	name: { type: 'string' },
	description: { type: 'string' },
	language: { type: 'string' },
	boundary: { type: 'string' },
	path: { type: 'string' },
	home: { type: 'string' },
} as const;

const inboxFlags = {
	vault: { type: 'string' },
	source: { type: 'string' },
	title: { type: 'string' },
	url: { type: 'string' },
	file: { type: 'string' },
} as const;

export async function run(argv: readonly string[], io: CommandLineIo, env: Environment = process.env): Promise<number> {
	const [command, subcommand, ...rest] = argv;

	if (command === undefined) {
		io.write(usage);

		return 0;
	}

	if (command === '--version') {
		io.write(`${version}\n`);

		return 0;
	}

	try {
		if (command === 'registry' && subcommand === 'list') {
			return listRegistry(io, env);
		}

		if (command === 'vault' && (subcommand === 'create' || subcommand === 'adopt')) {
			return vaultCommand(subcommand, rest, io, env);
		}

		if (command === 'inbox' && subcommand === 'add') {
			return await inboxAdd(rest, io, env);
		}

		if (command === 'inbox' && subcommand === 'list') {
			return inboxList(io, env);
		}

		if (command === 'inbox' && subcommand === 'done') {
			return inboxDone(rest, io, env);
		}
	} catch (error) {
		io.error(`${(error as Error).message}\n`);

		return 1;
	}

	io.error(`Unknown command: ${argv.join(' ')}\n\n${usage}`);

	return 1;
}

function listRegistry(io: CommandLineIo, env: Environment): number {
	const registry = readRegistryFile(configDir(env), defaultHome(env));

	io.write(
		registry.vaults.length === 0
			? 'No vaults yet. Create one with `keepwiki vault create`.\n'
			: renderRegistry(registry),
	);

	return 0;
}

function vaultCommand(
	action: 'create' | 'adopt',
	args: readonly string[],
	io: CommandLineIo,
	env: Environment,
): number {
	const { values } = parseArgs({ args: [...args], options: vaultFlags, strict: true });
	const required =
		action === 'adopt' ? ['name', 'description', 'language', 'path'] : ['name', 'description', 'language'];

	requireFlags(values, required);

	const options: VaultOptions = {
		configDir: configDir(env),
		home:
			values.home === undefined
				? expandHome(readRegistryFile(configDir(env), defaultHome(env)).home)
				: resolve(values.home),
	};
	const path = values.path === undefined ? undefined : resolve(values.path);
	const spec: VaultSpec = {
		name: values.name ?? '',
		description: values.description ?? '',
		language: values.language ?? '',
		...(values.boundary === undefined ? {} : { boundary: values.boundary }),
		...(path === undefined ? {} : { path }),
	};
	const result = action === 'adopt' ? adoptVault({ ...spec, path: path ?? '' }, options) : createVault(spec, options);

	io.write(`${JSON.stringify(result, null, '\t')}\n`);

	return 0;
}

async function inboxAdd(args: readonly string[], io: CommandLineIo, env: Environment): Promise<number> {
	const { values } = parseArgs({ args: [...args], options: inboxFlags, strict: true });
	const source = sourceKindNamed(values.source);
	const fetched = source === 'article' && values.file === undefined ? await fetchArticle(requireUrl(values.url)) : null;
	const title = values.title ?? fetched?.title;

	if (title === undefined) {
		throw new Error(`Missing --title.\n\n${usage}`);
	}

	const content = fetched?.text ?? readContent(values.file, io);
	const result = addToInbox(
		{
			source,
			title,
			content,
			...(values.url === undefined ? {} : { url: values.url }),
			...(values.vault === undefined ? {} : { vault: values.vault }),
		},
		inboxOptions(env),
	);

	io.write(`${JSON.stringify(result, null, '\t')}\n`);

	return 0;
}

function inboxList(io: CommandLineIo, env: Environment): number {
	io.write(`${JSON.stringify(listInbox(inboxOptions(env)), null, '\t')}\n`);

	return 0;
}

function inboxDone(args: readonly string[], io: CommandLineIo, env: Environment): number {
	const { values, positionals } = parseArgs({
		args: [...args],
		options: { vault: { type: 'string' } },
		strict: true,
		allowPositionals: true,
	});
	const [path] = positionals;

	if (path === undefined) {
		throw new Error(`Missing the note path.\n\n${usage}`);
	}

	const result = completeNote(path, {
		...inboxOptions(env),
		...(values.vault === undefined ? {} : { vault: values.vault }),
	});

	io.write(`${JSON.stringify(result, null, '\t')}\n`);

	return 0;
}

function readContent(file: string | undefined, io: CommandLineIo): string {
	if (file === undefined || file === '-') {
		return io.read();
	}

	return readFileSync(resolve(file), 'utf8');
}

function sourceKindNamed(value: string | undefined): SourceKind {
	const kind = sourceKinds.find((candidate) => candidate === value);

	if (kind === undefined) {
		throw new Error(`--source must be one of ${sourceKinds.join(', ')}.\n\n${usage}`);
	}

	return kind;
}

function requireUrl(url: string | undefined): string {
	if (url === undefined) {
		throw new Error(`An article is fetched from --url; give it, or pass the text with --file.\n\n${usage}`);
	}

	return url;
}

function requireFlags(values: Readonly<Record<string, string | undefined>>, required: readonly string[]): void {
	const missing = required.filter((flag) => values[flag] === undefined);

	if (missing.length > 0) {
		throw new Error(`Missing ${missing.map((flag) => `--${flag}`).join(', ')}.\n\n${usage}`);
	}
}

function inboxOptions(env: Environment): InboxOptions {
	return { configDir: configDir(env), home: defaultHome(env) };
}

function configDir(env: Environment): string {
	return join(env['HOME'] ?? homedir(), '.keepwiki');
}

function defaultHome(env: Environment): string {
	return join(env['HOME'] ?? homedir(), 'keepwiki');
}
