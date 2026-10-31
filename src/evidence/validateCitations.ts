import { EvidenceItem, Finding, Hypothesis, GhostTraceReport } from '../model/schemas';

export interface ValidationResult {
  validatedReport: GhostTraceReport;
  repairedCount: number;
  warnings: string[];
  contradictions: string[];
}

export interface EvidenceContradiction {
  itemAId: string;
  itemBId: string;
  reason: string;
}

/**
 * Detects contradictions between evidence items, such as conflicting attribution
 * for overlapping line ranges in the same file, or differing commit dates.
 */
export function detectEvidenceContradictions(evidencePack: EvidenceItem[]): EvidenceContradiction[] {
  const contradictions: EvidenceContradiction[] = [];

  for (let i = 0; i < evidencePack.length; i++) {
    for (let j = i + 1; j < evidencePack.length; j++) {
      const a = evidencePack[i];
      const b = evidencePack[j];

      // 1. Same commit SHA with conflicting dates
      if (a.commit_sha && b.commit_sha && a.commit_sha === b.commit_sha) {
        if (a.date && b.date && a.date !== b.date) {
          contradictions.push({
            itemAId: a.id,
            itemBId: b.id,
            reason: `Commit ${a.commit_sha.slice(0, 7)} has conflicting dates between ${a.id} (${a.date}) and ${b.id} (${b.date}).`,
          });
        }
      }

      // 2. Overlapping line ranges in the same file with conflicting commit attribution
      if (
        a.file_path &&
        b.file_path &&
        a.file_path === b.file_path &&
        a.line_start !== null &&
        a.line_start !== undefined &&
        a.line_end !== null &&
        a.line_end !== undefined &&
        b.line_start !== null &&
        b.line_start !== undefined &&
        b.line_end !== null &&
        b.line_end !== undefined
      ) {
        const overlap = Math.max(a.line_start, b.line_start) <= Math.min(a.line_end, b.line_end);
        if (overlap) {
          if (a.commit_sha && b.commit_sha && a.commit_sha !== b.commit_sha) {
            contradictions.push({
              itemAId: a.id,
              itemBId: b.id,
              reason: `Contradictory attribution for ${a.file_path} lines ${Math.max(a.line_start, b.line_start)}-${Math.min(a.line_end, b.line_end)}: ${a.id} attributes to commit ${a.commit_sha.slice(0, 7)} (${a.date || 'unknown date'}) while ${b.id} attributes to commit ${b.commit_sha.slice(0, 7)} (${b.date || 'unknown date'}).`,
            });
          }
        }
      }
    }
  }

  return contradictions;
}

/**
 * Validates all citations in the generated report against the actual collected evidence pack.
 * If any claim references a non-existent evidence ID (hallucination), it is repaired:
 * - Filter out invalid IDs
 * - Demote unsupported claims to hypotheses or unknowns
 * - Check for evidence contradictions and prevent presenting contradictory claims as high confidence
 * - Enforce that speculative language remains in hypotheses rather than verified findings
 */
export function validateAndRepairCitations(
  rawReport: GhostTraceReport,
  evidencePack: EvidenceItem[]
): ValidationResult {
  const validIdSet = new Set(evidencePack.map((e) => e.id));
  const warnings: string[] = [];
  let repairedCount = 0;

  // Run evidence consistency & contradiction detection
  const contradictionList = detectEvidenceContradictions(evidencePack);
  const contradictionStrings = contradictionList.map((c) => c.reason);
  const contradictoryPairMap = new Map<string, Set<string>>();
  for (const c of contradictionList) {
    if (!contradictoryPairMap.has(c.itemAId)) contradictoryPairMap.set(c.itemAId, new Set());
    if (!contradictoryPairMap.has(c.itemBId)) contradictoryPairMap.set(c.itemBId, new Set());
    contradictoryPairMap.get(c.itemAId)!.add(c.itemBId);
    contradictoryPairMap.get(c.itemBId)!.add(c.itemAId);
    warnings.push(`Evidence contradiction detected: ${c.reason}`);
  }

  const validFindings: Finding[] = [];
  const additionalHypotheses: Hypothesis[] = [];
  const additionalUnknowns: string[] = [];

  // Regex for speculative language that must not be classified as verified findings
  const speculativeRegex = /\b(might|maybe|could|possibly|presumed|presumably|hypothesize|hypothesized|unknown whether|unverified|assumed|likely that|speculate)\b/i;

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

    if (filteredIds.length === 0) {
      // Demote unsupported claim to hypothesis
      repairedCount++;
      warnings.push(
        `Demoting unsupported claim to hypothesis: "${finding.claim.slice(0, 60)}..." (no verified evidence cited).`
      );
      additionalHypotheses.push({
        claim: finding.claim,
        why_plausible: 'Suggested during investigation but lacks direct evidence confirmation in the repository history.',
        evidence_ids: [],
      });
      continue;
    }

    // Check if finding cites conflicting/contradictory evidence items
    const hasContradictoryCitations = filteredIds.some((id1) =>
      filteredIds.some((id2) => contradictoryPairMap.get(id1)?.has(id2))
    );

    if (hasContradictoryCitations) {
      repairedCount++;
      warnings.push(
        `Demoting finding to hypothesis due to contradictory citations: "${finding.claim.slice(0, 60)}..."`
      );
      additionalHypotheses.push({
        claim: finding.claim,
        why_plausible: 'Cited evidence items contain conflicting attributions or historical records.',
        evidence_ids: filteredIds,
      });
      continue;
    }

    // Check for speculative wording in findings
    if (speculativeRegex.test(finding.claim)) {
      repairedCount++;
      warnings.push(
        `Demoting speculative claim to hypothesis: "${finding.claim.slice(0, 60)}..."`
      );
      additionalHypotheses.push({
        claim: finding.claim,
        why_plausible: 'Claim uses speculative phrasing; classified as hypothesis rather than verified finding.',
        evidence_ids: filteredIds,
      });
      continue;
    }

    // Validated factual finding
    validFindings.push({
      claim: finding.claim,
      confidence: finding.confidence,
      evidence_ids: filteredIds,
    });
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
  if (contradictionStrings.length > 0) {
    for (const c of contradictionStrings) {
      additionalUnknowns.push(`Unresolved evidence conflict: ${c}`);
    }
  }

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
      contradictions: contradictionStrings,
    },
    repairedCount,
    warnings,
    contradictions: contradictionStrings,
  };
}
