import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface SafeExecOptions {
  cwd: string;
  timeoutMs?: number;
  maxBufferChars?: number;
}

export interface SafeExecResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  clipped: boolean;
}

const DEFAULT_TIMEOUT_MS = parseInt(process.env.GHOSTTRACE_TOOL_TIMEOUT_MS || '8000', 10);
const DEFAULT_MAX_DIFF_CHARS = parseInt(process.env.GHOSTTRACE_MAX_DIFF_CHARS || '12000', 10);

/**
 * Execute a command safely using execFile with argument arrays and shell: false.
 * Prevents command injection, enforces timeouts, and enforces output character limits.
 */
export async function safeExec(
  file: string,
  args: string[],
  options: SafeExecOptions
): Promise<SafeExecResult> {
  const timeout = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBuffer = options.maxBufferChars ?? DEFAULT_MAX_DIFF_CHARS;

  try {
    const { stdout, stderr } = await execFileAsync(file, args, {
      cwd: options.cwd,
      timeout,
      shell: false,
      maxBuffer: 10 * 1024 * 1024, // 10MB process buffer limit
      windowsHide: true,
      env: {
        ...process.env,
        LC_ALL: 'C',
        GIT_TERMINAL_PROMPT: '0',
        GIT_OPTIONAL_LOCKS: '0',
      },
    });

    let stdoutStr = stdout?.toString() || '';
    let stderrStr = stderr?.toString() || '';
    let clipped = false;

    if (stdoutStr.length > maxBuffer) {
      stdoutStr = stdoutStr.slice(0, maxBuffer) + `\n\n[... clipped at ${maxBuffer} characters by GhostTrace ...]`;
      clipped = true;
    }

    return {
      stdout: stdoutStr,
      stderr: stderrStr,
      exitCode: 0,
      clipped,
    };
  } catch (err: unknown) {
    const execErr = err as {
      code?: number | string;
      stdout?: string;
      stderr?: string;
      message?: string;
      killed?: boolean;
    };

    if (execErr.killed) {
      throw new Error(`Command timed out after ${timeout}ms: ${file} ${args.join(' ')}`);
    }

    const stdoutStr = execErr.stdout?.toString() || '';
    const stderrStr = execErr.stderr?.toString() || execErr.message || '';

    return {
      stdout: stdoutStr.length > maxBuffer ? stdoutStr.slice(0, maxBuffer) + '\n[... clipped ...]' : stdoutStr,
      stderr: stderrStr,
      exitCode: typeof execErr.code === 'number' ? execErr.code : 1,
      clipped: stdoutStr.length > maxBuffer,
    };
  }
}
