import { EventEmitter } from 'events';
import { TaskInput } from './task-queue.js';
import { StateStore } from '../storage/state-store.js';
import { Config } from '../utils/config.js';
import { YamlPersistence } from '../storage/yaml-persistence.js';
export interface OrchestratorOptions {
    config: Config;
    stateStore?: StateStore;
    repository: string;
    baseBranch: string;
    globalContext?: string;
    globalFiles?: string[];
    defaultModel?: string;
    yamlPersistence?: YamlPersistence;
    beadsEnabled?: boolean;
}
export declare class Orchestrator extends EventEmitter {
    private client;
    private queue;
    private stateStore?;
    private logger;
    private options;
    private activeAgents;
    private timeouts;
    private isRunning;
    private templateName;
    constructor(options: OrchestratorOptions);
    private setupEventHandlers;
    loadTasks(templateName: string, tasks: TaskInput[]): void;
    start(): Promise<void>;
    private trySpawnAgents;
    private spawnAgent;
    private buildPrompt;
    private handleAgentComplete;
    private handleBreakpoint;
    private handleAgentFailed;
    private clearTimeout;
    private clearAllTimeouts;
    private saveState;
    stop(): Promise<void>;
    getStatus(): {
        isRunning: boolean;
        queue: Record<string, number>;
        activeAgents: Array<{
            agentId: string;
            taskId: string;
        }>;
    };
    sendFollowUp(taskId: string, message: string): Promise<void>;
}
