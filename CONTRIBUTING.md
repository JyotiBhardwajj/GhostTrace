# Contributing to GhostTrace

Thank you for your interest in contributing to **GhostTrace**! We welcome bug fixes, documentation improvements, and tool extensions.

## Core Design Principles

1. **Local-First & Privacy Preserving**:
   GhostTrace is designed to run locally on developer hardware. Never add telemetry, tracking, or unsolicited uploads of repository code or metadata to external servers.

2. **Read-Only Git Operations**:
   All Git tools must execute read-only commands (`log`, `show`, `blame`, `grep`, `rev-parse`). Never execute mutating commands (`commit`, `checkout`, `reset`, `push`) or arbitrary shell strings. Always use `node:child_process.execFile` with explicit argument arrays and `shell: false`.

3. **Strict Citation Provenance**:
   Every factual claim in a report must link to verified repository evidence (commit SHA, file path, line range, or diff). Unsupported claims must be explicitly marked as hypotheses or unknowns.

## Development Setup

### Prerequisites
- Node.js 20+ (recommended v22 LTS)
- Git 2.40+
- (Optional for full inference) Ollama with `gemma2:2b`

### Setup Instructions

```bash
# Clone the repository
git clone https://github.com/JyotiBhardwajj/GhostTrace.git
cd GhostTrace

# Install dependencies
npm install

# Initialize the deterministic fixture test repository
npm run setup:fixture

# Start the Next.js development server
npm run dev
```

The app will be accessible at [http://localhost:3000](http://localhost:3000).

## Testing & Quality Gates

Run the automated checks before opening a Pull Request:

```bash
# Run unit and integration tests (Vitest)
npm test

# Run strict TypeScript typecheck
npm run typecheck

# Run linter
npm run lint

# Verify production build
npm run build
```

## Pull Request Guidelines

- Ensure all existing tests pass and add unit tests for new functionality.
- Write clear, conventional commit messages (`feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`).
- Never commit `.env` files, API keys, credentials, or private repository paths.
- All code is licensed under the [Apache-2.0 License](./LICENSE).
