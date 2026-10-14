import { execFile as execFileCallback } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);

export function serializeVisualHarnessError(error) {
  return {
    name: error instanceof Error ? error.name : 'Error',
    message: error instanceof Error ? error.message : String(error),
    code: typeof error?.code === 'string' ? error.code : '',
    stack: typeof error?.stack === 'string' ? error.stack : '',
    details: error?.details && typeof error.details === 'object' ? error.details : null,
  };
}

export async function readVisualHarnessGitState(rootDir) {
  const [{ stdout: headStdout }, { stdout: statusStdout }] = await Promise.all([
    execFile('git', ['rev-parse', 'HEAD'], { cwd: rootDir }),
    execFile('git', ['--no-optional-locks', 'status', '--short'], { cwd: rootDir }),
  ]);
  return {
    head: headStdout.trim(),
    dirtyPaths: statusStdout
      .split('\n')
      .map((line) => line.trimEnd())
      .filter(Boolean),
  };
}

export async function writeVisualHarnessJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
