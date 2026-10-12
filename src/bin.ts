#!/usr/bin/env node
import { run } from './cli.js';

process.exitCode = run(process.argv.slice(2), {
	write: (text) => process.stdout.write(text),
	error: (text) => process.stderr.write(text),
});
