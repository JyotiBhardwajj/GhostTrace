import path from 'node:path';
import { safeExec } from './safeExec';
import { validateRepoPath, validateRelativeFilePath, validateCommitSha } from './validateRepo';
import { redactSecrets, truncateExcerpt, parsePorcelainBlame, BlameLineRecord } from './normalize';
export type { BlameLineRecord } from './normalize';

export interface CommitSummary {
  sha: string;
  shortSha: string;
  author: string;
  date: string;
  subject: string;
}

export interface RepoSummaryResult {
  repoPath: string;
  branch: string;
  headSha: string;
  trackedFileCount: number;
  recentCommits: CommitSummary[];
}

export interface CommitDetails extends CommitSummary {
  body: string;
  filesChanged: string[];
}

export interface DiffResult {
  sha: string;
  filePath?: string;
  diff: string;
  clipped: boolean;
}

export interface SourceSearchResult {
  filePath: string;
  lineNumber: number;
  lineContent: string;
}

/**
 * 1. repo_summary: Retrieves high-level repository context.
 */
export async function repoSummary(repoPath: string): Promise<RepoSummaryResult> {
  const { realRoot } = await validateRepoPath(repoPath);

  // Get current branch or detached HEAD
  const branchRes = await safeExec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: realRoot });
  const branch = branchRes.exitCode === 0 ? branchRes.stdout.trim() : 'HEAD';

  // Get HEAD SHA
  const headRes = await safeExec('git', ['rev-parse', 'HEAD'], { cwd: realRoot });
  const headSha = headRes.exitCode === 0 ? headRes.stdout.trim() : 'unknown';

  // Get tracked file count
  const filesRes = await safeExec('git', ['ls-files'], { cwd: realRoot });
  const trackedFiles = filesRes.stdout.split('\n').filter((l) => l.trim().length > 0);
  const trackedFileCount = trackedFiles.length;

  // Get recent 10 commits
  const logRes = await safeExec(
    'git',
    ['log', '-n', '10', '--pretty=format:%H%x00%an%x00%ad%x00%s', '--date=short'],
    { cwd: realRoot }
  );

  const recentCommits: CommitSummary[] = [];
  if (logRes.exitCode === 0 && logRes.stdout.trim()) {
    const rawLines = logRes.stdout.split('\n').filter(Boolean);
    for (const line of rawLines) {
      const [sha, author, date, subject] = line.split('\0');
      if (sha) {
        recentCommits.push({
          sha,
          shortSha: sha.slice(0, 7),
          author: redactSecrets(author || ''),
          date: date || '',
          subject: redactSecrets(subject || ''),
        });
      }
    }
  }

  return {
    repoPath: realRoot,
    branch,
    headSha,
    trackedFileCount,
    recentCommits,
  };
}

/**
 * 2. search_history: Searches commit messages matching query.
 */
export async function searchHistory(
  repoPath: string,
  query: string,
  limit: number = 10
): Promise<CommitSummary[]> {
  const { realRoot } = await validateRepoPath(repoPath);
  const safeLimit = Math.min(Math.max(limit, 1), 30);

  if (!query || query.trim() === '') {
    return [];
  }

  const logRes = await safeExec(
    'git',
    [
      'log',
      `-n`,
      `${safeLimit}`,
      `--grep=${query.trim()}`,
      '-i',
      '--pretty=format:%H%x00%an%x00%ad%x00%s',
      '--date=short',
    ],
    { cwd: realRoot }
  );

  if (logRes.exitCode !== 0 || !logRes.stdout.trim()) {
    return [];
  }

  const commits: CommitSummary[] = [];
  const rawLines = logRes.stdout.split('\n').filter(Boolean);
  for (const line of rawLines) {
    const [sha, author, date, subject] = line.split('\0');
    if (sha) {
      commits.push({
        sha,
        shortSha: sha.slice(0, 7),
        author: redactSecrets(author || ''),
        date: date || '',
        subject: redactSecrets(subject || ''),
      });
    }
  }

  return commits;
}

/**
 * 3. get_commit: Retrieves detailed information for a specific commit.
 */
export async function getCommit(repoPath: string, sha: string): Promise<CommitDetails> {
  const { realRoot } = await validateRepoPath(repoPath);
  const safeSha = validateCommitSha(sha);

  // Validate commit exists
  const checkRes = await safeExec('git', ['cat-file', '-e', `${safeSha}^{commit}`], { cwd: realRoot });
  if (checkRes.exitCode !== 0) {
    throw new Error(`Commit not found in repository: ${sha}`);
  }

  // Get commit metadata
  const metaRes = await safeExec(
    'git',
    ['show', '-s', '--pretty=format:%H%x00%an%x00%ad%x00%s%x00%b', '--date=short', safeSha],
    { cwd: realRoot }
  );

  const [fullSha, author, date, subject, body] = metaRes.stdout.split('\0');

  // Get changed files list
  const filesRes = await safeExec('git', ['show', '--name-only', '--format=', safeSha], {
    cwd: realRoot,
  });

  const filesChanged = filesRes.stdout
    .split('\n')
    .map((f) => f.trim())
    .filter(Boolean);

  return {
    sha: fullSha || safeSha,
    shortSha: (fullSha || safeSha).slice(0, 7),
    author: redactSecrets(author || ''),
    date: date || '',
    subject: redactSecrets(subject || ''),
    body: redactSecrets(body || '').trim(),
    filesChanged,
  };
}

/**
 * 4. get_diff: Retrieves diff for a commit, optionally filtered to a file.
 * Disables external diff / textconv to guarantee security.
 */
export async function getDiff(
  repoPath: string,
  sha: string,
  optionalFile?: string
): Promise<DiffResult> {
  const { realRoot } = await validateRepoPath(repoPath);
  const safeSha = validateCommitSha(sha);

  const args = [
    'show',
    '--patch',
    '--no-ext-diff',
    '--no-textconv',
    '--binary',
    '--diff-filter=ACDMRTUXB',
    safeSha,
  ];

  let validatedFile: string | undefined;
  if (optionalFile && optionalFile.trim()) {
    validatedFile = validateRelativeFilePath(realRoot, optionalFile);
    args.push('--', validatedFile);
  }

  const maxDiff = parseInt(process.env.GHOSTTRACE_MAX_DIFF_CHARS || '12000', 10);
  const diffRes = await safeExec('git', args, { cwd: realRoot, maxBufferChars: maxDiff });

  const cleanDiff = truncateExcerpt(diffRes.stdout, 200, maxDiff);

  return {
    sha: safeSha,
    filePath: validatedFile,
    diff: cleanDiff,
    clipped: diffRes.clipped || cleanDiff.includes('truncated'),
  };
}

/**
 * 5. get_blame: Inspects line-by-line blame for a file and line range.
 */
export async function getBlame(
  repoPath: string,
  relativePath: string,
  startLine: number = 1,
  endLine: number = 50
): Promise<BlameLineRecord[]> {
  const { realRoot } = await validateRepoPath(repoPath);
  const safeFile = validateRelativeFilePath(realRoot, relativePath);

  const start = Math.max(1, Math.floor(startLine));
  const end = Math.max(start, Math.floor(endLine));

  const blameRes = await safeExec(
    'git',
    ['blame', '--porcelain', `-L`, `${start},${end}`, '--', safeFile],
    { cwd: realRoot }
  );

  if (blameRes.exitCode !== 0) {
    throw new Error(`Git blame failed on ${safeFile}: ${blameRes.stderr}`);
  }

  return parsePorcelainBlame(blameRes.stdout);
}

/**
 * 6. get_file_history: Returns commits that modified a specific file.
 */
export async function getFileHistory(
  repoPath: string,
  relativePath: string,
  limit: number = 10
): Promise<CommitSummary[]> {
  const { realRoot } = await validateRepoPath(repoPath);
  const safeFile = validateRelativeFilePath(realRoot, relativePath);
  const safeLimit = Math.min(Math.max(limit, 1), 30);

  const logRes = await safeExec(
    'git',
    [
      'log',
      `-n`,
      `${safeLimit}`,
      '--pretty=format:%H%x00%an%x00%ad%x00%s',
      '--date=short',
      '--',
      safeFile,
    ],
    { cwd: realRoot }
  );

  if (logRes.exitCode !== 0 || !logRes.stdout.trim()) {
    return [];
  }

  const commits: CommitSummary[] = [];
  const rawLines = logRes.stdout.split('\n').filter(Boolean);
  for (const line of rawLines) {
    const [sha, author, date, subject] = line.split('\0');
    if (sha) {
      commits.push({
        sha,
        shortSha: sha.slice(0, 7),
        author: redactSecrets(author || ''),
        date: date || '',
        subject: redactSecrets(subject || ''),
      });
    }
  }

  return commits;
}

/**
 * 7. search_source: Greps tracked source files for terms. Skips binary & sensitive files.
 */
export async function searchSource(
  repoPath: string,
  query: string,
  optionalGlob?: string,
  limit: number = 20
): Promise<SourceSearchResult[]> {
  const { realRoot } = await validateRepoPath(repoPath);
  if (!query || query.trim() === '') return [];

  const args = ['grep', '-n', '-I', '-i', '-e', query.trim()];

  if (optionalGlob && optionalGlob.trim()) {
    args.push('--', optionalGlob.trim());
  }

  const grepRes = await safeExec('git', args, { cwd: realRoot });
  if (grepRes.exitCode !== 0 || !grepRes.stdout.trim()) {
    return [];
  }

  const results: SourceSearchResult[] = [];
  const lines = grepRes.stdout.split('\n').filter(Boolean);

  for (const line of lines) {
    if (results.length >= limit) break;
    // format is file:line:content
    const match = line.match(/^([^:]+):(\d+):(.*)$/);
    if (match) {
      const [, filePath, lineNo, content] = match;
      results.push({
        filePath,
        lineNumber: parseInt(lineNo, 10),
        lineContent: redactSecrets(content.trim()),
      });
    }
  }

  return results;
}
