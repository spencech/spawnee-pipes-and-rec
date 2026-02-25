import { readFile, writeFile, unlink, access } from 'fs/promises';
import { StateStore, OrchestratorState } from './state-store.js';
import { Logger } from '../utils/logger.js';

export class FileStateStore implements StateStore {
  private logger: Logger;

  constructor(private filePath: string) {
    this.logger = new Logger('FileStateStore');
  }

  async save(state: OrchestratorState): Promise<void> {
    const data = JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2);
    await writeFile(this.filePath, data, 'utf-8');
    this.logger.debug(`State saved to ${this.filePath}`);
  }

  async load(): Promise<OrchestratorState | null> {
    try {
      const data = await readFile(this.filePath, 'utf-8');
      return JSON.parse(data) as OrchestratorState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async clear(): Promise<void> {
    try {
      await unlink(this.filePath);
      this.logger.debug(`State file cleared: ${this.filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async exists(): Promise<boolean> {
    try {
      await access(this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}

