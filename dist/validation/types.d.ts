export type GateType = 'typecheck' | 'unit' | 'e2e' | 'lint' | 'manual';
export interface IGateConfig {
    gate: GateType;
    command?: string;
    pattern?: string;
    specs?: string[];
    description?: string;
}
export interface IGateFailure {
    gate: GateType;
    file?: string;
    line?: number;
    column?: number;
    message: string;
    rawOutput: string;
    testName?: string;
    ruleName?: string;
}
export interface IGateResult {
    gate: GateType;
    passed: boolean;
    command: string;
    exitCode: number;
    failures: IGateFailure[];
    rawStdout: string;
    rawStderr: string;
    durationMs: number;
}
export interface IValidationResult {
    allPassed: boolean;
    cycle: number;
    maxCycles: number;
    gateResults: IGateResult[];
}
export interface IValidationHistory {
    cycles: IValidationResult[];
}
