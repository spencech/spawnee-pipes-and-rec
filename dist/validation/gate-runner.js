import inquirer from 'inquirer';
import chalk from 'chalk';
import { execFileNoThrow } from '../utils/shell.js';
import { parseGateOutput } from './gate-parsers.js';
/**
 * Executes a single validation gate and returns the result.
 * For automated gates, runs the command via execFile.
 * For manual gates, prompts the user via inquirer.
 */
export async function runGate(config, options) {
    if (config.gate === 'manual') {
        return runManualGate(config, options);
    }
    return runAutomatedGate(config, options);
}
async function runAutomatedGate(config, options) {
    const command = config.command;
    const args = buildCommandArgs(config);
    const result = await execFileNoThrow(args[0], args.slice(1), {
        cwd: options.cwd,
        timeout: options.timeout,
    });
    const passed = result.exitCode === 0;
    const failures = passed ? [] : parseGateOutput(config.gate, result.stdout, result.stderr);
    return {
        gate: config.gate,
        passed,
        command,
        exitCode: result.exitCode,
        failures,
        rawStdout: result.stdout,
        rawStderr: result.stderr,
        durationMs: result.durationMs,
    };
}
async function runManualGate(config, _options) {
    const start = Date.now();
    console.log(chalk.yellow('\n' + '='.repeat(60)));
    console.log(chalk.yellow.bold('MANUAL REVIEW GATE'));
    console.log(chalk.yellow('='.repeat(60)));
    if (config.description) {
        console.log(chalk.white(`\n  ${config.description}\n`));
    }
    const { approved, feedback } = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'approved',
            message: 'Does this pass review?',
            default: true,
        },
        {
            type: 'input',
            name: 'feedback',
            message: 'Feedback (required if rejecting):',
            when: (answers) => !answers.approved,
            validate: (input) => input.trim().length > 0 || 'Feedback is required when rejecting',
        },
    ]);
    console.log(chalk.yellow('='.repeat(60) + '\n'));
    const durationMs = Date.now() - start;
    if (approved) {
        return {
            gate: 'manual',
            passed: true,
            command: 'manual review',
            exitCode: 0,
            failures: [],
            rawStdout: 'Approved',
            rawStderr: '',
            durationMs,
        };
    }
    return {
        gate: 'manual',
        passed: false,
        command: 'manual review',
        exitCode: 1,
        failures: [{
                gate: 'manual',
                message: feedback || 'Rejected without feedback',
                rawOutput: feedback || '',
            }],
        rawStdout: '',
        rawStderr: feedback || 'Rejected',
        durationMs,
    };
}
/**
 * Splits a command string into [executable, ...args] for execFile.
 * Handles npx-prefixed commands by using npx as the executable.
 * Appends structured output flags for e2e/lint gates when not already present.
 */
function buildCommandArgs(config) {
    const command = config.command;
    const parts = command.split(/\s+/);
    // For e2e gates, append --reporter json if not already present
    if (config.gate === 'e2e' && !command.includes('--reporter')) {
        parts.push('--reporter', 'json');
    }
    // For e2e gates with specific specs, append --spec
    if (config.gate === 'e2e' && config.specs?.length) {
        parts.push('--spec', config.specs.join(','));
    }
    // For lint gates, append --format json if not already present
    if (config.gate === 'lint' && !command.includes('--format') && !command.includes('-f')) {
        parts.push('--format', 'json');
    }
    return parts;
}
//# sourceMappingURL=gate-runner.js.map