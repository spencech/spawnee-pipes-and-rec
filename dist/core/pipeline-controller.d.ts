import { EventEmitter } from 'events';
import { Task } from './task-queue.js';
import { IValidationHistory } from '../validation/types.js';
import { IArtifactResult } from '../artifact/types.js';
import { ParsedTemplate } from '../parsers/index.js';
import { Config } from '../utils/config.js';
import { StateStore } from '../storage/state-store.js';
import { YamlPersistence } from '../storage/yaml-persistence.js';
export interface IPipelineOptions {
    config: Config;
    template: ParsedTemplate;
    templatePath: string;
    repoWorkDir: string;
    generateArtifact: boolean;
    stateStore?: StateStore;
    yamlPersistence?: YamlPersistence;
}
export interface IPipelineResult {
    success: boolean;
    taskResults: {
        completed: Task[];
        failed: Task[];
    };
    validationHistory: IValidationHistory;
    artifact?: IArtifactResult;
}
/**
 * Manages the full pipeline lifecycle: Phase 3 (Execution) → Phase 4 (Validation) → Phase 5 (Artifacts).
 * Wraps the Orchestrator without modifying it. Handles the QA retry loop.
 */
export declare class PipelineController extends EventEmitter {
    private logger;
    private options;
    constructor(options: IPipelineOptions);
    run(): Promise<IPipelineResult>;
    private executePhase3;
    private executePhase4;
    private executePhase5;
    private mergeTaskBranches;
    private generateRetryTasks;
}
