import { EventEmitter } from 'events';
import { IGateConfig, IValidationResult } from './types.js';
export interface IValidationRunnerOptions {
    cwd: string;
    timeout?: number;
}
/**
 * Orchestrates running all validation gates in sequence.
 * All gates run regardless of individual failures (no short-circuit).
 */
export declare class ValidationRunner extends EventEmitter {
    private logger;
    private options;
    constructor(options: IValidationRunnerOptions);
    /**
     * Runs all gates in order and returns aggregate results.
     */
    run(gates: IGateConfig[], cycle: number, maxCycles: number): Promise<IValidationResult>;
}
