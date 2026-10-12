import { createRequire } from 'node:module';

export interface CommandLineIo {
	readonly write: (text: string) => void;
	readonly error: (text: string) => void;
}

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

const usage = `Usage: keepwiki <command>

Commands:
  --version    print the version
`;

export function run(argv: readonly string[], io: CommandLineIo): number {
	const [command] = argv;

	if (command === undefined) {
		io.write(usage);

		return 0;
	}

	if (command === '--version') {
		io.write(`${version}\n`);

		return 0;
	}

	io.error(`Unknown command: ${command}\n\n${usage}`);

	return 1;
}
