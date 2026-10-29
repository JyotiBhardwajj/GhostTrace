import { describe, it, expect } from 'vitest';
import { validateAndRepairCitations } from '../../src/evidence/validateCitations';
import { EvidenceItem, GhostTraceReport } from '../../src/model/schemas';

const mockEvidencePack: EvidenceItem[] = [
  {
    id: 'E1',
    kind: 'commit',
    commit_sha: '1234567890abcdef1234567890abcdef12345678',
    date: '2024-04-02',
    subject: 'fix: add retry workaround',
    file_path: null,
    line_start: null,
    line_end: null,
    excerpt: 'Commit subject...',
    source_tool: 'search_history',
  },
  {
    id: 'E2',
    kind: 'diff',
    commit_sha: '1234567890abcdef1234567890abcdef12345678',
    date: '2024-04-02',
    subject: 'fix: add retry workaround',
    file_path: 'src/paymentClient.ts',
    line_start: null,
    line_end: null,
    excerpt: '+ const MAX_RETRIES = 5;',
    source_tool: 'get_diff',
  },
];

describe('validateAndRepairCitations', () => {
  it('preserves valid citations present in evidence pack', () => {
    const rawReport: GhostTraceReport = {
      question: 'Why was retry added?',
      summary: 'Retry was added for network flakiness.',
      findings: [
        {
          claim: 'Retry loop added in commit 1234567.',
          confidence: 'high',
          evidence_ids: ['E1', 'E2'],
        },
      ],
      evidence: mockEvidencePack,
      hypotheses: [],
      unknowns: [],
      limitations: [],
    };

    const { validatedReport, repairedCount, warnings } = validateAndRepairCitations(
      rawReport,
      mockEvidencePack
    );

    expect(repairedCount).toBe(0);
    expect(warnings.length).toBe(0);
    expect(validatedReport.findings[0].evidence_ids).toEqual(['E1', 'E2']);
  });

  it('filters phantom non-existent evidence IDs and demotes unsupported findings', () => {
    const rawReport: GhostTraceReport = {
      question: 'Why was retry added?',
      summary: 'Retry was added.',
      findings: [
        {
          claim: 'Supported finding with mixed IDs.',
          confidence: 'high',
          evidence_ids: ['E1', 'E999_PHANTOM'],
        },
        {
          claim: 'Completely fabricated finding with only phantom citation.',
          confidence: 'high',
          evidence_ids: ['E888_FABRICATED'],
        },
      ],
      evidence: mockEvidencePack,
      hypotheses: [],
      unknowns: [],
      limitations: [],
    };

    const { validatedReport, repairedCount, warnings } = validateAndRepairCitations(
      rawReport,
      mockEvidencePack
    );

    expect(repairedCount).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);

    // E999 was filtered out, leaving E1
    expect(validatedReport.findings.length).toBe(1);
    expect(validatedReport.findings[0].evidence_ids).toEqual(['E1']);

    // The unsupported claim was demoted to hypothesis
    const demoted = validatedReport.hypotheses.find((h) =>
      h.claim.includes('Completely fabricated')
    );
    expect(demoted).toBeDefined();
    expect(demoted?.evidence_ids).toEqual([]);
  });
});
