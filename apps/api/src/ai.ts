import { createAnthropicClient } from '@pg/ai';
import { env } from './env';

export const anthropic = createAnthropicClient(env.ANTHROPIC_API_KEY);
