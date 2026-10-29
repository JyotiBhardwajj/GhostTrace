import { GhostTraceReport, GhostTraceReportSchema } from './schemas';
import { GHOSTTRACE_SYSTEM_PROMPT } from '../agent/prompts';

export interface OllamaHealth {
  running: boolean;
  models: string[];
  error?: string;
}

const DEFAULT_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_MODEL = process.env.OLLAMA_MODEL || 'gemma2:2b';

/**
 * Checks if Ollama is running and lists locally installed models.
 */
export async function checkOllamaHealth(baseUrl: string = DEFAULT_BASE_URL): Promise<OllamaHealth> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return {
        running: false,
        models: [],
        error: `Ollama returned HTTP ${res.status}: ${res.statusText}`,
      };
    }

    const data = (await res.json()) as { models?: Array<{ name: string; model?: string }> };
    const models = (data.models || []).map((m) => m.name || m.model || '');

    return {
      running: true,
      models,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      running: false,
      models: [],
      error: `Could not connect to Ollama at ${baseUrl} (${message}). Run 'ollama serve' to start.`,
    };
  }
}

/**
 * Sends prompt to local Ollama with JSON mode enabled and temperature 0.1 for high fidelity.
 */
export async function generateWithOllama(
  prompt: string,
  model: string = DEFAULT_MODEL,
  baseUrl: string = DEFAULT_BASE_URL
): Promise<GhostTraceReport> {
  const url = `${baseUrl}/api/generate`;

  const payload = {
    model,
    system: GHOSTTRACE_SYSTEM_PROMPT,
    prompt,
    format: 'json',
    stream: false,
    options: {
      temperature: 0.1,
      top_p: 0.9,
    },
  };

  const controller = new AbortController();
  const timeoutMs = parseInt(process.env.GHOSTTRACE_TOOL_TIMEOUT_MS || '60000', 10);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } catch (err: unknown) {
    clearTimeout(timeout);
    throw new Error(`Failed to communicate with local Ollama at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`);
  }
  clearTimeout(timeout);

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama generation error (HTTP ${res.status}): ${errText}`);
  }

  const result = (await res.json()) as { response?: string };
  const rawResponse = (result.response || '').trim();

  // Strip possible markdown fences
  let cleanJson = rawResponse;
  if (cleanJson.startsWith('```json')) {
    cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanJson.startsWith('```')) {
    cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  try {
    const parsed = JSON.parse(cleanJson);
    return GhostTraceReportSchema.parse(parsed);
  } catch (parseErr: unknown) {
    throw new Error(
      `Malformed JSON emitted by local model: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\nRaw output: ${rawResponse.slice(0, 300)}`
    );
  }
}
