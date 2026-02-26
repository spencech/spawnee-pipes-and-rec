import { execFileNoThrow } from './shell.js';

/**
 * Reads a beads issue and extracts the design field.
 * Returns the design notes or null if not found / bd not available.
 */
export async function readBeadsBrief(issueId: string, cwd?: string): Promise<string | null> {
	const result = await execFileNoThrow('bd', ['show', issueId], { cwd });

	if (result.exitCode !== 0) {
		return null;
	}

	const output = result.stdout;

	// Parse the design field from bd show output.
	// bd show outputs fields as "Design: <value>" or as a block under "Design:"
	const designMatch = output.match(/^Design:\s*(.+)$/m);
	if (designMatch) {
		return designMatch[1].trim();
	}

	// Try multiline block format: "Design:" followed by indented lines
	const blockMatch = output.match(/^Design:\s*\n((?:\s+.+\n?)+)/m);
	if (blockMatch) {
		return blockMatch[1].replace(/^\s{2}/gm, '').trim();
	}

	return null;
}
