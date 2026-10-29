import { CommitSummary } from '../git/tools';

const STOP_WORDS = new Set([
  'why', 'was', 'this', 'that', 'these', 'those', 'what', 'when', 'where', 'how',
  'and', 'or', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'is', 'are', 'were', 'been', 'can', 'could', 'should', 'would', 'safe', 'safely',
  'remove', 'introduced', 'exist', 'added', 'find', 'show', 'tell', 'me', 'explain'
]);

/**
 * Extracts searchable keywords and symbols from a question.
 */
export function extractKeywords(question: string): string[] {
  const words = question
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  // Deduplicate
  return Array.from(new Set(words));
}

/**
 * Scores and sorts commits based on keyword matching in their subjects and recency.
 */
export function rankCommits(commits: CommitSummary[], keywords: string[]): CommitSummary[] {
  if (keywords.length === 0) return commits;

  const scored = commits.map((c) => {
    let score = 0;
    const lowerSubj = c.subject.toLowerCase();

    for (const kw of keywords) {
      if (lowerSubj.includes(kw)) {
        score += 10;
        // Exact word boundary match gets bonus
        const regex = new RegExp(`\\b${kw}\\b`, 'i');
        if (regex.test(c.subject)) {
          score += 5;
        }
      }
    }

    return { commit: c, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.commit);
}
