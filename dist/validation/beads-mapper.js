import { execFileNoThrow } from '../utils/shell.js';
import { Logger } from '../utils/logger.js';
/**
 * Maps gate failures to beads issues via `bd create`.
 * Groups failures intelligently (multiple errors in same file → one issue).
 */
export class BeadsMapper {
    logger;
    options;
    constructor(options) {
        this.options = options;
        this.logger = new Logger('BeadsMapper');
    }
    /**
     * Creates beads issues from gate results. Returns created issue IDs.
     */
    async createIssuesFromResults(gateResults) {
        const issueIds = [];
        for (const result of gateResults) {
            if (result.passed)
                continue;
            const grouped = this.groupFailures(result);
            for (const group of grouped) {
                const issueId = await this.createIssue(result, group);
                if (issueId)
                    issueIds.push(issueId);
            }
        }
        return issueIds;
    }
    /**
     * Groups failures by file (for typecheck/lint) or keeps them individual (for unit/e2e).
     */
    groupFailures(result) {
        const { failures } = result;
        if (failures.length === 0)
            return [[createCatchAllFailure(result)]];
        // Group typecheck and lint failures by file
        if (result.gate === 'typecheck' || result.gate === 'lint') {
            const byFile = new Map();
            for (const failure of failures) {
                const key = failure.file ?? 'unknown';
                if (!byFile.has(key))
                    byFile.set(key, []);
                byFile.get(key).push(failure);
            }
            return Array.from(byFile.values());
        }
        // Keep unit/e2e/manual failures individual
        return failures.map(f => [f]);
    }
    async createIssue(result, failures) {
        const title = this.buildTitle(result.gate, failures);
        const description = this.buildDescription(result, failures);
        const priority = result.gate === 'lint' ? '2' : '1';
        const bdResult = await execFileNoThrow('bd', [
            'create',
            `--title=${title}`,
            `--description=${description}`,
            '--type=bug',
            `--priority=${priority}`,
        ], { cwd: this.options.cwd });
        if (bdResult.exitCode !== 0) {
            this.logger.error(`Failed to create beads issue: ${bdResult.stderr}`);
            return null;
        }
        // Parse issue ID from output: "Created issue: spawnee-pipes-and-rec-xxx"
        const idMatch = bdResult.stdout.match(/Created issue:\s+(\S+)/);
        const issueId = idMatch ? idMatch[1] : null;
        if (issueId) {
            this.logger.info(`Created QA issue: ${issueId} — ${title}`);
        }
        return issueId;
    }
    buildTitle(gate, failures) {
        const first = failures[0];
        if (gate === 'typecheck' || gate === 'lint') {
            const file = first.file ?? 'unknown file';
            const count = failures.length;
            return `QA: ${gate}: ${count} error${count > 1 ? 's' : ''} in ${file}`;
        }
        if (gate === 'unit' || gate === 'e2e') {
            const testName = first.testName ?? first.message;
            return `QA: ${gate}: ${testName}`.substring(0, 120);
        }
        if (gate === 'manual') {
            return `QA: manual review — ${first.message}`.substring(0, 120);
        }
        return `QA: ${gate}: ${first.message}`.substring(0, 120);
    }
    buildDescription(result, failures) {
        const parts = [];
        parts.push(`## Gate\n${result.gate}`);
        parts.push(`## QA Cycle\n${this.options.cycle + 1} of ${this.options.maxCycles}`);
        parts.push(`## Command\n${result.command}`);
        // Error output (truncated)
        const errorOutput = failures.map(f => f.rawOutput).join('\n\n').substring(0, 2000);
        parts.push(`## Error Output\n${errorOutput}`);
        // Files involved
        const files = failures
            .filter(f => f.file)
            .map(f => `- ${f.file}${f.line ? `:${f.line}` : ''}`)
            .filter((v, i, a) => a.indexOf(v) === i); // dedupe
        if (files.length > 0) {
            parts.push(`## Files Involved\n${files.join('\n')}`);
        }
        return parts.join('\n\n');
    }
}
function createCatchAllFailure(result) {
    const combined = (result.rawStdout + '\n' + result.rawStderr).trim();
    return {
        gate: result.gate,
        message: `${result.gate} gate failed`,
        rawOutput: combined.substring(0, 2000),
    };
}
//# sourceMappingURL=beads-mapper.js.map