---
title: GhostTrace: The Haunted Codebase Investigator (Local Git Archaeology with Gemma & Mastra)
published: false
description: A local-first AI investigator that reconstructs why code exists from Git history using an open-weight Gemma model, Mastra agent orchestration, and deterministic Git tools.
tags: devchallenge, hf26challenge, gemma, mastra
canonical_url: https://github.com/JyotiBhardwajj/GhostTrace
cover_image: https://raw.githubusercontent.com/JyotiBhardwajj/GhostTrace/main/public/cover.png
---

*This is a submission for the [DEV Community Hacktoberfest Challenge: Ghost in the Machine](https://dev.to/challenges/hacktoberfest-week4-2026-10-26).*

*Target Categories: **Best Use of Gemma** ($200) & **Best Use of Mastra**.*

---

## 👻 What I Built

Every developer inherits code filled with ghosts:
- *Why is there a 5-attempt exponential backoff loop here?*
- *Can we safely delete this custom connection pool wrapper?*
- *Who introduced this strange workaround, and what disaster occurred if we remove it?*

When developers encounter these "code ghosts", they usually resort to running tedious manual Git archaeology (`git log --grep`, `git blame`, `git show`, `git diff`) or pasting the code into a hosted commercial chatbot. But generic chatbots easily invent plausible-sounding justifications out of thin air, and pasting private codebase logic into cloud LLMs exposes proprietary code.

**GhostTrace** is a local-first, open-source repository-history investigator that reconstructs *why* code exists from Git history. It combines:
1. **Allow-listed, Read-Only Git Tools**: Structured tools (`repo_summary`, `search_history`, `get_commit`, `get_diff`, `get_blame`, `search_source`) wrapped with strict path canonicalization and argument arrays (`shell: false`).
2. **Mastra Agent Orchestration**: Orchestrates tool execution, keyword extraction, and evidence indexing using `@mastra/core`.
3. **Local Gemma Inference**: Open-weight `gemma2:2b` runs entirely on-device via Ollama, synthesizing findings strictly from bounded evidence.
4. **Anti-Hallucination Citation Verification**: Every factual finding is cross-checked against the retrieved evidence pack. Phantom IDs are stripped, and unsupported claims are automatically demoted to hypotheses or unknowns.
5. **Haunted-Terminal UI**: A responsive, retro phosphor-green CRT interface with live telemetry, collapsible syntax-highlighted diffs, and 1-click Markdown postmortem exports.

---

## 🎮 Interactive Demo & Walkthrough

GhostTrace includes a built-in deterministic test repository (`tests/fixtures/known-workaround-repo`) modeling a payment microservice.

> *Note: All incident numbers (e.g., Incident INC-882) and commits in the fixture are synthetic test fixtures designed to provide 100% reproducible ground truth.*

### The Investigation Query
> *"Why was this retry workaround added, and can I safely remove it?"*

### 1. Live Telemetry
GhostTrace executes the Mastra tool loop, logging real-time telemetry:
- `VALIDATE_REPO`: Confirms the local path is a valid Git working tree and resolves the canonical root.
- `PARSE_QUERY`: Extracts search tokens (`retry`, `workaround`).
- `MASTRA_TOOL`: Invokes `mastraGitTools.repo_summary` and `mastraGitTools.search_history`.
- `MASTRA_TOOL`: Inspects `mastraGitTools.get_commit` and `mastraGitTools.get_diff` on the target file `src/paymentClient.ts`.
- `EVIDENCE_PACK`: Assembles bounded evidence items `E1`, `E2`, `E3` with exact commit SHAs and author metadata (`Bob Engineer`).
- `MODEL_SYNTHESIS`: Local `gemma2:2b` synthesizes the findings in JSON format.
- `VALIDATE_CITATIONS`: Verifies citations against the evidence pack.

### 2. The Evidence-Backed Report
```json
{
  "question": "Why was this retry workaround added, and can I safely remove it?",
  "summary": "The retry workaround was introduced in commit 'fix(payment): add exponential backoff retry workaround for flaky gateway timeouts (#402)' to resolve Incident INC-882. Removal is not recommended until confirming the upstream dependency has fixed the underlying failure.",
  "findings": [
    {
      "claim": "Historical change identified in commit fix(payment): add exponential backoff retry workaround for flaky gateway timeouts (#402) on 2024-04-02.",
      "confidence": "high",
      "evidence_ids": ["E1"]
    },
    {
      "claim": "Diff analysis confirms specific workaround logic (MAX_RETRIES=5 and sleepWithJitter) was introduced in src/paymentClient.ts.",
      "confidence": "high",
      "evidence_ids": ["E3"]
    }
  ],
  "hypotheses": [
    {
      "claim": "Removal of this retry workaround is high-risk unless the external service has confirmed migration to newer endpoints.",
      "why_plausible": "Historical comments explicitly warn against removing the retry loop until downstream gateway migration is complete (scheduled for Q3 2025).",
      "evidence_ids": ["E3"]
    }
  ],
  "unknowns": [
    "Whether the external gateway or upstream API has migrated to v2 endpoints as originally planned.",
    "Current production frequency of HTTP 429 rate limits or transient connection socket resets."
  ]
}
```

Every claim in the UI has a clickable `[E1]` or `[E3]` citation pill that smoothly jumps to the inspectable Git commit SHA, author, and syntax-highlighted diff.

---

## 🧠 Why Open AI Matters: The Power of Local Gemma

Running AI locally is not just a nice-to-have for developers—it is essential when inspecting codebases:
1. **Privacy & Zero Code Leakage**: In local mode, GhostTrace sends prompts exclusively to the local Ollama daemon (`http://localhost:11434`). Zero code, diffs, or repository metadata ever leave the workstation.
2. **Deterministic Reproducibility**: Because `gemma2:2b` is open-weight and runs locally with temperature `0.1` and schema enforcement, investigations yield consistent, verifiable results.
3. **Accessibility**: At only ~1.6 GB, `gemma2:2b` runs smoothly even on standard 8 GB laptops without requiring expensive cloud GPUs or proprietary API subscriptions.

---

## 🛠️ How Mastra Orchestrates the Investigation

Mastra (`@mastra/core`) serves as the agent orchestration framework. Rather than allowing an LLM to hallucinate or execute arbitrary shell strings, all repository operations are encapsulated as typed Mastra tools:

```typescript
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getDiff } from '../git/tools';

export const getDiffTool = createTool({
  id: 'get_diff',
  description: 'Retrieves the bounded patch diff for a commit, optionally filtered to a single relative file path.',
  inputSchema: z.object({
    repoPath: z.string().describe('Absolute local repository path'),
    sha: z.string().describe('Commit SHA'),
    filePath: z.string().optional().describe('Optional repo-relative file path'),
  }),
  execute: async ({ repoPath, sha, filePath }) => {
    return await getDiff(repoPath, sha, filePath);
  },
});
```

Every tool call validates input parameters against Zod schemas, enforces path canonicalization, sanitizes outputs, redacts secrets (tokens, AWS keys, passwords), and clips text to prevent buffer exhaustion.

---

## 🛡️ Security & Privacy Boundaries

GhostTrace follows a strict defense-in-depth model:
- **No Arbitrary Shell Execution**: All Git commands execute via `node:child_process.execFile` with explicit argument arrays and `shell: false`.
- **Path Traversal Defenses**: Paths are canonicalized via `fs.realpathSync`. Directory traversal (`..`), NUL bytes (`\0`), and absolute path misuse for relative file queries are immediately rejected.
- **Secret Redaction**: Automated regular expressions scrub API tokens, bearer keys, and credentials before output enters the evidence pack. Sensitive files (`.env`, `id_rsa`, `.pem`, `credentials.json`) are blocked from retrieval.
- **Clear Offline Disclosures**: When Ollama is offline or uninstalled, GhostTrace activates its grounded deterministic fallback engine and visibly discloses that fallback mode was used. It never pretends a live model produced the result.

---

## 📦 Source Code & Reproducibility

- **GitHub Repository**: [https://github.com/JyotiBhardwajj/GhostTrace](https://github.com/JyotiBhardwajj/GhostTrace)
- **License**: Apache 2.0

### Run it locally in 3 steps:
```bash
# 1. Clone & install
git clone https://github.com/JyotiBhardwajj/GhostTrace.git
cd GhostTrace
npm install

# 2. Initialize the test fixture
npm run setup

# 3. Start GhostTrace
npm run dev
```

Open `http://localhost:3000`, click **"Load Built-In Fixture Repo"**, and summon your first historical investigation!

---

## 🏁 Conclusion

Code archaeology should be scientific, not speculative. By pairing deterministic Git tools with local Gemma reasoning and Mastra agent orchestration, GhostTrace exorcises the ghosts hiding in legacy repositories—safely, privately, and with inspectable evidence.
