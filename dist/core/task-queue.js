import { EventEmitter } from 'events';
export class TaskQueue extends EventEmitter {
    tasks = new Map();
    completed = new Set();
    addTask(input) {
        const task = { ...input, status: 'pending', attempts: 0 };
        this.tasks.set(task.id, task);
        // If task is marked as complete, mark it as completed immediately
        if (task.complete) {
            this.markCompleted(task.id, { completedAt: new Date().toISOString() }, false);
        }
        else {
            this.updateReadyTasks();
        }
    }
    addTasks(inputs) {
        inputs.forEach(input => {
            const task = { ...input, status: 'pending', attempts: 0 };
            this.tasks.set(task.id, task);
            // If task is marked as complete, mark it as completed immediately
            if (task.complete) {
                this.markCompleted(task.id, { completedAt: new Date().toISOString() }, false);
            }
        });
        this.updateReadyTasks();
    }
    updateReadyTasks() {
        for (const task of this.tasks.values()) {
            if (task.status !== 'pending')
                continue;
            const depsComplete = task.dependsOn.every(depId => this.completed.has(depId));
            if (!depsComplete)
                continue;
            task.status = 'ready';
            this.emit('taskReady', task);
        }
    }
    getReadyTasks() {
        return Array.from(this.tasks.values())
            .filter(t => t.status === 'ready')
            .sort((a, b) => b.priority - a.priority);
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    getAllTasks() {
        return Array.from(this.tasks.values());
    }
    markRunning(id, agentId) {
        const task = this.tasks.get(id);
        if (!task)
            return;
        task.status = 'running';
        task.agentId = agentId;
        task.attempts++;
        this.emit('taskStarted', task);
    }
    markCompleted(id, result, checkComplete = true) {
        const task = this.tasks.get(id);
        if (!task)
            return;
        task.status = 'completed';
        task.result = { ...result, completedAt: new Date().toISOString() };
        this.completed.add(id);
        this.emit('taskCompleted', task);
        this.updateReadyTasks();
        if (checkComplete) {
            this.checkAllComplete();
        }
    }
    markFailed(id, error, maxRetries = 2) {
        const task = this.tasks.get(id);
        if (!task)
            return;
        task.error = error;
        if (task.attempts < (task.retries ?? maxRetries)) {
            task.status = 'ready';
            this.emit('taskRetry', task);
            return;
        }
        task.status = 'failed';
        this.emit('taskFailed', task);
        this.checkAllComplete();
    }
    markPausedAtBreakpoint(id, result) {
        const task = this.tasks.get(id);
        if (!task)
            return;
        task.status = 'paused_at_breakpoint';
        task.result = { ...result, completedAt: new Date().toISOString() };
        // Note: Do NOT add to completed set yet, do NOT emit taskCompleted yet
        // This pauses dependent tasks from becoming ready
        this.emit('taskPausedAtBreakpoint', task);
    }
    resumeFromBreakpoint(id) {
        const task = this.tasks.get(id);
        if (!task || task.status !== 'paused_at_breakpoint')
            return;
        task.status = 'completed';
        this.completed.add(id);
        this.emit('taskCompleted', task);
        this.updateReadyTasks();
        this.checkAllComplete();
    }
    checkAllComplete() {
        const allDone = Array.from(this.tasks.values()).every(t => t.status === 'completed' || t.status === 'failed' || t.status === 'paused_at_breakpoint');
        // Only emit allComplete if nothing is paused at breakpoint
        const anyPaused = Array.from(this.tasks.values()).some(t => t.status === 'paused_at_breakpoint');
        if (allDone && !anyPaused)
            this.emit('allComplete', this.getResults());
    }
    getResults() {
        const tasks = Array.from(this.tasks.values());
        return {
            completed: tasks.filter(t => t.status === 'completed'),
            failed: tasks.filter(t => t.status === 'failed'),
        };
    }
    getStatus() {
        const tasks = Array.from(this.tasks.values());
        return {
            pending: tasks.filter(t => t.status === 'pending').length,
            ready: tasks.filter(t => t.status === 'ready').length,
            running: tasks.filter(t => t.status === 'running').length,
            completed: tasks.filter(t => t.status === 'completed').length,
            failed: tasks.filter(t => t.status === 'failed').length,
            paused_at_breakpoint: tasks.filter(t => t.status === 'paused_at_breakpoint').length,
            total: tasks.length,
        };
    }
    reset() {
        this.tasks.clear();
        this.completed.clear();
    }
}
//# sourceMappingURL=task-queue.js.map