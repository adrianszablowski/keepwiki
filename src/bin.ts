#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { run } from './cli.js';

process.exitCode = await run(process.argv.slice(2), {
	write: (text) => process.stdout.write(text),
	error: (text) => process.stderr.write(text),
	read: () => readFileSync(0, 'utf8'),
});
