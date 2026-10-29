import { describe, it, expect } from 'vitest';
import path from 'node:path';
import {
  validateRepoPath,
  validateRelativeFilePath,
  validateCommitSha,
} from '../../src/git/validateRepo';

const FIXTURE_REPO = path.resolve(__dirname, '../fixtures/known-workaround-repo');

describe('validateRepoPath', () => {
  it('accepts and canonicalizes a valid git work tree', async () => {
    const validated = await validateRepoPath(FIXTURE_REPO);
    expect(validated.isWorkTree).toBe(true);
    expect(validated.realRoot.toLowerCase()).toBe(FIXTURE_REPO.toLowerCase());
  });

  it('rejects empty or whitespace paths', async () => {
    await expect(validateRepoPath('')).rejects.toThrow('Repository path cannot be empty');
    await expect(validateRepoPath('   ')).rejects.toThrow('Repository path cannot be empty');
  });

  it('rejects non-existent paths', async () => {
    await expect(
      validateRepoPath(path.join(process.cwd(), 'does_not_exist_xyz'))
    ).rejects.toThrow('does not exist');
  });

  it('rejects paths containing NUL bytes', async () => {
    await expect(validateRepoPath('C:\\path\0evil')).rejects.toThrow('contains NUL byte');
  });
});

describe('validateRelativeFilePath', () => {
  it('accepts valid repository-relative file paths', () => {
    const valid = validateRelativeFilePath(FIXTURE_REPO, 'src/paymentClient.ts');
    expect(valid).toBe('src/paymentClient.ts');
  });

  it('rejects directory traversal attacks', () => {
    expect(() => validateRelativeFilePath(FIXTURE_REPO, '../secret.txt')).toThrow('Path traversal detected');
    expect(() => validateRelativeFilePath(FIXTURE_REPO, '../../etc/passwd')).toThrow('Path traversal detected');
  });

  it('rejects absolute paths for file parameters', () => {
    expect(() => validateRelativeFilePath(FIXTURE_REPO, 'C:\\Windows\\System32\\cmd.exe')).toThrow(
      'Expected repo-relative path'
    );
  });

  it('rejects sensitive files and secret patterns', () => {
    expect(() => validateRelativeFilePath(FIXTURE_REPO, '.env')).toThrow('forbidden');
    expect(() => validateRelativeFilePath(FIXTURE_REPO, '.env.production')).toThrow('forbidden');
    expect(() => validateRelativeFilePath(FIXTURE_REPO, 'id_rsa')).toThrow('forbidden');
    expect(() => validateRelativeFilePath(FIXTURE_REPO, 'server.key')).toThrow('forbidden');
    expect(() => validateRelativeFilePath(FIXTURE_REPO, 'credentials.json')).toThrow('forbidden');
  });
});

describe('validateCommitSha', () => {
  it('accepts valid 7-40 hex SHA', () => {
    expect(validateCommitSha('a1b2c3d')).toBe('a1b2c3d');
    expect(validateCommitSha('0123456789abcdef0123456789abcdef01234567')).toBe(
      '0123456789abcdef0123456789abcdef01234567'
    );
  });

  it('accepts HEAD revision syntax', () => {
    expect(validateCommitSha('HEAD')).toBe('HEAD');
    expect(validateCommitSha('HEAD~2')).toBe('HEAD~2');
  });

  it('rejects shell metacharacters and invalid hashes', () => {
    expect(() => validateCommitSha('; rm -rf /')).toThrow('Invalid Git commit SHA');
    expect(() => validateCommitSha('HEAD && calc.exe')).toThrow('Invalid Git commit SHA');
    expect(() => validateCommitSha('xyz123')).toThrow('Invalid Git commit SHA');
  });
});
