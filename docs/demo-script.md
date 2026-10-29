# GhostTrace Demo Script (85 Seconds)

This script is designed for recording the official challenge submission video. It demonstrates the core value proposition within the first 10 seconds and follows the exact flow specified in the challenge brief.

---

### Segment 1: The Hook (0:00 - 0:10)
- **Visual**: Show Haunted Terminal UI with CRT scanline texture and glowing phosphor green header.
- **Narrator**:
  > *"Every codebase has ghosts: strange retries, mysterious branches, and legacy workarounds whose original authors and reasons vanished years ago. This is GhostTrace — a local-first repository investigator that reconstructs why code exists from Git history."*

---

### Segment 2: Local Privacy & Environment (0:10 - 0:20)
- **Visual**: Click "Load Built-In Fixture Repo". Point out the `LOCAL-FIRST` badge and the local Gemma model status.
- **Narrator**:
  > *"Notice our privacy indicator: GhostTrace executes 100% on-device. Source code and commit diffs never leave the developer's machine, synthesized locally using open-weight Gemma."*

---

### Segment 3: The Investigation Query (0:20 - 0:35)
- **Visual**: Select the query: `"Why was this retry workaround added, and can I safely remove it?"` with focus file `src/paymentClient.ts`. Click **"Summon Investigation"**.
- **Narrator**:
  > *"We ask a critical question: Why was this 5-retry exponential backoff loop added, and can we safely delete it? GhostTrace immediately kicks off the investigation."*

---

### Segment 4: Real Telemetry & Synthesis (0:35 - 0:55)
- **Visual**: Show the live telemetry steps updating: `VALIDATE_REPO` -> `SEARCH_HISTORY` -> `INSPECT_COMMIT` -> `EVIDENCE_PACK` -> `MODEL_SYNTHESIS` -> `VALIDATE_CITATIONS`.
- **Narrator**:
  > *"Instead of hallucinating answers, Mastra orchestrates allow-listed Git tools: inspecting recent logs, commit diffs, and line-by-line blame. Once the evidence pack is bounded, local Gemma synthesizes the explanation."*

---

### Segment 5: Evidence-Backed Report & Citation Verification (0:55 - 0:70)
- **Visual**: Report appears. Scroll to Executive Summary, then Verified Findings. Click evidence tag `[E1]` and `[E2]` to smoothly jump to the exact commit SHA, author (`Bob Engineer`), date, and diff excerpt showing `+ const MAX_RETRIES = 5`.
- **Narrator**:
  > *"Here is our answer: The workaround was introduced in commit `fix(payment): add exponential backoff retry workaround for flaky gateway timeouts (#402)` to resolve Incident INC-882. Every factual claim is tied to an inspectable evidence ID with real commit SHAs and line ranges."*

---

### Segment 6: Scientific Uncertainty & Unknowns (0:70 - 0:78)
- **Visual**: Highlight the **Plausible Hypotheses**, **Historical Unknowns**, and **Limitations** sections.
- **Narrator**:
  > *"Crucially, GhostTrace separates verified facts from hypotheses. It explicitly flags that we do not know if the external gateway has been updated to v2, preventing developers from prematurely deleting defensive code."*

---

### Segment 7: Open Source Quality & Close (0:78 - 0:85)
- **Visual**: Quick cut to terminal showing Vitest passing all 23 tests and clean GitHub repository.
- **Narrator**:
  > *"Deterministic, reproducible, and fully open-source. GhostTrace puts historical context back into developer hands — privately and locally."*
