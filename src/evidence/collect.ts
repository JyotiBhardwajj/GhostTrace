import { EvidenceItem } from '../model/schemas';
import { CommitSummary, CommitDetails, DiffResult, BlameLineRecord, SourceSearchResult } from '../git/tools';
import { truncateExcerpt } from '../git/normalize';

export function groupBlameRuns(records: BlameLineRecord[]): BlameLineRecord[][] {
  if (records.length === 0) return [];
  const runs: BlameLineRecord[][] = [];
  let currentRun: BlameLineRecord[] = [records[0]];

  for (let i = 1; i < records.length; i++) {
    const prev = records[i - 1];
    const curr = records[i];
    // Contiguous lines and same commit SHA
    if (curr.commitSha === prev.commitSha && curr.lineNumber === prev.lineNumber + 1) {
      currentRun.push(curr);
    } else {
      runs.push(currentRun);
      currentRun = [curr];
    }
  }
  runs.push(currentRun);
  return runs;
}

export class EvidenceCollector {
  private items: EvidenceItem[] = [];
  private counter: number = 1;
  private maxItems: number;

  constructor(maxItems: number = 20) {
    this.maxItems = maxItems;
  }

  public getItems(): EvidenceItem[] {
    return this.items;
  }

  public addCommit(commit: CommitSummary, toolName: string = 'search_history'): string | null {
    if (this.items.length >= this.maxItems) return null;
    const id = `E${this.counter++}`;
    this.items.push({
      id,
      kind: 'commit',
      commit_sha: commit.sha,
      author: commit.author || null,
      date: commit.date || null,
      subject: commit.subject || null,
      file_path: null,
      line_start: null,
      line_end: null,
      excerpt: `Commit: ${commit.shortSha} - ${commit.subject} (Author: ${commit.author}, Date: ${commit.date})`,
      source_tool: toolName,
    });
    return id;
  }

  public addCommitDetails(commit: CommitDetails, toolName: string = 'get_commit'): string | null {
    if (this.items.length >= this.maxItems) return null;
    const id = `E${this.counter++}`;
    const excerpt = [
      `Commit: ${commit.sha}`,
      `Author: ${commit.author}`,
      `Date: ${commit.date}`,
      `Subject: ${commit.subject}`,
      commit.body ? `Message:\n${commit.body}` : '',
      commit.filesChanged.length > 0 ? `Files: ${commit.filesChanged.join(', ')}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    this.items.push({
      id,
      kind: 'commit',
      commit_sha: commit.sha,
      author: commit.author || null,
      date: commit.date || null,
      subject: commit.subject || null,
      file_path: commit.filesChanged[0] || null,
      line_start: null,
      line_end: null,
      excerpt: truncateExcerpt(excerpt, 25, 1500),
      source_tool: toolName,
    });
    return id;
  }

  public addDiff(diff: DiffResult, commitInfo?: CommitSummary, toolName: string = 'get_diff'): string | null {
    if (this.items.length >= this.maxItems) return null;
    const id = `E${this.counter++}`;
    this.items.push({
      id,
      kind: 'diff',
      commit_sha: diff.sha,
      author: commitInfo?.author || null,
      date: commitInfo?.date || null,
      subject: commitInfo?.subject || null,
      file_path: diff.filePath || null,
      line_start: null,
      line_end: null,
      excerpt: truncateExcerpt(diff.diff, 40, 2500),
      source_tool: toolName,
    });
    return id;
  }

  public addBlameGroup(
    filePath: string,
    records: BlameLineRecord[],
    toolName: string = 'get_blame',
    focusSha?: string
  ): string | null {
    if (this.items.length >= this.maxItems || records.length === 0) return null;
    const runs = groupBlameRuns(records);
    if (runs.length === 0) return null;

    // If focusSha is provided, prioritize runs matching focusSha
    const sortedRuns = focusSha
      ? [...runs].sort((a, b) => {
          const aMatch =
            a[0].commitSha.startsWith(focusSha) || focusSha.startsWith(a[0].commitSha) ? -1 : 1;
          const bMatch =
            b[0].commitSha.startsWith(focusSha) || focusSha.startsWith(b[0].commitSha) ? -1 : 1;
          return aMatch - bMatch;
        })
      : runs;

    let primaryId: string | null = null;
    for (const run of sortedRuns) {
      if (this.items.length >= this.maxItems) break;
      const id = `E${this.counter++}`;
      if (!primaryId) primaryId = id;

      const startLine = run[0].lineNumber;
      const endLine = run[run.length - 1].lineNumber;
      const mainSha = run[0].commitSha;
      const mainDate = run[0].date;
      const mainAuthor = run[0].author;

      const formattedLines = run.map((r) => `${r.lineNumber}: ${r.content}`).join('\n');

      this.items.push({
        id,
        kind: 'blame',
        commit_sha: mainSha,
        author: mainAuthor || null,
        date: mainDate || null,
        subject: `Blame for lines ${startLine}-${endLine} by ${mainAuthor} (${mainSha.slice(0, 7)})`,
        file_path: filePath,
        line_start: startLine,
        line_end: endLine,
        excerpt: truncateExcerpt(formattedLines, 30, 1500),
        source_tool: toolName,
      });

      // When targeted by focusSha, only add the focused run to avoid filling bounded pack with non-pertinent lines
      if (focusSha && (run[0].commitSha.startsWith(focusSha) || focusSha.startsWith(run[0].commitSha))) {
        break;
      }
    }
    return primaryId;
  }

  public addSourceMatches(
    query: string,
    matches: SourceSearchResult[],
    toolName: string = 'search_source'
  ): string | null {
    if (this.items.length >= this.maxItems || matches.length === 0) return null;
    const id = `E${this.counter++}`;
    const firstMatch = matches[0];

    const lines = matches.map((m) => `${m.filePath}:${m.lineNumber}: ${m.lineContent}`).join('\n');

    this.items.push({
      id,
      kind: 'source',
      commit_sha: null,
      date: null,
      subject: `Grep match for "${query}"`,
      file_path: firstMatch.filePath,
      line_start: firstMatch.lineNumber,
      line_end: matches[matches.length - 1].lineNumber,
      excerpt: truncateExcerpt(lines, 30, 1500),
      source_tool: toolName,
    });
    return id;
  }
}
