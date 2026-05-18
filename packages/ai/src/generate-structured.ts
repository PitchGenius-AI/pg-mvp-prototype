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
}): Promise<z.infer<T>> {
  const { client, model, system, user, schema, schemaName, maxTokens = 4096 } = opts;

  const toolName = `emit_${schemaName}`;
  const inputSchema = zodToJsonSchema(schema, {
    target: 'openApi3',
    $refStrategy: 'none',
  }) as Record<string, unknown>;
  delete inputSchema.$schema;
  delete inputSchema.title;

  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
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
    throw new Error(`Model did not return a tool_use block for ${schemaName}`);
  }
  return schema.parse(block.input);
}
