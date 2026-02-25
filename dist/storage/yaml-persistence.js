import { readFileSync, writeFileSync } from 'fs';
import * as yaml from 'yaml';
import { Logger } from '../utils/logger.js';
export class YamlPersistence {
    logger;
    doc = null;
    options;
    constructor(options) {
        this.options = options;
        this.logger = new Logger('YamlPersistence');
        if (options.enabled) {
            this.loadDocument();
        }
    }
    loadDocument() {
        try {
            const content = readFileSync(this.options.filePath, 'utf-8');
            this.doc = yaml.parseDocument(content);
        }
        catch (error) {
            this.logger.error(`Failed to load YAML for persistence: ${error}`);
        }
    }
    updateTaskStatus(taskId, status) {
        if (!this.options.enabled || !this.doc)
            return;
        try {
            const tasks = this.doc.get('tasks');
            if (!tasks) {
                this.logger.error('No tasks array found in YAML document');
                return;
            }
            for (let i = 0; i < tasks.items.length; i++) {
                const task = tasks.get(i);
                if (task && task.get('id') === taskId) {
                    task.set('status', status);
                    break;
                }
            }
            // Write back to file, preserving comments and formatting
            writeFileSync(this.options.filePath, this.doc.toString(), 'utf-8');
            this.logger.debug(`Updated task ${taskId} status to ${status}`);
        }
        catch (error) {
            this.logger.error(`Failed to update YAML status: ${error}`);
        }
    }
}
//# sourceMappingURL=yaml-persistence.js.map