'use client';

import React from 'react';
import { Terminal, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { InvestigationProgressEvent } from '@/agent/investigator';

interface ProgressProps {
  events: InvestigationProgressEvent[];
  isLoading: boolean;
  error?: string | null;
}

export function Progress({ events, isLoading, error }: ProgressProps) {
  if (events.length === 0 && !isLoading && !error) return null;

  return (
    <div className="p-4 rounded-xl bg-ghost-bg border border-ghost-border space-y-3">
      <div className="flex items-center justify-between border-b border-ghost-border pb-2">
        <span className="text-xs font-semibold text-ghost-green flex items-center gap-2">
          <Terminal className="w-4 h-4 text-ghost-green animate-pulse" />
          Live Investigation Telemetry
        </span>
        {isLoading && (
          <span className="text-[11px] text-ghost-cyan animate-pulse font-mono">
            Orchestrating Mastra Tools...
          </span>
        )}
      </div>

      <div className="space-y-1.5 font-mono text-xs max-h-48 overflow-y-auto pr-1">
        {events.map((ev, idx) => {
          const isLatest = idx === events.length - 1 && isLoading;
          return (
            <div
              key={idx}
              className={`flex items-start gap-2 py-0.5 ${
                isLatest ? 'text-ghost-cyan font-bold' : 'text-gray-400'
              }`}
            >
              <span className="text-ghost-muted text-[10px] shrink-0">
                {ev.timestamp.slice(11, 19)}
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] bg-ghost-surface border border-ghost-border text-ghost-green shrink-0">
                {ev.stage}
              </span>
              <span className="truncate flex-1">{ev.detail}</span>
              {isLatest ? (
                <Clock className="w-3.5 h-3.5 text-ghost-cyan animate-spin shrink-0" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-ghost-greenDim shrink-0" />
              )}
            </div>
          );
        })}

        {error && (
          <div className="flex items-start gap-2 py-1 text-red-400 bg-red-950/30 p-2 rounded border border-red-500/30 mt-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
