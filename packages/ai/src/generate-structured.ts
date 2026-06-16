import { z } from 'zod';
import zodToJsonSchema from 'zod-to-json-schema';
import type { AnthropicClient } from './client';

/**
 * Forces Claude to emit a value conforming to a zod schema by exposing the schema
 * as the input_schema of a single tool and setting tool_choice to require it.
 * This is the most reliable way to get structured JSON from Claude — far more
 * robust than "respond in JSON" prompting.
 *
 * The system prompt is wrapped in a cache_control block so repeated calls with
 * the same system prompt hit the prompt cache.
 */
export async function generateStructured<T extends z.ZodTypeAny>(opts: {
  client: AnthropicClient;
  model: string;
  system: string;
  user: string;
  schema: T;
  schemaName: string;
  maxTokens?: number;
  /** Per-stage sampling temperature. Omitted → the API default. Low (~0.1) for
   *  classification/judgment, moderate (~0.2) for grounded summary prose. */
  temperature?: number;
  /** How many times to (re)sample when the model emits a missing/invalid tool call.
   *  Even with `tool_choice` forced, the model occasionally returns an empty or
   *  partial object (stop_reason=tool_use) — a transient that a fresh sample fixes.
   *  The SDK already retries transport-level errors (429/5xx); this covers the
   *  schema-validation case it can't see. Truncation (max_tokens) is NOT retried —
   *  the same budget would truncate again. */
  maxAttempts?: number;
}): Promise<z.infer<T>> {
  const {
    client,
    model,
    system,
    user,
    schema,
    schemaName,
    maxTokens = 4096,
    temperature,
    maxAttempts = 3,
  } = opts;

  const toolName = `emit_${schemaName}`;
  const inputSchema = zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  delete inputSchema.$schema;
  delete inputSchema.title;

  let lastError = 'no attempts ran';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      ...(temperature !== undefined ? { temperature } : {}),
      system: [
        {
          type: 'text',
          text: system,
          cache_control: { type: 'ephemeral' },
        },
      ],
      tools: [
        {
          name: toolName,
          description: `Emit a validated ${schemaName} object.`,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          input_schema: inputSchema as any,
        },
      ],
      tool_choice: { type: 'tool', name: toolName },
      messages: [{ role: 'user', content: user }],
    });

    const block = response.content.find((c) => c.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      lastError = `did not return a tool_use block (stop_reason=${response.stop_reason})`;
    } else {
      const parsed = schema.safeParse(block.input);
      if (parsed.success) return parsed.data;
      // stop_reason=max_tokens means the tool JSON was truncated — bump maxTokens.
      lastError = `failed schema validation (stop_reason=${response.stop_reason}): ${parsed.error.message}`;
      if (response.stop_reason === 'max_tokens') break;
    }

    if (attempt < maxAttempts) {
      // eslint-disable-next-line no-console
      console.warn(
        `[generateStructured] ${schemaName} attempt ${attempt}/${maxAttempts} ${lastError.slice(0, 140)} — resampling`,
      );
    }
  }

  throw new Error(`Model output for ${schemaName} ${lastError} (after ${maxAttempts} attempts)`);
}
