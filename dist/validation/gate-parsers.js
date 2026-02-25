/**
 * Parses raw gate output into structured failures.
 * Falls back to a single catch-all failure if structured parsing fails.
 */
export function parseGateOutput(gate, stdout, stderr) {
    try {
        switch (gate) {
            case 'typecheck':
                return parseTypecheckOutput(stdout, stderr);
            case 'unit':
                return parseUnitOutput(stdout, stderr);
            case 'e2e':
                return parseE2eOutput(stdout, stderr);
            case 'lint':
                return parseLintOutput(stdout, stderr);
            default:
                return [createCatchAllFailure(gate, stdout, stderr)];
        }
    }
    catch {
        return [createCatchAllFailure(gate, stdout, stderr)];
    }
}
/**
 * Parses TypeScript compiler (tsc) output.
 * Matches lines like: src/foo.ts(42,5): error TS2345: Argument of type...
 * Also matches: src/foo.ts:42:5 - error TS2345: Argument of type...
 */
function parseTypecheckOutput(stdout, stderr) {
    const output = stdout + '\n' + stderr;
    const failures = [];
    // Match tsc output format: file(line,col): error TSxxxx: message
    const parenPattern = /^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)$/gm;
    let match;
    while ((match = parenPattern.exec(output)) !== null) {
        failures.push({
            gate: 'typecheck',
            file: match[1],
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
            message: `${match[4]}: ${match[5]}`,
            rawOutput: match[0],
            ruleName: match[4],
        });
    }
    // Also match colon-separated format: file:line:col - error TSxxxx: message
    const colonPattern = /^(.+?):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)$/gm;
    while ((match = colonPattern.exec(output)) !== null) {
        // Skip if already captured by paren pattern
        const alreadyCaptured = failures.some(f => f.file === match[1] && f.line === parseInt(match[2], 10));
        if (!alreadyCaptured) {
            failures.push({
                gate: 'typecheck',
                file: match[1],
                line: parseInt(match[2], 10),
                column: parseInt(match[3], 10),
                message: `${match[4]}: ${match[5]}`,
                rawOutput: match[0],
                ruleName: match[4],
            });
        }
    }
    if (failures.length === 0 && output.trim().length > 0) {
        return [createCatchAllFailure('typecheck', stdout, stderr)];
    }
    return failures;
}
/**
 * Parses unit test output (jasmine, jest, vitest).
 * Attempts to extract individual test failure names and messages.
 */
function parseUnitOutput(stdout, stderr) {
    const output = stdout + '\n' + stderr;
    const failures = [];
    // Jest/Vitest format: look for bullet/cross markers before test names
    const jestPattern = /^\s*[●✕✗]\s+(.+?)$/gm;
    let match;
    while ((match = jestPattern.exec(output)) !== null) {
        failures.push({
            gate: 'unit',
            message: match[1].trim(),
            rawOutput: extractSurroundingContext(output, match.index, 500),
            testName: match[1].trim(),
        });
    }
    // Jasmine format: "Failures:" followed by "1) suite name test name"
    const jasminePattern = /^\s*\d+\)\s+(.+?)$/gm;
    const hasFailuresHeader = /^Failures:$/m.test(output);
    if (hasFailuresHeader) {
        while ((match = jasminePattern.exec(output)) !== null) {
            const beforeMatch = output.substring(0, match.index);
            if (beforeMatch.includes('Failures:')) {
                failures.push({
                    gate: 'unit',
                    message: match[1].trim(),
                    rawOutput: extractSurroundingContext(output, match.index, 500),
                    testName: match[1].trim(),
                });
            }
        }
    }
    if (failures.length === 0 && output.trim().length > 0) {
        return [createCatchAllFailure('unit', stdout, stderr)];
    }
    return deduplicateFailures(failures);
}
/**
 * Parses Cypress JSON reporter output.
 * Falls back to regex parsing if JSON parsing fails.
 */
function parseE2eOutput(stdout, stderr) {
    const output = stdout + '\n' + stderr;
    const failures = [];
    // Try to parse as JSON (from --reporter json)
    try {
        const jsonMatch = stdout.match(/\{[\s\S]*"stats"[\s\S]*\}/);
        if (jsonMatch) {
            const report = JSON.parse(jsonMatch[0]);
            if (report.failures && Array.isArray(report.failures)) {
                for (const failure of report.failures) {
                    failures.push({
                        gate: 'e2e',
                        message: failure.err?.message || failure.title || 'E2E test failed',
                        rawOutput: JSON.stringify(failure, null, 2).substring(0, 2000),
                        testName: failure.fullTitle || failure.title,
                        file: failure.file,
                    });
                }
                if (failures.length > 0)
                    return failures;
            }
        }
    }
    catch {
        // Fall through to regex parsing
    }
    // Regex fallback: look for Cypress failure patterns
    const cypressPattern = /\d+\)\s+(.+?):\n\s+(.+)/g;
    let match;
    while ((match = cypressPattern.exec(output)) !== null) {
        failures.push({
            gate: 'e2e',
            message: match[2].trim(),
            rawOutput: extractSurroundingContext(output, match.index, 500),
            testName: match[1].trim(),
        });
    }
    if (failures.length === 0 && output.trim().length > 0) {
        return [createCatchAllFailure('e2e', stdout, stderr)];
    }
    return failures;
}
/**
 * Parses ESLint JSON output.
 * Falls back to regex parsing if JSON parsing fails.
 */
function parseLintOutput(stdout, stderr) {
    const failures = [];
    // Try to parse as JSON (from --format json)
    try {
        const results = JSON.parse(stdout);
        if (Array.isArray(results)) {
            for (const fileResult of results) {
                if (fileResult.errorCount > 0 && fileResult.messages) {
                    for (const msg of fileResult.messages) {
                        if (msg.severity === 2) { // errors only, not warnings
                            failures.push({
                                gate: 'lint',
                                file: fileResult.filePath,
                                line: msg.line,
                                column: msg.column,
                                message: msg.message,
                                rawOutput: `${fileResult.filePath}:${msg.line}:${msg.column} ${msg.ruleId}: ${msg.message}`,
                                ruleName: msg.ruleId,
                            });
                        }
                    }
                }
            }
            if (failures.length > 0)
                return failures;
        }
    }
    catch {
        // Fall through to regex parsing
    }
    // Regex fallback: file:line:col  error  message  rule-name
    const output = stdout + '\n' + stderr;
    const lintPattern = /^\s*(\S+?):(\d+):(\d+)\s+error\s+(.+?)\s{2,}(\S+)\s*$/gm;
    let match;
    while ((match = lintPattern.exec(output)) !== null) {
        failures.push({
            gate: 'lint',
            file: match[1],
            line: parseInt(match[2], 10),
            column: parseInt(match[3], 10),
            message: match[4].trim(),
            rawOutput: match[0],
            ruleName: match[5],
        });
    }
    if (failures.length === 0 && output.trim().length > 0) {
        return [createCatchAllFailure('lint', stdout, stderr)];
    }
    return failures;
}
// --- Helpers ---
function createCatchAllFailure(gate, stdout, stderr) {
    const combined = (stdout + '\n' + stderr).trim();
    return {
        gate,
        message: `${gate} gate failed`,
        rawOutput: combined.substring(0, 2000),
    };
}
function extractSurroundingContext(text, index, chars) {
    const start = Math.max(0, index - 100);
    const end = Math.min(text.length, index + chars);
    return text.substring(start, end);
}
function deduplicateFailures(failures) {
    const seen = new Set();
    return failures.filter(f => {
        const key = `${f.testName ?? f.message}`;
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
}
//# sourceMappingURL=gate-parsers.js.map