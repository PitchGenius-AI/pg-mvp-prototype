import Anthropic from '@anthropic-ai/sdk';

export type AnthropicClient = Anthropic;

export function createAnthropicClient(apiKey: string): AnthropicClient {
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required');
  return new Anthropic({ apiKey });
}
