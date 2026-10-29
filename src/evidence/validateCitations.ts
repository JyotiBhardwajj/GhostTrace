import { EvidenceItem, Finding, Hypothesis, GhostTraceReport } from '../model/schemas';

export interface ValidationResult {
  validatedReport: GhostTraceReport;
  repairedCount: number;
  warnings: string[];
}

/**
 * Validates all citations in the generated report against the actual collected evidence pack.
 * If any claim references a non-existent evidence ID (hallucination), it is repaired:
 * - Filter out invalid IDs
 * - If a finding has zero remaining valid evidence IDs, it is demoted to a hypothesis or unknown
 * - Ensures confidence accurately reflects evidence support
 */
export function validateAndRepairCitations(
  rawReport: GhostTraceReport,
  evidencePack: EvidenceItem[]
): ValidationResult {
  const validIdSet = new Set(evidencePack.map((e) => e.id));
  const warnings: string[] = [];
  let repairedCount = 0;

  const validFindings: Finding[] = [];
  const additionalHypotheses: Hypothesis[] = [];
  const additionalUnknowns: string[] = [];

  // 1. Process Findings
  for (const finding of rawReport.findings || []) {
    const originalIds = finding.evidence_ids || [];
    const filteredIds = originalIds.filter((id) => validIdSet.has(id));

    if (filteredIds.length !== originalIds.length) {
      const dropped = originalIds.filter((id) => !validIdSet.has(id));
      warnings.push(
        `Finding "${finding.claim.slice(0, 50)}..." cited non-existent evidence IDs: [${dropped.join(', ')}].`
      );
      repairedCount++;
    }

    if (filteredIds.length > 0) {
      validFindings.push({
        claim: finding.claim,
        confidence: finding.confidence,
        evidence_ids: filteredIds,
      });
    } else {
      // Demote unsupported claim to hypothesis or unknown
      repairedCount++;
      warnings.push(
        `Demoting unsupported claim to hypothesis: "${finding.claim.slice(0, 60)}..." (no verified evidence cited).`
      );
      additionalHypotheses.push({
        claim: finding.claim,
        why_plausible: 'Suggested during investigation but lacks direct evidence confirmation in the repository history.',
        evidence_ids: [],
      });
    }
  }

  // 2. Process Hypotheses
  const validHypotheses: Hypothesis[] = [];
  for (const hyp of rawReport.hypotheses || []) {
    const originalIds = hyp.evidence_ids || [];
    const filteredIds = originalIds.filter((id) => validIdSet.has(id));
    if (filteredIds.length !== originalIds.length) {
      repairedCount++;
    }
    validHypotheses.push({
      claim: hyp.claim,
      why_plausible: hyp.why_plausible,
      evidence_ids: filteredIds,
    });
  }
  validHypotheses.push(...additionalHypotheses);

  // 3. Process Unknowns & Limitations
  const combinedUnknowns = Array.from(
    new Set([...(rawReport.unknowns || []), ...additionalUnknowns])
  );

  const finalLimitations = Array.from(
    new Set([
      ...(rawReport.limitations || []),
      'Analysis is strictly bounded by commits and source files retrieved from the local repository.',
      'Inference was performed locally; uncommitted changes or external issue tracker context outside Git may be absent.',
    ])
  );

  return {
    validatedReport: {
      question: rawReport.question,
      summary: rawReport.summary,
      findings: validFindings,
      evidence: evidencePack, // Always use the source-of-truth evidence pack
      hypotheses: validHypotheses,
      unknowns: combinedUnknowns,
      limitations: finalLimitations,
    },
    repairedCount,
    warnings,
  };
}
