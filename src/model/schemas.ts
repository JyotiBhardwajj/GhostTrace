import { z } from 'zod';

export const EvidenceKindSchema = z.enum(['commit', 'diff', 'blame', 'source']);
export type EvidenceKind = z.infer<typeof EvidenceKindSchema>;

export const EvidenceItemSchema = z.object({
  id: z.string(), // E1, E2, ...
  kind: EvidenceKindSchema,
  commit_sha: z.string().nullable().optional(),
  author: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  file_path: z.string().nullable().optional(),
  line_start: z.number().int().nullable().optional(),
  line_end: z.number().int().nullable().optional(),
  excerpt: z.string(),
  source_tool: z.string(),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

export const FindingSchema = z.object({
  claim: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  evidence_ids: z.array(z.string()),
});
export type Finding = z.infer<typeof FindingSchema>;

export const HypothesisSchema = z.object({
  claim: z.string(),
  why_plausible: z.string(),
  evidence_ids: z.array(z.string()).default([]),
});
export type Hypothesis = z.infer<typeof HypothesisSchema>;

export const GhostTraceReportSchema = z.object({
  question: z.string(),
  summary: z.string(),
  findings: z.array(FindingSchema).default([]),
  evidence: z.array(EvidenceItemSchema).default([]),
  hypotheses: z.array(HypothesisSchema).default([]),
  unknowns: z.array(z.string()).default([]),
  limitations: z.array(z.string()).default([]),
  contradictions: z.array(z.string()).optional(),
});
export type GhostTraceReport = z.infer<typeof GhostTraceReportSchema>;

export const InvestigateRequestSchema = z.object({
  repoPath: z.string().min(1, 'Repository path is required'),
  question: z.string().min(1, 'Question is required'),
  focusFile: z.string().optional(),
  model: z.string().optional(),
});
export type InvestigateRequest = z.infer<typeof InvestigateRequestSchema>;
