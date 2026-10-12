import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { renderRegistry } from './registry.js';
import { adoptVault, createVault, expandHome, readRegistryFile, type VaultOptions, type VaultSpec } from './vault.js';

export interface CommandLineIo {
	readonly write: (text: string) => void;
	readonly error: (text: string) => void;
}

export type Environment = Readonly<Record<string, string | undefined>>;

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const usage = `Usage: keepwiki <command>

Commands:
  registry list                       print the registry file
  vault create --name <n> --description <d> --language <l> [--boundary <b>] [--path <p>] [--home <h>]
  vault adopt  --name <n> --description <d> --language <l> --path <p> [--boundary <b>] [--home <h>]
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

export function run(argv: readonly string[], io: CommandLineIo, env: Environment = process.env): number {
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
	} catch (error) {
		io.error(`${(error as Error).message}\n`);

		return 1;
	}

	io.error(`Unknown command: ${argv.join(' ')}\n\n${usage}`);

	return 1;
}

function listRegistry(io: CommandLineIo, env: Environment): number {
	const registry = readRegistryFile(configDir(env));

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
	const missing = required.filter((flag) => values[flag as keyof typeof values] === undefined);

	if (missing.length > 0) {
		throw new Error(`Missing ${missing.map((flag) => `--${flag}`).join(', ')}.\n\n${usage}`);
	}

	const options: VaultOptions = {
		configDir: configDir(env),
		home: values.home === undefined ? expandHome(readRegistryFile(configDir(env)).home) : resolve(values.home),
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

function configDir(env: Environment): string {
	return join(env['HOME'] ?? homedir(), '.keepwiki');
}
