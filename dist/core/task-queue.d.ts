import { EventEmitter } from 'events';
export interface Task {
    id: string;
    name: string;
    prompt: string;
    dependsOn: string[];
    priority: number;
    branch?: string;
    files?: string[];
    timeout?: number;
    retries?: number;
    validation?: {
        command: string;
        successPattern: string;
    };
    complete?: boolean;
    model?: string;
    repository?: {
        url: string;
        branch?: string;
    };
    breakpoint?: boolean;
    status: TaskStatus;
    agentId?: string;
    attempts: number;
    error?: string;
    result?: TaskResult;
}
export type TaskStatus = 'pending' | 'ready' | 'running' | 'completed' | 'failed' | 'paused_at_breakpoint';
export interface TaskResult {
    branch?: string;
    pullRequestUrl?: string;
    completedAt: string;
}
export type TaskInput = Omit<Task, 'status' | 'attempts' | 'agentId' | 'error' | 'result'>;
export declare class TaskQueue extends EventEmitter {
    private tasks;
    private completed;
    addTask(input: TaskInput): void;
    addTasks(inputs: TaskInput[]): void;
    private updateReadyTasks;
    getReadyTasks(): Task[];
    getTask(id: string): Task | undefined;
    getAllTasks(): Task[];
    markRunning(id: string, agentId: string): void;
    markCompleted(id: string, result?: Partial<TaskResult>, checkComplete?: boolean): void;
    markFailed(id: string, error: string, maxRetries?: number): void;
    markPausedAtBreakpoint(id: string, result?: Partial<TaskResult>): void;
    resumeFromBreakpoint(id: string): void;
    private checkAllComplete;
    getResults(): {
        completed: Task[];
        failed: Task[];
    };
    getStatus(): Record<string, number>;
    reset(): void;
}
