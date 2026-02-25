import { IShellResult } from './shell.js';
export declare function fetchAll(cwd: string): Promise<IShellResult>;
export declare function getCurrentBranch(cwd: string): Promise<string>;
export declare function checkoutBranch(cwd: string, branch: string, create?: boolean): Promise<IShellResult>;
export declare function mergeBranch(cwd: string, branch: string): Promise<IShellResult>;
export declare function pushBranch(cwd: string, branch: string, setUpstream?: boolean): Promise<IShellResult>;
export declare function branchExists(cwd: string, branch: string, remote?: boolean): Promise<boolean>;
