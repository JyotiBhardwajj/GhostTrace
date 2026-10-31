'use client';

import React, { useState } from 'react';
import {
  FileText,
  CheckCircle,
  HelpCircle,
  AlertTriangle,
  Info,
  Copy,
  Check,
  ExternalLink,
  Flame,
  Layers,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';
import { GhostTraceReport } from '@/model/schemas';
import { EvidenceCard } from './EvidenceCard';

interface ReportViewProps {
  report: GhostTraceReport;
  modelUsed?: string;
  inferenceMode?: string;
}

export function ReportView({ report, modelUsed, inferenceMode }: ReportViewProps) {
  const [copiedMd, setCopiedMd] = useState(false);
  const [activeEvidenceId, setActiveEvidenceId] = useState<string | null>(null);

  const isLiveGemma = inferenceMode === 'ollama-local';

  const scrollToEvidence = (id: string) => {
    setActiveEvidenceId(id);
    const element = document.getElementById(`evidence-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const getConfidenceBadge = (confidence: 'high' | 'medium' | 'low') => {
    switch (confidence) {
      case 'high':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40">
            HIGH CONFIDENCE
          </span>
        );
      case 'medium':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/80 text-amber-400 border border-amber-500/40">
            MEDIUM CONFIDENCE
          </span>
        );
      case 'low':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-600">
            LOW CONFIDENCE
          </span>
        );
    }
  };

  const exportAsMarkdown = () => {
    const md = `# GhostTrace Investigation Report

**Question**: ${report.question}
**Synthesized By**: ${
      isLiveGemma
        ? `Local Gemma 2 (${modelUsed || 'gemma2:2b'}) via Ollama`
        : 'Grounded Deterministic Fallback Engine (Offline Mode)'
    }
**Generated At**: ${new Date().toISOString()}

> **Fixture Ground Truth Notice**: If analyzing the built-in fixture repository, incident IDs (e.g. INC-882) and commits are synthetic test fixtures designed to provide reproducible, verifiable ground truth.

## Executive Summary
${report.summary}

## Verified Findings
${report.findings
  .map(
    (f, idx) =>
      `${idx + 1}. **${f.claim}** [${f.confidence.toUpperCase()}]\n   *Citations: ${f.evidence_ids.join(', ')}*`
  )
  .join('\n\n')}

## Plausible Hypotheses & Removal Guidance
${report.hypotheses
  .map(
    (h, idx) =>
      `${idx + 1}. **${h.claim}**\n   *Why Plausible*: ${h.why_plausible}${
        h.evidence_ids.length > 0 ? `\n   *Related Evidence*: ${h.evidence_ids.join(', ')}` : ''
      }`
  )
  .join('\n\n')}

## Historical Unknowns
${report.unknowns.map((u) => `- ${u}`).join('\n')}

## Investigation Limitations
${report.limitations.map((l) => `- ${l}`).join('\n')}

---
*Generated locally by GhostTrace - The Haunted Open-Source Codebase Investigator*
`;

    navigator.clipboard.writeText(md);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Bar with Question, Inference Mode Badge, & Copy Button */}
      <div className="p-4 rounded-xl bg-ghost-surface border border-ghost-border flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-ghost-muted uppercase tracking-wider font-semibold">
              Investigation Target
            </span>
            {isLiveGemma ? (
              <span className="px-2 py-0.5 rounded bg-purple-950/80 border border-purple-500/40 text-purple-300 font-mono text-[10px] flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-purple-400" />
                Live Model: Local Gemma 2 ({modelUsed})
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-mono text-[10px] flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3 h-3 text-amber-400" />
                Offline Mode: Grounded Deterministic Fallback
              </span>
            )}
          </div>
          <h2 className="text-base font-bold text-gray-100">&ldquo;{report.question}&rdquo;</h2>
        </div>

        <button
          onClick={exportAsMarkdown}
          className="px-3.5 py-2 rounded-lg bg-ghost-bg hover:bg-ghost-border border border-ghost-border text-xs text-ghost-green flex items-center gap-2 transition-all self-start md:self-auto cursor-pointer"
        >
          {copiedMd ? <Check className="w-3.5 h-3.5 text-ghost-green" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copiedMd ? 'Copied Markdown!' : 'Copy Report as Markdown'}</span>
        </button>
      </div>

      {/* Disclosures & Synthetic Fixture Notice */}
      {!isLiveGemma && (
        <div className="p-3.5 rounded-lg bg-amber-950/30 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p>
            <strong className="text-amber-300">Offline Fallback Disclosure:</strong> Local Ollama was not active or Gemma weights were not loaded. This report was synthesized using GhostTrace&apos;s grounded deterministic engine directly from collected Git evidence without invoking a remote or fake model.
          </p>
        </div>
      )}

      {/* Contradictions Detected Alert */}
      {report.contradictions && report.contradictions.length > 0 && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/50 space-y-2 text-xs text-red-200">
          <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-xs">
            <ShieldAlert className="w-4 h-4 text-red-400" />
            Evidence Contradictions Detected ({report.contradictions.length})
          </div>
          <ul className="list-disc list-inside space-y-1 text-gray-200 font-mono text-[11px]">
            {report.contradictions.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Executive Summary */}
      <div className="p-5 rounded-xl bg-ghost-surface border border-ghost-green/40 shadow-glowGreen relative overflow-hidden">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-5 h-5 text-ghost-green" />
          <h3 className="text-sm font-bold tracking-wider text-ghost-green uppercase">
            Executive Summary
          </h3>
        </div>
        <p className="text-sm text-gray-200 leading-relaxed font-sans font-medium">
          {report.summary}
        </p>
      </div>

      {/* Grid: Findings & Hypotheses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Verified Findings */}
        <div className="p-5 rounded-xl bg-ghost-surface border border-ghost-border space-y-4">
          <div className="flex items-center justify-between border-b border-ghost-border pb-2.5">
            <h3 className="text-xs font-bold tracking-wider text-ghost-green uppercase flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-ghost-green" />
              Verified Findings ({report.findings.length})
            </h3>
            <span className="text-[11px] text-gray-400">Directly backed by Git</span>
          </div>

          <div className="space-y-3">
            {report.findings.map((f, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-ghost-bg border border-ghost-border/80 space-y-2 hover:border-ghost-green/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs text-gray-100 font-medium leading-relaxed">
                    {f.claim}
                  </p>
                  {getConfidenceBadge(f.confidence)}
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[10px] text-gray-400 font-mono">Citations:</span>
                  {f.evidence_ids.map((id) => (
                    <button
                      key={id}
                      onClick={() => scrollToEvidence(id)}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-ghost-surface border border-ghost-green/40 text-ghost-green hover:bg-ghost-green hover:text-black transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>{id}</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hypotheses & Removal Guidance */}
        <div className="p-5 rounded-xl bg-ghost-surface border border-ghost-border space-y-4">
          <div className="flex items-center justify-between border-b border-ghost-border pb-2.5">
            <h3 className="text-xs font-bold tracking-wider text-ghost-amber uppercase flex items-center gap-2">
              <Flame className="w-4 h-4 text-ghost-amber" />
              Plausible Hypotheses &amp; Guidance ({report.hypotheses.length})
            </h3>
            <span className="text-[11px] text-gray-400">Contextual Inferences</span>
          </div>

          <div className="space-y-3">
            {report.hypotheses.map((h, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-ghost-bg border border-ghost-border/80 space-y-2 hover:border-ghost-amber/40 transition-colors"
              >
                <p className="text-xs text-gray-100 font-medium leading-relaxed">
                  {h.claim}
                </p>
                <div className="p-2 rounded bg-ghost-surface/80 text-[11px] text-amber-300/90 border-l-2 border-ghost-amber">
                  <span className="font-semibold block text-[10px] text-gray-400 uppercase">
                    Why Plausible:
                  </span>
                  {h.why_plausible}
                </div>
                {h.evidence_ids.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] text-gray-400 font-mono">Associated Evidence:</span>
                    {h.evidence_ids.map((id) => (
                      <button
                        key={id}
                        onClick={() => scrollToEvidence(id)}
                        className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-ghost-surface border border-ghost-amber/40 text-ghost-amber hover:bg-ghost-amber hover:text-black transition-colors cursor-pointer"
                      >
                        {id}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grid: Unknowns & Limitations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Unknowns */}
        <div className="p-4 rounded-xl bg-ghost-surface border border-ghost-border space-y-2.5">
          <h4 className="text-xs font-bold tracking-wider text-gray-300 uppercase flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-ghost-cyan" />
            Historical Unknowns
          </h4>
          <ul className="space-y-1.5 text-xs text-gray-400">
            {report.unknowns.map((u, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-ghost-cyan">&bull;</span>
                <span>{u}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Limitations */}
        <div className="p-4 rounded-xl bg-ghost-surface border border-ghost-border space-y-2.5">
          <h4 className="text-xs font-bold tracking-wider text-gray-300 uppercase flex items-center gap-2">
            <Info className="w-4 h-4 text-ghost-muted" />
            Investigation Limitations
          </h4>
          <ul className="space-y-1.5 text-xs text-gray-400">
            {report.limitations.map((l, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="text-ghost-muted">&bull;</span>
                <span>{l}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Collected Evidence Cards Pack */}
      <div className="p-5 rounded-xl bg-ghost-surface border border-ghost-border space-y-4">
        <div className="flex items-center justify-between border-b border-ghost-border pb-2.5">
          <h3 className="text-xs font-bold tracking-wider text-ghost-green uppercase flex items-center gap-2">
            <Layers className="w-4 h-4 text-ghost-green" />
            Retrieved Evidence Pack ({report.evidence.length} Items)
          </h3>
          <span className="text-[11px] text-gray-400">Every excerpt has deterministic provenance</span>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {report.evidence.map((ev) => (
            <EvidenceCard
              key={ev.id}
              evidence={ev}
              highlighted={activeEvidenceId === ev.id}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
