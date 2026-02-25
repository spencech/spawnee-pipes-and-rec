import { IValidationHistory } from '../validation/types.js';
import { Task } from '../core/task-queue.js';
export interface IArtifactOptions {
    templateName: string;
    description?: string;
    acceptance_criteria: string[];
    validationHistory: IValidationHistory;
    taskResults: {
        completed: Task[];
        failed: Task[];
    };
    featureBranch: string;
    baseBranch: string;
    repoWorkDir: string;
    success: boolean;
}
export interface IArtifactResult {
    prUrl?: string;
    testReport: string;
    beadsAuditTrail: string;
}
