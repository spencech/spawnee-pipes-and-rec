import inquirer from 'inquirer';
import chalk from 'chalk';
import { Task } from '../core/task-queue.js';

export interface BreakpointPromptResult {
  action: 'continue' | 'abort';
}

export async function promptBreakpoint(task: Task): Promise<BreakpointPromptResult> {
  console.log(chalk.yellow('\n' + '='.repeat(60)));
  console.log(chalk.yellow.bold(`BREAKPOINT: Task "${task.name}" has completed`));
  console.log(chalk.yellow('='.repeat(60)));

  if (task.result?.branch) {
    console.log(chalk.gray(`  Branch: ${task.result.branch}`));
  }
  if (task.result?.pullRequestUrl) {
    console.log(chalk.cyan(`  PR: ${task.result.pullRequestUrl}`));
  }
  if (task.repository?.url) {
    console.log(chalk.gray(`  Repository: ${task.repository.url}`));
  }
  console.log(chalk.gray(`  Completed at: ${task.result?.completedAt}`));

  console.log();
  console.log(chalk.white.bold('  Review steps:'));
  console.log(chalk.white('  1. Open the PR link above in your browser'));
  console.log(chalk.white('  2. Review the changes made by the agent'));
  console.log(chalk.white('  3. Pull the branch locally if needed: ') + chalk.cyan(`git fetch && git checkout ${task.result?.branch || task.branch}`));
  console.log();

  const { shouldContinue } = await inquirer.prompt<{ shouldContinue: boolean }>([
    {
      type: 'confirm',
      name: 'shouldContinue',
      message: 'Continue to dependent tasks? (n to abort)',
      default: true,
    },
  ]);

  const action = shouldContinue ? 'continue' : 'abort';

  console.log(chalk.yellow('='.repeat(60) + '\n'));
  return { action };
}
