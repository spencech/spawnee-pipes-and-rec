import { execFileNoThrow, IShellResult } from './shell.js';

export async function fetchAll(cwd: string): Promise<IShellResult> {
	return execFileNoThrow('git', ['fetch', '--all'], { cwd });
}

export async function getCurrentBranch(cwd: string): Promise<string> {
	const result = await execFileNoThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
	return result.stdout.trim();
}

export async function checkoutBranch(cwd: string, branch: string, create = false): Promise<IShellResult> {
	const args = create ? ['checkout', '-b', branch] : ['checkout', branch];
	return execFileNoThrow('git', args, { cwd });
}

export async function mergeBranch(cwd: string, branch: string): Promise<IShellResult> {
	return execFileNoThrow('git', ['merge', branch, '--no-edit'], { cwd });
}

export async function pushBranch(cwd: string, branch: string, setUpstream = false): Promise<IShellResult> {
	const args = setUpstream
		? ['push', '-u', 'origin', branch]
		: ['push', 'origin', branch];
	return execFileNoThrow('git', args, { cwd });
}

export async function branchExists(cwd: string, branch: string, remote = true): Promise<boolean> {
	const ref = remote ? `origin/${branch}` : branch;
	const result = await execFileNoThrow('git', ['rev-parse', '--verify', ref], { cwd });
	return result.exitCode === 0;
}
