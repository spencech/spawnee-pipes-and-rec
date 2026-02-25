import { Task } from '../core/task-queue.js';
export interface BreakpointPromptResult {
    action: 'continue' | 'abort';
}
export declare function promptBreakpoint(task: Task): Promise<BreakpointPromptResult>;
