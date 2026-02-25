import { IGateFailure, GateType } from './types.js';
/**
 * Parses raw gate output into structured failures.
 * Falls back to a single catch-all failure if structured parsing fails.
 */
export declare function parseGateOutput(gate: GateType, stdout: string, stderr: string): IGateFailure[];
