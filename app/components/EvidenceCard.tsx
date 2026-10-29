'use client';

import React, { useState } from 'react';
import { GitCommit, FileDiff, UserCheck, Search, Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { EvidenceItem } from '@/model/schemas';

interface EvidenceCardProps {
  evidence: EvidenceItem;
  highlighted?: boolean;
}

export function EvidenceCard({ evidence, highlighted = false }: EvidenceCardProps) {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  const copySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getKindIcon = () => {
    switch (evidence.kind) {
      case 'commit':
        return <GitCommit className="w-4 h-4 text-ghost-cyan" />;
      case 'diff':
        return <FileDiff className="w-4 h-4 text-ghost-green" />;
      case 'blame':
        return <UserCheck className="w-4 h-4 text-ghost-amber" />;
      case 'source':
        return <Search className="w-4 h-4 text-purple-400" />;
    }
  };

  const getKindBadgeClass = () => {
    switch (evidence.kind) {
      case 'commit':
        return 'bg-cyan-950/50 text-ghost-cyan border-cyan-500/30';
      case 'diff':
        return 'bg-emerald-950/50 text-ghost-green border-emerald-500/30';
      case 'blame':
        return 'bg-amber-950/50 text-ghost-amber border-amber-500/30';
      case 'source':
        return 'bg-purple-950/50 text-purple-300 border-purple-500/30';
    }
  };

  return (
    <div
      id={`evidence-${evidence.id}`}
      className={`rounded-xl border transition-all ${
        highlighted
          ? 'bg-ghost-surface border-ghost-green ring-1 ring-ghost-green shadow-glowGreen'
          : 'bg-ghost-surface/80 border-ghost-border hover:border-ghost-muted'
      }`}
    >
      {/* Header */}
      <div className="p-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-ghost-border/70">
        <div className="flex items-center gap-2">
          {/* Evidence ID Badge */}
          <span className="px-2 py-0.5 rounded text-xs font-bold font-mono bg-ghost-bg text-ghost-green border border-ghost-green/40">
            {evidence.id}
          </span>

          {/* Kind Pill */}
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border flex items-center gap-1 ${getKindBadgeClass()}`}>
            {getKindIcon()}
            {evidence.kind.toUpperCase()}
          </span>

          {/* Tool tag */}
          <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
            via {evidence.source_tool}
          </span>
        </div>

        {/* SHA and Date */}
        <div className="flex items-center gap-2 text-xs font-mono">
          {evidence.date && <span className="text-gray-400">{evidence.date}</span>}

          {evidence.commit_sha && (
            <button
              onClick={() => copySha(evidence.commit_sha!)}
              title="Copy commit SHA"
              className="px-2 py-0.5 rounded bg-ghost-bg border border-ghost-border hover:border-ghost-cyan text-ghost-cyan text-[11px] flex items-center gap-1 transition-colors"
            >
              <span>{evidence.commit_sha.slice(0, 7)}</span>
              {copied ? <Check className="w-3 h-3 text-ghost-green" /> : <Copy className="w-3 h-3" />}
            </button>
          )}

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 rounded text-gray-400 hover:text-gray-200 hover:bg-ghost-bg"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Meta Bar */}
      {(evidence.subject || evidence.file_path) && (
        <div className="px-3.5 py-2 bg-ghost-bg/60 text-xs border-b border-ghost-border/50 flex flex-wrap items-center gap-3">
          {evidence.subject && (
            <span className="text-gray-200 font-medium">
              &ldquo;{evidence.subject}&rdquo;
            </span>
          )}
          {evidence.file_path && (
            <span className="text-ghost-cyan font-mono text-[11px] flex items-center gap-1">
              <span>{evidence.file_path}</span>
              {evidence.line_start !== null && evidence.line_end !== null && (
                <span className="text-gray-400">
                  (lines {evidence.line_start}-{evidence.line_end})
                </span>
              )}
            </span>
          )}
        </div>
      )}

      {/* Excerpt Body */}
      {isExpanded && (
        <div className="p-3 bg-black/60 font-mono text-xs overflow-x-auto max-h-72">
          <pre className="text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {evidence.excerpt.split('\n').map((line, idx) => {
              let lineStyle = 'text-gray-300';
              if (line.startsWith('+') && !line.startsWith('+++')) {
                lineStyle = 'text-emerald-400 bg-emerald-950/20';
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                lineStyle = 'text-red-400 bg-red-950/20';
              } else if (line.startsWith('@@')) {
                lineStyle = 'text-ghost-cyan bg-cyan-950/20';
              }
              return (
                <div key={idx} className={`${lineStyle} px-1 rounded-sm`}>
                  {line}
                </div>
              );
            })}
          </pre>
        </div>
      )}
    </div>
  );
}
