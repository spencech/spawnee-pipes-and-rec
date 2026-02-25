import { IGateConfig, IGateResult } from './types.js';
export interface IGateRunnerOptions {
    cwd: string;
    timeout?: number;
}
/**
 * Executes a single validation gate and returns the result.
 * For automated gates, runs the command via execFile.
 * For manual gates, prompts the user via inquirer.
 */
export declare function runGate(config: IGateConfig, options: IGateRunnerOptions): Promise<IGateResult>;
