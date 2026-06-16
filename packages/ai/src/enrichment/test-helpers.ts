// Shared test doubles for the enrichment pipeline. A fake AnthropicClient lets us
// assert the deterministic stage logic (index→source mapping, sorting, grounding
// passthrough, partial-failure tolerance) without any network or real LLM call.

import type { AnthropicClient } from '../client';
import type { EnrichLogger, ProviderResult, SearchProvider } from './types';

// Build a fake Anthropic client whose tool_use output is computed by `handler`
// from the requested tool name + user message. Throwing inside the handler
// simulates an LLM failure for that call.
export function fakeClient(
  handler: (toolName: string, userMessage: string) => unknown,
): AnthropicClient {
  const create = async (args: {
    tools: Array<{ name: string }>;
    messages: Array<{ content: string }>;
  }) => {
    const toolName = args.tools[0]!.name;
    const userMessage = args.messages[0]!.content;
    return {
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', input: handler(toolName, userMessage) }],
    };
  };
  return { messages: { create } } as unknown as AnthropicClient;
}

// A search provider that always succeeds with the given evidence.
export function okProvider(name: string, result: Partial<ProviderResult> = {}): SearchProvider {
  return {
    name,
    async search() {
      return {
        name,
        ok: true,
        error: null,
        answer: result.answer ?? null,
        results: result.results ?? [],
        images: result.images ?? [],
      };
    },
  };
}

// A provider whose search always throws (network/5xx) — exercises the fan-out's
// degrade-don't-fail behavior.
export function failingProvider(name: string): SearchProvider {
  return {
    name,
    async search() {
      throw new Error(`${name} exploded`);
    },
  };
}

export const silentLogger: EnrichLogger = {
  child: () => silentLogger,
  info: () => {},
  warn: () => {},
  error: () => {},
};
