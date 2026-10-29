import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIXTURE_DIR = path.resolve(__dirname, '../tests/fixtures/known-workaround-repo');

export function createFixtureRepo() {
  console.log(`Setting up deterministic fixture repository at: ${FIXTURE_DIR}`);

  if (fs.existsSync(FIXTURE_DIR)) {
    fs.rmSync(FIXTURE_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(FIXTURE_DIR, { recursive: true });

  const runGit = (args, envExtra = {}) => {
    execFileSync('git', args, {
      cwd: FIXTURE_DIR,
      stdio: 'pipe',
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 'Alice Dev',
        GIT_AUTHOR_EMAIL: 'alice@ghosttrace.internal',
        GIT_COMMITTER_NAME: 'Alice Dev',
        GIT_COMMITTER_EMAIL: 'alice@ghosttrace.internal',
        GIT_AUTHOR_DATE: '2024-03-10T10:00:00Z',
        GIT_COMMITTER_DATE: '2024-03-10T10:00:00Z',
        ...envExtra,
      },
    });
  };

  runGit(['init', '-b', 'main']);
  runGit(['config', 'user.name', 'Alice Dev']);
  runGit(['config', 'user.email', 'alice@ghosttrace.internal']);

  // Commit 1: Initial commit
  fs.writeFileSync(
    path.join(FIXTURE_DIR, 'README.md'),
    '# Payment Processing Service\n\nInternal payment processing pipeline.'
  );
  fs.writeFileSync(
    path.join(FIXTURE_DIR, 'package.json'),
    JSON.stringify({ name: 'payment-svc', version: '1.0.0' }, null, 2)
  );
  runGit(['add', '.']);
  runGit(['commit', '-m', 'feat: initial project structure with payment service skeleton'], {
    GIT_AUTHOR_DATE: '2024-03-10T10:00:00Z',
    GIT_COMMITTER_DATE: '2024-03-10T10:00:00Z',
  });

  // Commit 2: Add payment client without retry
  const clientDir = path.join(FIXTURE_DIR, 'src');
  fs.mkdirSync(clientDir, { recursive: true });
  fs.writeFileSync(
    path.join(clientDir, 'paymentClient.ts'),
    `export interface ChargeRequest {
  id: string;
  amountCents: number;
  currency: string;
}

export async function processPayment(req: ChargeRequest): Promise<{ status: string }> {
  // Direct HTTP POST to payment gateway
  const res = await fetch("https://gateway.internal/v1/charges", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req)
  });

  if (!res.ok) {
    throw new Error(\`Payment failed with status \${res.status}\`);
  }

  return res.json();
}
`
  );
  runGit(['add', '.']);
  runGit(['commit', '-m', 'feat(payment): integrate core payment gateway API client'], {
    GIT_AUTHOR_DATE: '2024-03-15T14:30:00Z',
    GIT_COMMITTER_DATE: '2024-03-15T14:30:00Z',
  });

  // Commit 3: The crucial workaround commit!
  fs.writeFileSync(
    path.join(clientDir, 'paymentClient.ts'),
    `export interface ChargeRequest {
  id: string;
  amountCents: number;
  currency: string;
}

/**
 * WORKAROUND (Incident INC-882 / Issue #402):
 * The legacy payment gateway drops sockets and returns spurious HTTP 429 / 503
 * during micro-burst traffic surges. We must retry up to 5 times with exponential backoff
 * and randomized jitter before giving up.
 *
 * DO NOT REMOVE until the gateway migrates to v2 endpoints (scheduled for Q3 2025).
 */
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 250;

async function sleepWithJitter(attempt: number): Promise<void> {
  const backoff = BASE_BACKOFF_MS * Math.pow(2, attempt);
  const jitter = Math.random() * 100;
  await new Promise(resolve => setTimeout(resolve, backoff + jitter));
}

export async function processPayment(req: ChargeRequest): Promise<{ status: string }> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt < MAX_RETRIES) {
    try {
      const res = await fetch("https://gateway.internal/v1/charges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req)
      });

      if (res.status === 429 || res.status >= 500) {
        throw new Error(\`Transient error \${res.status} from gateway\`);
      }

      if (!res.ok) {
        throw new Error(\`Payment rejected with status \${res.status}\`);
      }

      return res.json();
    } catch (err: any) {
      lastError = err;
      attempt++;
      if (attempt >= MAX_RETRIES) break;
      await sleepWithJitter(attempt);
    }
  }

  throw new Error(\`Payment failed after \${MAX_RETRIES} attempts. Reason: \${lastError?.message}\`);
}
`
  );
  runGit(['add', '.']);
  runGit(
    [
      'commit',
      '-m',
      'fix(payment): add exponential backoff retry workaround for flaky gateway timeouts (#402)\n\nResolves Incident INC-882 where payments failed under load due to gateway 429 and connection resets.',
    ],
    {
      GIT_AUTHOR_NAME: 'Bob Engineer',
      GIT_AUTHOR_EMAIL: 'bob@ghosttrace.internal',
      GIT_COMMITTER_NAME: 'Bob Engineer',
      GIT_COMMITTER_EMAIL: 'bob@ghosttrace.internal',
      GIT_AUTHOR_DATE: '2024-04-02T16:45:00Z',
      GIT_COMMITTER_DATE: '2024-04-02T16:45:00Z',
    }
  );

  // Commit 4: Add telemetry/logging
  fs.writeFileSync(
    path.join(clientDir, 'metrics.ts'),
    `export function recordRetryMetric(attempt: number, success: boolean) {
  console.log(\`[METRIC] retry_attempt=\${attempt} success=\${success}\`);
}
`
  );
  runGit(['add', '.']);
  runGit(['commit', '-m', 'chore(metrics): track retry attempt distributions in logs'], {
    GIT_AUTHOR_DATE: '2024-04-10T11:20:00Z',
    GIT_COMMITTER_DATE: '2024-04-10T11:20:00Z',
  });

  console.log('Deterministic fixture repository created successfully with 4 commits.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  createFixtureRepo();
}
