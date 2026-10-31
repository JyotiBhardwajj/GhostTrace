import { describe, it, expect } from 'vitest';
import {
  detectEvidenceContradictions,
  validateAndRepairCitations,
} from '../../src/evidence/validateCitations';
import { EvidenceItem, GhostTraceReport } from '../../src/model/schemas';

describe('Evidence Consistency & Contradiction Validation Tests', () => {
  it('detects contradiction when two evidence items attribute overlapping line ranges to different commits', () => {
    const evidencePack: EvidenceItem[] = [
      {
        id: 'E1',
        kind: 'diff',
        commit_sha: '62010d22cef523777eacb5e8f47b608297f06bd5',
        date: '2024-04-02',
        subject: 'Add retry workaround',
        file_path: 'src/paymentClient.ts',
        line_start: 7,
        line_end: 23,
        excerpt: 'MAX_RETRIES = 5',
        source_tool: 'mastra:get_diff',
      },
      {
        id: 'E2',
        kind: 'blame',
        commit_sha: '1d9e462330b7bd4696e290a936bc38a7a766d110',
        date: '2024-03-15',
        subject: 'Initial payment client',
        file_path: 'src/paymentClient.ts',
        line_start: 1,
        line_end: 20, // Overlaps lines 7-20 with E1!
        excerpt: 'MAX_RETRIES = 5',
        source_tool: 'mastra:get_blame',
      },
    ];

    const contradictions = detectEvidenceContradictions(evidencePack);
    expect(contradictions.length).toBeGreaterThan(0);
    expect(contradictions[0].reason).toContain('Contradictory attribution');
    expect(contradictions[0].reason).toContain('lines 7-20');
  });

  it('demotes a finding to hypothesis if it cites conflicting contradictory evidence items', () => {
    const evidencePack: EvidenceItem[] = [
      {
        id: 'E1',
        kind: 'diff',
        commit_sha: 'aaaa111122223333444455556666777788889999',
        date: '2024-04-02',
        subject: 'Diff change',
        file_path: 'src/test.ts',
        line_start: 10,
        line_end: 20,
        excerpt: 'code block',
        source_tool: 'diff',
      },
      {
        id: 'E2',
        kind: 'blame',
        commit_sha: 'bbbb111122223333444455556666777788889999',
        date: '2024-03-15',
        subject: 'Blame change',
        file_path: 'src/test.ts',
        line_start: 15,
        line_end: 25,
        excerpt: 'code block',
        source_tool: 'blame',
      },
    ];

    const rawReport: GhostTraceReport = {
      question: 'Who added this code?',
      summary: 'Testing conflicting citations.',
      findings: [
        {
          claim: 'Both commits A and B authored this exact logic concurrently.',
          confidence: 'high',
          evidence_ids: ['E1', 'E2'], // Cites contradictory pair!
        },
      ],
      evidence: evidencePack,
      hypotheses: [],
      unknowns: [],
      limitations: [],
      contradictions: [],
    };

    const res = validateAndRepairCitations(rawReport, evidencePack);
    expect(res.contradictions.length).toBeGreaterThan(0);
    // Finding must be demoted to hypothesis
    expect(res.validatedReport.findings).toHaveLength(0);
    expect(res.validatedReport.hypotheses).toHaveLength(1);
    expect(res.validatedReport.hypotheses[0].claim).toContain('Both commits A and B');
    expect(res.validatedReport.hypotheses[0].why_plausible).toContain('conflicting attributions');
  });

  it('demotes speculative claims from findings to hypotheses even if citations are valid', () => {
    const evidencePack: EvidenceItem[] = [
      {
        id: 'E1',
        kind: 'commit',
        commit_sha: '62010d22cef523777eacb5e8f47b608297f06bd5',
        date: '2024-04-02',
        subject: 'Retry commit',
        file_path: null,
        line_start: null,
        line_end: null,
        excerpt: 'Add retry',
        source_tool: 'search_history',
      },
    ];

    const rawReport: GhostTraceReport = {
      question: 'Is it safe to remove?',
      summary: 'Summary text.',
      findings: [
        {
          claim: 'The service might have possibly migrated to v2 endpoints.',
          confidence: 'high',
          evidence_ids: ['E1'],
        },
        {
          claim: 'Historical change was introduced in commit 62010d2 on 2024-04-02.',
          confidence: 'high',
          evidence_ids: ['E1'],
        },
      ],
      evidence: evidencePack,
      hypotheses: [],
      unknowns: [],
      limitations: [],
      contradictions: [],
    };

    const res = validateAndRepairCitations(rawReport, evidencePack);
    // The speculative claim must be demoted
    expect(res.validatedReport.findings).toHaveLength(1);
    expect(res.validatedReport.findings[0].claim).toContain('Historical change was introduced');
    expect(res.validatedReport.hypotheses).toHaveLength(1);
    expect(res.validatedReport.hypotheses[0].claim).toContain('might have possibly migrated');
  });
});
