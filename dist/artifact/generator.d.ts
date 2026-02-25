import { IArtifactOptions, IArtifactResult } from './types.js';
/**
 * Generates pipeline artifacts: PR, test report, beads audit trail.
 * Handles both success and failure cases.
 */
export declare class ArtifactGenerator {
    private logger;
    private options;
    constructor(options: IArtifactOptions);
    generate(): Promise<IArtifactResult>;
    private mergeBranches;
    private createPullRequest;
    private buildSuccessPrBody;
    private buildFailurePrBody;
    private buildTestReport;
    private exportBeadsAudit;
    private getGateStatusHistory;
}
