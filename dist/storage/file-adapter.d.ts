import { StateStore, OrchestratorState } from './state-store.js';
export declare class FileStateStore implements StateStore {
    private filePath;
    private logger;
    constructor(filePath: string);
    save(state: OrchestratorState): Promise<void>;
    load(): Promise<OrchestratorState | null>;
    clear(): Promise<void>;
    exists(): Promise<boolean>;
}
