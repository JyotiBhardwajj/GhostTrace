import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { runInvestigation } from '../../src/agent/investigator';
import { checkOllamaHealth } from '../../src/model/ollama';

const FIXTURE_DIR = path.resolve(__dirname, '../fixtures/known-workaround-repo');

describe('End-to-End Investigation with Fixture Repo', () => {
  it('investigates with deterministic fallback mode and verifies citations and caution', async () => {
    const output = await runInvestigation({
      repoPath: FIXTURE_DIR,
      question: 'Why was this retry workaround added, and can I safely remove it?',
      focusFile: 'src/paymentClient.ts',
      forceFallback: true,
    });

    expect(output).toBeDefined();
    expect(output.inferenceMode).toBe('grounded-deterministic');
    expect(output.modelUsed).toContain('fallback');

    const report = output.report;
    expect(report.question).toBe('Why was this retry workaround added, and can I safely remove it?');
    expect(report.summary.length).toBeGreaterThan(15);
    // Explicitly contains prominent warning on insufficient evidence
    expect(report.summary).toContain('WARNING:');
    expect(report.summary.toLowerCase()).toContain('insufficient');

    // Verify findings and evidence IDs
    expect(report.findings.length).toBeGreaterThan(0);
    const validEvidenceIds = new Set(report.evidence.map((e) => e.id));

    for (const finding of report.findings) {
      expect(finding.claim).toBeTruthy();
      expect(['high', 'medium', 'low']).toContain(finding.confidence);
      expect(finding.evidence_ids.length).toBeGreaterThan(0);
      for (const id of finding.evidence_ids) {
        expect(validEvidenceIds.has(id)).toBe(true);
      }
    }

    // Verify explicit temporal reasoning on Q3 2025 past planned deadline
    const q3Finding = report.findings.find((f) => f.claim.includes('Q3 2025'));
    expect(q3Finding).toBeDefined();
    expect(q3Finding?.claim.toLowerCase()).toContain('past planned deadline');
    expect(q3Finding?.claim.toLowerCase()).toContain('unknown completion status');

    // Check that the evidence pack found the workaround commit
    const workaroundEvidence = report.evidence.find(
      (e) =>
        (e.subject && e.subject.toLowerCase().includes('retry workaround')) ||
        (e.excerpt && e.excerpt.toLowerCase().includes('max_retries'))
    );
    expect(workaroundEvidence).toBeDefined();
    expect(workaroundEvidence?.commit_sha).toBeDefined();

    // Verify blame attribution: lines 7-23 must be attributed to Bob Engineer, NOT Alice Dev
    const blameEvidence = report.evidence.find((e) => e.kind === 'blame');
    if (blameEvidence) {
      expect(blameEvidence.author).toBe('Bob Engineer');
      expect(blameEvidence.date).toBe('2024-04-02');
      expect(blameEvidence.commit_sha).toContain('62010d2');
    }

    // Check hypotheses and unknowns
    expect(report.hypotheses.length).toBeGreaterThan(0);
    expect(report.unknowns.length).toBeGreaterThan(0);
    expect(report.limitations.length).toBeGreaterThan(0);
    expect(report.contradictions).toBeDefined();
    expect(report.contradictions).toHaveLength(0);

    // Check progress events
    expect(output.events.length).toBeGreaterThanOrEqual(5);
    const stageNames = output.events.map((e) => e.stage);
    expect(stageNames).toContain('VALIDATE_REPO');
    expect(stageNames).toContain('SEARCH_HISTORY');
    expect(stageNames).toContain('COMPLETE');
  }, 30000);

  it('runs investigation pipeline through active model or graceful fallback', async () => {
    const health = await checkOllamaHealth();
    console.log('[TEST] Ollama Health Status:', health.running, health.models);

    const output = await runInvestigation({
      repoPath: FIXTURE_DIR,
      question: 'Why was this retry workaround added, and can I safely remove it?',
      focusFile: 'src/paymentClient.ts',
    });

    expect(output).toBeDefined();
    expect(output.report).toBeDefined();
    expect(['ollama-local', 'grounded-deterministic']).toContain(output.inferenceMode);

    console.log('\n================== LIVE GEMMA AUDIT RUN ==================');
    console.log('Inference Mode:', output.inferenceMode);
    console.log('Model Used:', output.modelUsed);
    console.log('Repaired Citations Count:', output.validation.repairedCount);
    console.log('Evidence Contradictions Detected:', output.validation.contradictions.length);
    console.log('Warnings:', output.validation.warnings);
    console.log('--- SAMPLE REPORT FROM LIVE GEMMA MODE ---');
    console.log(JSON.stringify(output.report, null, 2));
    console.log('==========================================================\n');

    // Citations are strictly validated in either mode
    const validEvidenceIds = new Set(output.report.evidence.map((e) => e.id));
    for (const finding of output.report.findings) {
      for (const id of finding.evidence_ids) {
        expect(validEvidenceIds.has(id)).toBe(true);
      }
    }
  }, 240000);
});
