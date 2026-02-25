import { readFile, writeFile, unlink, access } from 'fs/promises';
import { Logger } from '../utils/logger.js';
export class FileStateStore {
    filePath;
    logger;
    constructor(filePath) {
        this.filePath = filePath;
        this.logger = new Logger('FileStateStore');
    }
    async save(state) {
        const data = JSON.stringify({ ...state, updatedAt: new Date().toISOString() }, null, 2);
        await writeFile(this.filePath, data, 'utf-8');
        this.logger.debug(`State saved to ${this.filePath}`);
    }
    async load() {
        try {
            const data = await readFile(this.filePath, 'utf-8');
            return JSON.parse(data);
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return null;
            throw error;
        }
    }
    async clear() {
        try {
            await unlink(this.filePath);
            this.logger.debug(`State file cleared: ${this.filePath}`);
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                throw error;
        }
    }
    async exists() {
        try {
            await access(this.filePath);
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=file-adapter.js.map