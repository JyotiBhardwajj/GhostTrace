'use client';

import React from 'react';
import { Ghost, ShieldCheck, Cpu, Terminal, Sparkles } from 'lucide-react';

interface HeaderProps {
  modelName?: string;
  isOllamaRunning?: boolean;
}

export function Header({ modelName = 'gemma2:2b', isOllamaRunning = false }: HeaderProps) {
  return (
    <header className="border-b border-ghost-border bg-ghost-surface/80 backdrop-blur sticky top-0 z-30 px-4 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Logo and title */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-ghost-bg border border-ghost-green/40 text-ghost-green shadow-glowGreen">
            <Ghost className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-wider text-ghost-green glow-text-green flex items-center gap-2">
                GHOSTTRACE
                <span className="text-xs px-2 py-0.5 rounded bg-ghost-green/10 text-ghost-green border border-ghost-green/30 font-mono">
                  v0.1-alpha
                </span>
              </h1>
            </div>
            <p className="text-xs text-gray-400">
              The Haunted Open-Source Codebase Investigator &bull; Git Archaeology via Local Gemma &amp; Mastra
            </p>
          </div>
        </div>

        {/* Runtime Badges */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Local Mode Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/40 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-semibold">Local-First</span>
            <span className="text-[10px] text-emerald-500/80">(No Code Upload)</span>
          </div>

          {/* Model Status Badge */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border ${
            isOllamaRunning
              ? 'bg-ghost-bg border-ghost-cyan/40 text-ghost-cyan shadow-glowCyan'
              : 'bg-ghost-bg border-ghost-amber/40 text-ghost-amber'
          }`}>
            <Cpu className="w-3.5 h-3.5" />
            <span>Model: <span className="font-bold">{modelName}</span></span>
            <span className={`w-2 h-2 rounded-full ${isOllamaRunning ? 'bg-ghost-cyan animate-ping' : 'bg-ghost-amber'}`} />
          </div>

          {/* Mastra Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-purple-950/50 border border-purple-500/30 text-purple-300">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Mastra Agent</span>
          </div>
        </div>
      </div>
    </header>
  );
}
