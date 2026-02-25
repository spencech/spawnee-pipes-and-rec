export type TaskYamlStatus = 'pending' | 'started' | 'completed' | 'failed';
export interface YamlPersistenceOptions {
    filePath: string;
    enabled: boolean;
}
export declare class YamlPersistence {
    private logger;
    private doc;
    private options;
    constructor(options: YamlPersistenceOptions);
    private loadDocument;
    updateTaskStatus(taskId: string, status: TaskYamlStatus): void;
}
