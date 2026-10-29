'use client';

import React from 'react';
import { FolderGit2, CheckCircle2, Sparkles, Folder } from 'lucide-react';

interface RepoPickerProps {
  repoPath: string;
  setRepoPath: (path: string) => void;
  fixturePath: string;
  disabled?: boolean;
}

export function RepoPicker({
  repoPath,
  setRepoPath,
  fixturePath,
  disabled = false,
}: RepoPickerProps) {
  const isFixture = repoPath.toLowerCase() === fixturePath.toLowerCase();

  return (
    <div className="p-4 rounded-xl bg-ghost-surface border border-ghost-border space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <label className="text-xs font-semibold tracking-wider text-ghost-green uppercase flex items-center gap-2">
          <FolderGit2 className="w-4 h-4 text-ghost-green" />
          Target Repository Path
        </label>
        {fixturePath && (
          <button
            type="button"
            onClick={() => setRepoPath(fixturePath)}
            disabled={disabled}
            className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-all ${
              isFixture
                ? 'bg-ghost-green/10 border-ghost-green text-ghost-green font-bold'
                : 'bg-ghost-bg hover:bg-ghost-border border-ghost-muted text-gray-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-ghost-green" />
            {isFixture ? 'Fixture Repo Loaded' : 'Load Built-In Fixture Repo'}
          </button>
        )}
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-ghost-muted">
          <Folder className="w-4 h-4" />
        </div>
        <input
          type="text"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          disabled={disabled}
          placeholder="e.g. C:\Users\name\Desktop\GhostTrace\tests\fixtures\known-workaround-repo"
          className="w-full pl-9 pr-24 py-2.5 bg-ghost-bg border border-ghost-border rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-ghost-green focus:ring-1 focus:ring-ghost-green font-mono transition-colors"
        />
        {isFixture && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-ghost-green text-xs font-medium gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Fixture</span>
          </div>
        )}
      </div>

      <p className="text-[11px] text-gray-400">
        Must be a local Git working tree. All commands execute strictly locally with read-only arguments.
      </p>
    </div>
  );
}
