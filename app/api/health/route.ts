import { NextResponse } from 'next/server';
import path from 'node:path';
import fs from 'node:fs';
import { checkOllamaHealth } from '@/model/ollama';
import { safeExec } from '@/git/safeExec';

export async function GET() {
  const ollamaHealth = await checkOllamaHealth();

  let gitAvailable = false;
  let gitVersion = 'unknown';

  try {
    const gitRes = await safeExec('git', ['--version'], { cwd: process.cwd() });
    if (gitRes.exitCode === 0) {
      gitAvailable = true;
      gitVersion = gitRes.stdout.trim();
    }
  } catch {
    gitAvailable = false;
  }

  const fixtureRepoPath = path.resolve(process.cwd(), 'tests/fixtures/known-workaround-repo');
  const fixtureExists = fs.existsSync(path.join(fixtureRepoPath, '.git'));

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    git: {
      available: gitAvailable,
      version: gitVersion,
    },
    ollama: {
      running: ollamaHealth.running,
      models: ollamaHealth.models,
      targetModel: process.env.OLLAMA_MODEL || 'gemma2:2b',
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      error: ollamaHealth.error,
    },
    fixtureRepo: {
      exists: fixtureExists,
      path: fixtureRepoPath,
    },
    env: {
      maxDiffChars: parseInt(process.env.GHOSTTRACE_MAX_DIFF_CHARS || '12000', 10),
      maxEvidenceItems: parseInt(process.env.GHOSTTRACE_MAX_EVIDENCE_ITEMS || '20', 10),
      localOnly: process.env.GHOSTTRACE_LOCAL_ONLY === 'true',
    },
  });
}
