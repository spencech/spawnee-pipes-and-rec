import { execFileNoThrow } from './shell.js';
export async function fetchAll(cwd) {
    return execFileNoThrow('git', ['fetch', '--all'], { cwd });
}
export async function getCurrentBranch(cwd) {
    const result = await execFileNoThrow('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd });
    return result.stdout.trim();
}
export async function checkoutBranch(cwd, branch, create = false) {
    const args = create ? ['checkout', '-b', branch] : ['checkout', branch];
    return execFileNoThrow('git', args, { cwd });
}
export async function mergeBranch(cwd, branch) {
    return execFileNoThrow('git', ['merge', branch, '--no-edit'], { cwd });
}
export async function pushBranch(cwd, branch, setUpstream = false) {
    const args = setUpstream
        ? ['push', '-u', 'origin', branch]
        : ['push', 'origin', branch];
    return execFileNoThrow('git', args, { cwd });
}
export async function branchExists(cwd, branch, remote = true) {
    const ref = remote ? `origin/${branch}` : branch;
    const result = await execFileNoThrow('git', ['rev-parse', '--verify', ref], { cwd });
    return result.exitCode === 0;
}
//# sourceMappingURL=git.js.map