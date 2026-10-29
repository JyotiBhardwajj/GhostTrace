# GhostTrace Architecture & Security Model

GhostTrace is designed as a secure, local-first monolithic application that reconstructs why code exists from historical Git data. It uses an open-weight Gemma model running locally via Ollama and an agent orchestrated by Mastra, strictly bounded by deterministic, read-only Git tools.

```
┌─────────────────────────────────────────────────────────────┐
│                   Next.js Haunted Terminal UI               │
│        (RepoPicker, QuestionForm, Telemetry, ReportView)     │
└──────────────────────────────┬──────────────────────────────┘
                               │ HTTP POST /api/investigate
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Next.js Server API Boundary                 │
│         - Validates input paths & prevents traversal        │
│         - Enforces allowed repository boundaries             │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                Mastra Investigator Agent                    │
│   - Registers allow-listed read-only Git tools              │
│   - Orchestrates keyword extraction & commit ranking        │
│   - Assembles sequentially tagged evidence items (E1, E2)   │
└──────────────┬──────────────────────────────┬───────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│      Safe Git Tool Layer     │ │     Bounded Evidence Pack  │
│  - spawn/execFile only       │ │  - Unique IDs (E1, E2, ..) │
│  - shell: false              │ │  - Exact commit SHAs       │
│  - Timeouts & buffer caps    │ │  - Author & ISO dates      │
│  - Secret redaction          │ │  - Excerpt line ranges     │
│  - No external diff helpers  │ │  - Max item/token budgets  │
└──────────────────────────────┘ └─────────────┬──────────────┘
                                               │
                                               ▼
                                 ┌────────────────────────────┐
                                 │     Local Model Runtime    │
                                 │       (Ollama + Gemma)     │
                                 │  - JSON schema enforcement │
                                 │  - Low temp (0.1) fidelity │
                                 │  - 100% on-device inference│
                                 └─────────────┬──────────────┘
                                               │
                                               ▼
                                 ┌────────────────────────────┐
                                 │ Strict Citation Validator  │
                                 │  - Rejects phantom IDs     │
                                 │  - Demotes unsupported     │
                                 │    claims to hypotheses    │
                                 └─────────────┬──────────────┘
                                               │
                                               ▼
                                 ┌────────────────────────────┐
                                 │ Verified Report back to UI │
                                 └────────────────────────────┘
```

## System Layers and Responsibilities

| Layer | Responsibility | Security Boundary |
| :--- | :--- | :--- |
| **Next.js UI** | Repo selection, query input, live progress steps, report presentation, clickable evidence cards. | Browser sandbox: zero direct shell, filesystem, or git execution. |
| **Server API** | Request schema validation, canonical path resolution, allowed root enforcement. | Server boundary: strictly validates all inputs before invoking git layer. |
| **Mastra Agent** | Orchestrates tool calls based on question semantics and repository state. | Allow-listed tools only; model cannot invoke arbitrary shell or network requests. |
| **Git Tool Layer** | Safe execution of `git log`, `git show`, `git blame`, and `git grep`. | `execFile` with argument arrays; `shell: false`; timeouts (8000ms); output caps (12,000 chars); secrets redacted. |
| **Evidence Pack** | Normalizes and indexes raw Git outputs into tagged items (`E1`, `E2`, etc.). | Bounded context budget (max 20 items); prevents prompt injection via strict delimiter formatting. |
| **Model Runtime** | Synthesizes historical context into structured JSON report. | Runs via local Ollama daemon (`http://localhost:11434`); no external source code uploads. |
| **Citation Validator** | Cross-references generated citations against collected evidence. | Strict anti-hallucination check: any claim citing a non-existent ID is purged or demoted to a hypothesis. |
| **Fixture Repo** | Known Git repository with verifiable ground-truth workaround history. | Isolated test repository providing 100% deterministic reproducibility. |

## Defense-in-Depth Safeguards

1. **No Arbitrary Command Execution**:
   - GhostTrace uses `node:child_process.execFile` with explicit argument arrays.
   - `shell: false` is permanently enforced. The model never generates shell strings.

2. **Strict Repository Path Validation**:
   - Accepts only local absolute paths.
   - Validates existence, directory status, and verifies `git rev-parse --is-inside-work-tree`.
   - Resolves canonical real path (symlink resolution).
   - Enforces optional `GHOSTTRACE_ALLOWED_ROOTS` restrictions.
   - Rejects directory traversal (`..`), NUL bytes (`\0`), and unexpected absolute paths in file arguments.

3. **Sensitive File & Secret Redaction**:
   - Automatically blocks inspection of `.env`, `id_rsa`, `.pem`, `.key`, and `credentials.json`.
   - Scans and redacts API tokens, bearer keys, and AWS access keys before text enters the evidence pack.

4. **Prompt Injection Resistance**:
   - Repository code and commit messages are explicitly treated as untrusted historical data, never as agent instructions.
