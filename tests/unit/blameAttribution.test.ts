import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { getBlame } from '../../src/git/tools';
import { groupBlameRuns, EvidenceCollector } from '../../src/evidence/collect';
import { BlameLineRecord } from '../../src/git/normalize';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/known-workaround-repo');

describe('Git Blame Attribution & Contiguous Runs Regression Tests', () => {
  it('correctly partitions mixed-commit blame lines into contiguous runs', () => {
    const mockRecords: BlameLineRecord[] = [
      { lineNumber: 1, commitSha: '1111111111111111111111111111111111111111', author: 'Alice', date: '2024-03-10', content: 'line 1' },
      { lineNumber: 2, commitSha: '1111111111111111111111111111111111111111', author: 'Alice', date: '2024-03-10', content: 'line 2' },
      { lineNumber: 3, commitSha: '2222222222222222222222222222222222222222', author: 'Bob', date: '2024-04-02', content: 'workaround 1' },
      { lineNumber: 4, commitSha: '2222222222222222222222222222222222222222', author: 'Bob', date: '2024-04-02', content: 'workaround 2' },
      { lineNumber: 5, commitSha: '1111111111111111111111111111111111111111', author: 'Alice', date: '2024-03-10', content: 'line 5' },
    ];

    const runs = groupBlameRuns(mockRecords);
    expect(runs).toHaveLength(3);

    expect(runs[0][0].author).toBe('Alice');
    expect(runs[0]).toHaveLength(2);

    expect(runs[1][0].author).toBe('Bob');
    expect(runs[1][0].commitSha).toBe('2222222222222222222222222222222222222222');
    expect(runs[1]).toHaveLength(2);

    expect(runs[2][0].author).toBe('Alice');
    expect(runs[2]).toHaveLength(1);
  });

  it('accurately attributes workaround lines (8-20) in paymentClient.ts to Bob Engineer on 2024-04-02', async () => {
    const blameLines = await getBlame(FIXTURE_DIR, 'src/paymentClient.ts', 1, 35);
    expect(blameLines.length).toBeGreaterThan(20);

    // Filter lines 8 through 20 (containing the workaround comment, MAX_RETRIES, and sleepWithJitter)
    const workaroundLines = blameLines.filter((l) => l.lineNumber >= 8 && l.lineNumber <= 20);
    expect(workaroundLines.length).toBe(13);

    for (const line of workaroundLines) {
      // Must be attributed to Bob Engineer, NOT Alice Dev
      expect(line.author).toBe('Bob Engineer');
      expect(line.date).toBe('2024-04-02');
      expect(line.commitSha.toLowerCase()).toContain('62010d2');
    }

    // Lines 1 through 6 must be Alice Dev
    const clientHeaderLines = blameLines.filter((l) => l.lineNumber >= 1 && l.lineNumber <= 5);
    for (const line of clientHeaderLines) {
      expect(line.author).toBe('Alice Dev');
      expect(line.date).toBe('2024-03-15');
    }
  });

  it('ensures EvidenceCollector creates an accurately attributed blame evidence item for workaround lines', async () => {
    const blameLines = await getBlame(FIXTURE_DIR, 'src/paymentClient.ts', 1, 35);
    const collector = new EvidenceCollector(20);

    // Pass topCommitSha (Bob's commit 62010d22)
    const workaroundSha = '62010d22cef523777eacb5e8f47b608297f06bd5';
    collector.addBlameGroup('src/paymentClient.ts', blameLines, 'mastra:get_blame', workaroundSha);

    const items = collector.getItems();
    expect(items.length).toBeGreaterThan(0);

    const blameItem = items.find((i) => i.kind === 'blame');
    expect(blameItem).toBeDefined();
    expect(blameItem?.commit_sha).toBe(workaroundSha);
    expect(blameItem?.date).toBe('2024-04-02');
    expect(blameItem?.subject).toContain('Bob Engineer');
    expect(blameItem?.line_start).toBe(7);
    expect(blameItem?.line_end).toBe(23);
    // Excerpt must contain the workaround comment and not just Alice's interface
    expect(blameItem?.excerpt).toContain('INC-882');
    expect(blameItem?.excerpt).toContain('MAX_RETRIES');
  });
});
