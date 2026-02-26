#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, writeFileSync } from 'fs';
import chalk from 'chalk';
import ora from 'ora';
import { Orchestrator } from './core/orchestrator.js';
import { PipelineController } from './core/pipeline-controller.js';
import { parseTemplate, validateTemplateFile, validatePipelineTemplate } from './parsers/index.js';
import { FileStateStore } from './storage/file-adapter.js';
import { YamlPersistence } from './storage/yaml-persistence.js';
import { loadConfig, generateDefaultConfig, getConfigFilePath } from './utils/config.js';
import { CursorClient } from './cursor/client.js';
import { ValidationRunner } from './validation/validation-runner.js';
const program = new Command();
program
    .name('spawnee')
    .description('Spawn and orchestrate Cursor Cloud Agents from task templates')
    .version('1.0.0')
    .option('--config <path>', 'Path to config file (default: .spawneerc.json)')
    .option('-v, --verbose', 'Enable verbose logging');
program
    .command('init')
    .description('Initialize a .spawneerc.json config file in the current directory')
    .option('-f, --force', 'Overwrite existing config file')
    .action((options) => {
    const configPath = getConfigFilePath();
    if (existsSync(configPath) && !options.force) {
        console.error(chalk.red(`Config file already exists: ${configPath}`));
        console.log(chalk.gray('Use --force to overwrite'));
        process.exit(1);
    }
    writeFileSync(configPath, generateDefaultConfig(), 'utf-8');
    console.log(chalk.green(`✓ Created config file: ${configPath}`));
    console.log(chalk.gray('\nEdit this file to set your API key and other options.'));
});
program
    .command('config')
    .description('Show resolved configuration (merges config file, env vars, and defaults)')
    .action((_, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    try {
        const config = loadConfig({ configFile: globalOpts.config, verbose: globalOpts.verbose });
        console.log(chalk.blue('\n📋 Resolved Configuration:\n'));
        const display = { ...config, apiKey: config.apiKey ? '***' + config.apiKey.slice(-4) : '(not set)' };
        for (const [key, value] of Object.entries(display)) {
            const label = key.padEnd(16);
            console.log(chalk.gray(`   ${label}`) + chalk.white(String(value)));
        }
        console.log();
    }
    catch (error) {
        console.error(chalk.red(`Configuration error: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('run')
    .description('Execute a task template')
    .argument('<template>', 'Path to template file (JSON/YAML)')
    .option('-k, --api-key <key>', 'Cursor API key')
    .option('--api-url <url>', 'Cursor API base URL')
    .option('-c, --concurrency <number>', 'Max concurrent agents')
    .option('--poll-interval <ms>', 'Status poll interval in milliseconds')
    .option('-t, --timeout <ms>', 'Default task timeout in milliseconds')
    .option('--state-file <path>', 'State file path for persistence')
    .option('-d, --dry-run', 'Parse template without spawning agents')
    .option('--no-persist', 'Disable state persistence')
    .option('--update-source', 'Update source YAML file with task status for resume capability')
    .option('--validate', 'Run validation gates after execution (Phase 4)')
    .option('--artifact', 'Generate artifacts after validation (Phase 5: PR, test report)')
    .option('--repo-dir <path>', 'Path to checked-out target repo for validation gates')
    .action(async (templatePath, options, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    if (!existsSync(templatePath)) {
        console.error(chalk.red(`Error: Template file not found: ${templatePath}`));
        process.exit(1);
    }
    let template;
    try {
        template = parseTemplate(templatePath);
    }
    catch (error) {
        console.error(chalk.red(`Error parsing template: ${error.message}`));
        process.exit(1);
    }
    const completedTasks = template.tasks.filter(t => t.complete);
    const activeTasks = template.tasks.filter(t => !t.complete);
    console.log(chalk.blue(`\n📋 Template: ${template.name}`));
    console.log(chalk.gray(`   Repository: ${template.repository.url}`));
    console.log(chalk.gray(`   Tasks: ${template.tasks.length}${completedTasks.length > 0 ? ` (${completedTasks.length} already completed, ${activeTasks.length} active)` : ''}`));
    if (completedTasks.length > 0) {
        console.log(chalk.yellow(`\n✓ Already completed: ${completedTasks.map(t => t.id).join(', ')}`));
    }
    console.log(chalk.blue('\n📊 Task Dependency Graph:'));
    displayTaskGraph(template.tasks);
    // Show pipeline-specific info
    if (template.type) {
        console.log(chalk.gray(`   Type: ${template.type}`));
    }
    if (template.validation_strategy.length > 0) {
        console.log(chalk.gray(`   Validation gates: ${template.validation_strategy.map(g => g.gate).join(' → ')}`));
        console.log(chalk.gray(`   Max QA cycles: ${template.max_qa_cycles}`));
    }
    if (options.dryRun) {
        console.log(chalk.yellow('\n🔍 Dry run - no agents will be spawned'));
        return;
    }
    const configOverrides = {
        configFile: globalOpts.config,
        verbose: globalOpts.verbose,
        apiKey: options.apiKey,
        apiBaseUrl: options.apiUrl,
        maxConcurrent: options.concurrency ? parseInt(options.concurrency, 10) : undefined,
        pollInterval: options.pollInterval ? parseInt(options.pollInterval, 10) : undefined,
        defaultTimeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
        stateFile: options.stateFile,
    };
    let config;
    try {
        config = loadConfig(configOverrides);
    }
    catch (error) {
        console.error(chalk.red(`Configuration error: ${error.message}`));
        process.exit(1);
    }
    if (config.verbose) {
        console.log(chalk.gray(`\n   Config: concurrency=${config.maxConcurrent}, timeout=${config.defaultTimeout}ms, poll=${config.pollInterval}ms`));
    }
    const stateStore = options.persist ? new FileStateStore(config.stateFile) : undefined;
    const yamlPersistence = options.updateSource ? new YamlPersistence({
        filePath: templatePath,
        enabled: true,
    }) : undefined;
    // Use PipelineController when --validate or --artifact is set
    if (options.validate || options.artifact) {
        const repoDir = options.repoDir || process.cwd();
        const pipeline = new PipelineController({
            config,
            template,
            templatePath,
            repoWorkDir: repoDir,
            generateArtifact: !!options.artifact,
            stateStore,
            yamlPersistence,
        });
        // Wire up pipeline events
        pipeline.on('agentSpawned', ({ taskId, agentId }) => {
            console.log(chalk.cyan(`   ▶ Started: ${taskId} (agent: ${agentId.slice(0, 8)}...)`));
        });
        pipeline.on('taskCompleted', (task) => {
            console.log(chalk.green(`   ✓ Completed: ${task.id}`));
        });
        pipeline.on('taskFailed', (task) => {
            console.log(chalk.red(`   ✗ Failed: ${task.id} - ${task.error}`));
        });
        pipeline.on('gateStarted', (config) => {
            console.log(chalk.blue(`   🔍 Running gate: ${config.gate}`));
        });
        pipeline.on('gatePassed', (result) => {
            console.log(chalk.green(`   ✓ Gate passed: ${result.gate} (${result.durationMs}ms)`));
        });
        pipeline.on('gateFailed', (result) => {
            console.log(chalk.red(`   ✗ Gate failed: ${result.gate} (${result.failures.length} failures)`));
        });
        pipeline.on('issuesCreated', ({ issueIds }) => {
            console.log(chalk.yellow(`   📋 Created ${issueIds.length} beads issues for QA failures`));
        });
        pipeline.on('escalation', () => {
            console.log(chalk.red('\n   ⚠ Max QA cycles reached — escalating to human review'));
        });
        const spinner = ora('Starting pipeline...').start();
        spinner.succeed('Pipeline started');
        const result = await pipeline.run();
        console.log(chalk.blue('\n📊 Pipeline Results:'));
        console.log(chalk.green(`   ✓ Completed tasks: ${result.taskResults.completed.length}`));
        console.log(chalk.red(`   ✗ Failed tasks: ${result.taskResults.failed.length}`));
        console.log(chalk.gray(`   Validation cycles: ${result.validationHistory.cycles.length}`));
        console.log(chalk.gray(`   Overall: ${result.success ? chalk.green('SUCCESS') : chalk.red('PARTIAL/FAILED')}`));
        if (result.artifact?.prUrl) {
            console.log(chalk.cyan(`\n   PR: ${result.artifact.prUrl}`));
        }
        process.exit(result.success ? 0 : 1);
        return;
    }
    // Original Orchestrator-only path (no --validate/--artifact)
    const orchestrator = new Orchestrator({
        config,
        stateStore,
        repository: template.repository.url,
        baseBranch: template.repository.branch,
        globalContext: template.context.instructions,
        globalFiles: template.context.files,
        defaultModel: template.defaults.model,
        yamlPersistence,
        beadsEnabled: template.tasks.some(t => t.beadsIssueId),
    });
    const spinner = ora('Starting orchestration...').start();
    orchestrator.on('started', (status) => {
        spinner.succeed('Orchestration started');
        console.log(chalk.gray(`   Total tasks: ${status.total}`));
    });
    orchestrator.on('agentSpawned', ({ taskId, agentId }) => {
        console.log(chalk.cyan(`   ▶ Started: ${taskId} (agent: ${agentId.slice(0, 8)}...)`));
    });
    orchestrator.on('taskCompleted', (task) => {
        console.log(chalk.green(`   ✓ Completed: ${task.id}`));
        if (task.result?.pullRequestUrl)
            console.log(chalk.gray(`     PR: ${task.result.pullRequestUrl}`));
    });
    orchestrator.on('taskFailed', (task) => {
        console.log(chalk.red(`   ✗ Failed: ${task.id} - ${task.error}`));
    });
    orchestrator.on('taskRetry', (task) => {
        console.log(chalk.yellow(`   ↻ Retrying: ${task.id} (attempt ${task.attempts + 1})`));
    });
    orchestrator.on('breakpointReached', (task) => {
        console.log(chalk.yellow(`   ⏸ Breakpoint: ${task.id} - waiting for review...`));
    });
    orchestrator.on('breakpointResumed', (task) => {
        console.log(chalk.green(`   ▶ Resumed: ${task.id}`));
    });
    orchestrator.on('breakpointAborted', (task) => {
        console.log(chalk.red(`   ⏹ Aborted at breakpoint: ${task.id}`));
    });
    orchestrator.on('complete', (results) => {
        console.log(chalk.blue('\n📊 Final Results:'));
        console.log(chalk.green(`   ✓ Completed: ${results.completed.length}`));
        console.log(chalk.red(`   ✗ Failed: ${results.failed.length}`));
        if (results.failed.length > 0) {
            console.log(chalk.red('\n   Failed tasks:'));
            results.failed.forEach(t => console.log(chalk.red(`     - ${t.id}: ${t.error}`)));
        }
        process.exit(results.failed.length > 0 ? 1 : 0);
    });
    process.on('SIGINT', async () => {
        console.log(chalk.yellow('\n\nGracefully shutting down...'));
        await orchestrator.stop();
        process.exit(0);
    });
    orchestrator.loadTasks(template.name, template.tasks);
    await orchestrator.start();
});
program
    .command('validate')
    .description('Validate a task template without running')
    .argument('<template>', 'Path to template file')
    .action((templatePath) => {
    if (!existsSync(templatePath)) {
        console.error(chalk.red(`Error: Template file not found: ${templatePath}`));
        process.exit(1);
    }
    const result = validateTemplateFile(templatePath);
    if (result.valid) {
        console.log(chalk.green('✓ Template is valid'));
        process.exit(0);
    }
    console.error(chalk.red('✗ Template validation failed:'));
    result.errors.forEach(e => console.error(chalk.red(`  - ${e}`)));
    process.exit(1);
});
program
    .command('status')
    .description('Check status of running agents')
    .option('-k, --api-key <key>', 'Cursor API key')
    .option('--api-url <url>', 'Cursor API base URL')
    .action(async (options, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    let config;
    try {
        config = loadConfig({
            configFile: globalOpts.config,
            verbose: globalOpts.verbose,
            apiKey: options.apiKey,
            apiBaseUrl: options.apiUrl,
        });
    }
    catch (error) {
        console.error(chalk.red(`Configuration error: ${error.message}`));
        process.exit(1);
    }
    const client = new CursorClient(config.apiKey, config.apiBaseUrl);
    try {
        const response = await client.listAgents();
        console.log(chalk.blue(`\n📊 Agents: ${response.agents.length}\n`));
        const statusColors = {
            RUNNING: chalk.cyan,
            FINISHED: chalk.green,
            FAILED: chalk.red,
            CREATING: chalk.yellow,
            STOPPED: chalk.gray,
            EXPIRED: chalk.dim,
        };
        response.agents.forEach(agent => {
            const colorFn = statusColors[agent.status] || chalk.white;
            const branch = agent.target?.branchName || '';
            const name = agent.name || agent.id.slice(0, 12);
            console.log(`  ${colorFn(agent.status.padEnd(10))} ${name.padEnd(20)} ${branch}`);
        });
    }
    catch (error) {
        const errorMessage = error.message;
        console.error(chalk.red(`Error: ${errorMessage}`));
        if (errorMessage.includes('API endpoint not found')) {
            console.log(chalk.yellow('\n💡 Tip: The Cursor Cloud Agents API endpoints may need to be configured.'));
            console.log(chalk.gray('   Check the Cursor documentation or dashboard for the correct API endpoints.'));
            console.log(chalk.gray('   You can override the base URL with: SPAWNEE_API_URL=https://api.cursor.com'));
        }
        process.exit(1);
    }
});
program
    .command('models')
    .description('List available models from Cursor API')
    .option('-k, --api-key <key>', 'Cursor API key')
    .option('--api-url <url>', 'Cursor API base URL')
    .action(async (options, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    let config;
    try {
        config = loadConfig({
            configFile: globalOpts.config,
            verbose: globalOpts.verbose,
            apiKey: options.apiKey,
            apiBaseUrl: options.apiUrl,
        });
    }
    catch (error) {
        console.error(chalk.red(`Configuration error: ${error.message}`));
        process.exit(1);
    }
    const client = new CursorClient(config.apiKey, config.apiBaseUrl);
    try {
        const response = await client.listModels();
        console.log(chalk.blue(`\n📋 Available Models: ${response.models.length}\n`));
        response.models.forEach(model => {
            console.log(`  ${chalk.cyan(model)}`);
        });
        console.log();
    }
    catch (error) {
        const errorMessage = error.message;
        console.error(chalk.red(`Error: ${errorMessage}`));
        if (errorMessage.includes('API endpoint not found') || errorMessage.includes('404')) {
            console.log(chalk.yellow('\n💡 Tip: The /v0/models endpoint may not be available on your API version.'));
            console.log(chalk.gray('   Check the Cursor documentation for available endpoints.'));
        }
        process.exit(1);
    }
});
program
    .command('cancel')
    .description('Cancel a running agent')
    .argument('<agent-id>', 'Agent ID to cancel')
    .option('-k, --api-key <key>', 'Cursor API key')
    .option('--api-url <url>', 'Cursor API base URL')
    .action(async (agentId, options, cmd) => {
    const globalOpts = cmd.optsWithGlobals();
    let config;
    try {
        config = loadConfig({
            configFile: globalOpts.config,
            verbose: globalOpts.verbose,
            apiKey: options.apiKey,
            apiBaseUrl: options.apiUrl,
        });
    }
    catch (error) {
        console.error(chalk.red(`Configuration error: ${error.message}`));
        process.exit(1);
    }
    const client = new CursorClient(config.apiKey, config.apiBaseUrl);
    try {
        await client.stopAgent(agentId);
        console.log(chalk.green(`✓ Agent ${agentId} stopped`));
    }
    catch (error) {
        console.error(chalk.red(`Error: ${error.message}`));
        process.exit(1);
    }
});
program
    .command('validate-gates')
    .description('Run validation gates against an existing checkout (skip Phase 3 execution)')
    .argument('<template>', 'Path to template file')
    .option('--repo-dir <path>', 'Path to checked-out target repo (default: cwd)')
    .action(async (templatePath, options) => {
    if (!existsSync(templatePath)) {
        console.error(chalk.red(`Error: Template file not found: ${templatePath}`));
        process.exit(1);
    }
    let template;
    try {
        template = parseTemplate(templatePath);
    }
    catch (error) {
        console.error(chalk.red(`Error parsing template: ${error.message}`));
        process.exit(1);
    }
    const gates = template.validation_strategy;
    if (gates.length === 0) {
        console.log(chalk.yellow('No validation_strategy defined in template'));
        process.exit(0);
    }
    const repoDir = options.repoDir || process.cwd();
    console.log(chalk.blue(`\n🔍 Running ${gates.length} validation gates against ${repoDir}\n`));
    const runner = new ValidationRunner({ cwd: repoDir });
    runner.on('gateStarted', (config) => {
        console.log(chalk.blue(`   Running: ${config.gate}`));
    });
    runner.on('gatePassed', (result) => {
        console.log(chalk.green(`   ✓ Passed: ${result.gate} (${result.durationMs}ms)`));
    });
    runner.on('gateFailed', (result) => {
        console.log(chalk.red(`   ✗ Failed: ${result.gate} (${result.failures.length} failures, ${result.durationMs}ms)`));
    });
    const result = await runner.run(gates, 0, 1);
    console.log(chalk.blue('\n📊 Gate Results:'));
    for (const gate of result.gateResults) {
        const status = gate.passed ? chalk.green('PASS') : chalk.red('FAIL');
        console.log(`   ${gate.gate.padEnd(12)} ${status}`);
    }
    process.exit(result.allPassed ? 0 : 1);
});
program
    .command('validate-pipeline')
    .description('Validate a template has all required fields for the full pipeline')
    .argument('<template>', 'Path to template file')
    .action((templatePath) => {
    if (!existsSync(templatePath)) {
        console.error(chalk.red(`Error: Template file not found: ${templatePath}`));
        process.exit(1);
    }
    const result = validatePipelineTemplate(templatePath);
    if (result.valid) {
        console.log(chalk.green('✓ Template is valid for full pipeline use'));
        process.exit(0);
    }
    console.error(chalk.red('✗ Pipeline template validation failed:'));
    result.errors.forEach(e => console.error(chalk.red(`  - ${e}`)));
    process.exit(1);
});
function displayTaskGraph(tasks) {
    const roots = tasks.filter(t => t.dependsOn.length === 0);
    function printTask(task, indent, isLast) {
        const prefix = isLast ? '└── ' : '├── ';
        const priority = task.priority ? chalk.gray(` [p:${task.priority}]`) : '';
        console.log(chalk.gray(indent + prefix) + task.id + priority);
        const children = tasks.filter(t => t.dependsOn.includes(task.id));
        children.forEach((child, i) => {
            const newIndent = indent + (isLast ? '    ' : '│   ');
            printTask(child, newIndent, i === children.length - 1);
        });
    }
    roots.forEach((root, i) => printTask(root, '   ', i === roots.length - 1));
}
program.parse();
//# sourceMappingURL=index.js.map