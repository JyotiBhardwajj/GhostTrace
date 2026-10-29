import { describe, it, expect, beforeAll } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import {
  repoSummary,
  searchHistory,
  getCommit,
  getDiff,
  getBlame,
  searchSource,
} from '../../src/git/tools';
import { createFixtureRepo } from '../../scripts/setup-fixture.mjs';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/known-workaround-repo');

describe('Git Tools Integration with Fixture Repo', () => {
  beforeAll(() => {
    // Ensure deterministic fixture repo exists
    if (!fs.existsSync(path.join(FIXTURE_DIR, '.git'))) {
      createFixtureRepo();
    }
  });

  it('repoSummary returns branch, HEAD, and 4 commits', async () => {
    const summary = await repoSummary(FIXTURE_DIR);
    expect(summary.branch).toBe('main');
    expect(summary.trackedFileCount).toBeGreaterThanOrEqual(3);
    expect(summary.recentCommits.length).toBe(4);
    expect(summary.recentCommits[0].subject).toContain('chore(metrics)');
  });

  it('searchHistory finds the workaround commit by keyword "retry"', async () => {
    const results = await searchHistory(FIXTURE_DIR, 'retry', 5);
    expect(results.length).toBeGreaterThanOrEqual(1);

    const workaroundCommit = results.find((c) => c.subject.includes('retry workaround'));
    expect(workaroundCommit).toBeDefined();
    expect(workaroundCommit?.author).toBe('Bob Engineer');
  });

  it('getCommit returns commit metadata, body, and changed files', async () => {
    const matches = await searchHistory(FIXTURE_DIR, 'workaround', 1);
    expect(matches.length).toBe(1);

    const details = await getCommit(FIXTURE_DIR, matches[0].sha);
    expect(details.author).toBe('Bob Engineer');
    expect(details.body).toContain('INC-882');
    expect(details.filesChanged).toContain('src/paymentClient.ts');
  });

  it('getDiff returns patch diff containing workaround code', async () => {
    const matches = await searchHistory(FIXTURE_DIR, 'workaround', 1);
    const diff = await getDiff(FIXTURE_DIR, matches[0].sha, 'src/paymentClient.ts');

    expect(diff.diff).toContain('MAX_RETRIES = 5');
    expect(diff.diff).toContain('sleepWithJitter');
    expect(diff.clipped).toBe(false);
  });

  it('getBlame returns porcelain blame lines with line numbers and author', async () => {
    const blame = await getBlame(FIXTURE_DIR, 'src/paymentClient.ts', 1, 20);
    expect(blame.length).toBeGreaterThan(0);
    expect(blame[0].author).toBeDefined();
    expect(blame[0].lineNumber).toBe(1);
  });

  it('searchSource finds keyword occurrences across tracked files', async () => {
    const grepRes = await searchSource(FIXTURE_DIR, 'MAX_RETRIES');
    expect(grepRes.length).toBeGreaterThanOrEqual(1);
    expect(grepRes[0].filePath).toBe('src/paymentClient.ts');
    expect(grepRes[0].lineContent).toContain('MAX_RETRIES');
  });
});
