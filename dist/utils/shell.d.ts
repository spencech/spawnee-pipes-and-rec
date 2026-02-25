export interface IShellResult {
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
}
export interface IShellOptions {
    cwd?: string;
    timeout?: number;
    env?: NodeJS.ProcessEnv;
}
/**
 * Executes a command using execFile (not exec) for shell injection safety.
 * Does NOT throw on non-zero exit codes — callers must check exitCode.
 */
export declare function execFileNoThrow(command: string, args?: string[], options?: IShellOptions): Promise<IShellResult>;
