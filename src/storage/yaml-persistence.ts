import { readFileSync, writeFileSync } from 'fs';
import * as yaml from 'yaml';
import { Logger } from '../utils/logger.js';

export type TaskYamlStatus = 'pending' | 'started' | 'completed' | 'failed';

export interface YamlPersistenceOptions {
  filePath: string;
  enabled: boolean;
}

export class YamlPersistence {
  private logger: Logger;
  private doc: yaml.Document | null = null;
  private options: YamlPersistenceOptions;

  constructor(options: YamlPersistenceOptions) {
    this.options = options;
    this.logger = new Logger('YamlPersistence');
    if (options.enabled) {
      this.loadDocument();
    }
  }

  private loadDocument(): void {
    try {
      const content = readFileSync(this.options.filePath, 'utf-8');
      this.doc = yaml.parseDocument(content);
    } catch (error) {
      this.logger.error(`Failed to load YAML for persistence: ${error}`);
    }
  }

  updateTaskStatus(taskId: string, status: TaskYamlStatus): void {
    if (!this.options.enabled || !this.doc) return;

    try {
      const tasks = this.doc.get('tasks') as yaml.YAMLSeq;
      if (!tasks) {
        this.logger.error('No tasks array found in YAML document');
        return;
      }

      for (let i = 0; i < tasks.items.length; i++) {
        const task = tasks.get(i) as yaml.YAMLMap;
        if (task && task.get('id') === taskId) {
          task.set('status', status);
          break;
        }
      }

      // Write back to file, preserving comments and formatting
      writeFileSync(this.options.filePath, this.doc.toString(), 'utf-8');
      this.logger.debug(`Updated task ${taskId} status to ${status}`);
    } catch (error) {
      this.logger.error(`Failed to update YAML status: ${error}`);
    }
  }
}
