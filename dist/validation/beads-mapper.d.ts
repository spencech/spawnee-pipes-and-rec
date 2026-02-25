import { IGateResult } from './types.js';
export interface IBeadsMapperOptions {
    cycle: number;
    maxCycles: number;
    cwd?: string;
}
/**
 * Maps gate failures to beads issues via `bd create`.
 * Groups failures intelligently (multiple errors in same file → one issue).
 */
export declare class BeadsMapper {
    private logger;
    private options;
    constructor(options: IBeadsMapperOptions);
    /**
     * Creates beads issues from gate results. Returns created issue IDs.
     */
    createIssuesFromResults(gateResults: IGateResult[]): Promise<string[]>;
    /**
     * Groups failures by file (for typecheck/lint) or keeps them individual (for unit/e2e).
     */
    private groupFailures;
    private createIssue;
    private buildTitle;
    private buildDescription;
}
