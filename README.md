# 👻 GhostTrace: The Haunted Open-Source Codebase Investigator

[![GhostTrace CI](https://github.com/JyotiBhardwajj/GhostTrace/actions/workflows/ci.yml/badge.svg)](https://github.com/JyotiBhardwajj/GhostTrace/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue.svg)](./LICENSE)
[![Local First](https://img.shields.io/badge/Privacy-100%25%20Local-emerald.svg)](#privacy--local-mode-truth-table)
[![Target Model](https://img.shields.io/badge/Model-Gemma%202%20(2B)-purple.svg)](https://ai.google.dev/gemma)
[![Orchestrator](https://img.shields.io/badge/Agent-Mastra-orange.svg)](https://mastra.ai)

> **Old code has ghosts:** undocumented workarounds, bizarre retries, mysterious branches, and legacy fixes whose original context and authors have vanished.
>
> **GhostTrace** is a local-first AI investigator that reconstructs *why* code exists from Git history using an open-weight Gemma model, Mastra agent orchestration, and deterministic Git tools.

---

## ⚡ The Problem: Why Historical Context Matters

Developers inherit software systems filled with defensive code:
- *Why is there a 5-retry exponential backoff loop here?*
- *Can we safely delete this custom connection pool wrapper?*
- *When did this strange behavior first appear, and what problem was it solving?*

Normally, finding out requires running multiple manual Git commands (`git log --grep`, `git blame`, `git show`, `git diff`) and manually piecing together fragmented clues. Asking a generic cloud chatbot often results in hallucinated explanations or requires uploading proprietary source code to a third-party hosted model.

**GhostTrace solves this locally and scientifically:**
1. It queries real, deterministic Git history tools.
2. It bounds and indexes the retrieved commits, diffs, and blame lines into an evidence pack with unique IDs (`E1`, `E2`, ...).
3. Local Gemma synthesizes an explanation grounded strictly in the retrieved evidence.
4. An automated citation validator enforces that every historical claim links to a real commit SHA, file path, or diff excerpt, while demoting unproven assumptions to hypotheses or unknowns.

---

## ✨ Features

| Feature | Status | Description |
| :--- | :---: | :--- |
| **Safe Read-Only Git Tools** | **`[WORKING]`** | Executes `repo_summary`, `search_history`, `get_commit`, `get_diff`, `get_blame`, and `search_source` using `execFile` with argument arrays and `shell: false`. |
| **Bounded Evidence Pack** | **`[WORKING]`** | Assembles normalized evidence items with unique IDs (`E1`, `E2`), character limits (12,000 chars), and secret redaction. |
| **Strict Citation Verification** | **`[WORKING]`** | Validates that all claim citations exist in the collected evidence pack. Demotes unsupported claims to hypotheses or unknowns. |
| **Mastra Agent Orchestration** | **`[WORKING]`** | Orchestrates tool execution, keyword extraction, and evidence collation through `@mastra/core` registered tools. |
| **Local Gemma Inference** | **`[WORKING]`** | Connects to local Ollama daemon (`http://localhost:11434`) using `gemma2:2b` with structured JSON mode and temperature 0.1. |
| **Offline Synthesis Fallback** | **`[WORKING]`** | Automatically falls back to grounded deterministic evidence synthesis when the Ollama daemon is offline or warming up. |
| **Haunted-Terminal UI** | **`[WORKING]`** | Retro phosphor green CRT aesthetic with live telemetry tracking, collapsible diff viewers, and citation jump links. |
| **Deterministic Fixture Repo** | **`[WORKING]`** | Built-in test repository (`tests/fixtures/known-workaround-repo`) with a known bug and workaround for instant 1-click reproduction. |
| **Markdown Report Export** | **`[WORKING]`** | One-click button to copy full evidence-backed postmortem reports directly to the clipboard for PRs or issue trackers. |
| **Remote HTTPS Git Clone** | *`[PLANNED]`* | Restricted public HTTPS repository cloning into isolated ephemeral workspaces. |

---

## 🏛️ Architecture & Data Flow

```
Browser UI (Next.js Haunted Terminal)
       │
       ▼  HTTP POST /api/investigate
Server API (Validation & Traversal Protection)
       │
       ▼
Mastra Investigator Agent
       ├──► Allow-Listed Git Tools (safeExec, shell: false, timeouts)
       │         └── git log, git show, git blame, git grep
       │
       ├──► Bounded Evidence Pack (E1, E2, ... with commit SHAs & diffs)
       │
       ├──► Local Gemma via Ollama (Structured JSON format, temp=0.1)
       │
       ▼
Citation & Provenance Validator (Demotes unsupported claims to hypotheses)
       │
       ▼
Structured Report (Summary, Verified Findings, Hypotheses, Unknowns, Evidence Cards)
```

See [docs/architecture.md](./docs/architecture.md) for full security boundaries and implementation details.

---

## 🚀 Quickstart & Local Setup

### 1. Prerequisites
- **Node.js**: v20+ (tested on Node v22.14 LTS)
- **Git**: 2.40+ installed and on system PATH
- **Ollama**: (Optional for local AI synthesis) [Download Ollama](https://ollama.ai)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/JyotiBhardwajj/GhostTrace.git
cd GhostTrace

# Install dependencies
npm install

# Initialize the deterministic test fixture repository
npm run setup:fixture
```

### 3. Local Model Setup (Gemma 2 via Ollama)
```bash
# Pull the recommended local Gemma instruction model (1.6GB)
ollama pull gemma2:2b

# Start the Ollama local daemon (if not already running)
ollama serve
```

### 4. Run GhostTrace
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🧪 Reproducible Fixture Demo

GhostTrace includes a deterministic fixture repository (`tests/fixtures/known-workaround-repo`) modeling a payment microservice:
1. Open the UI at `http://localhost:3000`.
2. Click **"Load Built-In Fixture Repo"**.
3. Select the question:
   > *"Why was this retry workaround added, and can I safely remove it?"*
4. Click **"Summon Investigation"**.

### Sample Verified Output
```json
{
  "question": "Why was this retry workaround added, and can I safely remove it?",
  "summary": "The retry workaround was introduced in commit 'fix(payment): add exponential backoff retry workaround for flaky gateway timeouts (#402)' to resolve Incident INC-882 caused by legacy payment gateway connection drops and HTTP 429 errors.",
  "findings": [
    {
      "claim": "Exponential backoff with jitter and MAX_RETRIES=5 was added to address gateway timeouts during peak load.",
      "confidence": "high",
      "evidence_ids": ["E1", "E2"]
    }
  ],
  "hypotheses": [
    {
      "claim": "Removing the retry loop will likely re-trigger payment failures unless the external gateway has migrated to v2.",
      "why_plausible": "The code comment explicitly states not to remove until gateway migrates in Q3 2025.",
      "evidence_ids": ["E2"]
    }
  ],
  "unknowns": [
    "Whether the payment gateway has actually upgraded its endpoints since April 2024.",
    "Current production 429 error frequency outside of local Git history."
  ]
}
```

---

## 🔒 Privacy & Local-Mode Truth Table

| Operation | Where it Runs | Network Disclosure |
| :--- | :--- | :--- |
| **Git history retrieval** | Local machine | Reads local `.git` repository data only. |
| **Model inference** | Local machine | Prompts and evidence sent strictly to `http://localhost:11434`. Zero cloud upload. |
| **Initial model weight download** | Internet | Performed once by user via Ollama (`ollama pull gemma2:2b`). |
| **Telemetry / Tracking** | None | No analytics, trackers, cookies, or external phone-home requests. |

> **Privacy Statement**: In local mode, GhostTrace sends prompts and retrieved repository evidence to the configured Ollama endpoint. When that endpoint runs on the same machine, inference stays entirely on that machine. GhostTrace does not upload repository contents to any cloud service.

---

## 🛠️ Verification & Test Suite

GhostTrace is covered by an automated test suite verifying path traversal defenses, argument injection protections, citation validators, and end-to-end fixture investigations:

```bash
# Run Vitest test suite (23 unit & integration tests)
npm test

# Run strict TypeScript typecheck
npm run typecheck

# Run Next.js linter
npm run lint

# Build production bundle
npm run build
```

---

## 📜 License & Model Terms

- **Code License**: Licensed under the [Apache License, Version 2.0](./LICENSE).
- **Gemma Model Terms**: Gemma is an open-weight model provided by Google under the [Gemma Terms of Use](https://ai.google.dev/gemma/terms).
