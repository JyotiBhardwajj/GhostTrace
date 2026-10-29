/**
 * Utility functions to sanitize, redact secrets, and format Git outputs safely.
 */

const SECRET_PATTERNS = [
  /(?:api[_-]?key|apikey|secret|token|password|auth|bearer)\s*[:=]\s*["']?([a-zA-Z0-9_\-.~+/=]{8,})["']?/gi,
  /ghp_[a-zA-Z0-9]{36}/g,
  /github_pat_[a-zA-Z0-9]{22}_[a-zA-Z0-9]{59}/g,
  /xox[baprs]-[0-9]{12}-[0-9]{12}-[a-zA-Z0-9]{24}/g,
  /AKIA[0-9A-Z]{16}/g,
];

/**
 * Redacts common API tokens, passwords, and secrets from Git output text.
 */
export function redactSecrets(text: string): string {
  if (!text) return '';
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, (match) => {
      // Keep prefix if matching key=val
      const eqIdx = match.search(/[:=]/);
      if (eqIdx !== -1) {
        return match.slice(0, eqIdx + 1) + ' [REDACTED_SECRET]';
      }
      return '[REDACTED_SECRET]';
    });
  }
  return result;
}

/**
 * Truncate text cleanly by line count and maximum character budget.
 */
export function truncateExcerpt(text: string, maxLines: number = 40, maxChars: number = 2500): string {
  if (!text) return '';
  const sanitized = redactSecrets(text);
  const lines = sanitized.split(/\r?\n/);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines).join('\n');
    return kept + `\n... [${lines.length - maxLines} more lines truncated]`;
  }

  if (sanitized.length > maxChars) {
    return sanitized.slice(0, maxChars) + `\n... [truncated at ${maxChars} chars]`;
  }

  return sanitized;
}

/**
 * Parses raw porcelain blame lines into structured blame records.
 */
export interface BlameLineRecord {
  lineNumber: number;
  commitSha: string;
  author: string;
  date: string;
  content: string;
}

export function parsePorcelainBlame(rawBlame: string): BlameLineRecord[] {
  const records: BlameLineRecord[] = [];
  const lines = rawBlame.split('\n');

  let currentSha = '';
  let currentLineNo = 0;
  let currentAuthor = '';
  let currentDate = '';

  const commitAuthorMap = new Map<string, string>();
  const commitDateMap = new Map<string, string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // First line of block: <sha> <orig-line> <final-line> [<group-count>]
    const headerMatch = line.match(/^([0-9a-fA-F]{40})\s+\d+\s+(\d+)/);
    if (headerMatch) {
      currentSha = headerMatch[1];
      currentLineNo = parseInt(headerMatch[2], 10);
      currentAuthor = commitAuthorMap.get(currentSha) || 'Unknown';
      currentDate = commitDateMap.get(currentSha) || '';
      continue;
    }

    if (line.startsWith('author ')) {
      currentAuthor = line.slice(7).trim();
      commitAuthorMap.set(currentSha, currentAuthor);
      continue;
    }

    if (line.startsWith('author-time ')) {
      const timestamp = parseInt(line.slice(12).trim(), 10);
      if (!isNaN(timestamp)) {
        currentDate = new Date(timestamp * 1000).toISOString().slice(0, 10);
        commitDateMap.set(currentSha, currentDate);
      }
      continue;
    }

    // Line content starts with tab
    if (line.startsWith('\t')) {
      records.push({
        lineNumber: currentLineNo,
        commitSha: currentSha,
        author: currentAuthor,
        date: currentDate,
        content: redactSecrets(line.slice(1)),
      });
    }
  }

  return records;
}
