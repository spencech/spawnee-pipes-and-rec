import { EventEmitter } from 'events';
import { Logger } from '../utils/logger.js';
import { IGateConfig, IGateResult, IValidationResult } from './types.js';
import { runGate } from './gate-runner.js';

export interface IValidationRunnerOptions {
	cwd: string;
	timeout?: number;
}

/**
 * Orchestrates running all validation gates in sequence.
 * All gates run regardless of individual failures (no short-circuit).
 */
export class ValidationRunner extends EventEmitter {
	private logger: Logger;
	private options: IValidationRunnerOptions;

	constructor(options: IValidationRunnerOptions) {
		super();
		this.options = options;
		this.logger = new Logger('ValidationRunner');
	}

	/**
	 * Runs all gates in order and returns aggregate results.
	 */
	async run(gates: IGateConfig[], cycle: number, maxCycles: number): Promise<IValidationResult> {
		const gateResults: IGateResult[] = [];

		this.logger.info(`Starting validation cycle ${cycle + 1} of ${maxCycles} (${gates.length} gates)`);

		for (const gateConfig of gates) {
			this.logger.info(`Running gate: ${gateConfig.gate}`);
			this.emit('gateStarted', gateConfig);

			const result = await runGate(gateConfig, {
				cwd: this.options.cwd,
				timeout: this.options.timeout,
			});

			gateResults.push(result);

			if (result.passed) {
				this.logger.success(`Gate passed: ${gateConfig.gate} (${result.durationMs}ms)`);
				this.emit('gatePassed', result);
			} else {
				this.logger.error(`Gate failed: ${gateConfig.gate} (${result.failures.length} failures, ${result.durationMs}ms)`);
				this.emit('gateFailed', result);
			}
		}

		const allPassed = gateResults.every(r => r.passed);

		const validationResult: IValidationResult = {
			allPassed,
			cycle,
			maxCycles,
			gateResults,
		};

		this.emit('validationComplete', validationResult);

		if (allPassed) {
			this.logger.success('All gates passed');
		} else {
			const failedGates = gateResults.filter(r => !r.passed).map(r => r.gate);
			this.logger.error(`Validation failed: ${failedGates.join(', ')}`);
		}

		return validationResult;
	}
}
