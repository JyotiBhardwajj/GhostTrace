import { describe, it, expect } from 'vitest';
import { safeExec } from '../../src/git/safeExec';
import path from 'node:path';

describe('safeExec', () => {
  it('executes a safe git command and returns stdout', async () => {
    const res = await safeExec('git', ['--version'], { cwd: process.cwd() });
    expect(res.exitCode).toBe(0);
    expect(res.stdout).toMatch(/git version/i);
    expect(res.clipped).toBe(false);
  });

  it('clips stdout when output exceeds maxBufferChars', async () => {
    const res = await safeExec('git', ['--version'], {
      cwd: process.cwd(),
      maxBufferChars: 5,
    });
    expect(res.exitCode).toBe(0);
    expect(res.clipped).toBe(true);
    expect(res.stdout).toContain('clipped at 5 characters');
  });

  it('captures exit code and stderr for invalid commands', async () => {
    const res = await safeExec('git', ['nonexistent-git-subcommand-xyz'], {
      cwd: process.cwd(),
    });
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr).toMatch(/is not a git command/i);
  });
});
