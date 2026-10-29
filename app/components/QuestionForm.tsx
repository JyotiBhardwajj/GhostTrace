'use client';

import React from 'react';
import { HelpCircle, Search, Flame, FileCode } from 'lucide-react';

interface QuestionFormProps {
  question: string;
  setQuestion: (q: string) => void;
  focusFile: string;
  setFocusFile: (f: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
}

const PRESET_QUESTIONS = [
  'Why was this retry workaround added, and can I safely remove it?',
  'When did this behavior first appear, and what changed?',
  'Who last changed this line, and what does the commit message say?',
  'Can the available history establish why this branch exists? If not, what is missing?',
];

export function QuestionForm({
  question,
  setQuestion,
  focusFile,
  setFocusFile,
  onSubmit,
  isLoading,
}: QuestionFormProps) {
  return (
    <form onSubmit={onSubmit} className="p-4 rounded-xl bg-ghost-surface border border-ghost-border space-y-4">
      {/* Question Header & Preset Chips */}
      <div>
        <label className="text-xs font-semibold tracking-wider text-ghost-green uppercase flex items-center gap-2 mb-2">
          <HelpCircle className="w-4 h-4 text-ghost-green" />
          Historical Investigation Query
        </label>

        {/* Textarea */}
        <textarea
          rows={3}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={isLoading}
          placeholder="Ask why a workaround exists, what problem a commit solved, or when a behavior was introduced..."
          className="w-full p-3 bg-ghost-bg border border-ghost-border rounded-lg text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-ghost-green focus:ring-1 focus:ring-ghost-green font-mono transition-colors"
        />

        {/* Quick Suggestion Chips */}
        <div className="mt-2.5">
          <span className="text-[11px] text-gray-400 block mb-1.5 flex items-center gap-1">
            <Flame className="w-3 h-3 text-ghost-amber" />
            Suggested Demo Queries:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {PRESET_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isLoading}
                onClick={() => setQuestion(q)}
                className="text-[11px] px-2.5 py-1 rounded bg-ghost-bg hover:bg-ghost-border border border-ghost-border text-gray-300 hover:text-ghost-green transition-colors text-left"
              >
                &ldquo;{q}&rdquo;
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Focus File (Optional) and Submit Button */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-ghost-border/60">
        <div className="md:col-span-2">
          <label className="text-xs text-gray-400 flex items-center gap-1 mb-1">
            <FileCode className="w-3.5 h-3.5 text-ghost-muted" />
            Focus Relative File (Optional)
          </label>
          <input
            type="text"
            value={focusFile}
            onChange={(e) => setFocusFile(e.target.value)}
            disabled={isLoading}
            placeholder="e.g. src/paymentClient.ts"
            className="w-full px-3 py-2 bg-ghost-bg border border-ghost-border rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none focus:border-ghost-green font-mono"
          />
        </div>

        <div className="flex items-end">
          <button
            type="submit"
            disabled={isLoading || !question.trim()}
            className="w-full py-2.5 px-4 bg-ghost-green hover:bg-ghost-green/90 text-black font-bold text-xs uppercase tracking-wider rounded-lg shadow-glowGreen transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Search className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            {isLoading ? 'Investigating...' : 'Summon Investigation'}
          </button>
        </div>
      </div>
    </form>
  );
}
