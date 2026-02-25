import { EventEmitter } from 'events';
import { Logger } from '../utils/logger.js';
import { runGate } from './gate-runner.js';
/**
 * Orchestrates running all validation gates in sequence.
 * All gates run regardless of individual failures (no short-circuit).
 */
export class ValidationRunner extends EventEmitter {
    logger;
    options;
    constructor(options) {
        super();
        this.options = options;
        this.logger = new Logger('ValidationRunner');
    }
    /**
     * Runs all gates in order and returns aggregate results.
     */
    async run(gates, cycle, maxCycles) {
        const gateResults = [];
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
            }
            else {
                this.logger.error(`Gate failed: ${gateConfig.gate} (${result.failures.length} failures, ${result.durationMs}ms)`);
                this.emit('gateFailed', result);
            }
        }
        const allPassed = gateResults.every(r => r.passed);
        const validationResult = {
            allPassed,
            cycle,
            maxCycles,
            gateResults,
        };
        this.emit('validationComplete', validationResult);
        if (allPassed) {
            this.logger.success('All gates passed');
        }
        else {
            const failedGates = gateResults.filter(r => !r.passed).map(r => r.gate);
            this.logger.error(`Validation failed: ${failedGates.join(', ')}`);
        }
        return validationResult;
    }
}
//# sourceMappingURL=validation-runner.js.map