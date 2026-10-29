'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { RepoPicker } from './components/RepoPicker';
import { QuestionForm } from './components/QuestionForm';
import { Progress } from './components/Progress';
import { ReportView } from './components/ReportView';
import { GhostTraceReport } from '@/model/schemas';
import { InvestigationProgressEvent } from '@/agent/investigator';
import { Ghost, ShieldCheck, Terminal, AlertCircle, RefreshCw } from 'lucide-react';

export default function Home() {
  const [repoPath, setRepoPath] = useState('');
  const [fixturePath, setFixturePath] = useState('');
  const [question, setQuestion] = useState(
    'Why was this retry workaround added, and can I safely remove it?'
  );
  const [focusFile, setFocusFile] = useState('src/paymentClient.ts');

  const [isLoading, setIsLoading] = useState(false);
  const [progressEvents, setProgressEvents] = useState<InvestigationProgressEvent[]>([]);
  const [report, setReport] = useState<GhostTraceReport | null>(null);
  const [modelUsed, setModelUsed] = useState('gemma2:2b');
  const [inferenceMode, setInferenceMode] = useState<string>('local');
  const [error, setError] = useState<string | null>(null);

  // Health check state
  const [isOllamaRunning, setIsOllamaRunning] = useState(false);
  const [detectedModel, setDetectedModel] = useState('gemma2:2b');

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        setIsOllamaRunning(data.ollama?.running ?? false);
        setDetectedModel(data.ollama?.targetModel || 'gemma2:2b');
        if (data.fixtureRepo?.path) {
          setFixturePath(data.fixtureRepo.path);
          if (!repoPath) {
            setRepoPath(data.fixtureRepo.path);
          }
        }
      }
    } catch {
      // Non-fatal
    }
  }, [repoPath]);

  useEffect(() => {
    checkHealth();
  }, [checkHealth]);

  const handleInvestigate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoPath.trim() || !question.trim()) return;

    setIsLoading(true);
    setError(null);
    setReport(null);
    setProgressEvents([
      {
        stage: 'INIT',
        detail: `Starting GhostTrace investigation on "${repoPath}"...`,
        timestamp: new Date().toISOString(),
      },
    ]);

    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoPath: repoPath.trim(),
          question: question.trim(),
          focusFile: focusFile.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete investigation');
      }

      setReport(data.report);
      setModelUsed(data.modelUsed || detectedModel);
      setInferenceMode(data.inferenceMode || 'local');
      if (data.events && Array.isArray(data.events)) {
        setProgressEvents(data.events);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setProgressEvents((prev) => [
        ...prev,
        {
          stage: 'ERROR',
          detail: msg,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-ghost-bg text-gray-200 scanlines flex flex-col">
      <Header modelName={detectedModel} isOllamaRunning={isOllamaRunning} />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {/* Intro banner */}
        <div className="p-4 rounded-xl bg-ghost-surface/60 border border-ghost-border flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Ghost className="w-5 h-5 text-ghost-green shrink-0 mt-0.5" />
            <div className="text-xs text-gray-300 space-y-1">
              <p className="font-semibold text-ghost-green">
                Old code has ghosts: workarounds, strange fixes, and branches whose original context disappeared.
              </p>
              <p className="text-gray-400">
                GhostTrace combines deterministic Git history tools with an open-weight Gemma model to reconstruct why code exists, separating supported findings from hypotheses and unknowns.
              </p>
            </div>
          </div>

          <button
            onClick={checkHealth}
            title="Refresh local environment status"
            className="p-2 rounded-lg bg-ghost-bg border border-ghost-border hover:border-ghost-green text-gray-400 hover:text-ghost-green text-xs flex items-center gap-1.5 self-end md:self-auto transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Audit Status</span>
          </button>
        </div>

        {/* Input Controls */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <RepoPicker
            repoPath={repoPath}
            setRepoPath={setRepoPath}
            fixturePath={fixturePath}
            disabled={isLoading}
          />

          <QuestionForm
            question={question}
            setQuestion={setQuestion}
            focusFile={focusFile}
            setFocusFile={setFocusFile}
            onSubmit={handleInvestigate}
            isLoading={isLoading}
          />
        </div>

        {/* Live Progress Telemetry */}
        <Progress events={progressEvents} isLoading={isLoading} error={error} />

        {/* Investigation Report */}
        {report && (
          <ReportView
            report={report}
            modelUsed={modelUsed}
            inferenceMode={inferenceMode}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-ghost-border py-4 px-6 text-center text-xs text-gray-500 font-mono">
        <p>
          GhostTrace &bull; DEV Community &quot;Ghost in the Machine&quot; Challenge &bull; Built with Next.js, Mastra, Ollama &amp; Gemma
        </p>
      </footer>
    </div>
  );
}
