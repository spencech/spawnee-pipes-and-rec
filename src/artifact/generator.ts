import { execFileNoThrow } from '../utils/shell.js';
import * as git from '../utils/git.js';
import { Logger } from '../utils/logger.js';
import { IArtifactOptions, IArtifactResult } from './types.js';
import { IValidationResult, IGateResult } from '../validation/types.js';

/**
 * Generates pipeline artifacts: PR, test report, beads audit trail.
 * Handles both success and failure cases.
 */
export class ArtifactGenerator {
	private logger: Logger;
	private options: IArtifactOptions;

	constructor(options: IArtifactOptions) {
		this.options = options;
		this.logger = new Logger('ArtifactGenerator');
	}

	async generate(): Promise<IArtifactResult> {
		const testReport = this.buildTestReport();
		const beadsAuditTrail = await this.exportBeadsAudit();

		// Merge task branches into feature branch
		await this.mergeBranches();

		// Push feature branch
		await git.pushBranch(this.options.repoWorkDir, this.options.featureBranch, true);

		// Create PR
		const prUrl = await this.createPullRequest(testReport, beadsAuditTrail);

		return {
			prUrl: prUrl ?? undefined,
			testReport,
			beadsAuditTrail,
		};
	}

	private async mergeBranches(): Promise<void> {
		const { repoWorkDir, taskResults, featureBranch } = this.options;

		// Ensure we're on the feature branch
		await git.fetchAll(repoWorkDir);
		const currentBranch = await git.getCurrentBranch(repoWorkDir);
		if (currentBranch !== featureBranch) {
			await git.checkoutBranch(repoWorkDir, featureBranch);
		}

		// Merge completed task branches
		for (const task of taskResults.completed) {
			const branch = task.result?.branch;
			if (!branch) continue;

			this.logger.info(`Merging branch: ${branch}`);
			const result = await git.mergeBranch(repoWorkDir, `origin/${branch}`);

			if (result.exitCode !== 0) {
				this.logger.error(`Merge conflict on ${branch}: ${result.stderr}`);
				// Continue with other branches rather than aborting entirely
			}
		}
	}

	private async createPullRequest(testReport: string, beadsAudit: string): Promise<string | null> {
		const body = this.options.success
			? this.buildSuccessPrBody(testReport, beadsAudit)
			: this.buildFailurePrBody(testReport, beadsAudit);

		const title = this.options.success
			? this.options.templateName
			: `[Partial] ${this.options.templateName}`;

		const result = await execFileNoThrow('gh', [
			'pr', 'create',
			'--title', title,
			'--body', body,
			'--base', this.options.baseBranch,
			'--head', this.options.featureBranch,
		], { cwd: this.options.repoWorkDir });

		if (result.exitCode !== 0) {
			this.logger.error(`Failed to create PR: ${result.stderr}`);
			return null;
		}

		// Extract PR URL from output
		const urlMatch = result.stdout.match(/(https:\/\/github\.com\/\S+)/);
		const prUrl = urlMatch ? urlMatch[1] : result.stdout.trim();
		this.logger.success(`Created PR: ${prUrl}`);
		return prUrl;
	}

	private buildSuccessPrBody(testReport: string, beadsAudit: string): string {
		const { templateName, description, acceptance_criteria, taskResults, validationHistory } = this.options;

		const parts: string[] = [];

		parts.push('## Summary');
		parts.push(description || templateName);

		// Changes
		parts.push('## Changes');
		for (const task of taskResults.completed) {
			const prInfo = task.result?.pullRequestUrl ? ` ([PR](${task.result.pullRequestUrl}))` : '';
			parts.push(`- **${task.name}**${prInfo}`);
		}

		// Validation results table
		if (validationHistory.cycles.length > 0) {
			parts.push('## Validation Results');
			parts.push('| Gate | Status | Cycles |');
			parts.push('|------|--------|--------|');

			const lastCycle = validationHistory.cycles[validationHistory.cycles.length - 1];
			for (const result of lastCycle.gateResults) {
				const statusHistory = this.getGateStatusHistory(result.gate);
				const status = result.passed ? 'pass' : 'fail';
				parts.push(`| ${result.gate} | ${status} | ${statusHistory} |`);
			}
		}

		// Acceptance criteria checklist
		if (acceptance_criteria.length > 0) {
			parts.push('## Acceptance Criteria');
			for (const criterion of acceptance_criteria) {
				parts.push(`- [x] ${criterion}`);
			}
		}

		// Test report
		parts.push('## Test Report');
		parts.push(testReport);

		// Discovered work
		if (beadsAudit) {
			parts.push('## Beads Audit Trail');
			parts.push(beadsAudit);
		}

		return parts.join('\n\n');
	}

	private buildFailurePrBody(testReport: string, beadsAudit: string): string {
		const { templateName, description, taskResults, validationHistory } = this.options;

		const parts: string[] = [];

		parts.push('## Summary (Partial Completion)');
		parts.push(description || templateName);
		parts.push('> This PR represents partial completion. Some validation gates did not pass within the maximum QA cycles.');

		// What was completed
		if (taskResults.completed.length > 0) {
			parts.push('## Completed Work');
			for (const task of taskResults.completed) {
				parts.push(`- **${task.name}**`);
			}
		}

		// What failed
		if (taskResults.failed.length > 0) {
			parts.push('## Failed Tasks');
			for (const task of taskResults.failed) {
				parts.push(`- **${task.name}**: ${task.error ?? 'Unknown error'}`);
			}
		}

		// Remaining failures
		if (validationHistory.cycles.length > 0) {
			const lastCycle = validationHistory.cycles[validationHistory.cycles.length - 1];
			const failedGates = lastCycle.gateResults.filter(r => !r.passed);

			if (failedGates.length > 0) {
				parts.push('## Remaining Failures');
				parts.push('| Gate | Failures | Cycles Attempted |');
				parts.push('|------|----------|-----------------|');
				for (const gate of failedGates) {
					parts.push(`| ${gate.gate} | ${gate.failures.length} | ${validationHistory.cycles.length} |`);
				}
			}
		}

		// Test report
		parts.push('## Test Report');
		parts.push(testReport);

		// Recommended next steps
		parts.push('## Recommended Next Steps');
		parts.push('1. Review the remaining failures above');
		parts.push('2. Check open beads issues for detailed failure context');
		parts.push('3. Address failures manually or re-run the pipeline with increased `max_qa_cycles`');

		if (beadsAudit) {
			parts.push('## Beads Audit Trail');
			parts.push(beadsAudit);
		}

		return parts.join('\n\n');
	}

	private buildTestReport(): string {
		const { validationHistory } = this.options;

		if (validationHistory.cycles.length === 0) {
			return 'No validation cycles were run.';
		}

		const lines: string[] = [];

		for (const cycle of validationHistory.cycles) {
			lines.push(`### Cycle ${cycle.cycle + 1} of ${cycle.maxCycles}`);

			for (const result of cycle.gateResults) {
				const status = result.passed ? 'PASS' : 'FAIL';
				const duration = `${(result.durationMs / 1000).toFixed(1)}s`;
				lines.push(`- **${result.gate}**: ${status} (${duration})`);

				if (!result.passed && result.failures.length > 0) {
					for (const failure of result.failures.slice(0, 5)) {
						const location = failure.file ? ` in ${failure.file}${failure.line ? `:${failure.line}` : ''}` : '';
						lines.push(`  - ${failure.message}${location}`);
					}
					if (result.failures.length > 5) {
						lines.push(`  - ... and ${result.failures.length - 5} more`);
					}
				}
			}

			lines.push('');
		}

		return lines.join('\n');
	}

	private async exportBeadsAudit(): Promise<string> {
		const result = await execFileNoThrow('bd', ['list', '--status=all'], {
			cwd: this.options.repoWorkDir,
		});

		if (result.exitCode !== 0) {
			this.logger.warn(`Could not export beads audit: ${result.stderr}`);
			return '';
		}

		return result.stdout.trim();
	}

	private getGateStatusHistory(gate: string): string {
		return this.options.validationHistory.cycles
			.map((cycle) => {
				const result = cycle.gateResults.find((r: IGateResult) => r.gate === gate);
				return result ? (result.passed ? 'pass' : 'fail') : '—';
			})
			.join(' → ');
	}
}
