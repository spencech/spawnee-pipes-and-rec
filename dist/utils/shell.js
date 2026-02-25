import { execFile as _execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(_execFile);
/**
 * Executes a command using execFile (not exec) for shell injection safety.
 * Does NOT throw on non-zero exit codes — callers must check exitCode.
 */
export async function execFileNoThrow(command, args = [], options = {}) {
    const start = Date.now();
    try {
        const result = await execFileAsync(command, args, {
            cwd: options.cwd,
            timeout: options.timeout,
            env: options.env ?? process.env,
            maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        return {
            stdout: result.stdout,
            stderr: result.stderr,
            exitCode: 0,
            durationMs: Date.now() - start,
        };
    }
    catch (error) {
        const execError = error;
        return {
            stdout: execError.stdout ?? '',
            stderr: execError.stderr ?? (error instanceof Error ? error.message : String(error)),
            exitCode: execError.code ?? 1,
            durationMs: Date.now() - start,
        };
    }
}
//# sourceMappingURL=shell.js.map