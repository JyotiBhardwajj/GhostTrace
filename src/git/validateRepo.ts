import fs from 'node:fs';
import path from 'node:path';
import { safeExec } from './safeExec';

export interface ValidatedRepo {
  requestedPath: string;
  realRoot: string;
  isWorkTree: boolean;
}

const FORBIDDEN_FILE_PATTERNS = [
  /^\.env($|\..*)/i,
  /id_rsa/i,
  /id_ed25519/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
  /credentials\.json/i,
  /secret/i,
  /service-account/i,
  /aws_credentials/i,
];

/**
 * Validates a repository path.
 * 1. Must be non-empty string.
 * 2. Must exist and be a directory.
 * 3. Must be inside allowed roots if GHOSTTRACE_ALLOWED_ROOTS is set.
 * 4. Must be a valid Git repository work-tree.
 * 5. Returns canonical absolute repo root.
 */
export async function validateRepoPath(inputPath: string): Promise<ValidatedRepo> {
  if (!inputPath || typeof inputPath !== 'string' || inputPath.trim() === '') {
    throw new Error('Repository path cannot be empty.');
  }

  const cleanPath = inputPath.trim();

  // Check for NUL byte injection
  if (cleanPath.includes('\0')) {
    throw new Error('Invalid repository path: contains NUL byte.');
  }

  const resolved = path.resolve(cleanPath);

  if (!fs.existsSync(resolved)) {
    throw new Error(`Repository path does not exist: ${resolved}`);
  }

  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    throw new Error(`Repository path is not a directory: ${resolved}`);
  }

  // Canonical real path (resolves symlinks)
  const realPath = fs.realpathSync(resolved);

  // Check allowed roots if configured
  const allowedRootsEnv = process.env.GHOSTTRACE_ALLOWED_ROOTS;
  if (allowedRootsEnv && allowedRootsEnv.trim() !== '') {
    const allowedRoots = allowedRootsEnv
      .split(path.delimiter)
      .map((r) => r.trim())
      .filter(Boolean)
      .map((r) => fs.realpathSync(path.resolve(r)));

    const isAllowed = allowedRoots.some(
      (root) => realPath === root || realPath.startsWith(root + path.sep)
    );

    if (!isAllowed) {
      throw new Error(
        `Repository path "${realPath}" is outside the allowed root directories (${allowedRoots.join(', ')}).`
      );
    }
  }

  // Verify it is a git work tree
  const gitCheck = await safeExec('git', ['rev-parse', '--is-inside-work-tree'], {
    cwd: realPath,
  });

  if (gitCheck.exitCode !== 0 || gitCheck.stdout.trim() !== 'true') {
    throw new Error(`Directory is not a valid Git working tree: ${realPath}`);
  }

  // Find the top-level repo root
  const rootCheck = await safeExec('git', ['rev-parse', '--show-toplevel'], {
    cwd: realPath,
  });

  if (rootCheck.exitCode !== 0 || !rootCheck.stdout.trim()) {
    throw new Error(`Failed to determine Git top-level root for: ${realPath}`);
  }

  const topLevelRoot = path.normalize(rootCheck.stdout.trim());
  const canonicalRoot = fs.existsSync(topLevelRoot) ? fs.realpathSync(topLevelRoot) : topLevelRoot;

  return {
    requestedPath: inputPath,
    realRoot: canonicalRoot,
    isWorkTree: true,
  };
}

/**
 * Validates a repository-relative file path.
 * Protects against directory traversal (../), absolute paths, and secrets.
 */
export function validateRelativeFilePath(repoRoot: string, relativeFilePath: string): string {
  if (!relativeFilePath || typeof relativeFilePath !== 'string') {
    throw new Error('File path cannot be empty.');
  }

  if (relativeFilePath.includes('\0')) {
    throw new Error('Invalid file path: contains NUL byte.');
  }

  // Reject explicit absolute paths
  if (path.isAbsolute(relativeFilePath)) {
    throw new Error(`Expected repo-relative path, but got absolute path: ${relativeFilePath}`);
  }

  // Normalize path separators to POSIX style for git
  const normalizedRel = path.normalize(relativeFilePath).replace(/\\/g, '/');

  // Prevent directory traversal
  if (normalizedRel.startsWith('../') || normalizedRel === '..' || path.isAbsolute(normalizedRel)) {
    throw new Error(`Path traversal detected: ${relativeFilePath}`);
  }

  const fullPath = path.resolve(repoRoot, normalizedRel);
  if (!fullPath.startsWith(repoRoot + path.sep) && fullPath !== repoRoot) {
    throw new Error(`Path resolves outside repository: ${relativeFilePath}`);
  }

  // Check forbidden sensitive files
  const baseName = path.basename(normalizedRel);
  for (const pattern of FORBIDDEN_FILE_PATTERNS) {
    if (pattern.test(baseName) || pattern.test(normalizedRel)) {
      throw new Error(`Access to sensitive file or pattern is forbidden: ${normalizedRel}`);
    }
  }

  return normalizedRel;
}

/**
 * Validates Git commit SHA or revision string (hex hash or HEAD~n).
 */
export function validateCommitSha(sha: string): string {
  if (!sha || typeof sha !== 'string') {
    throw new Error('Commit SHA cannot be empty.');
  }

  const trimmed = sha.trim();

  // Allow standard Git full or short SHA (7 to 40 hex characters)
  if (/^[0-9a-fA-F]{4,40}$/.test(trimmed)) {
    return trimmed;
  }

  // Allow HEAD or HEAD~N revision syntax
  if (/^HEAD(~[0-9]+)?$/i.test(trimmed)) {
    return trimmed;
  }

  throw new Error(`Invalid Git commit SHA or revision syntax: "${sha}"`);
}
