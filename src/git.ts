import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type CommitOutcome = 'committed' | 'uncommitted' | 'unavailable';

export function hasGit(): boolean {
	try {
		execFileSync('git', ['--version'], { stdio: 'ignore' });

		return true;
	} catch {
		return false;
	}
}

export function commitAll(cwd: string, message: string): CommitOutcome {
	if (!existsSync(join(cwd, '.git')) || !hasGit()) {
		return 'unavailable';
	}

	try {
		execFileSync('git', ['add', '-A'], { cwd, stdio: 'ignore' });
		execFileSync('git', ['commit', '-q', '-m', message], { cwd, stdio: 'ignore' });

		return 'committed';
	} catch {
		return 'uncommitted';
	}
}
