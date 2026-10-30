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
    // Explicitly contains removal guidance
    expect(report.summary.toLowerCase()).toContain('not recommended');

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

    // Check that the evidence pack found the workaround commit
    const workaroundEvidence = report.evidence.find(
      (e) =>
        (e.subject && e.subject.toLowerCase().includes('retry workaround')) ||
        (e.excerpt && e.excerpt.toLowerCase().includes('max_retries'))
    );
    expect(workaroundEvidence).toBeDefined();
    expect(workaroundEvidence?.commit_sha).toBeDefined();

    // Check hypotheses and unknowns
    expect(report.hypotheses.length).toBeGreaterThan(0);
    expect(report.unknowns.length).toBeGreaterThan(0);
    expect(report.limitations.length).toBeGreaterThan(0);

    // Check progress events
    expect(output.events.length).toBeGreaterThanOrEqual(5);
    const stageNames = output.events.map((e) => e.stage);
    expect(stageNames).toContain('VALIDATE_REPO');
    expect(stageNames).toContain('SEARCH_HISTORY');
    expect(stageNames).toContain('COMPLETE');
  });

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

    // Citations are strictly validated in either mode
    const validEvidenceIds = new Set(output.report.evidence.map((e) => e.id));
    for (const finding of output.report.findings) {
      for (const id of finding.evidence_ids) {
        expect(validEvidenceIds.has(id)).toBe(true);
      }
    }
  }, 120000);
});
