/**
 * Reads a beads issue and extracts the design field.
 * Returns the design notes or null if not found / bd not available.
 */
export declare function readBeadsBrief(issueId: string, cwd?: string): Promise<string | null>;
