import { EventEmitter } from 'events';
import { CursorClient } from '../cursor/client.js';
import { CursorAgent } from '../cursor/types.js';
import { TaskQueue, Task, TaskInput } from './task-queue.js';
import { StateStore, OrchestratorState, SerializedTask } from '../storage/state-store.js';
import { Logger } from '../utils/logger.js';
import { Config } from '../utils/config.js';
import { YamlPersistence } from '../storage/yaml-persistence.js';
import { promptBreakpoint } from '../utils/breakpoint-handler.js';

const BEADS_SETUP_PREAMBLE = `## Environment Setup: Beads

This project uses beads (bd) for issue tracking. Complete these steps in order before running any bd commands.

### 1. Install Dolt (system binary)
\`\`\`bash
curl -L https://github.com/dolthub/dolt/releases/latest/download/install.sh | sudo bash
\`\`\`

### 2. Install Beads (project dependency)
\`\`\`bash
npm install --save-dev @beads/bd
\`\`\`

### 3. Create and initialize Dolt directory (only if .beads/dolt does not exist)
\`\`\`bash
mkdir -p .beads/dolt
cd .beads/dolt
dolt init
cd ../..
\`\`\`

### 4. Start Dolt SQL server
\`\`\`bash
cd .beads/dolt && dolt sql-server -H 127.0.0.1 -P 3307 &
cd ../..
\`\`\`
Run in the background; Beads expects port 3307 by default. Dolt must be running before any bd commands that touch the database.

### 5. Initialize Beads (only if .beads/ does not exist)
\`\`\`bash
npx bd init
\`\`\`
Skip this step if \`.beads/\` is already present in the repo.

### 6. Verify setup
\`\`\`bash
npx bd list
\`\`\``;

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

export class Orchestrator extends EventEmitter {
  private client: CursorClient;
  private queue: TaskQueue;
  private stateStore?: StateStore;
  private logger: Logger;
  private options: OrchestratorOptions;
  private activeAgents: Map<string, string> = new Map(); // agentId -> taskId
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  private isRunning = false;
  private templateName = '';

  constructor(options: OrchestratorOptions) {
    super();
    this.options = options;
    this.client = new CursorClient(options.config.apiKey, options.config.apiBaseUrl);
    this.queue = new TaskQueue();
    this.stateStore = options.stateStore;
    this.logger = new Logger('Orchestrator');
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.queue.on('taskReady', () => this.trySpawnAgents());

    this.queue.on('taskStarted', (task: Task) => {
      this.options.yamlPersistence?.updateTaskStatus(task.id, 'started');
    });

    this.queue.on('taskCompleted', (task: Task) => {
      this.logger.success(`Task completed: ${task.id}`);
      this.options.yamlPersistence?.updateTaskStatus(task.id, 'completed');
      this.emit('taskCompleted', task);
      this.saveState();
    });

    this.queue.on('taskFailed', (task: Task) => {
      this.logger.error(`Task failed: ${task.id} - ${task.error}`);
      this.options.yamlPersistence?.updateTaskStatus(task.id, 'failed');
      this.emit('taskFailed', task);
      this.saveState();
    });

    this.queue.on('taskRetry', (task: Task) => {
      this.logger.warn(`Retrying task: ${task.id} (attempt ${task.attempts + 1})`);
      this.emit('taskRetry', task);
    });

    this.queue.on('taskPausedAtBreakpoint', (task: Task) => {
      this.logger.info(`Task paused at breakpoint: ${task.id}`);
      this.emit('breakpointReached', task);
    });

    this.queue.on('allComplete', (results) => {
      this.isRunning = false;
      this.client.stopAllMonitoring();
      this.clearAllTimeouts();
      this.logger.info('All tasks complete');
      this.emit('complete', results);
      this.stateStore?.clear();
    });

    this.client.on('completed', ({ agentId, ...agent }: { agentId: string } & CursorAgent) => {
      this.handleAgentComplete(agentId, agent);
    });

    this.client.on('failed', ({ agentId, ...agent }: { agentId: string } & CursorAgent) => {
      const errorMsg = (agent as any).summary || 'Agent failed';
      this.handleAgentFailed(agentId, errorMsg);
    });

    this.client.on('cancelled', ({ agentId }: { agentId: string }) => {
      this.handleAgentFailed(agentId, 'Agent was stopped');
    });

    this.client.on('error', ({ agentId, error }: { agentId: string; error: Error }) => {
      this.logger.error(`Agent ${agentId} error: ${error.message}`);
    });
  }

  loadTasks(templateName: string, tasks: TaskInput[]): void {
    this.templateName = templateName;
    this.queue.addTasks(tasks);
    const completedCount = tasks.filter(t => t.complete).length;
    const activeCount = tasks.length - completedCount;
    this.logger.info(`Loaded ${tasks.length} tasks from "${templateName}"${completedCount > 0 ? ` (${completedCount} already completed, ${activeCount} active)` : ''}`);
  }

  async start(): Promise<void> {
    if (this.isRunning) throw new Error('Orchestrator is already running');
    this.isRunning = true;
    this.logger.info('Starting orchestration...');
    this.emit('started', this.queue.getStatus());
    await this.saveState();
    await this.trySpawnAgents();
  }

  private async trySpawnAgents(): Promise<void> {
    if (!this.isRunning) return;

    const availableSlots = this.options.config.maxConcurrent - this.activeAgents.size;
    if (availableSlots <= 0) return;

    const readyTasks = this.queue.getReadyTasks().slice(0, availableSlots);

    for (const task of readyTasks) {
      try {
        await this.spawnAgent(task);
      } catch (error) {
        this.logger.error(`Failed to spawn agent for ${task.id}: ${error}`);
        this.queue.markFailed(task.id, (error as Error).message);
      }
    }
  }

  private async spawnAgent(task: Task): Promise<void> {
    const prompt = this.buildPrompt(task);
    this.logger.info(`Spawning agent for task: ${task.id}`);

    // Determine repository: task-level overrides plan-level
    const repository = task.repository?.url || this.options.repository;
    const baseBranch = task.repository?.branch || this.options.baseBranch;
    const model = task.model || this.options.defaultModel;

    const agent = await this.client.createAgent({
      prompt,
      repository,
      branchName: task.branch || `task/${task.id}`,
      ref: baseBranch,
      autoCreatePr: true,
      model,
    });

    this.activeAgents.set(agent.id, task.id);
    this.queue.markRunning(task.id, agent.id);
    this.client.startMonitoring(agent.id, this.options.config.pollInterval);

    const timeout = task.timeout || this.options.config.defaultTimeout;
    const timer = setTimeout(() => {
      if (!this.activeAgents.has(agent.id)) return;
      this.logger.warn(`Task ${task.id} timed out`);
      this.client.stopAgent(agent.id).catch(() => {});
      this.handleAgentFailed(agent.id, 'Timeout exceeded');
    }, timeout);
    this.timeouts.set(agent.id, timer);

    this.emit('agentSpawned', { taskId: task.id, agentId: agent.id });
    await this.saveState();
  }

  private buildPrompt(task: Task): string {
    const parts: string[] = [];

    if (this.options.beadsEnabled) {
      parts.push(BEADS_SETUP_PREAMBLE);
    }

    if (this.options.globalContext) {
      parts.push(`## Global Instructions\n${this.options.globalContext}`);
    }

    if (this.options.globalFiles?.length) {
      parts.push(`## Reference Files\n${this.options.globalFiles.map(f => `- ${f}`).join('\n')}`);
    }

    // Add dependency context with cross-repo awareness
    if (task.dependsOn.length > 0) {
      const taskRepo = task.repository?.url || this.options.repository;
      const sameRepoDeps: string[] = [];
      const crossRepoDeps: string[] = [];

      for (const depId of task.dependsOn) {
        const depTask = this.queue.getTask(depId);
        if (!depTask) continue;

        const depRepo = depTask.repository?.url || this.options.repository;
        const isSameRepo = taskRepo === depRepo;

        if (depTask.result) {
          const branchInfo = depTask.result.branch ? ` (branch: ${depTask.result.branch})` : '';
          const prInfo = depTask.result.pullRequestUrl ? `\n   PR: ${depTask.result.pullRequestUrl}` : '';

          if (isSameRepo) {
            sameRepoDeps.push(`- **${depTask.name}**${branchInfo}${prInfo}`);
          } else {
            crossRepoDeps.push(`- **${depTask.name}** [${depRepo}]${branchInfo}${prInfo}`);
          }
        } else if (depTask) {
          if (isSameRepo) {
            sameRepoDeps.push(`- **${depTask.name}** (in progress)`);
          } else {
            crossRepoDeps.push(`- **${depTask.name}** [${depRepo}] (in progress)`);
          }
        }
      }

      if (sameRepoDeps.length > 0) {
        parts.push(
          `## Dependencies (Same Repository)\n` +
          `The following tasks have completed in this repository:\n${sameRepoDeps.join('\n')}\n\n` +
          `**Important**: Before starting, pull the latest changes from the dependent branches to incorporate their work.`
        );
      }

      if (crossRepoDeps.length > 0) {
        parts.push(
          `## Dependencies (Other Repositories)\n` +
          `The following tasks have completed in other repositories:\n${crossRepoDeps.join('\n')}\n\n` +
          `Note: These are in different repositories. Reference their PRs if you need to understand their changes.`
        );
      }
    }

    if (task.files?.length) {
      parts.push(`## Task-Specific Files\n${task.files.map(f => `- ${f}`).join('\n')}`);
    }

    parts.push(`## Task\n${task.prompt}`);

    if (task.validation) {
      parts.push(
        `## Validation\nAfter completing the task, verify by running:\n\`${task.validation.command}\`\nExpected output should match: ${task.validation.successPattern}`
      );
    }

    if (task.beadsIssueId) {
      parts.push(
        `## Beads Integration\n\n` +
        `This task corresponds to beads issue \`${task.beadsIssueId}\`.\n\n` +
        `1. Claim the issue: \`npx bd update ${task.beadsIssueId} --status=in_progress\`\n\n` +
        `2. Before closing, write an implementation brief:\n` +
        `   \`\`\`bash\n` +
        `   npx bd update ${task.beadsIssueId} --design="<brief>"\n` +
        `   \`\`\`\n` +
        `   The brief should cover:\n` +
        `   - Approach taken and why\n` +
        `   - Key files created or modified\n` +
        `   - Patterns followed from the existing codebase\n` +
        `   - Tradeoffs considered or constraints encountered\n\n` +
        `3. Close the issue: \`npx bd close ${task.beadsIssueId}\`\n\n` +
        `4. If you discover bugs, tech debt, or new work:\n` +
        `   \`npx bd create --title="..." --description="..." --type=bug --priority=2\``
      );
    }

    return parts.join('\n\n');
  }

  private handleAgentComplete(agentId: string, agent: CursorAgent): void {
    const taskId = this.activeAgents.get(agentId);
    if (!taskId) return;

    const task = this.queue.getTask(taskId);
    if (!task) return;

    this.activeAgents.delete(agentId);
    this.clearTimeout(agentId);

    const result = {
      branch: agent.target?.branchName,
      pullRequestUrl: agent.target?.prUrl,
    };

    // Check for breakpoint
    if (task.breakpoint) {
      // Pause at breakpoint - don't unlock dependents yet
      this.queue.markPausedAtBreakpoint(taskId, result);
      // Interactive prompt (runs async, doesn't block other tasks)
      this.handleBreakpoint(task);
    } else {
      // Normal completion
      this.queue.markCompleted(taskId, result);
    }

    // Continue spawning other ready tasks (independent of breakpoint handling)
    this.trySpawnAgents();
  }

  private async handleBreakpoint(task: Task): Promise<void> {
    const { action } = await promptBreakpoint(task);

    if (action === 'continue') {
      this.logger.info(`Resuming from breakpoint: ${task.id}`);
      this.queue.resumeFromBreakpoint(task.id);
      this.emit('breakpointResumed', task);
      this.trySpawnAgents();
    } else {
      this.logger.warn(`Aborting at breakpoint: ${task.id}`);
      this.emit('breakpointAborted', task);
      await this.stop();
    }
  }

  private handleAgentFailed(agentId: string, error: string): void {
    const taskId = this.activeAgents.get(agentId);
    if (!taskId) return;

    this.activeAgents.delete(agentId);
    this.clearTimeout(agentId);
    this.client.stopMonitoring(agentId);
    this.queue.markFailed(taskId, error);
    this.trySpawnAgents();
  }

  private clearTimeout(agentId: string): void {
    const timer = this.timeouts.get(agentId);
    if (!timer) return;
    clearTimeout(timer);
    this.timeouts.delete(agentId);
  }

  private clearAllTimeouts(): void {
    for (const timer of this.timeouts.values()) clearTimeout(timer);
    this.timeouts.clear();
  }

  private async saveState(): Promise<void> {
    if (!this.stateStore) return;

    const tasks: SerializedTask[] = this.queue.getAllTasks().map(t => ({
      id: t.id,
      name: t.name,
      status: t.status,
      agentId: t.agentId,
      attempts: t.attempts,
      error: t.error,
      result: t.result,
    }));

    const state: OrchestratorState = {
      templateName: this.templateName,
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      repository: this.options.repository,
      tasks,
      activeAgents: Array.from(this.activeAgents.entries()).map(([agentId, taskId]) => ({ agentId, taskId })),
    };

    await this.stateStore.save(state);
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.client.stopAllMonitoring();
    this.clearAllTimeouts();

    for (const agentId of this.activeAgents.keys()) {
      try {
        await this.client.stopAgent(agentId);
      } catch {
        // Ignore cancellation errors
      }
    }

    this.logger.info('Orchestrator stopped');
    this.emit('stopped', this.queue.getStatus());
  }

  getStatus(): { isRunning: boolean; queue: Record<string, number>; activeAgents: Array<{ agentId: string; taskId: string }> } {
    return {
      isRunning: this.isRunning,
      queue: this.queue.getStatus(),
      activeAgents: Array.from(this.activeAgents.entries()).map(([agentId, taskId]) => ({ agentId, taskId })),
    };
  }

  async sendFollowUp(taskId: string, message: string): Promise<void> {
    const task = this.queue.getTask(taskId);
    if (!task?.agentId) throw new Error(`No active agent for task ${taskId}`);
    await this.client.sendFollowUp(task.agentId, message);
  }
}

