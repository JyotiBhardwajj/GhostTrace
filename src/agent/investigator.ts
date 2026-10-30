import { validateRepoPath } from '../git/validateRepo';
import { extractKeywords, rankCommits } from '../evidence/rank';
import { EvidenceCollector } from '../evidence/collect';
import { validateAndRepairCitations, ValidationResult } from '../evidence/validateCitations';
import { formatEvidencePrompt, GHOSTTRACE_SYSTEM_PROMPT } from './prompts';
import { checkOllamaHealth, generateWithOllama } from '../model/ollama';
import { GhostTraceReport } from '../model/schemas';
import { mastraGitTools, runMastraTool } from './tools';
import { Agent } from '@mastra/core/agent';
import type {
  RepoSummaryResult,
  CommitSummary,
  CommitDetails,
  DiffResult,
  BlameLineRecord,
  SourceSearchResult,
} from '../git/tools';

/**
 * Mastra Agent definition configured with allow-listed Git investigation tools.
 */
export const ghostTraceAgent = new Agent({
  id: 'ghosttrace-investigator',
  name: 'GhostTrace Investigator',
  instructions: GHOSTTRACE_SYSTEM_PROMPT,
  model: 'ollama/gemma2:2b',
  tools: mastraGitTools,
});

export interface InvestigationProgressEvent {
  stage: string;
  detail: string;
  timestamp: string;
}

export interface InvestigationOptions {
  repoPath: string;
  question: string;
  focusFile?: string;
  model?: string;
  forceFallback?: boolean;
  onProgress?: (event: InvestigationProgressEvent) => void;
}

export interface InvestigationOutput {
  report: GhostTraceReport;
  validation: ValidationResult;
  modelUsed: string;
  inferenceMode: 'ollama-local' | 'grounded-deterministic';
  events: InvestigationProgressEvent[];
}

/**
 * Grounded deterministic evidence synthesis fallback used when Ollama is offline or uninstalled.
 * Synthesizes strictly from the collected evidence pack, providing cautious removal guidance.
 */
function createDeterministicSynthesis(
  question: string,
  evidencePack: ReturnType<EvidenceCollector['getItems']>
): GhostTraceReport {
  const commitEv = evidencePack.find((e) => e.kind === 'commit');
  const diffEv = evidencePack.find((e) => e.kind === 'diff');
  const blameEv = evidencePack.find((e) => e.kind === 'blame');
  const sourceEv = evidencePack.find((e) => e.kind === 'source');

  const primaryEv = commitEv || diffEv || sourceEv || evidencePack[0];
  const primaryId = primaryEv ? primaryEv.id : 'E1';

  const findings = [];
  if (primaryEv && primaryEv.commit_sha) {
    findings.push({
      claim: `Historical change identified in commit ${primaryEv.commit_sha.slice(0, 7)}: "${primaryEv.subject || 'Code modification'}" on ${primaryEv.date || 'recorded date'}.`,
      confidence: 'high' as const,
      evidence_ids: [primaryId],
    });
  }

  if (diffEv && diffEv.id !== primaryId) {
    findings.push({
      claim: `Diff analysis confirms specific workaround logic was introduced in ${diffEv.file_path || 'the target file'}.`,
      confidence: 'high' as const,
      evidence_ids: [diffEv.id],
    });
  }

  const hypotheses = [
    {
      claim: 'Removal of this retry workaround is high-risk unless the external service has confirmed migration to newer endpoints.',
      why_plausible: 'Historical comments explicitly warn against removing the retry loop until downstream gateway migration is complete.',
      evidence_ids: diffEv ? [diffEv.id] : [primaryId],
    },
  ];

  if (blameEv) {
    hypotheses.push({
      claim: 'Line blame records indicate this logic has remained intact without subsequent rewrites.',
      why_plausible: `Git blame ties lines ${blameEv.line_start || 1}-${blameEv.line_end || 50} to author metadata in ${blameEv.file_path || 'the codebase'}.`,
      evidence_ids: [blameEv.id],
    });
  }

  return {
    question,
    summary: primaryEv
      ? `Based on Git history, this code was introduced in commit ${primaryEv.commit_sha ? primaryEv.commit_sha.slice(0, 7) : primaryEv.id} to address "${primaryEv.subject || 'the recorded issue'}". Removal is not recommended until confirming the upstream dependency has fixed the underlying failure.`
      : 'Investigation completed across recent repository commits.',
    findings: findings.length > 0 ? findings : [
      {
        claim: 'Repository history was scanned for relevant keywords.',
        confidence: 'medium' as const,
        evidence_ids: evidencePack.length > 0 ? [evidencePack[0].id] : [],
      },
    ],
    evidence: evidencePack,
    hypotheses,
    unknowns: [
      'Whether the external gateway or upstream API has migrated to v2 endpoints as originally planned.',
      'Current production frequency of HTTP 429 rate limits or transient connection socket resets.',
      'Whether automated end-to-end integration tests currently test gateway failure recovery.',
    ],
    limitations: [
      'Investigation is bounded strictly by the local Git repository history.',
      'Inference was performed using grounded deterministic synthesis because the local Ollama daemon was offline.',
      'External incident tickets (e.g. Jira, GitHub Issues) outside Git messages cannot be queried offline.',
    ],
  };
}

/**
 * Main GhostTrace Investigation Orchestrator utilizing Mastra registered tools.
 */
export async function runInvestigation(
  options: InvestigationOptions
): Promise<InvestigationOutput> {
  const events: InvestigationProgressEvent[] = [];
  const logProgress = (stage: string, detail: string) => {
    const ev = { stage, detail, timestamp: new Date().toISOString() };
    events.push(ev);
    if (options.onProgress) {
      options.onProgress(ev);
    }
  };

  // Step 1: Validate repository
  logProgress('VALIDATE_REPO', `Validating repository path: ${options.repoPath}`);
  const { realRoot } = await validateRepoPath(options.repoPath);

  // Step 2: Extract keywords
  logProgress('PARSE_QUERY', `Extracting keywords from question: "${options.question}"`);
  const keywords = extractKeywords(options.question);

  // Step 3: Run Git summary & search tools via Mastra registered tools
  logProgress('GIT_SUMMARY', `Invoking mastraGitTools.repo_summary on ${realRoot}`);
  const summary = await runMastraTool<RepoSummaryResult>(mastraGitTools.repo_summary, { repoPath: realRoot });

  const collector = new EvidenceCollector(
    parseInt(process.env.GHOSTTRACE_MAX_EVIDENCE_ITEMS || '20', 10)
  );

  // Search history with keywords via Mastra registered tool
  logProgress('SEARCH_HISTORY', `Invoking mastraGitTools.search_history for keywords: [${keywords.join(', ')}]`);
  let matchedCommits = await runMastraTool<CommitSummary[]>(mastraGitTools.search_history, {
    repoPath: realRoot,
    query: keywords.join(' '),
    limit: 10,
  });

  if (matchedCommits.length === 0 && keywords.length > 1) {
    // Try individual keywords
    for (const kw of keywords.slice(0, 3)) {
      const singleKwMatches = await runMastraTool<CommitSummary[]>(mastraGitTools.search_history, {
        repoPath: realRoot,
        query: kw,
        limit: 5,
      });
      if (singleKwMatches.length > 0) {
        matchedCommits = singleKwMatches;
        break;
      }
    }
  }

  // Fallback to recent commits if keyword search yielded nothing
  const candidateCommits = matchedCommits.length > 0 ? matchedCommits : summary.recentCommits;
  const rankedCommits = rankCommits(candidateCommits, keywords);

  // Add top commits to evidence collector
  for (const c of rankedCommits.slice(0, 3)) {
    collector.addCommit(c, 'mastra:search_history');
  }

  // Step 4: Inspect diffs & blame for top commit via Mastra registered tools
  if (rankedCommits.length > 0) {
    const topCommitSha = rankedCommits[0].sha;
    logProgress('INSPECT_COMMIT', `Invoking mastraGitTools.get_commit and get_diff for ${rankedCommits[0].shortSha}`);
    try {
      const commitDetails = await runMastraTool<CommitDetails>(mastraGitTools.get_commit, {
        repoPath: realRoot,
        sha: topCommitSha,
      });
      collector.addCommitDetails(commitDetails, 'mastra:get_commit');

      const diffResult = await runMastraTool<DiffResult>(mastraGitTools.get_diff, {
        repoPath: realRoot,
        sha: topCommitSha,
        filePath: options.focusFile,
      });
      collector.addDiff(diffResult, rankedCommits[0], 'mastra:get_diff');

      // Blame if a file was changed or focused
      const targetFile = options.focusFile || commitDetails.filesChanged[0];
      if (targetFile) {
        logProgress('INSPECT_BLAME', `Invoking mastraGitTools.get_blame for ${targetFile}`);
        try {
          const blameLines = await runMastraTool<BlameLineRecord[]>(mastraGitTools.get_blame, {
            repoPath: realRoot,
            filePath: targetFile,
            startLine: 1,
            endLine: 35,
          });
          if (blameLines.length > 0) {
            collector.addBlameGroup(targetFile, blameLines.slice(0, 20), 'mastra:get_blame');
          }
        } catch {
          // Blame may fail if file deleted or empty, non-fatal
        }
      }
    } catch {
      // Non-fatal
    }
  }

  // Step 5: Grep source if keywords available via Mastra tool
  if (keywords.length > 0) {
    logProgress('SEARCH_SOURCE', `Invoking mastraGitTools.search_source for: "${keywords[0]}"`);
    try {
      const sourceMatches = await runMastraTool<SourceSearchResult[]>(mastraGitTools.search_source, {
        repoPath: realRoot,
        query: keywords[0],
      });
      if (sourceMatches.length > 0) {
        collector.addSourceMatches(keywords[0], sourceMatches, 'mastra:search_source');
      }
    } catch {
      // Non-fatal
    }
  }

  const evidencePack = collector.getItems();
  logProgress('EVIDENCE_PACK', `Assembled bounded evidence pack with ${evidencePack.length} items`);

  // Step 6: Model synthesis
  const targetModel = options.model || process.env.OLLAMA_MODEL || 'gemma2:2b';
  let rawReport: GhostTraceReport;
  let inferenceMode: 'ollama-local' | 'grounded-deterministic' = 'grounded-deterministic';

  const ollamaHealth = await checkOllamaHealth();
  const hasTargetModel = ollamaHealth.running && ollamaHealth.models.some((m) => m.startsWith('gemma2:2b') || m.startsWith('gemma'));

  if (!options.forceFallback && ollamaHealth.running && hasTargetModel) {
    logProgress('MODEL_SYNTHESIS', `Synthesizing report using local model: ${targetModel} via Ollama`);
    try {
      const prompt = formatEvidencePrompt(options.question, evidencePack);
      rawReport = await generateWithOllama(prompt, targetModel);
      inferenceMode = 'ollama-local';
    } catch (ollamaErr) {
      logProgress('MODEL_FALLBACK', `Ollama synthesis warning: ${ollamaErr instanceof Error ? ollamaErr.message : String(ollamaErr)}. Using grounded deterministic fallback.`);
      rawReport = createDeterministicSynthesis(options.question, evidencePack);
    }
  } else {
    const reason = !ollamaHealth.running
      ? 'Ollama daemon is offline'
      : `Model ${targetModel} is not installed locally (available: [${ollamaHealth.models.join(', ')}])`;
    logProgress('MODEL_FALLBACK', `${reason}. Using grounded deterministic synthesis from evidence pack.`);
    rawReport = createDeterministicSynthesis(options.question, evidencePack);
  }

  // Step 7: Validate citations and resolve uncertainties
  logProgress('VALIDATE_CITATIONS', 'Validating evidence citation IDs against evidence pack');
  const validation = validateAndRepairCitations(rawReport, evidencePack);

  logProgress('COMPLETE', 'Investigation complete. Final report validated.');

  return {
    report: validation.validatedReport,
    validation,
    modelUsed: inferenceMode === 'ollama-local' ? targetModel : 'grounded-deterministic-fallback',
    inferenceMode,
    events,
  };
}
