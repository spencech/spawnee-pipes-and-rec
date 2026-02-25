import { TaskStatus } from '../core/task-queue.js';
export interface OrchestratorState {
    templateName: string;
    startedAt: string;
    updatedAt: string;
    repository: string;
    tasks: SerializedTask[];
    activeAgents: Array<{
        agentId: string;
        taskId: string;
    }>;
}
export interface SerializedTask {
    id: string;
    name: string;
    status: TaskStatus;
    agentId?: string;
    attempts: number;
    error?: string;
    result?: {
        branch?: string;
        pullRequestUrl?: string;
        completedAt: string;
    };
}
export interface StateStore {
    save(state: OrchestratorState): Promise<void>;
    load(): Promise<OrchestratorState | null>;
    clear(): Promise<void>;
    exists(): Promise<boolean>;
}
