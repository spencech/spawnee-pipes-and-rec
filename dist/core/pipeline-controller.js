import { EventEmitter } from 'events';
import { Orchestrator } from './orchestrator.js';
import { ValidationRunner } from '../validation/validation-runner.js';
import { BeadsMapper } from '../validation/beads-mapper.js';
import { ArtifactGenerator } from '../artifact/generator.js';
import { Logger } from '../utils/logger.js';
import * as git from '../utils/git.js';
import { readBeadsBrief } from '../utils/beads.js';
/**
 * Manages the full pipeline lifecycle: Phase 3 (Execution) → Phase 4 (Validation) → Phase 5 (Artifacts).
 * Wraps the Orchestrator without modifying it. Handles the QA retry loop.
 */
export class PipelineController extends EventEmitter {
    logger;
    options;
    constructor(options) {
        super();
        this.options = options;
        this.logger = new Logger('Pipeline');
    }
    async run() {
        const { template } = this.options;
        const validationGates = template.validation_strategy;
        const maxCycles = template.max_qa_cycles;
        const validationHistory = { cycles: [] };
        let currentTasks = template.tasks;
        let lastTaskResults = { completed: [], failed: [] };
        for (let cycle = 0; cycle < maxCycles; cycle++) {
            // Phase 3: Execute tasks
            this.logger.info(`--- Pipeline cycle ${cycle + 1} of ${maxCycles} ---`);
            lastTaskResults = await this.executePhase3(currentTasks);
            this.emit('executionComplete', { cycle, results: lastTaskResults });
            // If no validation gates configured, skip Phase 4
            if (validationGates.length === 0) {
                this.logger.info('No validation gates configured — skipping validation');
                break;
            }
            // Merge task branches before validation
            await this.mergeTaskBranches(lastTaskResults.completed);
            // Phase 4: Validate
            const validationResult = await this.executePhase4(validationGates, cycle, maxCycles);
            validationHistory.cycles.push(validationResult);
            this.emit('validationComplete', { cycle, result: validationResult });
            if (validationResult.allPassed) {
                this.logger.success('All validation gates passed');
                break;
            }
            // Check if we have retries left
            if (cycle + 1 >= maxCycles) {
                this.logger.error(`Max QA cycles reached (${maxCycles}). Escalating to human review.`);
                this.emit('escalation', { cycle, validationHistory });
                break;
            }
            // Create beads issues from failures and generate retry tasks
            this.logger.info('Creating beads issues for failures...');
            const mapper = new BeadsMapper({ cycle, maxCycles, cwd: this.options.repoWorkDir });
            const failedGateResults = validationResult.gateResults.filter(r => !r.passed);
            const issueIds = await mapper.createIssuesFromResults(failedGateResults);
            this.emit('issuesCreated', { cycle, issueIds });
            // Generate retry tasks from the created issues
            currentTasks = await this.generateRetryTasks(issueIds, failedGateResults, cycle);
            this.logger.info(`Generated ${currentTasks.length} retry tasks for cycle ${cycle + 2}`);
        }
        const success = validationHistory.cycles.length === 0 ||
            validationHistory.cycles[validationHistory.cycles.length - 1].allPassed;
        // Phase 5: Generate artifacts
        let artifact;
        if (this.options.generateArtifact) {
            artifact = await this.executePhase5(lastTaskResults, validationHistory, success);
            this.emit('artifactGenerated', artifact);
        }
        const result = {
            success,
            taskResults: lastTaskResults,
            validationHistory,
            artifact,
        };
        this.emit('complete', result);
        return result;
    }
    executePhase3(tasks) {
        return new Promise((resolve) => {
            const { config, template } = this.options;
            const orchestratorOptions = {
                config,
                stateStore: this.options.stateStore,
                repository: template.repository.url,
                baseBranch: template.repository.branch,
                globalContext: template.context.instructions,
                globalFiles: template.context.files,
                defaultModel: template.defaults.model,
                yamlPersistence: this.options.yamlPersistence,
                beadsEnabled: tasks.some(t => t.beadsIssueId),
            };
            const orchestrator = new Orchestrator(orchestratorOptions);
            // Forward orchestrator events
            orchestrator.on('agentSpawned', (data) => this.emit('agentSpawned', data));
            orchestrator.on('taskCompleted', (task) => this.emit('taskCompleted', task));
            orchestrator.on('taskFailed', (task) => this.emit('taskFailed', task));
            orchestrator.on('taskRetry', (task) => this.emit('taskRetry', task));
            orchestrator.on('breakpointReached', (task) => this.emit('breakpointReached', task));
            orchestrator.on('breakpointResumed', (task) => this.emit('breakpointResumed', task));
            orchestrator.on('breakpointAborted', (task) => this.emit('breakpointAborted', task));
            orchestrator.on('complete', (results) => {
                resolve(results);
            });
            orchestrator.loadTasks(template.name, tasks);
            orchestrator.start();
        });
    }
    async executePhase4(gates, cycle, maxCycles) {
        const runner = new ValidationRunner({ cwd: this.options.repoWorkDir });
        // Forward validation events
        runner.on('gateStarted', (config) => this.emit('gateStarted', config));
        runner.on('gatePassed', (result) => this.emit('gatePassed', result));
        runner.on('gateFailed', (result) => this.emit('gateFailed', result));
        return runner.run(gates, cycle, maxCycles);
    }
    async executePhase5(taskResults, validationHistory, success) {
        const { template } = this.options;
        const generator = new ArtifactGenerator({
            templateName: template.name,
            description: template.description,
            acceptance_criteria: template.acceptance_criteria,
            validationHistory,
            taskResults,
            featureBranch: template.repository.branch,
            baseBranch: template.repository.baseBranch ?? 'main',
            repoWorkDir: this.options.repoWorkDir,
            success,
        });
        return generator.generate();
    }
    async mergeTaskBranches(completedTasks) {
        const { repoWorkDir } = this.options;
        await git.fetchAll(repoWorkDir);
        for (const task of completedTasks) {
            const branch = task.result?.branch;
            if (!branch)
                continue;
            this.logger.info(`Merging task branch: ${branch}`);
            const result = await git.mergeBranch(repoWorkDir, `origin/${branch}`);
            if (result.exitCode !== 0) {
                this.logger.error(`Failed to merge ${branch}: ${result.stderr}`);
            }
        }
    }
    async generateRetryTasks(issueIds, failedGateResults, cycle) {
        const { template } = this.options;
        const tasks = [];
        // Build failure summary (unchanged)
        const failureSummary = failedGateResults
            .map(r => {
            const details = r.failures
                .slice(0, 10)
                .map(f => {
                const location = f.file ? ` in ${f.file}${f.line ? `:${f.line}` : ''}` : '';
                return `  - ${f.message}${location}`;
            })
                .join('\n');
            return `### ${r.gate} failures:\n${details}`;
        })
            .join('\n\n');
        // Collect implementation briefs from original tasks that have beadsIssueIds
        const briefEntries = [];
        for (const task of template.tasks) {
            if (!task.beadsIssueId)
                continue;
            const brief = await readBeadsBrief(task.beadsIssueId, this.options.repoWorkDir);
            if (brief) {
                briefEntries.push(`- **${task.beadsIssueId}** (${task.name}): ${brief}`);
            }
        }
        // Collect branch names from original tasks
        const branchEntries = template.tasks
            .filter(t => t.branch)
            .map(t => `- origin/${t.branch}`);
        // Build the enriched prompt
        const promptParts = [];
        promptParts.push('## QA Fix Task');
        // Prior implementation context from beads briefs
        if (briefEntries.length > 0) {
            promptParts.push(`### Prior Implementation Context\n` +
                `The original agents documented their approach in these beads issues:\n` +
                briefEntries.join('\n'));
        }
        // Original task scope
        const taskSummaries = template.tasks
            .map(t => `- **${t.name}** (\`${t.id}\`): ${t.prompt.split('\n')[0]}`)
            .join('\n');
        promptParts.push(`### Original Task Scope\n${taskSummaries}`);
        // Branches to merge
        if (branchEntries.length > 0) {
            promptParts.push(`### Branches to Merge\n` +
                `Before starting, merge these branches:\n` +
                branchEntries.join('\n'));
        }
        // Failures to fix
        promptParts.push(`### Failures to Fix\n\nThe following validation gates failed. Fix the issues described below.\n\n${failureSummary}`);
        // Constraints from template
        if (template.constraints.length > 0) {
            promptParts.push(`### Constraints\n${template.constraints.map(c => `- ${c}`).join('\n')}`);
        }
        // Scope hints from template
        if (template.scope.length > 0) {
            promptParts.push(`### Scope\nFocus on these areas:\n${template.scope.map(s => `- ${s}`).join('\n')}`);
        }
        // Beads issues and closing instructions
        promptParts.push(`### Beads Issues\n` +
            `QA failure issues: ${issueIds.join(', ')}\n\n` +
            `After fixing all issues:\n` +
            `1. Run the failing gate commands to verify your fixes\n` +
            `2. Close the related beads issues with \`npx bd close ${issueIds.join(' ')}\`\n` +
            `3. Commit and push your changes\n\n` +
            `## Important\n` +
            `- Only fix the specific failures listed above\n` +
            `- Do not refactor or change unrelated code\n` +
            `- Verify your fixes pass the relevant gate commands before completing`);
        tasks.push({
            id: `qa-fix-c${cycle + 1}`,
            name: `QA Fix — Cycle ${cycle + 2}`,
            prompt: promptParts.join('\n\n'),
            dependsOn: [],
            priority: 100,
            branch: `cursor/spawnee/qa-fix-c${cycle + 2}`,
            timeout: template.defaults.timeout,
            retries: template.defaults.retries,
            model: template.defaults.model,
            breakpoint: false,
        });
        return tasks;
    }
}
//# sourceMappingURL=pipeline-controller.js.map